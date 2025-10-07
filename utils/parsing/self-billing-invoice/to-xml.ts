import { prebuildInvoiceUBL } from "../invoice/to-xml";
import type { SelfBillingInvoice } from "./schemas";
import { XMLBuilder } from "fast-xml-parser";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressBooleanAttributes: true,
});

export function selfBillingInvoiceToUBL(
  selfBillingInvoice: SelfBillingInvoice,
  senderAddress: string,
  recipientAddress: string
): string {
  // The self billing invoice is the same as the invoice with a different invoice type code (389 instead of 380)
  const ublInvoice = prebuildInvoiceUBL(selfBillingInvoice, senderAddress, recipientAddress);

  // Set the CustomizationID
  ublInvoice.Invoice["cbc:CustomizationID"] = "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:selfbilling:3.0";
  // Set the ProfileID
  ublInvoice.Invoice["cbc:ProfileID"] = "urn:fdc:peppol.eu:2017:poacc:selfbilling:01:1.0";
  // Set the invoice type code to 389
  ublInvoice.Invoice["cbc:InvoiceTypeCode"] = "389";
  
  return builder.build(ublInvoice);
}