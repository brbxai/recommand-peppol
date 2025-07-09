import { z } from 'zod';
import "zod-openapi/extend";
import { attachmentSchema, lineSchema, partySchema, paymentMeansSchema, totalsSchema, vatTotalsSchema } from '../invoice/schemas';

export const creditNoteSchema = z.object({
  creditNoteNumber: z.string().openapi({ example: "INV-2024-001" }),
  issueDate: z.string().date().openapi({ example: "2024-03-20" }),
  note: z.string().nullish().openapi({ example: "Thank you for your business" }),
  buyerReference: z.string().nullish().openapi({ example: "PO-2024-001" }),
  purchaseOrderReference: z.string().nullish().openapi({ example: "PO-2024-001" }),
  seller: partySchema,
  buyer: partySchema,
  paymentMeans: z.array(paymentMeansSchema).nullish(),
  paymentTerms: z.object({
    note: z.string().openapi({ example: "Net 30" }),
  }).nullish(),
  lines: z.array(lineSchema),
  totals: totalsSchema.nullish(),
  vat: vatTotalsSchema.nullish(),
  attachments: z.array(attachmentSchema).nullish().openapi({ description: "Optional attachments to the credit note" }),
}).openapi({ ref: "CreditNote" });

export const sendCreditNoteSchema = creditNoteSchema.extend({
  issueDate: z.string().date().nullish().openapi({ example: "2024-03-20", description: "If not provided, the issue date will be the current date." }),
  dueDate: z.string().date().nullish().openapi({ example: "2024-04-20", description: "If not provided, the due date will be 1 month from the issue date." }),
  seller: partySchema.nullish().openapi({ description: "If not provided, the seller will be the company that is sending the credit note." }),
}).openapi({ ref: "SendCreditNote" });

export type CreditNote = z.infer<typeof creditNoteSchema>;