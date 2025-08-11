import { db } from "@recommand/db";
import { transferEvents, transmittedDocuments } from "@peppol/db/schema";
import { getCompanyByPeppolId } from "@peppol/data/companies";
import { parseInvoiceFromXML } from "@peppol/utils/parsing/invoice/from-xml";
import { callWebhook, getWebhooksByCompany } from "@peppol/data/webhooks";
import { parseCreditNoteFromXML } from "@peppol/utils/parsing/creditnote/from-xml";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { UserFacingError } from "@peppol/utils/util";

export async function receiveDocument(options: {
  senderId: string;
  receiverId: string;
  docTypeId: string;
  processId: string;
  countryC1: string;
  body: string;
  skipBilling?: boolean;
  playgroundTeamId?: string;
}) {
  // The sender and receiver id might start with iso6523-actorid-upis::
  const senderId = options.senderId.startsWith("iso6523-actorid-upis::")
    ? options.senderId.split("::")[1]
    : options.senderId;
  const receiverId = options.receiverId.startsWith("iso6523-actorid-upis::")
    ? options.receiverId.split("::")[1]
    : options.receiverId;

  // Get the teamId and companyId from the receiverId
  const company = await getCompanyByPeppolId(receiverId, options.playgroundTeamId);
  if (!company) {
    throw new UserFacingError("Company not found");
  }

  // Parse the XML document
  let parsedDocument = null;
  let type: "invoice" | "creditNote" | "unknown" = "unknown";
  if (options.docTypeId.includes("Invoice")) {
    try {
      parsedDocument = parseInvoiceFromXML(options.body);
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
  } else if (options.docTypeId.includes("CreditNote")) {
    try {
      parsedDocument = parseCreditNoteFromXML(options.body);
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

  // Create a new transmittedDocument
  const transmittedDocument = await db
    .insert(transmittedDocuments)
    .values({
      teamId: company.teamId,
      companyId: company.id,
      direction: "incoming",
      senderId: senderId,
      receiverId: receiverId,
      docTypeId: options.docTypeId,
      processId: options.processId,
      countryC1: options.countryC1,
      xml: options.body,
      type,
      parsed: parsedDocument,
    })
    .returning({ id: transmittedDocuments.id })
    .then((rows) => rows[0]);

  // Call the webhooks
  try {
    const webhooks = await getWebhooksByCompany(company.teamId, company.id);
    for (const webhook of webhooks) {
      try {
        await callWebhook(webhook, {
          id: transmittedDocument.id,
          teamId: company.teamId,
          companyId: company.id,
        });
      } catch (error) {
        console.error("Failed to call webhook:", error);
      }
    }
  } catch (error) {
    console.error("Failed to call webhooks:", error);
  }

  // Create a new transferEvent for billing
  if (!options.skipBilling) {
    await db.insert(transferEvents).values({
      teamId: company.teamId,
      companyId: company.id,
      direction: "incoming",
      transmittedDocumentId: transmittedDocument.id,
    });
  }
}
