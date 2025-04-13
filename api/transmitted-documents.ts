import { Server } from "@recommand/lib/api";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { requireTeamAccess } from "@core/lib/auth-middleware";
import {
  getTransmittedDocuments,
  deleteTransmittedDocument,
} from "@peppol/data/transmitted-documents";

const server = new Server();

// List transmitted documents with pagination
const _transmittedDocuments = server.get(
  "/:teamId/transmitted-documents",
  requireTeamAccess(),
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      companyId: z.string().optional(),
      direction: z.enum(["incoming", "outgoing"]).optional(),
    })
  ),
  async (c) => {
    try {
      const { page, limit, companyId, direction } = c.req.valid("query");
      const { documents, total } = await getTransmittedDocuments(c.var.team.id, {
        page,
        limit,
        companyId,
        direction,
      });

      return c.json(
        actionSuccess({
          documents,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        })
      );
    } catch (error) {
      return c.json(actionFailure("Failed to fetch transmitted documents"), 500);
    }
  }
);

// Delete a transmitted document
const _deleteTransmittedDocument = server.delete(
  "/:teamId/transmitted-documents/:documentId",
  requireTeamAccess(),
  zValidator(
    "param",
    z.object({
      teamId: z.string(),
      documentId: z.string(),
    })
  ),
  async (c) => {
    try {
      const { documentId } = c.req.valid("param");
      await deleteTransmittedDocument(c.var.team.id, documentId);
      return c.json(actionSuccess());
    } catch (error) {
      if (error instanceof Error && error.message === "Document not found") {
        return c.json(actionFailure("Document not found"), 404);
      }
      return c.json(actionFailure("Failed to delete document"), 500);
    }
  }
);

export type TransmittedDocuments =
  | typeof _transmittedDocuments
  | typeof _deleteTransmittedDocument;

export default server; 