import { sendEmail } from "@core/lib/email";
import { db } from "@recommand/db";
import { transferEvents, transmittedDocuments } from "@peppol/db/schema";
import {
  detectDoctypeId,
  parseDocument,
} from "@peppol/utils/parsing/parse-document";
import { sendAs4 } from "@peppol/data/phase4-ap/client";
import { simulateSendAs4 } from "@peppol/data/playground/simulate-ap";
import { getSendingCompanyIdentifier } from "@peppol/data/company-identifiers";
import { sendOutgoingDocumentNotifications } from "@peppol/data/send-document-notifications";
import { getDocumentTypeInfo } from "@peppol/utils/document-types";
import { validateXmlDocument } from "@peppol/data/validation/client";
import { getTeamExtension } from "@peppol/data/teams";
import { getCompanyBySendEmail } from "@peppol/data/companies";
import { ulid } from "ulid";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import type { CreditNote } from "@peppol/utils/parsing/creditnote/schemas";
import type { SelfBillingInvoice } from "@peppol/utils/parsing/self-billing-invoice/schemas";
import type { SelfBillingCreditNote } from "@peppol/utils/parsing/self-billing-creditnote/schemas";
import { EmailToPeppolError } from "@peppol/emails/email-to-peppol-error";

export interface SendDocumentFromEmailOptions {
  toEmail: string;
  fromEmail: string;
  xmlContent: string;
}

export interface SendDocumentFromEmailResult {
  success: boolean;
  documentId?: string;
  company?: string;
  type?: string;
  recipient?: string;
  error?: string;
  details?: string;
}

