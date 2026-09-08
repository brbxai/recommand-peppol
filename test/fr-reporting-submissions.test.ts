import { describe, expect, it, mock } from "bun:test";

// The scheduling and status rules are pure; the database is never touched here.
mock.module("@recommand/db", () => ({ db: {} }));
mock.module("@core/data/rules/events", () => ({ publishEvent: async () => {} }));

const { applyStatusReport, planNextStatusCheck, TERMINAL_REPORTING_STATUSES } = await import(
  "../data/fr-reporting-submissions"
);

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
  });
});
