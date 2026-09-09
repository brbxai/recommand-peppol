import { writeAuditEvent } from "@core/lib/audit";
import { publishEvent } from "@core/data/rules/events";
import type { AccessPointProviderId } from "@peppol/data/peppol-providers";
import { providerDeliveryFailures, transmittedDocuments } from "@peppol/db/schema";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { db } from "@recommand/db";
import { and, eq, inArray, isNull } from "drizzle-orm";

export type ProviderDeliveryFailure = typeof providerDeliveryFailures.$inferSelect;

/** What the provider said went wrong, as its customer-facing error. */
export type DeliveryFailureError = {
  code: string;
  message: string;
  category: string;
};

/** A delivery failure as an access point reported it, before it is stored. */
export type ReportedDeliveryFailure = {
  accessPointProvider: AccessPointProviderId;
  apTransactionId: string;
  useTestNetwork: boolean;
  /** The provider's id and name for the webhook event, so a report can be traced back. */
  eventId: string;
  eventType: string;
  transactionStatus: string | null;
  docInstanceId: string | null;
  error: DeliveryFailureError | null;
  /** The event payload as reported. */
  payload: Record<string, unknown>;
};

/** The failure as a document's consumers see it. */
export type DeliveryFailureSummary = {
  code: string | null;
  message: string | null;
  category: string | null;
  transactionStatus: string | null;
  reportedAt: string;
};

export type DeliveryFailureOutcome =
  /** Attached to its document, which is now marked as failed. */
  | "attached"
  /** Stored; no document has been recorded for the transaction yet. */
  | "pending"
  /** Already attached: a retry of a report that was handled. */
  | "known";

/** The document a failure attaches to, as much of it as the failure event needs. */
export type OutgoingDocumentReference = {
  id: string;
  teamId: string;
  companyId: string;
  type: string;
  senderId: string;
  receiverId: string | null;
  envelopeId: string | null;
  apTransactionId: string;
};

export function toDeliveryFailureSummary(
  failure: ProviderDeliveryFailure
): DeliveryFailureSummary {
  return {
    code: failure.errorCode,
    message: failure.errorMessage,
    category: failure.errorCategory,
    transactionStatus: failure.transactionStatus,
    reportedAt: failure.reportedAt.toISOString(),
  };
}

async function findOutgoingDocument(
  apTransactionId: string
): Promise<OutgoingDocumentReference | undefined> {
  const [document] = await db
    .select({
      id: transmittedDocuments.id,
      teamId: transmittedDocuments.teamId,
      companyId: transmittedDocuments.companyId,
      type: transmittedDocuments.type,
      senderId: transmittedDocuments.senderId,
      receiverId: transmittedDocuments.receiverId,
      envelopeId: transmittedDocuments.envelopeId,
    })
    .from(transmittedDocuments)
    .where(
      and(
        eq(transmittedDocuments.apTransactionId, apTransactionId),
        eq(transmittedDocuments.direction, "outgoing")
      )
    )
    .limit(1);
  return document ? { ...document, apTransactionId } : undefined;
}

/**
 * Attaches the stored failure for the document's transaction to the document, and
 * tells the document's owner about it. The attach is a conditional update, so of two
 * callers seeing the same failure and document only one gets to attach it, and only
 * that one publishes the event: the customer hears about a failure exactly once.
 * Returns false when there is no failure for the transaction or it was attached
 * already.
 */
