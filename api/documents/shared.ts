import { z } from "zod";
import "zod-openapi/extend";
import { invoiceSchema } from "@peppol/utils/parsing/invoice/schemas";
import { selfBillingCreditNoteSchema } from "@peppol/utils/parsing/self-billing-creditnote/schemas";
import { selfBillingInvoiceSchema } from "@peppol/utils/parsing/self-billing-invoice/schemas";
import { creditNoteSchema } from "@peppol/utils/parsing/creditnote/schemas";
import { messageLevelResponseSchema } from "@peppol/utils/parsing/message-level-response/schemas";
import { franceCdarSchema } from "@peppol/utils/parsing/france-cdar/schemas";
import { frenchB2CReportSchema } from "@peppol/utils/parsing/b2c-reporting/france";
import { frenchB2BiReportSchema } from "@peppol/utils/parsing/b2bi-reporting/france";
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
    outcomeAt: z.string().nullable().openapi({ description: "When the tax administration returned its outcome." }),
    checkedAt: z.string().nullable().openapi({ description: "When the status was last refreshed from the reporting service." }),
    simulated: z.boolean().openapi({ description: "True for playground and test-network reports, which are recorded but never filed." }),
}).openapi({ ref: "FrenchReportingStatus" });

export const deliveryFailureResponse = z.object({
    code: z.string().nullable().openapi({
        description: "The access point's error code for the failure, when it reported one.",
        example: "TXE-1005",
    }),
    message: z.string().nullable().openapi({
        description: "The access point's description of what went wrong, written for the sender.",
    }),
    category: z.string().nullable().openapi({
        description: "The kind of failure, as classified by the access point, such as a validation error, an unknown recipient or a transport error.",
        example: "VALIDATION_ERROR",
    }),
    transactionStatus: z.string().nullable().openapi({
        description: "The access point's status of the transaction when it reported the failure.",
        example: "FAILED",
    }),
    reportedAt: z.string().openapi({
        description: "When the failure was reported.",
    }),
});

export const transmittedDocumentResponse = z.object({
    id: z.string().openapi({
        description: "The Recommand document ID. Use it with the other document endpoints.",
        example: "doc_01JQZ8X0M4T7RB6K9V2NDHW3PA",
    }),
    teamId: z.string().openapi({
        description: "The ID of the team the document belongs to.",
        example: "team_01JQZ8X0M4T7RB6K9V2NDHW3PA",
    }),
    companyId: z.string().openapi({
        description: "The ID of the company the document was sent for or received by.",
        example: "c_01JQZ8X0M4T7RB6K9V2NDHW3PA",
    }),
    direction: z.enum(["incoming", "outgoing"]).openapi({
        description: "Whether the document was received by this company (`incoming`) or sent by it (`outgoing`).",
        example: "incoming",
    }),
    senderId: z.string().openapi({
        description: "The Peppol address of the sender, as `scheme:identifier`.",
        example: "0208:1012081766",
    }),
    receiverId: z.string().nullable().openapi({
        description: "The Peppol address of the receiver, as `scheme:identifier`. Null for documents that were never addressed on the network, such as email-only sends and French e-reporting reports.",
        example: "0208:0428643097",
    }),
    docTypeId: z.string().openapi({
        description: "The full Peppol document type identifier the document was exchanged under. It names the syntax and the customization the document follows.",
        example: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
    }),
    processId: z.string().openapi({
        description: "The Peppol process identifier the document was exchanged under. It names the business process the document type is used in.",
        example: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    }),
    countryC1: z.string().openapi({
        description: "The country of the originating sender (Peppol corner 1), in ISO 3166-1 alpha-2 format. Peppol requires it on every transmission so receivers can apply country-specific rules.",
        example: "BE",
    }),
    type: transmittedDocumentTypeSchema.openapi({
        description: "What kind of document this is. `unknown` means the document could not be recognised as one of the supported types, in which case `parsed` is null and only the XML is available.",
        example: "invoice",
    }),
    readAt: z.string().nullable().openapi({
        description: "When the document was marked as read. Null while it is unread, which is what puts an incoming document in the inbox.",
    }),
    createdAt: z.string().openapi({
        description: "When the document was sent or received.",
    }),
    updatedAt: z.string().openapi({
        description: "When the document record last changed.",
    }),
    xml: z.string().nullable().openapi({
        description: "The document as XML, exactly as it went over the network. Null for documents that have no XML body, such as French e-reporting reports.",
    }),
    parsed: z.union([
        invoiceSchema,
        creditNoteSchema,
        selfBillingInvoiceSchema,
        selfBillingCreditNoteSchema,
        messageLevelResponseSchema,
        franceCdarSchema,
        frenchB2CReportSchema,
        frenchB2BiReportSchema,
        z.null(),
    ]).openapi({
        description: "The document read into the JSON shape of its type, so you do not have to parse the XML yourself. Null when the type is `unknown` or the payload was not kept.",
    }),
    validation: validationResponse.nullable().openapi({
        description: "The outcome of validating the document against the rules of its document type. Null when the document was not validated.",
    }),
    sentOverPeppol: z.boolean().openapi({
        description: "Whether the document travelled over the Peppol network. False for a document that was only delivered by email.",
        example: true,
    }),
    sentOverEmail: z.boolean().openapi({
        description: "Whether the document was delivered by email, either as the only channel or alongside Peppol.",
        example: false,
    }),
    emailRecipients: z.array(z.string()).openapi({
        description: "The email addresses the document was delivered to. Empty when it was not sent by email.",
        example: [],
    }),
    labels: z.array(labelResponse.omit({ teamId: true, createdAt: true, updatedAt: true })).openapi({
        description: "The labels assigned to this document. Manage them with the assign and unassign label endpoints.",
    }),
    peppolMessageId: z.string().nullable().openapi({
        description: "The AS4 message ID of the transmission. Null when the document did not travel over Peppol, and for playground teams, whose transmissions are simulated.",
    }),
    peppolConversationId: z.string().nullable().openapi({
        description: "The AS4 conversation ID the transmission belongs to. It ties a document to the responses that follow it.",
    }),
    receivedPeppolSignalMessage: z.string().nullable().openapi({
        description: "The AS4 signal message the receiving access point returned to acknowledge an outgoing transmission. Null for incoming documents and when the access point returned none.",
    }),
    envelopeId: z.string().nullable().openapi({
        description: "The envelope ID of the document, also known as the SBDH instance identifier (Standard Business Document Header Instance Identifier)",
    }),
    reporting: frenchReportingStatusResponse.nullable().openapi({
        description: "Where a French e-reporting report stands with the tax administration. Null for documents that are not reports.",
    }),
    deliveryFailure: deliveryFailureResponse.nullable().openapi({
        description: "Set when the access point reported that an outgoing document failed validation or delivery after accepting it. The document was then not delivered to the recipient, even though it was sent over Peppol. Null while no failure has been reported, and for incoming documents.",
    }),
});
