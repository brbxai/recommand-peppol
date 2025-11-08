import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getWebhooksServer, { type GetWebhooks } from "./get-webhooks";
import getWebhookServer, { type GetWebhook } from "./get-webhook";
import createWebhookServer, { type CreateWebhook } from "./create-webhook";
import updateWebhookServer, { type UpdateWebhook } from "./update-webhook";
import deleteWebhookServer, { type DeleteWebhook } from "./delete-webhook";

export type Webhooks = GetWebhooks | GetWebhook | CreateWebhook | UpdateWebhook | DeleteWebhook;

const server = new Server();
server.route("/", getWebhooksServer);
server.route("/", getWebhookServer);
server.route("/", createWebhookServer);
server.route("/", updateWebhookServer);
server.route("/", deleteWebhookServer);
export default server;