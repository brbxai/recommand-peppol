import { Server, type Context } from "@recommand/lib/api";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponse } from "@peppol/utils/api-docs";
import { type CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { type AuthenticatedUserContext, type AuthenticatedTeamContext, requireTeamAccess } from "@core/lib/auth-middleware";
import { deleteWebhook } from "@peppol/data/webhooks";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";

const server = new Server();

const deleteWebhookRouteDescription = describeRoute({
    operationId: "deleteWebhook",
    description: "Delete a webhook",
    summary: "Delete Webhook",
    tags: ["Webhooks"],
    responses: {
        ...describeSuccessResponse("Successfully deleted webhook"),
        ...describeErrorResponse(500, "Failed to delete webhook"),
    },
});

const deleteWebhookParamSchema = z.object({
    webhookId: z.string().openapi({
        description: "The ID of the webhook to delete",
    }),
});

type DeleteWebhookContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { param: z.input<typeof deleteWebhookParamSchema> }, out: { param: z.infer<typeof deleteWebhookParamSchema> } }>;

const _deleteWebhookMinimal = server.delete(
    "/webhooks/:webhookId",
    requireTeamAccess(),
    deleteWebhookRouteDescription,
    zodValidator("param", deleteWebhookParamSchema),
    _deleteWebhookImplementation,
);

const _deleteWebhook = server.delete(
    "/:teamId/webhooks/:webhookId",
    requireTeamAccess(),
    describeRoute({hide: true}),
    zodValidator("param", deleteWebhookParamSchema.extend({ teamId: z.string() })),
    _deleteWebhookImplementation,
);

async function _deleteWebhookImplementation(c: DeleteWebhookContext) {
    try {
        await deleteWebhook(c.var.team.id, c.req.valid("param").webhookId);
        return c.json(actionSuccess());
    } catch (error) {
        return c.json(actionFailure("Could not delete webhook"), 500);
    }
}

export type DeleteWebhook = typeof _deleteWebhook | typeof _deleteWebhookMinimal;

export default server;