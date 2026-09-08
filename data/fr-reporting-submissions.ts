import { publishEvent } from "@core/data/rules/events";
import { db } from "@recommand/db";
import type { Logger } from "@recommand/lib/logger";
import { Cron } from "croner";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import {
  FrenchReportingSubmissionError,
  getArratechSubmissionStatus,
  type FrenchReportingStatus,
  type FrenchReportingSubmissionStatus,
} from "@peppol/data/at/fr-reporting";
import type { FrenchReportingEnvironment } from "@peppol/data/fr-reporting-declarants";
import { frReportingSubmissions, transmittedDocuments } from "@peppol/db/schema";
import { isUniqueViolation } from "@peppol/utils/db-errors";
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
 */
export function applyStatusReport(
  submission: Pick<FrenchReportingSubmission, "reportingStatus" | "simulated">,
  report: FrenchReportingSubmissionStatus,
  now: Date = new Date(),
): {
  patch: Partial<typeof frReportingSubmissions.$inferInsert>;
  changed: boolean;
} {
  const changed = report.reportingStatus !== submission.reportingStatus;
  return {
    changed,
    patch: {
      ledgerStatus: report.status,
      reportingStatus: report.reportingStatus,
      receivedAt: toDate(report.receivedAt),
      operationDate: report.operationDate,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      submissionId: report.submissionId,
      outcomeCode: report.outcomeCode,
      outcomeAt: toDate(report.outcomeAt),
      lastCheckedAt: now,
      checkAttempts: 0,
      nextCheckAt: planNextStatusCheck(
        {
          reportingStatus: report.reportingStatus,
          periodEnd: report.periodEnd,
          simulated: submission.simulated,
        },
        now,
      ),
    },
  };
}

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

  const { patch, changed } = applyStatusReport(submission, report, now);
  const updated = await db
    .update(frReportingSubmissions)
    .set(patch)
    .where(eq(frReportingSubmissions.id, id))
    .returning()
    .then((rows) => rows[0]);
  if (!updated) {
    return;
  }

  if (updated.nextCheckAt === null && !TERMINAL_REPORTING_STATUSES.has(updated.reportingStatus)) {
    sendSystemAlert(
      "French Reporting Event Stale",
      `E-reporting event ${updated.flowId} (reference ${updated.reference}, company ${updated.companyId}) is still ${updated.reportingStatus} long after its period ended on ${updated.periodEnd}. Ask Arratech what happened to it.`,
      "warning",
    );
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

  if (updated.reportingStatus === "rejected") {
    sendSystemAlert(
      "French Reporting Event Rejected",
      `The tax administration rejected e-reporting event ${updated.flowId} (reference ${updated.reference}, company ${updated.companyId}, period ending ${updated.periodEnd}). Outcome code: ${updated.outcomeCode ?? "unknown"}. The customer needs help correcting it.`,
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
