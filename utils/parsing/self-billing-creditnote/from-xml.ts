import type { SelfBillingCreditNote } from "./schemas";
import { parseCreditNoteFromXML } from "../creditnote/from-xml";

export function parseSelfBillingCreditNoteFromXML(xml: string): SelfBillingCreditNote {
    // Self billing credit note is the same as a regular credit note with a different invoice type code
    return parseCreditNoteFromXML(xml);
}