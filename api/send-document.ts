import { Server } from "@recommand/lib/api";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { invoiceToUBL } from "@peppol/utils/parsing/invoice/to-xml";
import {
  sendDocumentSchema,
  SendDocumentType,
} from "utils/parsing/send-document";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import { sendAs4 } from "@peppol/data/phase4-ap/client";
import { db } from "@recommand/db";
import { transferEvents, transmittedDocuments } from "@peppol/db/schema";
import { requireCompanyAccess } from "@peppol/utils/auth-middleware";

const server = new Server();

server.post(
  "/:companyId/sendDocument",
  requireCompanyAccess(),
  describeRoute({
    description: "Send a document to a customer",
    responses: {
      200: {
        description: "Successfully sent document",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
              },
            },
          },
        },
      },
      400: {
        description: "Invalid document data provided",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", enum: [false] },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
    },
  }),
  zValidator("json", sendDocumentSchema),
  async (c) => {
    try {
      const jsonBody = c.req.valid("json");
      const document = jsonBody.document;

      let xmlDocument: string | null = null;
      let doctypeId: string = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1";
      if (jsonBody.documentType === SendDocumentType.INVOICE) {
        const ublInvoice = invoiceToUBL(document as Invoice);
        xmlDocument = ublInvoice;
      } else if (jsonBody.documentType === SendDocumentType.UBL) {
        xmlDocument = document as string;
        if (jsonBody.doctypeId) {
          doctypeId = jsonBody.doctypeId;
        }
      } else {
        return c.json(actionFailure("Invalid document type provided."));
      }

      if (!xmlDocument) {
        return c.json(actionFailure("Document could not be parsed."));
      }

      // Parse recipient
      let recipient = jsonBody.recipient;
      if (!recipient.includes(":")) {
        const numberOnlyRecipient = recipient.replace(/[^0-9]/g, "");
        recipient = "0208:" + numberOnlyRecipient;
      }

      // Get senderId, countryC1 from company
      const company = c.var.company;
      const senderId = "0208:" + company.enterpriseNumber;
      const countryC1 = company.country;

      const response = await sendAs4({
        senderId: senderId,
        receiverId: recipient,
        docTypeId: doctypeId,
        processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
        countryC1: countryC1,
        body: xmlDocument,
      });

      if (!response.ok) {
        return c.json(actionFailure("Failed to send document over Peppol network."));
      }

      // Create a new transmittedDocument
      const transmittedDocument = await db.insert(transmittedDocuments).values({
        teamId: c.var.team.id,
        companyId: company.id,
        direction: "outgoing",
        senderId: senderId,
        receiverId: recipient,
        docTypeId: doctypeId,
        processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
        countryC1: countryC1,
        body: xmlDocument,
      }).returning({ id: transmittedDocuments.id }).then((rows) => rows[0]);

      // Create a new transferEvent for billing
      await db.insert(transferEvents).values({
        teamId: c.var.team.id,
        companyId: company.id,
        direction: "outgoing",
        transmittedDocumentId: transmittedDocument.id,
      });

      return c.json(actionSuccess());
    } catch (error) {
      return c.json(actionFailure(error instanceof Error ? error.message : "Failed to send document"));
    }
  }
);

export default server;
