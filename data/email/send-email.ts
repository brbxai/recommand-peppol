import { sendEmail } from "@core/lib/email";
import { Attachment } from "postmark";
import type { DocumentType } from "@peppol/utils/document-types";
import {
  getDocumentFilename,
  type ParsedDocument,
} from "@peppol/utils/document-filename";
import { getCompanyCustomDomain } from "@peppol/data/company-custom-domains";
import { getCompanyById } from "@peppol/data/companies";
import { getActiveSubscription } from "@peppol/data/subscriptions";
import { isPlayground } from "@peppol/data/teams";
import { canUseCustomDomains } from "@peppol/utils/plan-validation";

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

export function extractDocumentAttachments(
  parsedDocument: ParsedDocument | null
): Attachment[] {
  const attachments: Attachment[] = [];
  if (
    parsedDocument &&
    "attachments" in parsedDocument &&
    parsedDocument.attachments
  ) {
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

export async function sendDocumentEmail(options: {
  type: DocumentType;
  parsedDocument: ParsedDocument | null;
  xmlDocument: string | null;
  to: string;
  subject?: string;
  htmlBody?: string;
  isPlayground?: boolean;
  companyId?: string;
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
    } else if (
      options.parsedDocument &&
      "creditNoteNumber" in options.parsedDocument
    ) {
      subject = `${documentTypeLabel} ${options.parsedDocument.creditNoteNumber}`;
      senderName = options.parsedDocument.seller.name;
    } else {
      subject = documentTypeLabel;
    }
  }

  if (!htmlBody) {
    const documentTypeLabel = getDocumentTypeLabel(options.type).toLowerCase();
    if (
      options.parsedDocument &&
      "buyer" in options.parsedDocument &&
      options.parsedDocument.buyer?.name
    ) {
      htmlBody = `Dear ${options.parsedDocument.buyer.name}, you can find your ${documentTypeLabel} attached.`;
    } else {
      htmlBody = `Dear, you can find your ${documentTypeLabel} attached.`;
    }
  }

  if (options.isPlayground) {
    subject = `[PLAYGROUND/TEST] ${subject}`;
  }

  const attachments = extractDocumentAttachments(options.parsedDocument);

  if (options.xmlDocument) {
    const xmlAttachment: Attachment = {
      Content: Buffer.from(options.xmlDocument, "utf-8").toString("base64"),
      ContentID: null,
      ContentType: "application/xml",
      Name: filename + ".xml",
    };
    attachments.push(xmlAttachment);
  }

  // Determine the from address - use custom domain if available, verified, and on a paid plan
  let fromAddress: string;
  const defaultAddress = senderName
    ? `${senderName} <noreply-documents@recommand.eu>`
    : "noreply-documents@recommand.eu";

  if (options.companyId) {
    const customDomain = await getCompanyCustomDomain(options.companyId);
    if (customDomain?.dkimVerified) {
      // Check if the company is on a paid plan
      const company = await getCompanyById(options.companyId);
      if (company) {
        const teamIsPlayground = await isPlayground(company.teamId);
        const subscription = await getActiveSubscription(company.teamId);
        if (canUseCustomDomains(teamIsPlayground, subscription)) {
          // Use custom sender email
          fromAddress = senderName
            ? `${senderName} <${customDomain.senderEmail}>`
            : customDomain.senderEmail;
        } else {
          // Not on a paid plan, fall back to default
          fromAddress = defaultAddress;
        }
      } else {
        fromAddress = defaultAddress;
      }
    } else {
      fromAddress = defaultAddress;
    }
  } else {
    fromAddress = defaultAddress;
  }

  await sendEmail({
    from: fromAddress,
    to: options.to,
    subject: subject,
    email: htmlBody,
    attachments: attachments,
  });
}
