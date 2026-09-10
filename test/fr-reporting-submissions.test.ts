import { describe, expect, it, mock } from "bun:test";

// The scheduling and status rules are pure; the database is never touched here.
mock.module("@recommand/db", () => ({ db: {} }));
mock.module("@core/data/rules/events", () => ({ publishEvent: async () => {} }));

const {
  applyStatusReport,
  operationalAlertKey,
  planNextStatusCheck,
  TERMINAL_REPORTING_STATUSES,
} = await import("../data/fr-reporting-submissions");
const { createAlertSuppressor } = await import("../utils/system-notifications/suppression");

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

describe("French reporting status polling", () => {
  it("looks an hour after filing when the period is not known yet", () => {
    const now = new Date("2026-09-08T10:00:00Z");
    const next = planNextStatusCheck(
      { reportingStatus: "accepted", periodEnd: null, simulated: false },
      now,
    );
    expect(next?.getTime()).toBe(now.getTime() + HOUR);
  });

  it("looks daily inside the period and every six hours after its cutoff", () => {
    const inside = new Date("2026-09-08T10:00:00Z");
    const next = planNextStatusCheck(
      { reportingStatus: "accepted", periodEnd: "2026-09-30", simulated: false },
      inside,
    );
    expect(next?.getTime()).toBe(inside.getTime() + DAY);

    const nearCutoff = new Date("2026-09-30T20:00:00Z");
    const soon = planNextStatusCheck(
      { reportingStatus: "accepted", periodEnd: "2026-09-30", simulated: false },
      nearCutoff,
    );
    // Never later than an hour past the cutoff.
    expect(soon?.toISOString()).toBe("2026-10-01T00:59:59.999Z");

    const after = new Date("2026-10-03T10:00:00Z");
    const later = planNextStatusCheck(
      { reportingStatus: "pending_rectificative", periodEnd: "2026-09-30", simulated: false },
      after,
    );
    expect(later?.getTime()).toBe(after.getTime() + 6 * HOUR);
  });

  it("stops looking at terminal, simulated and stale events", () => {
    const now = new Date("2026-12-01T10:00:00Z");
    for (const status of TERMINAL_REPORTING_STATUSES) {
      expect(
        planNextStatusCheck({ reportingStatus: status, periodEnd: "2026-09-30", simulated: false }, now),
      ).toBeNull();
    }
    expect(
      planNextStatusCheck({ reportingStatus: "accepted", periodEnd: null, simulated: true }, now),
    ).toBeNull();
    // Long after the cutoff an event that never became terminal is stale.
    expect(
      planNextStatusCheck({ reportingStatus: "accepted", periodEnd: "2026-09-30", simulated: false }, now),
    ).toBeNull();
  });

  it("records what the partner reports and notices when the status moved", () => {
    const now = new Date("2026-10-03T10:00:00Z");
    const report = {
      flowId: "flow-1",
      declarantSiren: "303265045",
      clientOperationRef: "SALES-2026-09-01-GOODS",
      subFlux: "10.3",
      operation: "SUBMIT" as const,
      transmissionType: "IN",
      status: "TRANSMITTED" as const,
      reportingStatus: "filed" as const,
      receivedAt: "2026-09-01T18:00:00Z",
      operationDate: "2026-09-01",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      submissionId: "sub-9",
      outcomeCode: "OK",
      outcomeAt: "2026-10-02T09:00:00Z",
    };

    const { patch, changed } = applyStatusReport(
      { reportingStatus: "accepted", simulated: false },
      report,
      now,
    );
    expect(changed).toBe(true);
    expect(patch).toMatchObject({
      ledgerStatus: "TRANSMITTED",
      reportingStatus: "filed",
      periodEnd: "2026-09-30",
      submissionId: "sub-9",
      outcomeCode: "OK",
      checkAttempts: 0,
      nextCheckAt: null,
    });
    expect(patch.receivedAt?.toISOString()).toBe("2026-09-01T18:00:00.000Z");

    const unchanged = applyStatusReport(
      { reportingStatus: "filed", simulated: false },
      report,
      now,
    );
    expect(unchanged.changed).toBe(false);
    expect(unchanged.unknownStatus).toBeNull();
  });

  it("keeps the status it knows when the service answers one it does not", () => {
    const now = new Date("2026-10-03T10:00:00Z");
    const report = {
      flowId: "flow-1",
      declarantSiren: "303265045",
      clientOperationRef: "SALES-2026-09-01-GOODS",
      subFlux: "10.3",
      operation: "SUBMIT",
      transmissionType: "IN",
      status: "AWAITING_SOMETHING_NEW",
      reportingStatus: "under_review_by_the_administration",
      receivedAt: "2026-09-01T18:00:00Z",
      operationDate: "2026-09-01",
      periodStart: "2026-09-01",
      // Long enough ago that the ordinary cadence would give up on the event.
      periodEnd: "2026-09-30",
      submissionId: "sub-9",
      outcomeCode: "300",
      outcomeAt: null,
    };

    const { patch, changed, unknownStatus } = applyStatusReport(
      { reportingStatus: "accepted", simulated: false },
      { ...report, periodEnd: "2026-06-30" },
      now,
    );

    // The event is not moved to a status this integration cannot reason about, and the
    // value is handed back so it can be reported rather than lost.
    expect(unknownStatus).toBe("under_review_by_the_administration");
    expect(changed).toBe(false);
    expect(patch.reportingStatus).toBe("accepted");
    // The raw ledger value is still kept as evidence of what was answered.
    expect(patch.ledgerStatus).toBe("AWAITING_SOMETHING_NEW");
    expect(patch.outcomeCode).toBe("300");
    // Polling continues on a fixed delay instead of the cadence of a status that is
    // not understood, which here would have stopped asking altogether.
    expect(patch.nextCheckAt).toEqual(new Date("2026-10-03T16:00:00Z"));

    // And it recovers on its own once a value it knows comes back.
    const recovered = applyStatusReport(
      { reportingStatus: "accepted", simulated: false },
      { ...report, reportingStatus: "filed", status: "TRANSMITTED" },
      now,
    );
    expect(recovered.unknownStatus).toBeNull();
    expect(recovered.changed).toBe(true);
    expect(recovered.patch.reportingStatus).toBe("filed");
    expect(recovered.patch.nextCheckAt).toBeNull();
  });
});

