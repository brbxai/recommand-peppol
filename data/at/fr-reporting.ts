import { z } from "zod";
import { fetchArratech, getArratechConfig } from "@peppol/data/at/client";
import type { FrenchReportingEnvironment } from "@peppol/data/fr-reporting-declarants";
import { getFrenchSiren } from "@peppol/utils/identifier-validation";
import type {
  FrenchB2BiBuyer,
  FrenchB2BiReport,
} from "@peppol/utils/parsing/b2bi-reporting/france";
import type { FrenchB2CReport } from "@peppol/utils/parsing/b2c-reporting/france";
import { isEuCountry } from "@peppol/utils/parsing/fr-reporting/shared";

/**
 * Every French e-reporting event is filed under the FR-F10 profile, as a single
 * atomic event rather than a finished report: Arratech determines the VAT period
 * and aggregates. The four sub-fluxes are the sales (10.1, 10.3) and payment
 * (10.2, 10.4) halves of the cross-border B2B and the B2C regimes.
 */
const FRENCH_REPORTING_PROFILE = "FR-F10";

/** The declarant files as the seller of the reported operations. */
const FRENCH_DECLARANT_ROLE = "SE";

/** The only "cadre de facturation" Arratech documents for a 10.1 event. */
const FRENCH_INVOICE_CADRE = "S1";

/**
 * The tax administration's own party codes. They are not ICD codes: an Italian
 * buyer is 0223, never 0211. The code decides what the company id must contain.
 */
const FRENCH_PARTY_SCHEME = {
  /** France: the SIREN. The VAT number goes in vatId. */
  france: "0002",
  /** EU outside France: the intra-community VAT number. */
  eu: "0223",
  /** Outside the EU: the ISO-2 country code followed by up to 16 characters of the name. */
  nonEu: "0227",
  /** Nouvelle-Calédonie: the RIDET. */
  ridet: "0228",
  /** Polynésie française: the TAHITI number. */
  tahiti: "0229",
} as const;

export type FrenchDeclarant = {
  siren: string;
  name: string;
  role: typeof FRENCH_DECLARANT_ROLE;
};

export type FrenchReportingParty = {
  companyId: string;
  schemeId: (typeof FRENCH_PARTY_SCHEME)[keyof typeof FRENCH_PARTY_SCHEME];
  vatId?: string;
  countryId: string;
};

/**
 * Builds the declarant block for a French filing from a company. Returns null when
 * the company has no usable SIREN, which the caller must reject.
 */
export function buildFrenchDeclarant(company: {
  name: string;
  enterpriseNumber: string | null;
}): FrenchDeclarant | null {
  const siren = getFrenchSiren(company.enterpriseNumber);
  if (!siren) {
    return null;
  }
  return { siren, name: company.name, role: FRENCH_DECLARANT_ROLE };
}

/**
 * The seller party a cross-border invoice event names, which is always the
 * declarant itself. Returns null when the company has no usable SIREN or no VAT
 * number, both of which a cross-border operation is reported under.
 */
export function buildFrenchSeller(company: {
  enterpriseNumber: string | null;
  vatNumber: string | null;
}): FrenchReportingParty | null {
  const siren = getFrenchSiren(company.enterpriseNumber);
  if (!siren || !company.vatNumber) {
    return null;
  }
  return {
    companyId: siren,
    schemeId: FRENCH_PARTY_SCHEME.france,
    vatId: company.vatNumber,
    countryId: "FR",
  };
}

/**
 * Maps a foreign buyer onto the tax administration's identity model. EU buyers are
 * identified by their VAT number, buyers outside the EU by a constructed id of
 * country code and name, and buyers in the French overseas collectivities by their
 * local registry number. French buyers never reach this function: their invoices
 * are exchanged, not reported.
 */
