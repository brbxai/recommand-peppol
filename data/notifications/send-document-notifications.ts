import { sendEmail } from "@core/lib/email";
import { getIncomingCompanyNotificationEmailAddresses, getOutgoingCompanyNotificationEmailAddresses } from "@peppol/data/company-notification-emails";
import DocumentIncomingNotification from "@peppol/emails/document-incoming-notification";
import DocumentOutgoingNotification from "@peppol/emails/document-outgoing-notification";
import { Attachment } from "postmark";
import {
  type ParsedDocument,
  type DocumentType,
  getDocumentTypeLabel,
  extractDocumentAttachments,
  getDocumentFilename,
} from "@peppol/data/email/send-email";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";

function extractDocumentDetails(
  parsedDocument: ParsedDocument | null,
  type: DocumentType
): {
  documentNumber?: string;
  amount?: string;
  currency?: string;
  sellerName: string;
  buyerName: string;
  senderName: string;
  receiverName: string;
} {
  if (!parsedDocument) {
    return {
      sellerName: "Unknown",
      buyerName: "Unknown",
      senderName: "Unknown",
      receiverName: "Unknown",
    };
  }

  let documentNumber: string | undefined;
  let amount: string | undefined;
  let currency: string | undefined;

  if ("invoiceNumber" in parsedDocument) {
    documentNumber = parsedDocument.invoiceNumber;
  } else if ("creditNoteNumber" in parsedDocument) {
    documentNumber = parsedDocument.creditNoteNumber;
  }

  if ("totals" in parsedDocument && parsedDocument.totals && typeof parsedDocument.totals === "object") {
    const totals = parsedDocument.totals as { payableAmount?: number | string };
    amount = totals.payableAmount?.toString();
    currency = "-";
    // TODO: Support multiple currencies
  }

  const sellerName = parsedDocument.seller?.name || "Unknown";
  const buyerName = parsedDocument.buyer?.name || "Unknown";
  let senderName = "Unknown";
  let receiverName = "Unknown";
  if(["invoice", "creditNote"].includes(type)) {
    senderName = parsedDocument.seller?.name || "Unknown";
    receiverName = parsedDocument.buyer?.name || "Unknown";
  } else if(["selfBillingInvoice", "selfBillingCreditNote"].includes(type)) {
    senderName = parsedDocument.buyer?.name || "Unknown";
    receiverName = parsedDocument.seller?.name || "Unknown";
  }

  return { documentNumber, amount, currency, sellerName, buyerName, senderName, receiverName };
}

export async function sendIncomingDocumentNotifications(options: {
  companyId: string;
  companyName: string;
  type: DocumentType;
  parsedDocument: ParsedDocument | null;
  xmlDocument: string;
}): Promise<void> {
  try {
    const notificationEmails = await getIncomingCompanyNotificationEmailAddresses(options.companyId);

    if (notificationEmails.length === 0) {
      return;
    }

    const { documentNumber, amount, currency, senderName, receiverName } = extractDocumentDetails(
      options.parsedDocument,
      options.type
    );

    const documentTypeLabel = getDocumentTypeLabel(options.type);
    const subject = documentNumber
      ? `New ${documentTypeLabel} Received: ${documentNumber}`
      : `New ${documentTypeLabel} Received - ${options.companyName}`;

    const attachments = extractDocumentAttachments(options.parsedDocument);
    const filename = getDocumentFilename(options.type, options.parsedDocument);
    const xmlAttachment: Attachment = {
      Content: Buffer.from(options.xmlDocument, 'utf-8').toString('base64'),
      ContentID: null,
      ContentType: "application/xml",
      Name: filename + ".xml",
    };

    for (const notificationEmail of notificationEmails) {
      try {
        await sendEmail({
          to: notificationEmail.email,
          subject,
          email: DocumentIncomingNotification({
            companyName: options.companyName,
            senderName: senderName,
            documentType: documentTypeLabel,
            documentNumber: documentNumber,
            amount: amount,
            currency: currency,
          }),
          attachments: [...attachments, xmlAttachment],
        });
      } catch (error) {
        console.error(`Failed to send incoming document notification to ${notificationEmail.email}:`, error);
        sendSystemAlert(
          "Document Notification Sending Failed",
          `Failed to send incoming document notification to ${notificationEmail.email}.`,
          "error"
        );
      }
    }
  } catch (error) {
    console.error("Failed to send incoming document notifications:", error);
    sendSystemAlert(
      "Document Notification Sending Failed",
      `Failed to send incoming document notifications.`,
      "error"
    );
  }
}

export async function sendOutgoingDocumentNotifications(options: {
  companyId: string;
  companyName: string;
  type: DocumentType;
  parsedDocument: ParsedDocument | null;
  xmlDocument: string;
}): Promise<void> {
  try {
    const notificationEmails = await getOutgoingCompanyNotificationEmailAddresses(options.companyId);

    if (notificationEmails.length === 0) {
      return;
    }

    const { documentNumber, amount, currency, receiverName } = extractDocumentDetails(
      options.parsedDocument,
      options.type
    );

    const documentTypeLabel = getDocumentTypeLabel(options.type);
    const subject = documentNumber
      ? `${documentTypeLabel} Sent Successfully: ${documentNumber}`
      : `${documentTypeLabel} Sent Successfully - ${options.companyName}`;

    const attachments = extractDocumentAttachments(options.parsedDocument);
    const filename = getDocumentFilename(options.type, options.parsedDocument);
    const xmlAttachment: Attachment = {
      Content: Buffer.from(options.xmlDocument, 'utf-8').toString('base64'),
      ContentID: null,
      ContentType: "application/xml",
      Name: filename + ".xml",
    };

    for (const notificationEmail of notificationEmails) {
      try {
        await sendEmail({
          to: notificationEmail.email,
          subject,
          email: DocumentOutgoingNotification({
            companyName: options.companyName,
            recipientName: receiverName,
            documentType: documentTypeLabel,
            documentNumber: documentNumber,
            amount: amount,
            currency: currency,
          }),
          attachments: [...attachments, xmlAttachment],
        });
      } catch (error) {
        console.error(`Failed to send outgoing document notification to ${notificationEmail.email}:`, error);
        sendSystemAlert(
          "Document Notification Sending Failed",
          `Failed to send outgoing document notification to ${notificationEmail.email}.`,
          "error"
        );
      }
    }
  } catch (error) {
    console.error("Failed to send outgoing document notifications:", error);
    sendSystemAlert(
      "Document Notification Sending Failed",
      `Failed to send outgoing document notifications.`,
      "error"
    );
  }
}
