import type { Company } from "@peppol/data/companies";
import { sendSystemAlert } from "../system-notifications/telegram";
import { parseInvoiceFromXML } from "./invoice/from-xml";
import { parseCreditNoteFromXML } from "./creditnote/from-xml";

export function parseDocument(docTypeId: string, xml: string, company: Company, senderId: string) {
    // Parse the XML document
    let parsedDocument = null;
    let type: "invoice" | "creditNote" | "unknown" = "unknown";
    if (docTypeId.includes("Invoice")) {
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
    } else if (docTypeId.includes("CreditNote")) {
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
    }

    return { parsedDocument, type };
}