export function toFrenchReportingBuyer(buyer: FrenchB2BiBuyer): FrenchReportingParty {
  const country = buyer.country.toUpperCase();
  if (country === "NC" || country === "PF") {
    return {
      companyId: buyer.enterpriseNumber ?? "",
      schemeId: country === "NC" ? FRENCH_PARTY_SCHEME.ridet : FRENCH_PARTY_SCHEME.tahiti,
      ...(buyer.vatNumber ? { vatId: buyer.vatNumber } : {}),
      countryId: country,
    };
  }
  if (isEuCountry(country)) {
    const vatNumber = buyer.vatNumber ?? "";
    return {
      companyId: vatNumber,
      schemeId: FRENCH_PARTY_SCHEME.eu,
      vatId: vatNumber,
      countryId: country,
    };
  }
  return {
    companyId: `${country}${buyer.name.slice(0, 16)}`,
    schemeId: FRENCH_PARTY_SCHEME.nonEu,
    ...(buyer.vatNumber ? { vatId: buyer.vatNumber } : {}),
    countryId: country,
  };
}

/**
 * A correction resends under transmission type RE; a cancellation resends as a
 * CANCEL operation. Both name the event they act on through the payload's own
 * key (the day and category of a daily total, the number of an invoice), never
 * through the reference: the reference is the idempotency handle, and reusing it
 * would make the partner treat the call as a replay of the original event.
 */
const arratechActionByPublicAction = {
  submit: {
    transmissionType: "IN",
    operation: "SUBMIT",
  },
  correct: {
    transmissionType: "RE",
    operation: "SUBMIT",
  },
  cancel: {
    transmissionType: "IN",
    operation: "CANCEL",
  },
} as const;

type FrenchReportAction = keyof typeof arratechActionByPublicAction;

/**
 * The sub-flux and operation a report is filed as, for the record we keep of the
 * filing.
 */
export function describeFrenchReportEvent(report: FrenchB2CReport | FrenchB2BiReport): {
  subFlux: "10.1" | "10.2" | "10.3" | "10.4";
  operation: "SUBMIT" | "CANCEL";
  transmissionType: "IN" | "RE";
} {
  const subFlux =
    report.type === "invoice"
      ? "10.1"
      : report.type === "payment"
        ? "10.2"
        : report.type === "sales"
          ? "10.3"
          : "10.4";
  return { subFlux, ...arratechActionByPublicAction[report.action] };
}

/**
 * Wraps a sub-flux payload in the FR-F10 envelope every submission shares. The
 * environment is always named: the partner would otherwise resolve it from the
 * declarant registrations, and a test-intended event must never land in PROD.
 */
function toArratechFlow(
  report: { reference: string; action: FrenchReportAction },
  declarant: FrenchDeclarant,
  environment: FrenchReportingEnvironment,
  flow: { subFlux: string; payload: object },
) {
  return {
    profile: FRENCH_REPORTING_PROFILE,
    environment,
    event: {
      declarant,
      clientOperationRef: report.reference,
      ...arratechActionByPublicAction[report.action],
      subFlux: flow.subFlux,
      payload: flow.payload,
    },
  };
}

export function toArratechB2CFlow(
  input: FrenchB2CReport,
  declarant: FrenchDeclarant,
  environment: FrenchReportingEnvironment = "PROD",
) {
  if (input.type === "sales") {
    return toArratechFlow(input, declarant, environment, {
      subFlux: "10.3",
      payload: {
        date: input.date,
        currency: input.currency,
        categoryCode: input.category === "goods" ? "TLB1" : "TPS1",
        taxExclusiveAmount: input.taxExclusiveAmount,
        taxTotal: input.taxAmount,
        count: input.transactionCount,
        subTotals: input.vatBreakdown.map((subtotal) => ({
          taxPercent: subtotal.percentage,
          taxableAmount: subtotal.taxableAmount,
          taxTotal: subtotal.taxAmount,
        })),
      },
    });
  }

  return toArratechFlow(input, declarant, environment, {
    subFlux: "10.4",
    payload: {
      paymentDate: input.date,
      subTotals: input.vatBreakdown.map((subtotal) => ({
        taxPercent: subtotal.percentage,
        currencyCode: input.currency,
        amount: subtotal.amount,
      })),
    },
  });
}

