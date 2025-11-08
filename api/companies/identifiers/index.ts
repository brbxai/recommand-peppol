import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getIdentifiersServer, { type GetIdentifiers } from "./get-identifiers";
import getIdentifierServer, { type GetIdentifier } from "./get-identifier";
import createIdentifierServer, { type CreateIdentifier } from "./create-identifier";
import updateIdentifierServer, { type UpdateIdentifier } from "./update-identifier";
import deleteIdentifierServer, { type DeleteIdentifier } from "./delete-identifier";

export type CompanyIdentifiers = GetIdentifiers | GetIdentifier | CreateIdentifier | UpdateIdentifier | DeleteIdentifier;

const server = new Server();
server.route("/", getIdentifiersServer);
server.route("/", getIdentifierServer);
server.route("/", createIdentifierServer);
server.route("/", updateIdentifierServer);
server.route("/", deleteIdentifierServer);
export default server;