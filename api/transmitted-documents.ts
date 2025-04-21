import { Server } from "@recommand/lib/api";
import { z } from "zod";
import "zod-openapi/extend";
import { validator as zValidator } from "hono-openapi/zod";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { requireTeamAccess } from "@core/lib/auth-middleware";
import { describeRoute } from "hono-openapi";
import {
  getTransmittedDocuments,
  deleteTransmittedDocument,
  getInbox,
  markAsRead,
  getTransmittedDocument,
} from "@peppol/data/transmitted-documents";
import {
  describeErrorResponse,
  describeSuccessResponse,
} from "@peppol/utils/api-docs";

const describeTransmittedDocumentResponse = {
  document: {
    type: "object",
    properties: {
      id: { type: "string" },
      teamId: { type: "string" },
      companyId: { type: "string" },
      direction: {
        type: "string",
        enum: ["incoming", "outgoing"],
      },
      senderId: { type: "string" },
      receiverId: { type: "string" },
      docTypeId: { type: "string" },
      processId: { type: "string" },
      countryC1: { type: "string" },
      type: { type: "string" },
      readAt: { type: "string", format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      xml: { type: "string" },
      parsed: { type: "object" },
    },
  },
};

const server = new Server();

// List transmitted documents with pagination
const _transmittedDocuments = server.get(
  "/:teamId/documents",
  requireTeamAccess(),
  describeRoute({
    operationId: "getDocuments",
    description: "Get a list of transmitted documents with pagination",
    summary: "List Documents",
    tags: ["Documents"],
    responses: {
      ...describeSuccessResponse(
        "Successfully retrieved transmitted documents",
        {
          documents: {
            type: "array",
            items: describeTransmittedDocumentResponse.document,
          },
          pagination: {
            type: "object",
            properties: {
              total: { type: "number" },
              page: { type: "number" },
              limit: { type: "number" },
              totalPages: { type: "number" },
            },
          },
        }
      ),
      ...describeErrorResponse(500, "Failed to fetch transmitted documents"),
    },
  }),
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().min(1).default(1).openapi({
        description: "The page number to retrieve",
        example: 1,
      }),
      limit: z.coerce.number().min(1).max(100).default(10).openapi({
        description: "The number of items per page",
        example: 10,
      }),
      companyId: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .openapi({
          description: "Filter documents by company ID",
          example: [
            "c_01JRQVH6J3FJMVS220E9ZRECWC",
            "c_01JRQVH6J3FJMVS220E9ZRECWD",
          ],
        }),
      direction: z.enum(["incoming", "outgoing"]).optional().openapi({
        description: "Filter documents by direction (incoming or outgoing)",
        example: "incoming",
      }),
      search: z.string().optional().openapi({
        description: "Search term to filter documents",
        example: "invoice",
      }),
    })
  ),
  async (c) => {
    try {
      const { page, limit, companyId, direction, search } =
        c.req.valid("query");
      const { documents, total } = await getTransmittedDocuments(
        c.var.team.id,
        {
          page,
          limit,
          companyId: Array.isArray(companyId)
            ? companyId
            : companyId
            ? [companyId]
            : undefined,
          direction,
          search,
        }
      );

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
      return c.json(
        actionFailure("Failed to fetch transmitted documents"),
        500
      );
    }
  }
);

