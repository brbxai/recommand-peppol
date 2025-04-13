import { Server } from "@recommand/lib/api";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { invoiceToUBL } from "@peppol/utils/parsing/invoice/to-xml";
import { requireTeamAccess } from "@core/lib/auth-middleware";
import {
  sendDocumentSchema,
  SendDocumentType,
} from "utils/parsing/send-document";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import { sendAs4 } from "@peppol/data/phase4-ap/client";

const server = new Server();

server.post(
  "/:teamId/sendDocument",
  requireTeamAccess(),
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
      let doctypeId: string | null = null;
      if (jsonBody.documentType === SendDocumentType.INVOICE) {
        const ublInvoice = invoiceToUBL(document as Invoice);
        xmlDocument = ublInvoice;
        doctypeId = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1"
      } else if (jsonBody.documentType === SendDocumentType.UBL) {
        xmlDocument = document as string;
      } else {
        return c.json(actionFailure("Invalid document type provided."));
      }

      if (!xmlDocument) {
        return c.json(actionFailure("Document could not be parsed."));
      }

      if (!doctypeId) {
        return c.json(actionFailure("Document type could not be determined."));
      }

      // Parse recipient
      let recipient = jsonBody.recipient;
      if (!recipient.includes(":")) {
        const numberOnlyRecipient = recipient.replace(/[^0-9]/g, "");
        recipient = "0208:" + numberOnlyRecipient;
      }

      // TODO: get senderId, countryC1, as well as some invoice details from peppol_companies

      const response = await sendAs4({
        senderId: "0208:0659689080",
        receiverId: recipient,
        docTypeId: doctypeId,
        processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
        countryC1: "BE",
        body: xmlDocument,
      });

      if (!response.ok) {
        return c.json(actionFailure("Failed to send document over Peppol network."));
      }

      return c.json(actionSuccess());
    } catch (error) {
      return c.json(actionFailure(error instanceof Error ? error.message : "Failed to send document"));
    }
  }
);

export default server;
