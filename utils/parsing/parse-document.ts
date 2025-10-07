import type { Company } from "@peppol/data/companies";
import { sendSystemAlert } from "../system-notifications/telegram";
import { parseInvoiceFromXML } from "./invoice/from-xml";
import { parseCreditNoteFromXML } from "./creditnote/from-xml";
import { parseSelfBillingInvoiceFromXML } from "./self-billing-invoice/from-xml";
import { parseSelfBillingCreditNoteFromXML } from "./self-billing-creditnote/from-xml";

export function parseDocument(docTypeId: string, xml: string, company: Company, senderId: string) {
    // Parse the XML document
    let parsedDocument = null;
    let type: "invoice" | "creditNote" | "selfBillingInvoice" | "selfBillingCreditNote" | "unknown" = "unknown";
    if (docTypeId === "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1") {
        try {
            parsedDocument = parseInvoiceFromXML(xml);
            type = "invoice";
        } catch (error) {
            console.error("Failed to parse invoice XML:", error);
            sendSystemAlert(
                "Document Parsing Error",
                `Failed to parse invoice XML\n\n` +
                `Company: ${company.name}\n` +
                `Sender: ${senderId}\n` +
                `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                "error"
            );
        }
    } else if (docTypeId === "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1") {
        try {
            parsedDocument = parseCreditNoteFromXML(xml);
            type = "creditNote";
        } catch (error) {
            console.error("Failed to parse credit note XML:", error);
            sendSystemAlert(
                "Document Parsing Error",
                `Failed to parse credit note XML\n\n` +
                `Company: ${company.name}\n` +
                `Sender: ${senderId}\n` +
                `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                "error"
            );
        }
    } else if (docTypeId === "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:selfbilling:3.0::2.1") {
        try {
            parsedDocument = parseSelfBillingInvoiceFromXML(xml);
            type = "selfBillingInvoice";
        } catch (error) {
            console.error("Failed to parse self billing invoice XML:", error);
            sendSystemAlert(
                "Document Parsing Error",
                `Failed to parse self billing invoice XML\n\n` +
                `Company: ${company.name}\n` +
                `Sender: ${senderId}\n` +
                `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                "error"
            );
        }
    } else if (docTypeId === "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:selfbilling:3.0::2.1") {
        try {
            parsedDocument = parseSelfBillingCreditNoteFromXML(xml);
            type = "selfBillingCreditNote";
        } catch (error) {
            console.error("Failed to parse self billing credit note XML:", error);
            sendSystemAlert(
                "Document Parsing Error",
                `Failed to parse self billing credit note XML\n\n` +
                `Company: ${company.name}\n` +
                `Sender: ${senderId}\n` +
                `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                "error"
            );
        }
    }

    return { parsedDocument, type };
}