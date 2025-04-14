import { requireTeamAccess } from "@core/lib/auth-middleware";
import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  getWebhooks,
  updateWebhook,
  getWebhooksByCompany,
} from "@peppol/data/webhooks";
import { Server } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { validator as zValidator } from "hono-openapi/zod";
import { describeRoute } from "hono-openapi";

const server = new Server();

const _webhooks = server.get(
  "/:teamId/webhooks",
  requireTeamAccess(),
  describeRoute({
    description: "Get a list of all webhooks for a team",
    summary: "List Webhooks",
    tags: ["Webhooks"],
    parameters: [
      {
        name: "companyId",
        in: "query",
        required: false,
        schema: {
          type: "string",
          nullable: true
        }
      }
    ],
    responses: {
      200: {
        description: "Successfully retrieved webhooks",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", enum: [true] },
                data: {
                  type: "object",
                  properties: {
                    webhooks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          teamId: { type: "string" },
                          companyId: { type: "string", nullable: true },
                          url: { type: "string" },
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
        },
      },
      500: {
        description: "Failed to fetch webhooks",
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
  zValidator("param", z.object({ teamId: z.string() })),
  zValidator("query", z.object({ companyId: z.string().nullish() })),
  async (c) => {
    try {
      const { companyId } = c.req.valid("query");
      const allWebhooks = companyId 
        ? await getWebhooksByCompany(c.var.team.id, companyId)
        : await getWebhooks(c.var.team.id);
      return c.json(actionSuccess({ webhooks: allWebhooks }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch webhooks"), 500);
    }
  }
);

const _webhook = server.get(
  "/:teamId/webhooks/:webhookId",
  requireTeamAccess(),
  describeRoute({
    description: "Get a specific webhook by ID",
    summary: "Get Webhook",
    tags: ["Webhooks"],
    responses: {
      200: {
        description: "Successfully retrieved webhook",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", enum: [true] },
                data: {
                  type: "object",
                  properties: {
                    webhook: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        teamId: { type: "string" },
                        companyId: { type: "string", nullable: true },
                        url: { type: "string" },
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
      },
      404: {
        description: "Webhook not found",
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
      500: {
        description: "Failed to fetch webhook",
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
  zValidator("param", z.object({ teamId: z.string(), webhookId: z.string() })),
  async (c) => {
    try {
      const webhook = await getWebhook(
        c.var.team.id,
        c.req.valid("param").webhookId
      );
      if (!webhook) {
        return c.json(actionFailure("Webhook not found"), 404);
      }
      return c.json(actionSuccess({ webhook }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch webhook"), 500);
    }
  }
);

const _createWebhook = server.post(
  "/:teamId/webhooks",
  requireTeamAccess(),
  describeRoute({
    description: "Create a new webhook",
    summary: "Create Webhook",
    tags: ["Webhooks"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              url: { type: "string" },
              companyId: { type: "string", nullable: true },
            },
            required: ["url"],
          },
        },
      },
    },
    responses: {
      200: {
        description: "Successfully created webhook",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", enum: [true] },
                data: {
                  type: "object",
                  properties: {
                    webhook: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        teamId: { type: "string" },
                        companyId: { type: "string", nullable: true },
                        url: { type: "string" },
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
      },
      400: {
        description: "Invalid request data",
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
      500: {
        description: "Failed to create webhook",
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
  zValidator("param", z.object({ teamId: z.string() })),
  zValidator(
    "json",
    z.object({
      url: z.string().url(),
      companyId: z.string().nullish(),
    })
  ),
  async (c) => {
    try {
      const webhook = await createWebhook({
        ...c.req.valid("json"),
        teamId: c.var.team.id,
      });
      return c.json(actionSuccess({ webhook }));
    } catch (error) {
      return c.json(actionFailure("Could not create webhook"), 500);
    }
  }
);

const _updateWebhook = server.put(
  "/:teamId/webhooks/:webhookId",
  requireTeamAccess(),
  describeRoute({
    description: "Update an existing webhook",
    summary: "Update Webhook",
    tags: ["Webhooks"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              url: { type: "string" },
              companyId: { type: "string", nullable: true },
            },
            required: ["url"],
          },
        },
      },
    },
    responses: {
      200: {
        description: "Successfully updated webhook",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", enum: [true] },
                data: {
                  type: "object",
                  properties: {
                    webhook: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        teamId: { type: "string" },
                        companyId: { type: "string", nullable: true },
                        url: { type: "string" },
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
      },
      400: {
        description: "Invalid request data",
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
      404: {
        description: "Webhook not found",
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
      500: {
        description: "Failed to update webhook",
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
  zValidator("param", z.object({ teamId: z.string(), webhookId: z.string() })),
  zValidator(
    "json",
    z.object({
      url: z.string().url(),
      companyId: z.string().nullish(),
    })
  ),
  async (c) => {
    try {
      const webhook = await updateWebhook({
        ...c.req.valid("json"),
        teamId: c.var.team.id,
        id: c.req.valid("param").webhookId,
      });
      if (!webhook) {
        return c.json(actionFailure("Webhook not found"), 404);
      }
      return c.json(actionSuccess({ webhook }));
    } catch (error) {
      return c.json(actionFailure("Could not update webhook"), 500);
    }
  }
);

const _deleteWebhook = server.delete(
  "/:teamId/webhooks/:webhookId",
  requireTeamAccess(),
  describeRoute({
    description: "Delete a webhook",
    summary: "Delete Webhook",
    tags: ["Webhooks"],
    responses: {
      200: {
        description: "Successfully deleted webhook",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", enum: [true] },
              },
            },
          },
        },
      },
      500: {
        description: "Failed to delete webhook",
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
  zValidator("param", z.object({ teamId: z.string(), webhookId: z.string() })),
  async (c) => {
    try {
      await deleteWebhook(c.var.team.id, c.req.valid("param").webhookId);
      return c.json(actionSuccess());
    } catch (error) {
      return c.json(actionFailure("Could not delete webhook"), 500);
    }
  }
);

export type Webhooks =
  | typeof _webhooks
  | typeof _webhook
  | typeof _createWebhook
  | typeof _updateWebhook
  | typeof _deleteWebhook;

export default server; 