import type z from "zod";
import { _invoiceSchema, _sendInvoiceSchema, partySchema } from "../invoice/schemas";

// The self billing invoice schema is the same as the invoice schema with a different invoice type code
export const selfBillingInvoiceSchema = _invoiceSchema.openapi({ ref: "SelfBillingInvoice", title: "Self Billing Invoice", description: "Self billing invoice" });

export const sendSelfBillingInvoiceSchema = _sendInvoiceSchema
    .extend({
        seller: partySchema.openapi({ description: "For self billing invoices, the seller is mandatory."}),
        buyer: partySchema.nullish().openapi({ description: "If not provided, the buyer will be the company that is sending the self billing invoice." }),
    })
    .openapi({ ref: "SendSelfBillingInvoice", title: "Self Billing Invoice to send", description: "Self billing invoice to send to a recipient" });

export type SelfBillingInvoice = z.infer<typeof selfBillingInvoiceSchema>;