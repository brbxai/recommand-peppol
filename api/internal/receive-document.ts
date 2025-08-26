import { Server } from "@recommand/lib/api";
import { zodValidator } from "@recommand/lib/zod-validator";
import { z } from "zod";
import { requireInternalToken } from "@peppol/utils/auth-middleware";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { receiveDocument } from "@peppol/data/receive-document";
import { UserFacingError } from "@peppol/utils/util";

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
  zodValidator("json", receiveDocumentSchema),
  async (c) => {
    const jsonBody = c.req.valid("json");

    try {
      await receiveDocument(jsonBody);
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error), 400);
      }
      return c.json(actionFailure("Unknown error"), 500);
    }

    return c.json(actionSuccess(), 200);
  }
);

export default server;
