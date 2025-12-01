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
    receiverId: z.string(),
    docTypeId: z.string(),
    processId: z.string(),
    countryC1: z.string(),
    type: documentTypeSchema,
    readAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    xml: z.string(),
    parsed: z.union([invoiceSchema, creditNoteSchema, selfBillingInvoiceSchema, selfBillingCreditNoteSchema, z.null()]),
    validation: validationResponse,
    sentOverPeppol: z.boolean(),
    sentOverEmail: z.boolean(),
    emailRecipients: z.array(z.string()),
    labels: z.array(labelResponse.omit({ teamId: true, createdAt: true, updatedAt: true })),
});