export async function sendDocumentFromEmail(
  options: SendDocumentFromEmailOptions
): Promise<SendDocumentFromEmailResult> {
  const { toEmail, fromEmail, xmlContent } = options;

  const company = await getCompanyBySendEmail(toEmail);
  if (!company) {
    await sendEmail({
      to: fromEmail,
      subject: "Error processing your Peppol document",
      email: EmailToPeppolError({
        error: "Unknown recipient address",
        details: `The email address ${toEmail} is not configured for document processing. Please check the email address and try again.`,
        hasXmlAttachment: true,
      }),
    });
    return { success: false, error: "Unknown company" };
  }

  const teamExtension = await getTeamExtension(company.teamId);
  const isPlayground = teamExtension?.isPlayground ?? false;
  const useTestNetwork = teamExtension?.useTestNetwork ?? false;

  const doctypeId = detectDoctypeId(xmlContent);
  if (!doctypeId) {
    await sendEmail({
      to: fromEmail,
      subject: "Error processing your Peppol document",
      email: EmailToPeppolError({
        error: "Invalid document type",
        details: "Document type could not be detected automatically. Please ensure you're sending a valid Peppol XML document.",
        companyName: company.name,
        hasXmlAttachment: true,
      }),
    });
    return {
      success: false,
      error: "Invalid document type",
      company: company.name,
    };
  }

  const validation = await validateXmlDocument(xmlContent);
  if (validation.result === "invalid") {
    const errorMessages = validation.errors
      .map((e) => `${e.fieldName}: ${e.errorMessage}`)
      .join("\n");

    await sendEmail({
      to: fromEmail,
      subject: "Error processing your Peppol document",
      email: EmailToPeppolError({
        error: "Document validation failed",
        details: errorMessages,
        companyName: company.name,
        hasXmlAttachment: true,
      }),
    });
    return {
      success: false,
      error: "Validation failed",
      company: company.name,
    };
  }

  const senderIdentifier = await getSendingCompanyIdentifier(company.id);
  const senderAddress = `${senderIdentifier.scheme}:${senderIdentifier.identifier}`;

  const parsed = parseDocument(doctypeId, xmlContent, company, senderAddress);
  const type = parsed.type;
  const parsedDocument = parsed.parsedDocument;

  let recipientAddress = "";

  if (type === "invoice" || type === "creditNote") {
    const doc = parsedDocument as Invoice | CreditNote;
    if (
      doc?.buyer?.endpointId?.schemeId &&
      doc?.buyer?.endpointId?.identifier
    ) {
      recipientAddress = `${doc.buyer.endpointId.schemeId}:${doc.buyer.endpointId.identifier}`;
    }
  } else if (
    type === "selfBillingInvoice" ||
    type === "selfBillingCreditNote"
  ) {
    const doc = parsedDocument as SelfBillingInvoice | SelfBillingCreditNote;
    if (
      doc?.seller?.endpointId?.schemeId &&
      doc?.seller?.endpointId?.identifier
    ) {
      recipientAddress = `${doc.seller.endpointId.schemeId}:${doc.seller.endpointId.identifier}`;
    }
  }

  if (!recipientAddress) {
    const partySection = type === "selfBillingInvoice" || type === "selfBillingCreditNote"
      ? "AccountingSupplierParty"
      : "AccountingCustomerParty";

    await sendEmail({
      to: fromEmail,
      subject: "Error processing your Peppol document",
      email: EmailToPeppolError({
        error: "Recipient Peppol address not found",
        details: `Please ensure the document includes the recipient's Peppol ID (EndpointID) in the ${partySection} section.`,
        companyName: company.name,
        hasXmlAttachment: true,
      }),
    });
    return {
      success: false,
      error: "No recipient address",
      company: company.name,
    };
  }

  let processId: string;
  try {
    processId = getDocumentTypeInfo(type).processId;
  } catch (error) {
    await sendEmail({
      to: fromEmail,
      subject: "Error processing your Peppol document",
      email: EmailToPeppolError({
        error: "Process ID detection failed",
        details: `Document type detected: ${type}. Please contact support if this issue persists.`,
        companyName: company.name,
        hasXmlAttachment: true,
      }),
    });
    return {
      success: false,
      error: "Process ID detection failed",
      company: company.name,
    };
  }

  const transmittedDocumentId = "doc_" + ulid();

  let sentPeppol = false;
  let peppolMessageId: string | null = null;
  let envelopeId: string | null = null;
  let additionalContext = "";

  if (isPlayground && !useTestNetwork) {
    try {
      await simulateSendAs4({
        senderId: senderAddress,
        receiverId: recipientAddress,
        docTypeId: doctypeId,
        processId,
        countryC1: company.country,
        body: xmlContent,
        playgroundTeamId: company.teamId,
      });
      sentPeppol = true;
    } catch (error) {
      additionalContext =
        error instanceof Error ? error.message : "Unknown error";
    }
  } else {
    const as4Response = await sendAs4({
      senderId: senderAddress,
      receiverId: recipientAddress,
      docTypeId: doctypeId,
      processId,
      countryC1: company.country,
      body: xmlContent,
      useTestNetwork,
    });

    if (!as4Response.ok) {
      additionalContext =
        as4Response.sendingException?.message ??
        "No additional context available";
    } else {
      sentPeppol = true;
      peppolMessageId = as4Response.peppolMessageId ?? null;
      envelopeId = as4Response.sbdhInstanceIdentifier ?? null;
    }
  }

  if (!sentPeppol) {
    await sendEmail({
      to: fromEmail,
      subject: "Error processing your Peppol document",
      email: EmailToPeppolError({
        error: "Failed to send document over Peppol",
        details: additionalContext,
        companyName: company.name,
        hasXmlAttachment: true,
      }),
    });
    return {
      success: false,
      error: "Peppol sending failed",
      company: company.name,
      details: additionalContext,
    };
  }

  const transmittedDocument = await db
    .insert(transmittedDocuments)
    .values({
      id: transmittedDocumentId,
      teamId: company.teamId,
      companyId: company.id,
      direction: "outgoing",
      senderId: senderAddress,
      receiverId: recipientAddress,
      docTypeId: doctypeId,
      processId,
      countryC1: company.country,
      xml: xmlContent,
      sentOverPeppol: sentPeppol,
      sentOverEmail: false,
      emailRecipients: [],
      type,
      parsed: parsedDocument,
      validation,
      peppolMessageId,
      peppolConversationId: null,
      receivedPeppolSignalMessage: null,
      envelopeId,
    })
    .returning({ id: transmittedDocuments.id })
    .then((rows) => rows[0]);

  if (!isPlayground) {
    await db.insert(transferEvents).values({
      teamId: company.teamId,
      companyId: company.id,
      direction: "outgoing",
      type: "peppol",
      transmittedDocumentId: transmittedDocument.id,
    });
  }

  try {
    await sendOutgoingDocumentNotifications({
      transmittedDocumentId: transmittedDocument.id,
      companyId: company.id,
      companyName: company.name,
      type,
      parsedDocument,
      xmlDocument: xmlContent,
      isPlayground,
    });
  } catch (error) {
    console.error("Failed to send outgoing document notifications:", error);
  }

  return {
    success: true,
    documentId: transmittedDocument.id,
    company: company.name,
    type,
    recipient: recipientAddress,
  };
}
