import type {
  AuthenticatedTeamContext,
  AuthenticatedUserContext,
} from "@core/lib/auth-middleware";
import {
  describeErrorResponse,
  describeSuccessResponseWithZod,
  describeValidationErrorResponse,
} from "@core/lib/api-docs";
import { audit } from "@core/lib/audit";
import {
  buildFrenchDeclarant,
  buildFrenchSeller,
  describeFrenchReportEvent,
  FrenchReportingSubmissionError,
  submitArratechB2BiReport,
  submitArratechB2CReport,
  type FrenchReportingSubmissionResult,
} from "@peppol/data/at/fr-reporting";
import { getSendingCompanyIdentifier } from "@peppol/data/company-identifiers";
import {
  getReadyFrenchReportingDeclarant,
  isFrenchReportingSimulated,
  resolveFrenchReportingEnvironment,
  type FrenchReportingDeclarant,
} from "@peppol/data/fr-reporting-declarants";
import { recordFrenchReportingSubmission } from "@peppol/data/fr-reporting-submissions";
import { recordOutgoingDocument } from "@peppol/data/record-outgoing-document";
import { findOutgoingDocumentByExternalReference } from "@peppol/data/transmitted-documents";
import {
  requireCompanyVerificationForStrictTeams,
  requireIntegrationSupportedCompanyAccess,
  requireValidSubscription,
  type CompanyAccessContext,
} from "@peppol/utils/auth-middleware";
import {
  frenchB2BiReportSchema,
  getFrenchB2BiReportDocumentProfile,
  type FrenchB2BiReport,
} from "@peppol/utils/parsing/b2bi-reporting/france";
import {
  frenchB2CReportSchema,
  getFrenchB2CReportDocumentProfile,
  type FrenchB2CReport,
} from "@peppol/utils/parsing/b2c-reporting/france";
import type { ReportingDocumentTypeKey } from "@peppol/utils/type-repository/document-types/types";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { zodValidator } from "@recommand/lib/zod-validator";
import { createHash } from "node:crypto";
import { describeRoute } from "hono-openapi";
import { ulid } from "ulid";
import { z } from "zod";

const server = new Server();

const frenchReportResponseSchema = z.object({
  id: z.string().openapi({
    description:
      "The identifier of the document this report was recorded as. Pass it to the get document endpoint to follow the report's `reporting` block until it is filed.",
  }),
  duplicate: z.boolean().openapi({
    description:
      "True when this reference was already filed, in which case the identifier of the existing report is returned and nothing was filed again.",
  }),
});

const referenceGuidance = `Choose a new, unique \`reference\` for every report, including corrections and cancellations. Retrying the exact same request with the same reference is safe: it returns the report filed the first time instead of filing a second one. A correction or cancellation acts on the report identified by the data in the request (the day and category of a daily total, or the document number of an invoice) and carries the optional \`action\` field.`;

const registrationGuidance = `The company must be registered for French e-reporting first, through \`PUT /:companyId/reporting/fr/declarant\`. Reports for playground and test-network teams are recorded but not filed.`;

const b2cRouteDescription = describeRoute({
  operationId: "submitFrenchB2CReport",
  summary: "Submit a French B2C report",
  tags: ["Reporting"],
  description: `Submit French daily sales or payment totals for transactions with private individuals. You do not need to create or submit a regulatory file yourself.

Use a sales report for the normal daily transaction totals, regardless of when customers pay. This endpoint accepts one sales summary per day, category and currency. The current integration supports taxable goods and taxable services.

Use a payment report only as an additional report for services using cash-basis VAT (\`TVA sur les encaissements\`), where VAT becomes due when the customer pays. Submit the sales report as usual, then submit the payment report for the day payment is received. Payment reports are only accepted for companies registered with VAT due on payment.

${registrationGuidance}

${referenceGuidance}

A submitted report is recorded alongside your sent documents and counts towards your document quota.`,
  responses: {
    ...describeSuccessResponseWithZod(
      "The report was accepted for processing",
      frenchReportResponseSchema
    ),
    ...describeValidationErrorResponse(
      "Invalid reporting data; the company is not registered for e-reporting, its registration is not yet registered, or it is suspended; the company is not registered in France or lacks the identifiers a report needs; a payment report was sent for a company whose VAT is due on invoicing; or the reporting service refused the report.",
    ),
    ...describeErrorResponse(409, "The report conflicts with what was filed before"),
    ...describeErrorResponse(
      502,
      "The reporting service could not accept the report; retry with the same reference"
    ),
  },
});

