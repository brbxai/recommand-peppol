import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getIntegrationsServer, { type GetIntegrations } from "./get-integrations";
import getIntegrationServer, { type GetIntegration } from "./get-integration";
import createIntegrationServer, { type CreateIntegration } from "./create-integration";
import updateIntegrationServer, { type UpdateIntegration } from "./update-integration";
import deleteIntegrationServer, { type DeleteIntegration } from "./delete-integration";

export type Integrations = GetIntegrations | GetIntegration | CreateIntegration | UpdateIntegration | DeleteIntegration;

const server = new Server();
server.route("/", getIntegrationsServer);
server.route("/", getIntegrationServer);
server.route("/", createIntegrationServer);
server.route("/", updateIntegrationServer);
server.route("/", deleteIntegrationServer);
export default server;

