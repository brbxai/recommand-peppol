import type z from "zod";
import { _invoiceSchema, _sendInvoiceSchema } from "../invoice/schemas";

// The self billing invoice schema is the same as the invoice schema with a different invoice type code
export const selfBillingInvoiceSchema = _invoiceSchema.openapi({ ref: "SelfBillingInvoice", title: "Self Billing Invoice", description: "Self billing invoice" });

export const sendSelfBillingInvoiceSchema = _sendInvoiceSchema.openapi({ ref: "SendSelfBillingInvoice", title: "Self Billing Invoice to send", description: "Self billing invoice to send to a recipient" });

export type SelfBillingInvoice = z.infer<typeof selfBillingInvoiceSchema>;