const b2biRouteDescription = describeRoute({
  operationId: "submitFrenchB2BiReport",
  summary: "Submit a French cross-border report",
  tags: ["Reporting"],
  description: `Submit a French e-reporting declaration for an operation with a business established outside France. These invoices are not exchanged over the French e-invoicing network, so their data is reported to the French tax administration instead. You do not need to create or submit a regulatory file yourself.

Use an invoice report for a single cross-border invoice or credit note. Report every such document; the buyer must not be established in France. Buyers in the European Union are identified by their VAT number, buyers elsewhere by their country and name.

Use a payment report for a payment received on a cross-border invoice. The invoice has to be reported before its payment can be, and the payment report refers back to it by \`invoiceNumber\`. Amounts on a payment report include VAT. Payment reports are only accepted for companies registered with VAT due on payment.

${registrationGuidance}

${referenceGuidance}

A submitted report is recorded alongside your sent documents and counts towards your document quota.`,
  responses: {
    ...describeSuccessResponseWithZod(
      "The report was accepted for processing",
      frenchReportResponseSchema
    ),
    ...describeValidationErrorResponse(
      "Invalid reporting data; the company is not registered for e-reporting, its registration is not yet registered, or it is suspended; the company is not registered in France or lacks the identifiers a report needs; a payment report was sent for a company whose VAT is due on invoicing; or the reporting service refused the report.",
    ),
    ...describeErrorResponse(409, "The report conflicts with what was filed before"),
    ...describeErrorResponse(
      502,
      "The reporting service could not accept the report; retry with the same reference"
    ),
  },
});

type FrenchReportingContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext
>;

type FrenchReportDocumentProfile = {
  type: ReportingDocumentTypeKey;
  docTypeId: string;
  processId: string;
};

/**
 * The reference a simulated filing gets. Derived from the company and the report's
 * own reference so that a retried simulated report finds its earlier document,
 * exactly like a real one does through the partner's idempotency.
 */
function simulatedReference(companyId: string, reference: string): string {
  const digest = createHash("sha256").update(`${companyId}\0${reference}`).digest("hex");
  return `sim_${digest.slice(0, 26)}`;
}

const PAYMENT_REPORT_TYPES: ReadonlySet<string> = new Set(["payments", "payment"]);

/**
 * Checks the report against the declarant it is filed under. Payment events only
 * exist for taxpayers whose VAT is due on payment; under the other regime the
 * partner would refuse them, so they are refused here with the reason.
 */
function rejectForDeclarant(
  report: FrenchB2CReport | FrenchB2BiReport,
  declarant: FrenchReportingDeclarant,
): string | null {
  if (PAYMENT_REPORT_TYPES.has(report.type) && declarant.vatExigibility === "DEBITS") {
    return "Payment reports only apply to companies whose VAT becomes due on payment (TVA sur les encaissements). This company is registered with VAT due on invoicing.";
  }
  return null;
}

function toFailureResponse(c: FrenchReportingContext, error: FrenchReportingSubmissionError) {
  switch (error.kind) {
    case "rejected":
      return c.json(actionFailure(`The report was refused: ${error.message}`), 400);
    case "unregistered":
      return c.json(
        actionFailure(
          `The company is not registered for French e-reporting, or its registration is suspended: ${error.message}`,
        ),
        400,
      );
    case "conflict":
      return c.json(
        actionFailure(`The report conflicts with what was filed before: ${error.message}`),
        409,
      );
    default:
      return c.json(
        actionFailure(
          "The reporting service could not accept the report. Retry later with the same reference.",
        ),
        502,
      );
  }
}

