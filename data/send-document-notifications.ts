import { sendEmail } from "@core/lib/email";
import {
  getIncomingCompanyNotificationEmailAddresses,
  getOutgoingCompanyNotificationEmailAddresses,
} from "@peppol/data/company-notification-emails";
import DocumentIncomingNotification from "@peppol/emails/document-incoming-notification";
import DocumentOutgoingNotification from "@peppol/emails/document-outgoing-notification";
import { Attachment } from "postmark";
import {
  getDocumentTypeLabel,
  extractDocumentAttachments,
} from "@peppol/data/email/send-email";
import {
  getDocumentFilename,
  type ParsedDocument,
} from "@peppol/utils/document-filename";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { renderDocumentPdf } from "@peppol/utils/document-renderer";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import type { CreditNote } from "@peppol/utils/parsing/creditnote/schemas";
import type { SelfBillingCreditNote } from "@peppol/utils/parsing/self-billing-creditnote/schemas";
import type { SelfBillingInvoice } from "@peppol/utils/parsing/self-billing-invoice/schemas";
import type { DocumentType } from "@peppol/utils/document-types";

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

  if (
    "totals" in parsedDocument &&
    parsedDocument.totals &&
    typeof parsedDocument.totals === "object"
  ) {
    const totals = parsedDocument.totals as { payableAmount?: number | string };
    amount = totals.payableAmount?.toString();
    currency = "-";
    // TODO: Support multiple currencies
  }

  let sellerName = "Unknown";
  let buyerName = "Unknown";
  let senderName = "Unknown";
  let receiverName = "Unknown";
  if (["invoice", "creditNote"].includes(type)) {
    senderName =
      (parsedDocument as Invoice | CreditNote).seller?.name || "Unknown";
    receiverName =
      (parsedDocument as Invoice | CreditNote).buyer?.name || "Unknown";
    sellerName =
      (parsedDocument as Invoice | CreditNote).seller?.name || "Unknown";
    buyerName =
      (parsedDocument as Invoice | CreditNote).buyer?.name || "Unknown";
  } else if (["selfBillingInvoice", "selfBillingCreditNote"].includes(type)) {
    senderName =
      (parsedDocument as SelfBillingInvoice | SelfBillingCreditNote).buyer
        ?.name || "Unknown";
    receiverName =
      (parsedDocument as SelfBillingInvoice | SelfBillingCreditNote).seller
        ?.name || "Unknown";
    sellerName =
      (parsedDocument as SelfBillingInvoice | SelfBillingCreditNote).seller
        ?.name || "Unknown";
    buyerName =
      (parsedDocument as SelfBillingInvoice | SelfBillingCreditNote).buyer
        ?.name || "Unknown";
  }

  return {
    documentNumber,
    amount,
    currency,
    sellerName,
    buyerName,
    senderName,
    receiverName,
  };
}

