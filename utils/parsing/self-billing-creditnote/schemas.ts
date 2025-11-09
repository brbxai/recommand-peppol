import type z from "zod";
import { _creditNoteSchema, _sendCreditNoteSchema } from "../creditnote/schemas";
import { partySchema } from "../invoice/schemas";

// The self billing invoice schema is the same as the invoice schema with a different invoice type code
export const selfBillingCreditNoteSchema = _creditNoteSchema.openapi({ ref: "SelfBillingCreditNote", title: "Self Billing Credit Note", description: "Self billing credit note" });

export const sendSelfBillingCreditNoteSchema = _sendCreditNoteSchema
    .extend({
        seller: partySchema.openapi({ description: "For self billing credit notes, the seller is mandatory."}),
        buyer: partySchema.nullish().openapi({ description: "If not provided, the buyer will be the company that is sending the self billing credit note." }),
    })
    .openapi({ ref: "SendSelfBillingCreditNote", title: "Self Billing Credit Note to send", description: "Self billing credit note to send to a recipient" });

export type SelfBillingCreditNote = z.infer<typeof selfBillingCreditNoteSchema>;