/**
 * Files a French report with the reporting provider and records it as an outgoing
 * document. Every report type reaches the platform the same way; only the payload
 * that is submitted differs, which is what `submit` holds.
 *
 * A retry under a reference that was filed before ends up at the document that
 * filing produced: the provider answers a replayed reference with the original
 * flow id, and one document exists per flow id. Playground and test-network teams
 * never reach the provider and get a simulated reference derived the same way.
 */
async function fileFrenchReport({
  c,
  report,
  profile,
  submit,
}: {
  c: FrenchReportingContext;
  report: FrenchB2CReport | FrenchB2BiReport;
  profile: FrenchReportDocumentProfile;
  submit: (options: {
    environment: FrenchReportingDeclarant["environment"];
  }) => Promise<FrenchReportingSubmissionResult>;
}) {
  const company = c.var.company;
  const team = c.var.team;
  const isPlayground = team.isPlayground;
  const environment = resolveFrenchReportingEnvironment(team);

  const declarant = await getReadyFrenchReportingDeclarant(company.id, environment);
  if (!declarant) {
    return c.json(
      actionFailure(
        "The company is not registered for French e-reporting yet. Register it first through PUT /:companyId/reporting/fr/declarant and wait until the registration is in the registered state.",
      ),
      400,
    );
  }
  const rejection = rejectForDeclarant(report, declarant);
  if (rejection) {
    return c.json(actionFailure(rejection), 400);
  }

  const simulated = isFrenchReportingSimulated(team);
  let externalReferenceId: string;
  let duplicate = false;
  let submission: FrenchReportingSubmissionResult | null = null;
  if (simulated) {
    externalReferenceId = simulatedReference(company.id, report.reference);
  } else {
    try {
      submission = await submit({ environment });
      externalReferenceId = submission.flowId;
      duplicate = submission.duplicate;
    } catch (error) {
      console.error("Failed to submit French report:", error);
      await audit(c, {
        action: report.action,
        subsystem: "peppol.documents",
        outcome: "failed",
        objectType: "peppol.document",
        reasonCode: "submit_french_report_failed",
        metadata: {
          inputFormat: "json_api",
          companyId: company.id,
          country: "FR",
          documentType: profile.type,
          reportType: report.type,
          reference: report.reference,
          providerStatus: error instanceof FrenchReportingSubmissionError ? error.status : null,
          providerCode: error instanceof FrenchReportingSubmissionError ? error.code : null,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      if (error instanceof FrenchReportingSubmissionError) {
        return toFailureResponse(c, error);
      }
      return c.json(
        actionFailure(
          "The reporting service could not accept the report. Retry later with the same reference.",
        ),
        502,
      );
    }
  }

  const existing = await findOutgoingDocumentByExternalReference(
    company.id,
    externalReferenceId,
  );
  if (existing) {
    return c.json(actionSuccess({ id: existing.id, duplicate: true }));
  }

  // The report is filed rather than transmitted, so it has no XML and no
  // recipient. The sending identifier still records which company filed it.
  const senderIdentifier = await getSendingCompanyIdentifier(company.id);
  const transmittedDocument = await recordOutgoingDocument({
    c,
    id: "doc_" + ulid(),
    teamId: team.id,
    company,
    isPlayground,
    inputFormat: "json_api",
    document: {
      senderId: `${senderIdentifier.scheme}:${senderIdentifier.identifier}`,
      receiverId: null,
      docTypeId: profile.docTypeId,
      processId: profile.processId,
      countryC1: company.country,
      type: profile.type,
      parsed: report,
      xml: null,
    },
    delivery: { kind: "reporting", externalReferenceId },
  });

  // The filing's own record, which the status worker follows until the tax
  // administration has ruled on it. Recorded after the document so it can point
  // at it; a failure here must not fail a report that was filed and recorded.
  try {
    await recordFrenchReportingSubmission({
      transmittedDocumentId: transmittedDocument.id,
      declarantId: declarant.id,
      teamId: team.id,
      companyId: company.id,
      environment,
      flowId: externalReferenceId,
      reference: report.reference,
      ...describeFrenchReportEvent(report),
      simulated,
      ledgerStatus: submission?.status ?? null,
      reportingStatus: submission?.reportingStatus ?? null,
    });
  } catch (error) {
    console.error("Failed to record French reporting submission:", error);
  }

  return c.json(actionSuccess({ id: transmittedDocument.id, duplicate }));
}

type FrenchB2CReportingContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: { json: z.input<typeof frenchB2CReportSchema> };
    out: { json: z.infer<typeof frenchB2CReportSchema> };
  }
>;

const _submitFrenchB2CReport = server.post(
  "/:companyId/reporting/fr/b2c",
  requireIntegrationSupportedCompanyAccess(),
  requireValidSubscription(),
  requireCompanyVerificationForStrictTeams(),
  b2cRouteDescription,
  zodValidator("json", frenchB2CReportSchema),
  async (c: FrenchB2CReportingContext) => {
    const report = c.req.valid("json");
    const company = c.var.company;

    if (company.country !== "FR") {
      return c.json(
        actionFailure(
          "B2C reporting is currently available only for companies registered in France."
        ),
        400
      );
    }

    const declarant = buildFrenchDeclarant(company);
    if (!declarant) {
      return c.json(
        actionFailure(
          "The company needs a valid French SIREN or SIRET as enterprise number before a B2C report can be submitted."
        ),
        400
      );
    }

    return fileFrenchReport({
      c,
      report,
      profile: getFrenchB2CReportDocumentProfile(report.type),
      submit: ({ environment }) =>
        submitArratechB2CReport({ input: report, declarant, environment }),
    });
  }
);

export type SubmitFrenchB2CReport = typeof _submitFrenchB2CReport;

type FrenchB2BiReportingContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: { json: z.input<typeof frenchB2BiReportSchema> };
    out: { json: z.infer<typeof frenchB2BiReportSchema> };
  }
>;

const _submitFrenchB2BiReport = server.post(
  "/:companyId/reporting/fr/b2bi",
  requireIntegrationSupportedCompanyAccess(),
  requireValidSubscription(),
  requireCompanyVerificationForStrictTeams(),
  b2biRouteDescription,
  zodValidator("json", frenchB2BiReportSchema),
  async (c: FrenchB2BiReportingContext) => {
    const report = c.req.valid("json");
    const company = c.var.company;

    if (company.country !== "FR") {
      return c.json(
        actionFailure(
          "Cross-border reporting is currently available only for companies registered in France."
        ),
        400
      );
    }

    const declarant = buildFrenchDeclarant(company);
    const seller = buildFrenchSeller(company);
    if (!declarant || !seller) {
      return c.json(
        actionFailure(
          "The company needs a valid French SIREN or SIRET and a VAT number before a cross-border report can be submitted."
        ),
        400
      );
    }

    // Operations with a French buyer are exchanged over the French e-invoicing
    // network instead of being reported, so they do not belong here.
    if (report.type === "invoice" && report.buyer.country === "FR") {
      return c.json(
        actionFailure(
          "Cross-border reporting covers buyers established outside France. An invoice to a French buyer is exchanged over the e-invoicing network instead."
        ),
        400
      );
    }

    return fileFrenchReport({
      c,
      report,
      profile: getFrenchB2BiReportDocumentProfile(report.type),
      submit: ({ environment }) =>
        submitArratechB2BiReport({
          input: report,
          declarant,
          seller,
          environment,
        }),
    });
  }
);

export type SubmitFrenchB2BiReport = typeof _submitFrenchB2BiReport;

export default server;
