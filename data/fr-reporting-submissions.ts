import { publishEvent } from "@core/data/rules/events";
import { db } from "@recommand/db";
import type { Logger } from "@recommand/lib/logger";
import { Cron } from "croner";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import {
  describeFrenchReportEvent,
  FrenchReportingSubmissionError,
  getArratechSubmissionStatus,
  toKnownReportingStatus,
  type FrenchReportingStatus,
  type FrenchReportingSubmissionStatus,
} from "@peppol/data/at/fr-reporting";
import type { FrenchReportingEnvironment } from "@peppol/data/fr-reporting-declarants";
import { frReportingSubmissions, transmittedDocuments } from "@peppol/db/schema";
import { isUniqueViolation } from "@peppol/utils/db-errors";
import { readStoredFrenchReport } from "@peppol/utils/parsing/fr-reporting/duplicates";
import { createAlertSuppressor } from "@peppol/utils/system-notifications/suppression";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { isReportingDocumentTypeKey } from "@peppol/utils/type-repository/document-types/keys";

export type FrenchReportingSubmission = typeof frReportingSubmissions.$inferSelect;

export const TERMINAL_REPORTING_STATUSES: ReadonlySet<FrenchReportingStatus> = new Set([
  "filed",
  "filed_rectificative",
  "superseded",
  "rejected",
]);

/** How long after its period's cutoff an event is still expected to reach a filing. */
const STALE_AFTER_PERIOD_END_DAYS = 45;
/** How long to wait before asking again about an event whose status is not understood. */
const UNKNOWN_STATUS_RETRY_HOURS = 6;
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

/**
 * The public view of where a filed report stands. Exposed on the document it was
 * filed as; the flow id itself stays internal.
 */
export type FrenchReportingStatusSummary = {
  reportingStatus: FrenchReportingStatus;
  receivedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  submissionId: string | null;
  outcomeCode: string | null;
  outcomeAt: string | null;
  checkedAt: string | null;
  simulated: boolean;
};

export function toFrenchReportingStatusSummary(
  submission: FrenchReportingSubmission,
): FrenchReportingStatusSummary {
  return {
    reportingStatus: submission.reportingStatus,
    receivedAt: submission.receivedAt?.toISOString() ?? null,
    periodStart: submission.periodStart,
    periodEnd: submission.periodEnd,
    submissionId: submission.submissionId,
    outcomeCode: submission.outcomeCode,
    outcomeAt: submission.outcomeAt?.toISOString() ?? null,
    checkedAt: submission.lastCheckedAt?.toISOString() ?? null,
    simulated: submission.simulated,
  };
}

/**
 * When to look at an event again. Kept pure so the cadence can be tested.
 *
 * Until the partner has placed the event in a period, the first look comes an hour
 * after filing. Inside the period nothing changes until the cutoff, so one look a
 * day is enough. After the cutoff the filing can happen at any moment, so every six
 * hours; and an event still not terminal long after its cutoff is stale and stops
 * being polled.
 */
export function planNextStatusCheck(
  submission: Pick<FrenchReportingSubmission, "reportingStatus" | "periodEnd" | "simulated">,
  now: Date = new Date(),
): Date | null {
  if (submission.simulated || TERMINAL_REPORTING_STATUSES.has(submission.reportingStatus)) {
    return null;
  }
  if (!submission.periodEnd) {
    return new Date(now.getTime() + HOUR);
  }
  // The cutoff is the end of the period's last day.
  const cutoff = new Date(`${submission.periodEnd}T23:59:59.999Z`);
  if (Number.isNaN(cutoff.getTime())) {
    return new Date(now.getTime() + DAY);
  }
  if (now < cutoff) {
    return new Date(Math.min(cutoff.getTime() + HOUR, now.getTime() + DAY));
  }
  if (now.getTime() - cutoff.getTime() > STALE_AFTER_PERIOD_END_DAYS * DAY) {
    return null;
  }
  return new Date(now.getTime() + 6 * HOUR);
}

/**
 * Records the event a report was filed as, right after its document. A duplicate
 * flow id means the same filing was recorded before, which is fine: the retry that
 * produced it already resolved to the same document.
 */