async function attachDeliveryFailure(
  document: OutgoingDocumentReference
): Promise<boolean> {
  const attached = await db.transaction(async (tx) => {
    const [failure] = await tx
      .update(providerDeliveryFailures)
      .set({ transmittedDocumentId: document.id, attachedAt: new Date() })
      .where(
        and(
          eq(providerDeliveryFailures.apTransactionId, document.apTransactionId),
          isNull(providerDeliveryFailures.transmittedDocumentId)
        )
      )
      .returning();
    if (!failure) {
      return null;
    }

    await publishEvent("peppol.document.delivery_failed.v1", {
      teamId: document.teamId,
      aggregateType: "peppol.document",
      aggregateId: document.id,
      idempotencyKey: `peppol.document.delivery_failed:${document.id}`,
      payload: {
        companyId: document.companyId,
        docType: document.type,
        senderId: document.senderId,
        receiverId: document.receiverId,
        envelopeId: document.envelopeId,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        errorCategory: failure.errorCategory,
        transactionStatus: failure.transactionStatus,
      },
      tx,
    });
    return failure;
  });
  if (!attached) {
    return false;
  }

  await writeAuditEvent({
    action: "update",
    subsystem: "peppol.documents",
    objectType: "peppol.document",
    objectId: document.id,
    teamId: document.teamId,
    reasonCode: "delivery_failed",
    metadata: {
      apTransactionId: document.apTransactionId,
      accessPointProvider: attached.accessPointProvider,
      transactionStatus: attached.transactionStatus,
      errorCode: attached.errorCode,
      errorCategory: attached.errorCategory,
    },
  });
  sendSystemAlert(
    "Document Delivery Failed",
    `The access point reported that document ${document.id} (transaction ${document.apTransactionId}) failed after it was accepted.\n` +
      `${attached.errorCode ?? "no code"} ${attached.errorCategory ?? ""}: ${attached.errorMessage ?? "no error details"}`,
    "warning"
  );
  return true;
}

/**
 * Stores a failure an access point reported for a transaction it had accepted, and
 * attaches it to the transaction's document when that document has been recorded.
 *
 * The provider retries a report it could not deliver, so the same failure may arrive
 * more than once: the row is keyed by the transaction and a repeat changes nothing.
 * The report can also arrive before our own send has recorded its document, in which
 * case the failure waits here and is attached by recordOutgoingDocument. Nothing is
 * resent: the document's owner is told and decides what to do.
 */
export async function recordProviderDeliveryFailure(
  failure: ReportedDeliveryFailure
): Promise<DeliveryFailureOutcome> {
  await db
    .insert(providerDeliveryFailures)
    .values({
      apTransactionId: failure.apTransactionId,
      accessPointProvider: failure.accessPointProvider,
      useTestNetwork: failure.useTestNetwork,
      eventId: failure.eventId,
      eventType: failure.eventType,
      transactionStatus: failure.transactionStatus,
      errorCode: failure.error?.code ?? null,
      errorMessage: failure.error?.message ?? null,
      errorCategory: failure.error?.category ?? null,
      docInstanceId: failure.docInstanceId,
      payload: failure.payload,
    })
    .onConflictDoNothing();

  // Looked up after the insert, whether or not the insert wrote anything: a document
  // recorded in between is found here, and a retry of a report whose first delivery
  // stored the row but failed before attaching it completes the attach now.
  const document = await findOutgoingDocument(failure.apTransactionId);
  if (!document) {
    sendSystemAlert(
      "Delivery Failure For Unrecorded Transaction",
      `The access point reported a failed transaction ${failure.apTransactionId} that no outgoing document has been recorded for yet. ` +
        `It is attached once the document is recorded.\n` +
        `${failure.error?.code ?? "no code"} ${failure.error?.category ?? ""}: ${failure.error?.message ?? "no error details"}`,
      "warning"
    );
    return "pending";
  }

  return (await attachDeliveryFailure(document)) ? "attached" : "known";
}

/**
 * Attaches to a freshly recorded document the failure its access point reported
 * before the document existed. Returns whether there was one.
 */
export async function attachPendingDeliveryFailure(
  document: OutgoingDocumentReference
): Promise<boolean> {
  return await attachDeliveryFailure(document);
}

/**
 * Adds to each document the delivery failure its access point reported, or null when
 * none was. Incoming documents never have one and are not looked up.
 */
export async function withDeliveryFailure<
  T extends { id: string; direction: "incoming" | "outgoing" },
>(documents: T[]): Promise<(T & { deliveryFailure: DeliveryFailureSummary | null })[]> {
  const outgoingIds = documents
    .filter((document) => document.direction === "outgoing")
    .map((document) => document.id);
  const failures = outgoingIds.length
    ? await db
        .select()
        .from(providerDeliveryFailures)
        .where(inArray(providerDeliveryFailures.transmittedDocumentId, outgoingIds))
    : [];
  const byDocument = new Map(
    failures.map((failure) => [failure.transmittedDocumentId, failure])
  );
  return documents.map((document) => {
    const failure = byDocument.get(document.id);
    return {
      ...document,
      deliveryFailure: failure ? toDeliveryFailureSummary(failure) : null,
    };
  });
}