export function toArratechB2BiFlow(
  input: FrenchB2BiReport,
  declarant: FrenchDeclarant,
  seller: FrenchReportingParty,
  environment: FrenchReportingEnvironment = "PROD",
) {
  if (input.type === "invoice") {
    return toArratechFlow(input, declarant, environment, {
      subFlux: "10.1",
      payload: {
        id: input.documentNumber,
        issueDate: input.issueDate,
        typeCode: input.documentType === "creditNote" ? "381" : "380",
        currencyCode: input.currency,
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
        cadre: FRENCH_INVOICE_CADRE,
        seller,
        buyer: toFrenchReportingBuyer(input.buyer),
        taxExclusiveAmount: input.taxExclusiveAmount,
        taxAmount: input.taxAmount,
        taxSubTotals: input.vatBreakdown.map((subtotal) => ({
          taxableAmount: subtotal.taxableAmount,
          taxAmount: subtotal.taxAmount,
          categoryCode: subtotal.category,
          percent: subtotal.percentage,
          ...(subtotal.exemptionReason
            ? { exemptionReason: subtotal.exemptionReason }
            : {}),
          ...(subtotal.exemptionReasonCode
            ? { exemptionReasonCode: subtotal.exemptionReasonCode }
            : {}),
        })),
      },
    });
  }

  return toArratechFlow(input, declarant, environment, {
    subFlux: "10.2",
    payload: {
      invoiceId: input.invoiceNumber,
      issueDate: input.issueDate,
      paymentDate: input.date,
      subTotals: input.vatBreakdown.map((subtotal) => ({
        taxPercent: subtotal.percentage,
        currencyCode: input.currency,
        amount: subtotal.amount,
      })),
    },
  });
}

/**
 * Where an event stands with the tax administration. `accepted` and
 * `pending_rectificative` are the two states an event can be accepted into; the
 * others are reached later and are terminal.
 */
export const frenchReportingStatuses = [
  "accepted",
  "pending_rectificative",
  "filed",
  "filed_rectificative",
  "superseded",
  "rejected",
] as const;
export type FrenchReportingStatus = (typeof frenchReportingStatuses)[number];

/** The partner's internal ledger state of an event. */
export const frenchReportingLedgerStatuses = [
  "ACCEPTED",
  "LATE",
  "SUPERSEDED",
  "TRANSMITTED",
  "TRANSMITTED_RE",
  "REJECTED",
] as const;

const arratechSubmissionResponseSchema = z
  .object({
    flowId: z.string().min(1),
    duplicate: z.boolean().default(false),
    status: z.enum(frenchReportingLedgerStatuses).nullish(),
    reportingStatus: z.enum(frenchReportingStatuses).nullish(),
  })
  .passthrough();

export type FrenchReportingSubmissionResult = {
  flowId: string;
  /** True when this reference was already on file and nothing new was filed. */
  duplicate: boolean;
  status: (typeof frenchReportingLedgerStatuses)[number] | null;
  reportingStatus: FrenchReportingStatus | null;
};

const arratechSubmissionStatusSchema = z
  .object({
    flowId: z.string(),
    declarantSiren: z.string(),
    clientOperationRef: z.string(),
    subFlux: z.string(),
    operation: z.string(),
    transmissionType: z.string(),
    status: z.enum(frenchReportingLedgerStatuses),
    reportingStatus: z.enum(frenchReportingStatuses),
    receivedAt: z.string(),
    operationDate: z.string().nullable(),
    periodStart: z.string().nullable(),
    periodEnd: z.string().nullable(),
    submissionId: z.string().nullable(),
    outcomeCode: z.string().nullable(),
    outcomeAt: z.string().nullable(),
  })
  .passthrough();

export type FrenchReportingSubmissionStatus = z.infer<typeof arratechSubmissionStatusSchema>;

/**
 * Why a submission did not go through, in the terms the API answers with:
 * `rejected` (the event itself is wrong), `unregistered` (the declarant is not
 * registered or enabled), `conflict` (the event contradicts what is on file, e.g. a
 * payment for an unknown invoice) or `unavailable` (retry later with the same
 * reference).
 */
