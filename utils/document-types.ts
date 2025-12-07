import { UserFacingError } from "./util";

type DocumentTypeInfo = {
    type: "invoice" | "creditNote" | "selfBillingInvoice" | "selfBillingCreditNote";
    title: string;
    docTypeId: string;
    processId: string;
}

export const INVOICE_DOCUMENT_TYPE_INFO: DocumentTypeInfo = {
    type: "invoice",
    title: "Invoice",
    docTypeId: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
    processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
};

export const CREDIT_NOTE_DOCUMENT_TYPE_INFO: DocumentTypeInfo = {

    type: "creditNote",
    title: "Credit Note",
    docTypeId: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
    processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
};

export const SELF_BILLING_INVOICE_DOCUMENT_TYPE_INFO: DocumentTypeInfo = {
    type: "selfBillingInvoice",
    title: "Self Billing Invoice",
    docTypeId: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:selfbilling:3.0::2.1",
    processId: "urn:fdc:peppol.eu:2017:poacc:selfbilling:01:1.0"
};

export const SELF_BILLING_CREDIT_NOTE_DOCUMENT_TYPE_INFO: DocumentTypeInfo = {
    type: "selfBillingCreditNote",
    title: "Self Billing Credit Note",
    docTypeId: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:selfbilling:3.0::2.1",
    processId: "urn:fdc:peppol.eu:2017:poacc:selfbilling:01:1.0"
};

export const DOCUMENT_TYPE_PRESETS: DocumentTypeInfo[] = [
    INVOICE_DOCUMENT_TYPE_INFO,
    CREDIT_NOTE_DOCUMENT_TYPE_INFO,
    SELF_BILLING_INVOICE_DOCUMENT_TYPE_INFO,
    SELF_BILLING_CREDIT_NOTE_DOCUMENT_TYPE_INFO,
];


export function getDocumentTypeInfo(type: string): DocumentTypeInfo {
    const documentType = DOCUMENT_TYPE_PRESETS.find(dt => dt.type === type);
    if (!documentType) {
        throw new UserFacingError(`Document type ${type} not found`);
    }
    return documentType;
};