// Delete a transmitted document
const _deleteTransmittedDocument = server.delete(
  "/:teamId/documents/:documentId",
  requireTeamAccess(),
  describeRoute({
    operationId: "deleteDocument",
    description: "Delete a transmitted document",
    summary: "Delete Document",
    tags: ["Documents"],
    responses: {
      ...describeSuccessResponse("Successfully deleted the document"),
      ...describeErrorResponse(404, "Document not found"),
      ...describeErrorResponse(500, "Failed to delete document"),
    },
  }),
  zValidator(
    "param",
    z.object({
      teamId: z.string().openapi({
        description: "The ID of the team",
        example: "team_01JQNRVSGW308K2P115PK98W7E",
      }),
      documentId: z.string().openapi({
        description: "The ID of the document to delete",
        example: "doc_01JRQNNPRRV13732DFB3FNR1T9",
      }),
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

// Get inbox (without pagination)
const _getInbox = server.get(
  "/:teamId/inbox",
  requireTeamAccess(),
  describeRoute({
    operationId: "getInbox",
    description: "List all unread incoming documents.",
    summary: "Inbox",
    tags: ["Documents"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved inbox documents", {
        documents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              teamId: { type: "string" },
              companyId: { type: "string" },
              direction: { type: "string", enum: ["incoming"] },
              senderId: { type: "string" },
              receiverId: { type: "string" },
              docTypeId: { type: "string" },
              processId: { type: "string" },
              countryC1: { type: "string" },
              type: { type: "string" },
              readAt: { type: "string", format: "date-time" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      }),
      ...describeErrorResponse(500, "Failed to fetch inbox documents"),
    },
  }),
  zValidator(
    "query",
    z.object({
      companyId: z.string().optional().openapi({
        description: "Optionally filter documents by company ID",
        example: "c_01JRQVH6J3FJMVS220E9ZRECWC",
      }),
    })
  ),
  async (c) => {
    try {
      const { companyId } = c.req.valid("query");
      const documents = await getInbox(c.var.team.id, companyId);
      return c.json(actionSuccess({ documents }));
    } catch (error) {
      return c.json(actionFailure("Failed to fetch inbox documents"), 500);
    }
  }
);

// Mark document as read or unread
const _markAsRead = server.post(
  "/:teamId/documents/:documentId/markAsRead",
  requireTeamAccess(),
  describeRoute({
    operationId: "markAsRead",
    description: "Mark a document as read or unread",
    summary: "Mark Document as Read",
    tags: ["Documents"],
    responses: {
      ...describeSuccessResponse("Successfully updated document read status"),
      ...describeErrorResponse(404, "Document not found"),
      ...describeErrorResponse(500, "Failed to update document read status"),
    },
  }),
  zValidator(
    "param",
    z.object({
      teamId: z.string().openapi({
        description: "The ID of the team",
        example: "team_01JQNRVSGW308K2P115PK98W7E",
      }),
      documentId: z.string().openapi({
        description: "The ID of the document to update read status",
        example: "doc_01JRQNNPRRV13732DFB3FNR1T9",
      }),
    })
  ),
  zValidator(
    "json",
    z
      .object({
        read: z.boolean().optional().default(true).openapi({
          description:
            "Whether to mark the document as read (true) or unread (false). If not provided, defaults to true.",
          example: true,
        }),
      })
      .optional()
  ),
  async (c) => {
    try {
      const { documentId } = c.req.valid("param");
      const { read = true } = c.req.valid("json") ?? {};
      await markAsRead(c.var.team.id, documentId, read);
      return c.json(actionSuccess());
    } catch (error) {
      if (error instanceof Error && error.message === "Document not found") {
        return c.json(actionFailure("Document not found"), 404);
      }
      return c.json(
        actionFailure("Failed to update document read status"),
        500
      );
    }
  }
);

// Get a single transmitted document
const _getTransmittedDocument = server.get(
  "/:teamId/documents/:documentId",
  requireTeamAccess(),
  describeRoute({
    operationId: "getDocument",
    description: "Get a single transmitted document by ID",
    summary: "Get Document",
    tags: ["Documents"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved the document", describeTransmittedDocumentResponse),
      ...describeErrorResponse(404, "Document not found"),
      ...describeErrorResponse(500, "Failed to fetch document"),
    },
  }),
  zValidator(
    "param",
    z.object({
      teamId: z.string().openapi({
        description: "The ID of the team",
        example: "team_01JQNRVSGW308K2P115PK98W7E",
      }),
      documentId: z.string().openapi({
        description: "The ID of the document to retrieve",
        example: "doc_01JRQNNPRRV13732DFB3FNR1T9",
      }),
    })
  ),
  async (c) => {
    try {
      const { documentId } = c.req.valid("param");
      const document = await getTransmittedDocument(c.var.team.id, documentId);

      if (!document) {
        return c.json(actionFailure("Document not found"), 404);
      }

      return c.json(actionSuccess({ document }));
    } catch (error) {
      return c.json(actionFailure("Failed to fetch document"), 500);
    }
  }
);

export type TransmittedDocuments =
  | typeof _transmittedDocuments
  | typeof _deleteTransmittedDocument
  | typeof _getInbox
  | typeof _markAsRead
  | typeof _getTransmittedDocument;

export default server;