export async function sendIncomingDocumentNotifications(options: {
  companyId: string;
  companyName: string;
  type: DocumentType;
  parsedDocument: ParsedDocument | null;
  xmlDocument: string;
  transmittedDocumentId: string;
  isPlayground?: boolean;
}): Promise<void> {
  try {
    const notificationEmails =
      await getIncomingCompanyNotificationEmailAddresses(options.companyId);

    if (notificationEmails.length === 0) {
      return;
    }

    const { documentNumber, amount, currency, senderName, receiverName } =
      extractDocumentDetails(options.parsedDocument, options.type);

    const documentTypeLabel = getDocumentTypeLabel(options.type);
    let subject = documentNumber
      ? `New ${documentTypeLabel} Received: ${documentNumber}`
      : `New ${documentTypeLabel} Received - ${options.companyName}`;

    if (options.isPlayground) {
      subject = `[PLAYGROUND/TEST] ${subject}`;
    }

    const attachments = extractDocumentAttachments(options.parsedDocument);
    const filename = getDocumentFilename(options.type, options.parsedDocument);

    const baseAttachments = [...attachments];

    if (options.xmlDocument) {
      const xmlAttachment: Attachment = {
        Content: Buffer.from(options.xmlDocument, "utf-8").toString("base64"),
        ContentID: null,
        ContentType: "application/xml",
        Name: filename + ".xml",
      };
      baseAttachments.push(xmlAttachment);
    }

    const shouldIncludePdf = notificationEmails.some(
      (notificationEmail) => notificationEmail.includeAutoGeneratedPdfIncoming
    );
    const shouldIncludeJson = notificationEmails.some(
      (notificationEmail) => notificationEmail.includeDocumentJsonIncoming
    );

    let autoGeneratedPdfAttachment: Attachment | null = null;
    if (shouldIncludePdf && options.parsedDocument) {
      try {
        const pdfBuffer = await renderDocumentPdf({
          id: options.transmittedDocumentId,
          type: options.type,
          parsed: options.parsedDocument,
        } as any);
        autoGeneratedPdfAttachment = {
          Content: Buffer.from(pdfBuffer).toString("base64"),
          ContentID: null,
          ContentType: "application/pdf",
          Name: "auto-generated.pdf",
        };
      } catch (error) {
        console.error(
          "Failed to generate auto-generated PDF for incoming notification:",
          error
        );
        sendSystemAlert(
          "Document Notification Attachment Failed",
          `Failed to generate auto-generated PDF for incoming document ${options.transmittedDocumentId}.`,
          "error"
        );
      }
    }

    let documentJsonAttachment: Attachment | null = null;
    if (shouldIncludeJson) {
      const documentJson = JSON.stringify(
        {
          id: options.transmittedDocumentId,
          companyId: options.companyId,
          companyName: options.companyName,
          direction: "incoming",
          type: options.type,
          parsed: options.parsedDocument,
        },
        null,
        2
      );
      documentJsonAttachment = {
        Content: Buffer.from(documentJson, "utf-8").toString("base64"),
        ContentID: null,
        ContentType: "application/json",
        Name: "document.json",
      };
    }

    for (const notificationEmail of notificationEmails) {
      try {
        const extraAttachments: Attachment[] = [];
        if (
          notificationEmail.includeAutoGeneratedPdfIncoming &&
          autoGeneratedPdfAttachment
        ) {
          extraAttachments.push(autoGeneratedPdfAttachment);
        }
        if (
          notificationEmail.includeDocumentJsonIncoming &&
          documentJsonAttachment
        ) {
          extraAttachments.push(documentJsonAttachment);
        }

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
          attachments: [...baseAttachments, ...extraAttachments],
        });
      } catch (error) {
        console.error(
          `Failed to send incoming document notification to ${notificationEmail.email}:`,
          error
        );
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
  xmlDocument: string | null;
  transmittedDocumentId: string;
  isPlayground?: boolean;
}): Promise<void> {
  try {
    const notificationEmails =
      await getOutgoingCompanyNotificationEmailAddresses(options.companyId);

    if (notificationEmails.length === 0) {
      return;
    }

    const { documentNumber, amount, currency, receiverName } =
      extractDocumentDetails(options.parsedDocument, options.type);

    const documentTypeLabel = getDocumentTypeLabel(options.type);
    let subject = documentNumber
      ? `${documentTypeLabel} Sent Successfully: ${documentNumber}`
      : `${documentTypeLabel} Sent Successfully - ${options.companyName}`;

    if (options.isPlayground) {
      subject = `[PLAYGROUND/TEST] ${subject}`;
    }

    const attachments = extractDocumentAttachments(options.parsedDocument);
    const filename = getDocumentFilename(options.type, options.parsedDocument);

    const baseAttachments = [...attachments];

    if (options.xmlDocument) {
      const xmlAttachment: Attachment = {
        Content: Buffer.from(options.xmlDocument, "utf-8").toString("base64"),
        ContentID: null,
        ContentType: "application/xml",
        Name: filename + ".xml",
      };
      baseAttachments.push(xmlAttachment);
    }

    const shouldIncludePdf = notificationEmails.some(
      (notificationEmail) => notificationEmail.includeAutoGeneratedPdfOutgoing
    );
    const shouldIncludeJson = notificationEmails.some(
      (notificationEmail) => notificationEmail.includeDocumentJsonOutgoing
    );

    let autoGeneratedPdfAttachment: Attachment | null = null;
    if (shouldIncludePdf && options.parsedDocument) {
      try {
        const pdfBuffer = await renderDocumentPdf({
          id: options.transmittedDocumentId,
          type: options.type,
          parsed: options.parsedDocument,
        } as any);
        autoGeneratedPdfAttachment = {
          Content: Buffer.from(pdfBuffer).toString("base64"),
          ContentID: null,
          ContentType: "application/pdf",
          Name: "auto-generated.pdf",
        };
      } catch (error) {
        console.error(
          "Failed to generate auto-generated PDF for outgoing notification:",
          error
        );
        sendSystemAlert(
          "Document Notification Attachment Failed",
          `Failed to generate auto-generated PDF for outgoing document ${options.transmittedDocumentId}.`,
          "error"
        );
      }
    }

    let documentJsonAttachment: Attachment | null = null;
    if (shouldIncludeJson) {
      const documentJson = JSON.stringify(
        {
          id: options.transmittedDocumentId,
          companyId: options.companyId,
          companyName: options.companyName,
          direction: "outgoing",
          type: options.type,
          parsed: options.parsedDocument,
        },
        null,
        2
      );
      documentJsonAttachment = {
        Content: Buffer.from(documentJson, "utf-8").toString("base64"),
        ContentID: null,
        ContentType: "application/json",
        Name: "document.json",
      };
    }

    for (const notificationEmail of notificationEmails) {
      try {
        const extraAttachments: Attachment[] = [];
        if (
          notificationEmail.includeAutoGeneratedPdfOutgoing &&
          autoGeneratedPdfAttachment
        ) {
          extraAttachments.push(autoGeneratedPdfAttachment);
        }
        if (
          notificationEmail.includeDocumentJsonOutgoing &&
          documentJsonAttachment
        ) {
          extraAttachments.push(documentJsonAttachment);
        }

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
          attachments: [...baseAttachments, ...extraAttachments],
        });
      } catch (error) {
        console.error(
          `Failed to send outgoing document notification to ${notificationEmail.email}:`,
          error
        );
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
