import { prebuildCreditNoteUBL } from "../creditnote/to-xml";
import type { SelfBillingCreditNote } from "./schemas";
import { XMLBuilder } from "fast-xml-parser";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressBooleanAttributes: true,
});

export function selfBillingCreditNoteToUBL(
  selfBillingCreditNote: SelfBillingCreditNote,
  senderAddress: string,
  recipientAddress: string
): string {
  // The self billing credit note is the same as the credit note with a different invoice type code (389 instead of 380)
  const ublCreditNote = prebuildCreditNoteUBL(selfBillingCreditNote, senderAddress, recipientAddress);

  // Set the CustomizationID
  ublCreditNote.CreditNote["cbc:CustomizationID"] = "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:selfbilling:3.0";
  // Set the ProfileID
  ublCreditNote.CreditNote["cbc:ProfileID"] = "urn:fdc:peppol.eu:2017:poacc:selfbilling:01:1.0";
  // Set the invoice type code to 389
  ublCreditNote.CreditNote["cbc:CreditNoteTypeCode"] = "261";
  
  return builder.build(ublCreditNote);
}