export type FrenchReportingSubmissionErrorKind =
  | "rejected"
  | "unregistered"
  | "conflict"
  | "unavailable";

export class FrenchReportingSubmissionError extends Error {
  constructor(
    message: string,
    readonly kind: FrenchReportingSubmissionErrorKind,
    readonly status: number | null,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "FrenchReportingSubmissionError";
  }
}

function classifySubmissionStatus(status: number): FrenchReportingSubmissionErrorKind {
  if (status === 400 || status === 422) return "rejected";
  if (status === 403) return "unregistered";
  if (status === 409) return "conflict";
  return "unavailable";
}

async function readSubmissionError(response: Response): Promise<FrenchReportingSubmissionError> {
  const text = (await response.text()).slice(0, 1000);
  let code: string | null = null;
  let message = text || response.statusText;
  try {
    const json = JSON.parse(text) as { code?: string; error?: string; message?: string };
    code = json.code ?? null;
    message = json.error ?? json.message ?? message;
  } catch {
    // Not JSON: keep the raw text.
  }
  return new FrenchReportingSubmissionError(
    message,
    classifySubmissionStatus(response.status),
    response.status,
    code,
  );
}

async function reportingRequest(
  path: string,
  environment: FrenchReportingEnvironment,
  init: RequestInit,
): Promise<Response> {
  const useTestNetwork = environment === "TEST";
  const config = getArratechConfig(useTestNetwork);
  try {
    return await fetchArratech(`/orgs/${config.orgId}/tax-reporting/fr-f10${path}`, {
      ...init,
      useTestNetwork,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new FrenchReportingSubmissionError(
      `The reporting service could not be reached: ${error instanceof Error ? error.message : String(error)}`,
      "unavailable",
      null,
      null,
    );
  }
}

async function submitArratechFlow({
  flow,
  environment,
}: {
  flow: object;
  environment: FrenchReportingEnvironment;
}): Promise<FrenchReportingSubmissionResult> {
  const response = await reportingRequest("/submissions", environment, {
    method: "POST",
    body: JSON.stringify(flow),
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw await readSubmissionError(response);
  }

  const parsed = arratechSubmissionResponseSchema.parse(await response.json());
  return {
    flowId: parsed.flowId,
    // A 200 is the partner's answer to a replayed reference; a 202 is a new event.
    duplicate: parsed.duplicate || response.status === 200,
    status: parsed.status ?? null,
    reportingStatus: parsed.reportingStatus ?? null,
  };
}

export async function submitArratechB2CReport({
  input,
  declarant,
  environment,
}: {
  input: FrenchB2CReport;
  declarant: FrenchDeclarant;
  environment: FrenchReportingEnvironment;
}): Promise<FrenchReportingSubmissionResult> {
  return submitArratechFlow({
    flow: toArratechB2CFlow(input, declarant, environment),
    environment,
  });
}

export async function submitArratechB2BiReport({
  input,
  declarant,
  seller,
  environment,
}: {
  input: FrenchB2BiReport;
  declarant: FrenchDeclarant;
  seller: FrenchReportingParty;
  environment: FrenchReportingEnvironment;
}): Promise<FrenchReportingSubmissionResult> {
  return submitArratechFlow({
    flow: toArratechB2BiFlow(input, declarant, seller, environment),
    environment,
  });
}

/**
 * Reads where a submitted event stands, including the tax authority outcome once
 * the partner has reconciled it. Returns null when the partner has no such event.
 */
export async function getArratechSubmissionStatus({
  flowId,
  environment,
}: {
  flowId: string;
  environment: FrenchReportingEnvironment;
}): Promise<FrenchReportingSubmissionStatus | null> {
  const response = await reportingRequest(
    `/submissions/${encodeURIComponent(flowId)}`,
    environment,
    { method: "GET" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw await readSubmissionError(response);
  }
  return arratechSubmissionStatusSchema.parse(await response.json());
}
