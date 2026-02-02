import codeList from "./data/peppol-document-types-v9.5.json";

let lookupMap: Map<string, string> | null = null;

function getMap(): Map<string, string> {
    if (lookupMap) return lookupMap;

    lookupMap = new Map();
    for (const entry of codeList.values) {
        lookupMap.set(entry.value, entry.name);
    }
    return lookupMap;
}

/**
 * Look up a human-readable name for a Peppol document type ID.
 * Falls back to regex extraction from the ID string if not in the code list.
 */
export function getDocumentTypeName(docTypeValue: string): string {
    const map = getMap();
    const name = map.get(docTypeValue);
    if (name) return name;

    // Fallback: extract name from UBL-style document type ID
    // e.g. "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##..." → "Invoice"
    const ublMatch = docTypeValue.match(/::([\w]+)##/);
    if (ublMatch) return ublMatch[1];

    // Fallback: extract from CII-style
    // e.g. "...::CrossIndustryInvoice##..." → "CrossIndustryInvoice"
    const ciiMatch = docTypeValue.match(/::([\w]+)$/);
    if (ciiMatch) return ciiMatch[1];

    return docTypeValue;
}
