import { Server } from "@recommand/lib/api";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { actionSuccess } from "@recommand/lib/utils";
import { simpleInvoiceSchema } from "utils/parsing/simple-invoice/schemas";
import { simpleInvoiceToUBL } from "utils/parsing/simple-invoice/to-xml";

const server = new Server();

server.post(
  "/create",
  describeRoute({
    description: 'Create an invoice in UBL format',
    responses: {
      200: {
        description: 'Successfully created invoice in UBL format',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    ublInvoice: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      400: {
        description: 'Invalid invoice data provided',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                error: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }),
  zValidator("json", simpleInvoiceSchema),
  async (c) => {
    const invoice = c.req.valid("json");
    const ublInvoice = simpleInvoiceToUBL(invoice);
    return c.json(actionSuccess({ ublInvoice }));
  }
);

export default server;