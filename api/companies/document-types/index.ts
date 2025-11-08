import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getDocumentTypesServer, { type GetDocumentTypes } from "./get-document-types";
import getDocumentTypeServer, { type GetDocumentType } from "./get-document-type";
import createDocumentTypeServer, { type CreateDocumentType } from "./create-document-type";
import updateDocumentTypeServer, { type UpdateDocumentType } from "./update-document-type";
import deleteDocumentTypeServer, { type DeleteDocumentType } from "./delete-document-type";

export type CompanyDocumentTypes = GetDocumentTypes | GetDocumentType | CreateDocumentType | UpdateDocumentType | DeleteDocumentType;

const server = new Server();
server.route("/", getDocumentTypesServer);
server.route("/", getDocumentTypeServer);
server.route("/", createDocumentTypeServer);
server.route("/", updateDocumentTypeServer);
server.route("/", deleteDocumentTypeServer);
export default server;