import { sendEmail } from "@core/lib/email";
import type { CreditNote } from "@peppol/utils/parsing/creditnote/schemas";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import type { SelfBillingInvoice } from "@peppol/utils/parsing/self-billing-invoice/schemas";
import type { SelfBillingCreditNote } from "@peppol/utils/parsing/self-billing-creditnote/schemas";
import { Attachment } from "postmark";

export async function sendDocumentEmail(options: {
    type: "invoice" | "creditNote" | "selfBillingInvoice" | "selfBillingCreditNote" | "unknown";
    parsedDocument: Invoice | CreditNote | SelfBillingInvoice | SelfBillingCreditNote | null;
    xmlDocument: string;

    to: string;
    subject?: string;
    htmlBody?: string;
}) {

    let senderName = "";
    let name = "document";
    let subject = options.subject;
    let htmlBody = options.htmlBody;

    if (!subject) {
        if (options.type === "invoice" && options.parsedDocument && "invoiceNumber" in options.parsedDocument) {
            subject = `Invoice ${options.parsedDocument?.invoiceNumber}`;
            senderName = options.parsedDocument.seller.name;
            name = `invoice-${options.parsedDocument?.invoiceNumber}`;
        } else if (options.type === "creditNote" && options.parsedDocument && "creditNoteNumber" in options.parsedDocument) {
            subject = `Credit Note ${options.parsedDocument?.creditNoteNumber}`;
            senderName = options.parsedDocument.seller.name;
            name = `credit-note-${options.parsedDocument?.creditNoteNumber}`;
        } else if (options.type === "selfBillingInvoice" && options.parsedDocument && "invoiceNumber" in options.parsedDocument) {
            subject = `Self Billing Invoice ${options.parsedDocument?.invoiceNumber}`;
            senderName = options.parsedDocument.seller.name;
            name = `self-billing-invoice-${options.parsedDocument?.invoiceNumber}`;
        } else if (options.type === "selfBillingCreditNote" && options.parsedDocument && "creditNoteNumber" in options.parsedDocument) {
            subject = `Self Billing Credit Note ${options.parsedDocument?.creditNoteNumber}`;
            senderName = options.parsedDocument.seller.name;
            name = `self-billing-credit-note-${options.parsedDocument?.creditNoteNumber}`;
        } else {
            subject = `Document`;
        }
    }
    if (!htmlBody) {
        if (options.type === "invoice" && options.parsedDocument && "invoiceNumber" in options.parsedDocument) {
            htmlBody = `Dear ${options.parsedDocument.buyer.name}, you can find your invoice attached.`;
        } else if (options.type === "creditNote" && options.parsedDocument && "creditNoteNumber" in options.parsedDocument) {
            htmlBody = `Dear ${options.parsedDocument.buyer.name}, you can find your credit note attached.`;
        } else if (options.type === "selfBillingInvoice" && options.parsedDocument && "invoiceNumber" in options.parsedDocument) {
            htmlBody = `Dear ${options.parsedDocument.buyer.name}, you can find your self billing invoice attached.`;
        } else if (options.type === "selfBillingCreditNote" && options.parsedDocument && "creditNoteNumber" in options.parsedDocument) {
            htmlBody = `Dear ${options.parsedDocument.buyer.name}, you can find your self billing credit note attached.`;
        } else {
            htmlBody = `Dear, you can find your document attached.`;
        }
    }

    const attachments: Attachment[] = [];
    if ((options.type === "invoice" || options.type === "creditNote" || options.type === "selfBillingInvoice" || options.type === "selfBillingCreditNote") && options.parsedDocument && "attachments" in options.parsedDocument && options.parsedDocument.attachments) {
        for (const attachment of options.parsedDocument.attachments) {
            if (attachment.embeddedDocument) {
                attachments.push({
                    Content: attachment.embeddedDocument,
                    ContentID: null,
                    ContentType: attachment.mimeCode,
                    Name: attachment.filename,
                });
            }
        }
    }

    await sendEmail({
        from: senderName ? `${senderName} <noreply-documents@recommand.eu>` : "noreply-documents@recommand.eu",
        to: options.to,
        subject: subject,
        email: htmlBody,
        attachments: [...attachments, {
            Content: Buffer.from(options.xmlDocument, 'utf-8').toString('base64'),
            ContentID: null,
            ContentType: "application/xml",
            Name: name + ".xml",
        }],
    });
}