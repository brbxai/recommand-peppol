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
      200: {
        description: "Successfully retrieved transmitted documents",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                documents: {
                  type: "array",
                  items: {
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
                    },
                  },
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
              },
            },
          },
        },
      },
      500: {
        description: "Failed to fetch transmitted documents",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
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
      companyId: z.string().optional().openapi({
        description: "Filter documents by company ID",
        example: "c_01JRQVH6J3FJMVS220E9ZRECWC",
      }),
      direction: z.enum(["incoming", "outgoing"]).optional().openapi({
        description: "Filter documents by direction (incoming or outgoing)",
        example: "incoming",
      }),
    })
  ),
  async (c) => {
    try {
      const { page, limit, companyId, direction } = c.req.valid("query");
      const { documents, total } = await getTransmittedDocuments(
        c.var.team.id,
        {
          page,
          limit,
          companyId,
          direction,
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
      200: {
        description: "Successfully deleted the document",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
              },
            },
          },
        },
      },
      404: {
        description: "Document not found",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
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
      500: {
        description: "Failed to delete document",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
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
      200: {
        description: "Successfully retrieved inbox documents",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
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
              },
            },
          },
        },
      },
      500: {
        description: "Failed to fetch inbox documents",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
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
      200: {
        description: "Successfully updated document read status",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
              },
            },
          },
        },
      },
      404: {
        description: "Document not found",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
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
      500: {
        description: "Failed to update document read status",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
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
      200: {
        description: "Successfully retrieved the document",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
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
              },
            },
          },
        },
      },
      404: {
        description: "Document not found",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
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
      500: {
        description: "Failed to fetch document",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
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
