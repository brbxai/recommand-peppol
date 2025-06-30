import { Server } from "@recommand/lib/api";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireInternalToken } from "@peppol/utils/auth-middleware";
import { db } from "@recommand/db";
import { transferEvents, transmittedDocuments } from "@peppol/db/schema";
import { getCompanyByPeppolId } from "@peppol/data/companies";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { parseInvoiceFromXML } from "@peppol/utils/parsing/invoice/from-xml";
import { callWebhook, getWebhooksByCompany } from "@peppol/data/webhooks";
import { parseCreditNoteFromXML } from "@peppol/utils/parsing/creditnote/from-xml";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";

export const receiveDocumentSchema = z.object({
  senderId: z.string(),
  receiverId: z.string(),
  docTypeId: z.string(),
  processId: z.string(),
  countryC1: z.string(),
  body: z.string(),
});

const server = new Server();

server.post(
  "/receiveDocument",
  requireInternalToken(),
  zValidator("json", receiveDocumentSchema),
  async (c) => {
    const jsonBody = c.req.valid("json");

    // The sender and receiver id might start with iso6523-actorid-upis::
    const senderId = jsonBody.senderId.startsWith("iso6523-actorid-upis::")
      ? jsonBody.senderId.split("::")[1]
      : jsonBody.senderId;
    const receiverId = jsonBody.receiverId.startsWith("iso6523-actorid-upis::")
      ? jsonBody.receiverId.split("::")[1]
      : jsonBody.receiverId;

    // Get the teamId and companyId from the receiverId
    const company = await getCompanyByPeppolId(receiverId);
    if (!company) {
      return c.json(actionFailure("Company not found"), 404);
    }

    // Parse the XML document
    let parsedDocument = null;
    let type: "invoice" | "creditNote" | "unknown" = "unknown";
    if (jsonBody.docTypeId.includes("Invoice")) {
      try {
        parsedDocument = parseInvoiceFromXML(jsonBody.body);
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
    } else if (jsonBody.docTypeId.includes("CreditNote")) {
      try {
        parsedDocument = parseCreditNoteFromXML(jsonBody.body);
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
        docTypeId: jsonBody.docTypeId,
        processId: jsonBody.processId,
        countryC1: jsonBody.countryC1,
        xml: jsonBody.body,
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
    await db.insert(transferEvents).values({
      teamId: company.teamId,
      companyId: company.id,
      direction: "incoming",
      transmittedDocumentId: transmittedDocument.id,
    });

    return c.json(actionSuccess(), 200);
  }
);

export default server;
