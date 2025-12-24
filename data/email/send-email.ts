import { sendEmail } from "@core/lib/email";
import type { CreditNote } from "@peppol/utils/parsing/creditnote/schemas";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import type { SelfBillingInvoice } from "@peppol/utils/parsing/self-billing-invoice/schemas";
import type { SelfBillingCreditNote } from "@peppol/utils/parsing/self-billing-creditnote/schemas";
import type { MessageLevelResponse } from "@peppol/utils/parsing/message-level-response/schemas";
import { Attachment } from "postmark";
import type { DocumentType } from "@peppol/utils/document-types";

export type ParsedDocument = Invoice | CreditNote | SelfBillingInvoice | SelfBillingCreditNote | MessageLevelResponse;

export function getDocumentTypeLabel(type: DocumentType): string {
  switch (type) {
    case "invoice":
      return "Invoice";
    case "creditNote":
      return "Credit Note";
    case "selfBillingInvoice":
      return "Self Billing Invoice";
    case "selfBillingCreditNote":
      return "Self Billing Credit Note";
    case "messageLevelResponse":
      return "Message Level Response";
    default:
      return "Document";
  }
}

export function extractDocumentAttachments(parsedDocument: ParsedDocument | null): Attachment[] {
  const attachments: Attachment[] = [];
  if (parsedDocument && "attachments" in parsedDocument && parsedDocument.attachments) {
    for (const attachment of parsedDocument.attachments) {
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
  return attachments;
}

export function getDocumentFilename(type: DocumentType, parsedDocument: ParsedDocument | null): string {
  if (!parsedDocument) {
    return "document";
  }

  if ("invoiceNumber" in parsedDocument) {
    return type === "selfBillingInvoice"
      ? `self-billing-invoice-${parsedDocument.invoiceNumber}`
      : `invoice-${parsedDocument.invoiceNumber}`;
  } else if ("creditNoteNumber" in parsedDocument) {
    return type === "selfBillingCreditNote"
      ? `self-billing-credit-note-${parsedDocument.creditNoteNumber}`
      : `credit-note-${parsedDocument.creditNoteNumber}`;
  }

  return "document";
}

export async function sendDocumentEmail(options: {
  type: DocumentType;
  parsedDocument: ParsedDocument | null;
  xmlDocument: string;
  to: string;
  subject?: string;
  htmlBody?: string;
  isPlayground?: boolean;
}) {
  let senderName = "";
  const filename = getDocumentFilename(options.type, options.parsedDocument);
  let subject = options.subject;
  let htmlBody = options.htmlBody;

  if (!subject) {
    const documentTypeLabel = getDocumentTypeLabel(options.type);
    if (options.parsedDocument && "invoiceNumber" in options.parsedDocument) {
      subject = `${documentTypeLabel} ${options.parsedDocument.invoiceNumber}`;
      senderName = options.parsedDocument.seller.name;
    } else if (options.parsedDocument && "creditNoteNumber" in options.parsedDocument) {
      subject = `${documentTypeLabel} ${options.parsedDocument.creditNoteNumber}`;
      senderName = options.parsedDocument.seller.name;
    } else {
      subject = documentTypeLabel;
    }
  }

  if (!htmlBody) {
    const documentTypeLabel = getDocumentTypeLabel(options.type).toLowerCase();
    if (options.parsedDocument && "buyer" in options.parsedDocument && options.parsedDocument.buyer?.name) {
      htmlBody = `Dear ${options.parsedDocument.buyer.name}, you can find your ${documentTypeLabel} attached.`;
    } else {
      htmlBody = `Dear, you can find your ${documentTypeLabel} attached.`;
    }
  }

  if (options.isPlayground) {
    subject = `[PLAYGROUND/TEST] ${subject}`;
  }

  const attachments = extractDocumentAttachments(options.parsedDocument);
  const xmlAttachment: Attachment = {
    Content: Buffer.from(options.xmlDocument, 'utf-8').toString('base64'),
    ContentID: null,
    ContentType: "application/xml",
    Name: filename + ".xml",
  };

  await sendEmail({
    from: senderName ? `${senderName} <noreply-documents@recommand.eu>` : "noreply-documents@recommand.eu",
    to: options.to,
    subject: subject,
    email: htmlBody,
    attachments: [...attachments, xmlAttachment],
  });
}