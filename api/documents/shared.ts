import { z } from "zod";
import "zod-openapi/extend";
import { invoiceSchema } from "@peppol/utils/parsing/invoice/schemas";
import { selfBillingCreditNoteSchema } from "@peppol/utils/parsing/self-billing-creditnote/schemas";
import { selfBillingInvoiceSchema } from "@peppol/utils/parsing/self-billing-invoice/schemas";
import { creditNoteSchema } from "@peppol/utils/parsing/creditnote/schemas";
import { documentTypeSchema } from "@peppol/utils/parsing/send-document";
import { labelResponse } from "@peppol/api/labels/shared";
import { validationResponse } from "@peppol/types/validation";

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
    type: documentTypeSchema,
    readAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    xml: z.string().nullable(),
    parsed: z.union([invoiceSchema, creditNoteSchema, selfBillingInvoiceSchema, selfBillingCreditNoteSchema, z.null()]),
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
});