export async function recordFrenchReportingSubmission(input: {
  transmittedDocumentId: string;
  declarantId: string | null;
  teamId: string;
  companyId: string;
  environment: FrenchReportingEnvironment;
  flowId: string;
  reference: string;
  subFlux: string;
  operation: "SUBMIT" | "CANCEL";
  transmissionType: "IN" | "RE";
  simulated: boolean;
  ledgerStatus: string | null;
  reportingStatus: FrenchReportingStatus | null;
}): Promise<void> {
  const reportingStatus = input.reportingStatus ?? "accepted";
  const now = new Date();
  try {
    await db.insert(frReportingSubmissions).values({
      transmittedDocumentId: input.transmittedDocumentId,
      declarantId: input.declarantId,
      teamId: input.teamId,
      companyId: input.companyId,
      environment: input.environment,
      flowId: input.flowId,
      reference: input.reference,
      subFlux: input.subFlux,
      operation: input.operation,
      transmissionType: input.transmissionType,
      simulated: input.simulated,
      ledgerStatus: input.ledgerStatus,
      reportingStatus,
      receivedAt: now,
      nextCheckAt: planNextStatusCheck(
        { reportingStatus, periodEnd: null, simulated: input.simulated },
        now,
      ),
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }
}

export async function getFrenchReportingSubmissionByDocument(
  transmittedDocumentId: string,
): Promise<FrenchReportingSubmission | undefined> {
  return await db
    .select()
    .from(frReportingSubmissions)
    .where(eq(frReportingSubmissions.transmittedDocumentId, transmittedDocumentId))
    .then((rows) => rows[0]);
}

/**
 * What a report needs to be followed, apart from what its own document already says.
 * The event it was filed as is read back from the stored report rather than from the
 * request at hand, because the two are only the same request when it is a retry.
 */
export type FrenchReportingSubmissionRecordInput = {
  transmittedDocumentId: string;
  /** The report as it was stored on the document, which is what was filed. */
  storedReport: unknown;
  declarantId: string | null;
  teamId: string;
  companyId: string;
  environment: FrenchReportingEnvironment;
  flowId: string;
  simulated: boolean;
  ledgerStatus: string | null;
  reportingStatus: FrenchReportingStatus | null;
};

export type FrenchReportingSubmissionRecordOutcome =
  | "present"
  | "repaired"
  | "unrecoverable";

export type FrenchReportingSubmissionRecordDependencies = {
  findByDocument: (
    transmittedDocumentId: string,
  ) => Promise<FrenchReportingSubmission | undefined>;
  record: typeof recordFrenchReportingSubmission;
  alert: typeof sendSystemAlert;
};

const defaultRecordDependencies: FrenchReportingSubmissionRecordDependencies = {
  findByDocument: getFrenchReportingSubmissionByDocument,
  record: recordFrenchReportingSubmission,
  alert: sendSystemAlert,
};

/**
 * Makes sure a report that was filed is also followed here. A report is recorded
 * right after its document, and the two are written separately: when the second write
 * fails, the report is filed and its document exists, but nothing polls it. The next
 * retry of the same reference lands on the existing document, and that is where this
 * repairs the missing record.
 *
 * Only what the earlier filing itself says is used. The reference and the event it was
 * filed as come from the stored report, never from the request that happens to be
 * retrying, so a reference reused for something else cannot rewrite history. When the
 * stored report cannot be read, nothing is invented and support is told.
 */
export async function ensureFrenchReportingSubmissionRecord(
  input: FrenchReportingSubmissionRecordInput,
  dependencies: Partial<FrenchReportingSubmissionRecordDependencies> = {},
): Promise<FrenchReportingSubmissionRecordOutcome> {
  const { findByDocument, record, alert } = {
    ...defaultRecordDependencies,
    ...dependencies,
  };

  if (await findByDocument(input.transmittedDocumentId)) {
    return "present";
  }

  const filed = readStoredFrenchReport(input.storedReport);
  if (!filed) {
    alert(
      "French Reporting Record Missing",
      `E-reporting event ${input.flowId} (company ${input.companyId}) has a document but no record to follow it by, and the stored report could not be read back to rebuild one. Its status will not be followed until support restores the record.`,
      "error",
    );
    return "unrecoverable";
  }

  await record({
    transmittedDocumentId: input.transmittedDocumentId,
    declarantId: input.declarantId,
    teamId: input.teamId,
    companyId: input.companyId,
    environment: input.environment,
    flowId: input.flowId,
    reference: filed.reference,
    ...describeFrenchReportEvent(filed),
    simulated: input.simulated,
    ledgerStatus: input.ledgerStatus,
    reportingStatus: input.reportingStatus,
  });
  return "repaired";
}

/**
 * Attaches the reporting status to the documents that are filed reports. Other
 * documents get null, so the field is always present on the API shape.
 */
export async function withFrenchReportingStatus<T extends { id: string; type: string }>(
  documents: T[],
): Promise<(T & { reporting: FrenchReportingStatusSummary | null })[]> {
  const reportIds = documents
    .filter((document) => isReportingDocumentTypeKey(document.type))
    .map((document) => document.id);
  const submissions = reportIds.length
    ? await db
        .select()
        .from(frReportingSubmissions)
        .where(inArray(frReportingSubmissions.transmittedDocumentId, reportIds))
    : [];
  const byDocument = new Map(
    submissions.map((submission) => [submission.transmittedDocumentId, submission]),
  );
  return documents.map((document) => {
    const submission = byDocument.get(document.id);
    return {
      ...document,
      reporting: submission ? toFrenchReportingStatusSummary(submission) : null,
    };
  });
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Applies what the partner reports about an event. Returns the row patch and
 * whether the reporting status moved, which is what the customer is told about.
 *
 * A status this integration does not know is not progress. The event keeps the status
 * it had, so an unfamiliar value can never quietly retire an event or present it as
 * filed, and `unknownStatus` carries the value on so it can be looked into. Such an
 * event is looked at again on a fixed delay instead of on the normal cadence: the
 * cadence is derived from a status, and the status is exactly what is not understood,
 * so applying it could stop the event from being followed at all. Everything else the
 * report says, including the raw ledger value, is still recorded.
 */
export function applyStatusReport(
  submission: Pick<FrenchReportingSubmission, "reportingStatus" | "simulated">,
  report: FrenchReportingSubmissionStatus,
  now: Date = new Date(),
): {
  patch: Partial<typeof frReportingSubmissions.$inferInsert>;
  changed: boolean;
  unknownStatus: string | null;
} {
  const known = toKnownReportingStatus(report.reportingStatus);
  const reportingStatus = known ?? submission.reportingStatus;
  const changed = reportingStatus !== submission.reportingStatus;
  return {
    changed,
    unknownStatus: known ? null : report.reportingStatus,
    patch: {
      ledgerStatus: report.status,
      reportingStatus,
      receivedAt: toDate(report.receivedAt),
      operationDate: report.operationDate,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      submissionId: report.submissionId,
      outcomeCode: report.outcomeCode,
      outcomeAt: toDate(report.outcomeAt),
      lastCheckedAt: now,
      checkAttempts: 0,
      nextCheckAt: known
        ? planNextStatusCheck(
            {
              reportingStatus,
              periodEnd: report.periodEnd,
              simulated: submission.simulated,
            },
            now,
          )
        : submission.simulated
          ? null
          : new Date(now.getTime() + UNKNOWN_STATUS_RETRY_HOURS * HOUR),
    },
  };
}

/**
 * How the same operational condition is recognised across the events it reaches. One
 * answer about a filing reaches every event that filing carries, so the filing is what
 * a message is about. Until a filing exists there is nothing to group by and the event
 * speaks for itself, which is what keeps unrelated filings apart.
 */
export function operationalAlertKey(
  kind: string,
  submission: Pick<
    FrenchReportingSubmission,
    "id" | "environment" | "companyId" | "submissionId" | "outcomeCode"
  >,
): string {
  const subject = submission.submissionId
    ? `deposit:${submission.submissionId}:${submission.outcomeCode ?? "no-outcome"}`
    : `event:${submission.id}`;
  return `${kind}:${submission.environment}:${submission.companyId}:${subject}`;
}

/**
 * Repeated operational alerts are thinned out per process (see the suppressor). It
 * reduces noise; it does not promise a single message across instances or restarts.
 */
const operationalAlerts = createAlertSuppressor({ intervalMs: 6 * HOUR });

async function publishStatusChange(
  submission: FrenchReportingSubmission,
  previous: FrenchReportingStatus,
  docType: string,
): Promise<void> {
  await publishEvent("peppol.document.reporting_status.v1", {
    teamId: submission.teamId,
    aggregateType: "peppol.document",
    aggregateId: submission.transmittedDocumentId,
    idempotencyKey: `peppol.document.reporting_status:${submission.id}:${submission.reportingStatus}`,
    payload: {
      companyId: submission.companyId,
      docType,
      reportingStatus: submission.reportingStatus,
      previousReportingStatus: previous,
      periodEnd: submission.periodEnd,
      submissionId: submission.submissionId,
      outcomeCode: submission.outcomeCode,
    },
  });
}

/**
 * Looks one event up at the partner and records what it learns. A status change is
 * published as an event; a rejection is also brought to support, because the
 * customer will need help understanding the tax authority's outcome code.
 */
export async function refreshFrenchReportingSubmission(
  id: string,
  logger: Pick<Logger, "info" | "warn" | "error"> = console,
): Promise<void> {
  const submission = await db
    .select()
    .from(frReportingSubmissions)
    .where(eq(frReportingSubmissions.id, id))
    .then((rows) => rows[0]);
  if (!submission || submission.simulated || !submission.nextCheckAt) {
    return;
  }

  const now = new Date();
  let report: FrenchReportingSubmissionStatus | null;
  try {
    report = await getArratechSubmissionStatus({
      flowId: submission.flowId,
      environment: submission.environment,
    });
  } catch (error) {
    const attempts = submission.checkAttempts + 1;
    const unavailable =
      error instanceof FrenchReportingSubmissionError && error.kind === "unavailable";
    const delay = unavailable ? Math.min(6 * HOUR, 15 * 60_000 * 2 ** Math.min(attempts, 4)) : DAY;
    await db
      .update(frReportingSubmissions)
      .set({
        checkAttempts: attempts,
        lastCheckedAt: now,
        nextCheckAt: new Date(now.getTime() + delay),
      })
      .where(eq(frReportingSubmissions.id, id));
    logger.warn(
      `French reporting status check for ${submission.flowId} failed (attempt ${attempts}): ${error instanceof Error ? error.message : String(error)}`,
    );
    // An answer that cannot be read at all is not a temporary outage: it repeats on
    // every retry, and an answer this integration cannot read is rarely about one
    // event. It is reported per environment rather than per event, so a change on the
    // other side is one message and not one per event that ran into it.
    if (!unavailable && operationalAlerts.shouldSend(`unreadable:${submission.environment}`, now)) {
      sendSystemAlert(
        "French Reporting Status Unreadable",
        `The status of e-reporting event ${submission.flowId} (company ${submission.companyId}) could not be read: ${error instanceof Error ? error.message : String(error)}. Other events may be running into the same answer. They are all still being polled; their status is not moving until this is understood.`,
        "warning",
      );
    }
    return;
  }

  if (!report) {
    // The partner does not know the event any more. Nothing can be learned; stop
    // asking and let support decide what happened.
    await db
      .update(frReportingSubmissions)
      .set({ lastCheckedAt: now, nextCheckAt: null })
      .where(eq(frReportingSubmissions.id, id));
    sendSystemAlert(
      "French Reporting Event Missing",
      `Arratech no longer knows e-reporting event ${submission.flowId} (reference ${submission.reference}, company ${submission.companyId}). Its status can no longer be followed.`,
      "warning",
    );
    return;
  }

  const { patch, changed, unknownStatus } = applyStatusReport(submission, report, now);
  const updated = await db
    .update(frReportingSubmissions)
    .set(patch)
    .where(eq(frReportingSubmissions.id, id))
    .returning()
    .then((rows) => rows[0]);
  if (!updated) {
    return;
  }

  if (unknownStatus) {
    logger.warn(
      `French reporting event ${updated.flowId} came back with reporting status "${unknownStatus}", which this integration does not know; it keeps status ${updated.reportingStatus} and stays under review`,
    );
    // A status this integration does not know is about the vocabulary rather than
    // about one event, so it is reported per value and not per event that meets it.
    if (
      operationalAlerts.shouldSend(`vocabulary:${updated.environment}:${unknownStatus}`, now)
    ) {
      sendSystemAlert(
        "French Reporting Status Not Recognised",
        `E-reporting event ${updated.flowId} (company ${updated.companyId}) came back with reporting status "${unknownStatus}", which this integration does not know. Events keep the status they had and are still being polled, so nothing is lost, but the status list needs to be checked against the reporting service.`,
        "warning",
      );
    }
  }

  if (updated.nextCheckAt === null && !TERMINAL_REPORTING_STATUSES.has(updated.reportingStatus)) {
    if (operationalAlerts.shouldSend(operationalAlertKey("stale", updated), now)) {
      sendSystemAlert(
        "French Reporting Event Stale",
        `E-reporting event ${updated.flowId} (reference ${updated.reference}, company ${updated.companyId}) is still ${updated.reportingStatus} long after its period ended on ${updated.periodEnd}. Ask the reporting service what happened to it.`,
        "warning",
      );
    }
  }

  if (!changed) {
    return;
  }
  logger.info(
    `French reporting event ${updated.flowId} moved from ${submission.reportingStatus} to ${updated.reportingStatus}`,
  );

  const document = await db
    .select({ type: transmittedDocuments.type })
    .from(transmittedDocuments)
    .where(eq(transmittedDocuments.id, updated.transmittedDocumentId))
    .then((rows) => rows[0]);
  try {
    await publishStatusChange(updated, submission.reportingStatus, document?.type ?? "unknown");
  } catch (error) {
    logger.error(
      `Could not publish reporting status change for ${updated.flowId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // The outcome is the filing's, so every event that filing carries turns rejected at
  // the same moment. Support hears about the filing rather than about each event.
  if (
    updated.reportingStatus === "rejected" &&
    operationalAlerts.shouldSend(operationalAlertKey("rejected", updated), now)
  ) {
    sendSystemAlert(
      "French Reporting Filing Rejected",
      `The tax administration rejected the filing carrying e-reporting event ${updated.flowId} (reference ${updated.reference}, company ${updated.companyId}, period ending ${updated.periodEnd}${updated.submissionId ? `, filing ${updated.submissionId}` : ""}). Outcome code: ${updated.outcomeCode ?? "unknown"}. Every event on the same filing carries this outcome, so check what the customer has to correct for that period.`,
      "error",
    );
  }
}

export function initializeFrenchReportingStatusCron(logger: Logger): void {
  if (process.env.RUN_CRON !== "true") {
    return;
  }

  new Cron(
    "*/5 * * * *",
    {
      name: "peppol.fr-reporting-status",
      protect: () =>
        logger.warn("Skipping peppol.fr-reporting-status tick: previous batch still running"),
    },
    async () => {
      try {
        const due = await db
          .select({ id: frReportingSubmissions.id })
          .from(frReportingSubmissions)
          .where(
            and(
              eq(frReportingSubmissions.simulated, false),
              isNotNull(frReportingSubmissions.nextCheckAt),
              lte(frReportingSubmissions.nextCheckAt, new Date()),
            ),
          )
          .orderBy(frReportingSubmissions.nextCheckAt)
          .limit(50);
        for (const { id } of due) {
          try {
            await refreshFrenchReportingSubmission(id, logger);
          } catch (error) {
            logger.error(
              `French reporting status refresh ${id}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      } catch (error) {
        logger.error(
          `French reporting status worker failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  logger.info("French reporting status cron job initialized");
}
