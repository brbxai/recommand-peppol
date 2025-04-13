import { Server } from "@recommand/lib/api";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { invoiceToUBL } from "@peppol/utils/parsing/invoice/to-xml";
import { requireTeamAccess } from "@core/lib/auth-middleware";
import { sendDocumentSchema, SendDocumentType } from "utils/parsing/send-document";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";

const server = new Server();

server.post(
  "/:teamId/sendDocument",
  requireTeamAccess(),
  describeRoute({
    description: 'Send a document to a customer',
    responses: {
      200: {
        description: 'Successfully sent document',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
              }
            }
          }
        }
      },
      400: {
        description: 'Invalid document data provided',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                errors: {
                  type: 'object',
                  additionalProperties: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              },
              required: ['success', 'errors']
            }
          }
        }
      }
    }
  }),
  zValidator("json", sendDocumentSchema),
  async (c) => {
    const jsonBody = c.req.valid("json");
    const document = jsonBody.document;
    if (jsonBody.documentType === SendDocumentType.INVOICE) {
      const ublInvoice = invoiceToUBL(document as Invoice);
      return c.json(actionSuccess({ ublInvoice }));
    } else if (jsonBody.documentType === SendDocumentType.UBL) {
      const ublInvoice = document;
      return c.json(actionSuccess({ ublInvoice }));
    }
    return c.json(actionFailure("Invalid document type"));
  }
);

export default server;