describe("Operational alerts about one filing", () => {
  const submission = {
    id: "frs_1",
    environment: "PROD" as const,
    companyId: "comp_1",
    submissionId: "sub-9",
    outcomeCode: "501",
  };

  it("recognises events of the same filing and outcome as one condition", () => {
    const sibling = { ...submission, id: "frs_2" };

    expect(operationalAlertKey("rejected", submission)).toBe(
      operationalAlertKey("rejected", sibling),
    );
    // A later outcome on the same filing is something else to hear about.
    expect(operationalAlertKey("rejected", { ...sibling, outcomeCode: "500" })).not.toBe(
      operationalAlertKey("rejected", submission),
    );
    // As is the same filing in the other environment, or another company's filing.
    expect(operationalAlertKey("rejected", { ...sibling, environment: "TEST" })).not.toBe(
      operationalAlertKey("rejected", submission),
    );
    expect(operationalAlertKey("rejected", { ...sibling, companyId: "comp_2" })).not.toBe(
      operationalAlertKey("rejected", submission),
    );
    // And a different condition on the same filing is not folded in either.
    expect(operationalAlertKey("stale", submission)).not.toBe(
      operationalAlertKey("rejected", submission),
    );
  });

  it("keeps events apart while there is no filing to group them by", () => {
    const first = { ...submission, submissionId: null };
    const second = { ...first, id: "frs_2" };

    expect(operationalAlertKey("stale", first)).not.toBe(operationalAlertKey("stale", second));
  });

  it("reports a condition once per interval and lets it through again afterwards", () => {
    const suppressor = createAlertSuppressor({ intervalMs: 6 * HOUR });
    const start = new Date("2026-10-03T10:00:00Z");
    const key = operationalAlertKey("rejected", submission);

    expect(suppressor.shouldSend(key, start)).toBe(true);
    expect(suppressor.shouldSend(key, start)).toBe(false);
    expect(suppressor.shouldSend(key, new Date(start.getTime() + 5 * HOUR))).toBe(false);
    // Another condition is never suppressed by an unrelated one.
    expect(suppressor.shouldSend(operationalAlertKey("stale", submission), start)).toBe(true);
    // The condition can be reported again once the interval has passed, so a lasting
    // problem does not fall silent for good.
    expect(suppressor.shouldSend(key, new Date(start.getTime() + 7 * HOUR))).toBe(true);
  });

  it("does not grow without bound when many conditions are reported", () => {
    const suppressor = createAlertSuppressor({ intervalMs: 6 * HOUR, maxEntries: 3 });
    const start = new Date("2026-10-03T10:00:00Z");

    for (let index = 0; index < 50; index += 1) {
      expect(suppressor.shouldSend(`key-${index}`, start)).toBe(true);
    }
    // The oldest keys were dropped to stay within the bound, so they are reported
    // again rather than suppressed for ever.
    expect(suppressor.shouldSend("key-0", start)).toBe(true);
    expect(suppressor.shouldSend("key-49", start)).toBe(false);
  });
});
