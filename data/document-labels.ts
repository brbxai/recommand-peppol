import { transmittedDocumentLabels, transmittedDocuments, labels } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and } from "drizzle-orm";
import { UserFacingError } from "@peppol/utils/util";
import { getWebhooksByCompany, callWebhook } from "@peppol/data/webhooks";

export async function assignLabelToDocument(
  teamId: string,
  documentId: string,
  labelId: string
): Promise<void> {
  const document = await db
    .select({ id: transmittedDocuments.id, companyId: transmittedDocuments.companyId })
    .from(transmittedDocuments)
    .where(and(eq(transmittedDocuments.id, documentId), eq(transmittedDocuments.teamId, teamId)))
    .then((rows) => rows[0]);

  if (!document) {
    throw new UserFacingError("Document not found");
  }

  const label = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.teamId, teamId)))
    .then((rows) => rows[0]);

  if (!label) {
    throw new UserFacingError("Label not found");
  }

  const existing = await db
    .select()
    .from(transmittedDocumentLabels)
    .where(
      and(
        eq(transmittedDocumentLabels.transmittedDocumentId, documentId),
        eq(transmittedDocumentLabels.labelId, labelId)
      )
    )
    .then((rows) => rows[0]);

  if (existing) {
    return;
  }

  await db.insert(transmittedDocumentLabels).values({
    transmittedDocumentId: documentId,
    labelId: labelId,
  });

  try {
    const webhooks = await getWebhooksByCompany(teamId, document.companyId);
    for (const webhook of webhooks) {
      try {
        await callWebhook(webhook, {
          id: documentId,
          teamId: teamId,
          companyId: document.companyId,
        }, "document.label.assigned", { labelId });
      } catch (error) {
        console.error("Failed to call webhook:", error);
      }
    }
  } catch (error) {
    console.error("Failed to call webhooks:", error);
  }
}

export async function unassignLabelFromDocument(
  teamId: string,
  documentId: string,
  labelId: string
): Promise<void> {
  const document = await db
    .select({ id: transmittedDocuments.id, companyId: transmittedDocuments.companyId })
    .from(transmittedDocuments)
    .where(and(eq(transmittedDocuments.id, documentId), eq(transmittedDocuments.teamId, teamId)))
    .then((rows) => rows[0]);

  if (!document) {
    throw new UserFacingError("Document not found");
  }

  const label = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.teamId, teamId)))
    .then((rows) => rows[0]);

  if (!label) {
    throw new UserFacingError("Label not found");
  }

  await db
    .delete(transmittedDocumentLabels)
    .where(
      and(
        eq(transmittedDocumentLabels.transmittedDocumentId, documentId),
        eq(transmittedDocumentLabels.labelId, labelId)
      )
    );

  try {
    const webhooks = await getWebhooksByCompany(teamId, document.companyId);
    for (const webhook of webhooks) {
      try {
        await callWebhook(webhook, {
          id: documentId,
          teamId: teamId,
          companyId: document.companyId,
        }, "document.label.unassigned", { labelId });
      } catch (error) {
        console.error("Failed to call webhook:", error);
      }
    }
  } catch (error) {
    console.error("Failed to call webhooks:", error);
  }
}

export async function getDocumentLabels(
  teamId: string,
  documentId: string
) {
  const document = await db
    .select({ id: transmittedDocuments.id })
    .from(transmittedDocuments)
    .where(and(eq(transmittedDocuments.id, documentId), eq(transmittedDocuments.teamId, teamId)))
    .then((rows) => rows[0]);

  if (!document) {
    throw new UserFacingError("Document not found");
  }

  return await db
    .select({
      id: labels.id,
      teamId: labels.teamId,
      externalId: labels.externalId,
      name: labels.name,
      colorHex: labels.colorHex,
      createdAt: labels.createdAt,
      updatedAt: labels.updatedAt,
    })
    .from(transmittedDocumentLabels)
    .innerJoin(labels, eq(transmittedDocumentLabels.labelId, labels.id))
    .where(eq(transmittedDocumentLabels.transmittedDocumentId, documentId));
}

