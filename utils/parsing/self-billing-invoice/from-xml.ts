import type { SelfBillingInvoice } from "./schemas";
import { parseInvoiceFromXML } from "../invoice/from-xml";

export function parseSelfBillingInvoiceFromXML(xml: string): SelfBillingInvoice {
    // Self billing invoice is the same as a regular invoice with a different invoice type code
    return parseInvoiceFromXML(xml);
}