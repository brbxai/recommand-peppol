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
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import {
  describeErrorResponse,
  describeSuccessResponse,
} from "@peppol/utils/api-docs";

const server = new Server();

const describeWebhookResponse = {
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
};

const _webhooks = server.get(
  "/:teamId/webhooks",
  requireTeamAccess(),
  describeRoute({
    operationId: "getWebhooks",
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
          nullable: true,
        },
      },
    ],
    responses: {
      ...describeSuccessResponse("Successfully retrieved webhooks", {
        webhooks: {
          type: "array",
          items: describeWebhookResponse.webhook,
        },
      }),
      ...describeErrorResponse(500, "Failed to fetch webhooks"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string() })),
  zodValidator("query", z.object({ companyId: z.string().nullish() })),
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
    operationId: "getWebhook",
    description: "Get a specific webhook by ID",
    summary: "Get Webhook",
    tags: ["Webhooks"],
    responses: {
      ...describeSuccessResponse(
        "Successfully retrieved webhook",
        describeWebhookResponse
      ),
      ...describeErrorResponse(404, "Webhook not found"),
      ...describeErrorResponse(500, "Failed to fetch webhook"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string(), webhookId: z.string() })),
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
    operationId: "createWebhook",
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
      ...describeSuccessResponse(
        "Successfully created webhook",
        describeWebhookResponse
      ),
      ...describeErrorResponse(400, "Invalid request data"),
      ...describeErrorResponse(500, "Failed to create webhook"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string() })),
  zodValidator(
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
    operationId: "updateWebhook",
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
      ...describeSuccessResponse(
        "Successfully updated webhook",
        describeWebhookResponse
      ),
      ...describeErrorResponse(400, "Invalid request data"),
      ...describeErrorResponse(404, "Webhook not found"),
      ...describeErrorResponse(500, "Failed to update webhook"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string(), webhookId: z.string() })),
  zodValidator(
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
    operationId: "deleteWebhook",
    description: "Delete a webhook",
    summary: "Delete Webhook",
    tags: ["Webhooks"],
    responses: {
      ...describeSuccessResponse("Successfully deleted webhook"),
      ...describeErrorResponse(500, "Failed to delete webhook"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string(), webhookId: z.string() })),
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
