import { z } from "zod";
import "zod-openapi/extend";
import { invoiceSchema } from "@peppol/utils/parsing/invoice/schemas";
import { selfBillingCreditNoteSchema } from "@peppol/utils/parsing/self-billing-creditnote/schemas";
import { selfBillingInvoiceSchema } from "@peppol/utils/parsing/self-billing-invoice/schemas";
import { creditNoteSchema } from "@peppol/utils/parsing/creditnote/schemas";
import { messageLevelResponseSchema } from "@peppol/utils/parsing/message-level-response/schemas";
import { franceCdarSchema } from "@peppol/utils/parsing/france-cdar/schemas";
import { frenchB2CReportSchema } from "@peppol/utils/parsing/b2c-reporting/france";
import { labelResponse } from "@directory/api/labels/shared";
import { validationResponse } from "@peppol/types/validation";
import { STORED_DOCUMENT_TYPE_KEYS } from "@peppol/utils/type-repository/document-types/keys";
import { zodFrReportingStatuses } from "@peppol/db/schema";

const transmittedDocumentTypeSchema = z.enum(STORED_DOCUMENT_TYPE_KEYS);

export const frenchReportingStatusResponse = z.object({
    reportingStatus: zodFrReportingStatuses.openapi({
        description: "`accepted`: on file, inside its reporting period. `pending_rectificative`: arrived after the period was filed and will be carried by a corrective filing. `filed` / `filed_rectificative`: reported to the tax administration. `superseded`: replaced by a correction or cancelled. `rejected`: refused by the tax administration; see `outcomeCode`.",
    }),
    receivedAt: z.string().nullable().openapi({ description: "When the report reached the reporting service." }),
    periodStart: z.string().nullable().openapi({ description: "First day of the reporting period the report belongs to." }),
    periodEnd: z.string().nullable().openapi({ description: "Last day of the reporting period; the cutoff for on-time filing." }),
    submissionId: z.string().nullable().openapi({ description: "The period filing the report was carried on, once assembled." }),
    outcomeCode: z.string().nullable().openapi({ description: "The tax administration's outcome code, once known." }),
    outcomeAt: z.string().nullable(),
    checkedAt: z.string().nullable().openapi({ description: "When the status was last refreshed from the reporting service." }),
    simulated: z.boolean().openapi({ description: "True for playground and test-network reports, which are recorded but never filed." }),
}).openapi({ ref: "FrenchReportingStatus" });

export const transmittedDocumentResponse = z.object({
    id: z.string(),
    teamId: z.string(),
    companyId: z.string(),
    direction: z.enum(["incoming", "outgoing"]),
    senderId: z.string(),
    receiverId: z.string().nullable(),
    docTypeId: z.string(),
    processId: z.string(),
    countryC1: z.string(),
    type: transmittedDocumentTypeSchema,
    readAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    xml: z.string().nullable(),
    parsed: z.union([
        invoiceSchema,
        creditNoteSchema,
        selfBillingInvoiceSchema,
        selfBillingCreditNoteSchema,
        messageLevelResponseSchema,
        franceCdarSchema,
        frenchB2CReportSchema,
        z.null(),
    ]),
    validation: validationResponse.nullable(),
    sentOverPeppol: z.boolean(),
    sentOverEmail: z.boolean(),
    emailRecipients: z.array(z.string()),
    labels: z.array(labelResponse.omit({ teamId: true, createdAt: true, updatedAt: true })),
    peppolMessageId: z.string().nullable(),
    peppolConversationId: z.string().nullable(),
    receivedPeppolSignalMessage: z.string().nullable(),
    envelopeId: z.string().nullable().openapi({
        description: "The envelope ID of the document, also known as the SBDH instance identifier (Standard Business Document Header Instance Identifier)",
    }),
    reporting: frenchReportingStatusResponse.nullable().openapi({
        description: "Where a French e-reporting report stands with the tax administration. Null for documents that are not reports.",
    }),
});
