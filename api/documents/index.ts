import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import listDocumentsServer, { type ListTransmittedDocuments } from "./list-documents";
import getDocumentServer, { type GetTransmittedDocument } from "./get-document";
import deleteDocumentServer, { type DeleteTransmittedDocument } from "./delete-document";
import deleteAllDocumentsServer, { type DeleteAllTransmittedDocuments } from "./delete-all-documents";
import getInboxServer, { type GetInbox } from "./get-inbox";
import markAsReadServer, { type MarkAsRead } from "./mark-as-read";
import downloadPackageServer, { type DownloadPackage } from "./download-package";
import assignLabelServer, { type AssignLabel } from "./assign-label";
import unassignLabelServer, { type UnassignLabel } from "./unassign-label";
import renderDocumentServer, { type RenderDocument } from "./render-document";

export type TransmittedDocuments = ListTransmittedDocuments | GetTransmittedDocument | DeleteTransmittedDocument | DeleteAllTransmittedDocuments | GetInbox | MarkAsRead | DownloadPackage | AssignLabel | UnassignLabel | RenderDocument;

const server = new Server();
server.route("/", listDocumentsServer);
server.route("/", getDocumentServer);
server.route("/", deleteAllDocumentsServer);
server.route("/", deleteDocumentServer);
server.route("/", getInboxServer);
server.route("/", markAsReadServer);
server.route("/", downloadPackageServer);
server.route("/", assignLabelServer);
server.route("/", unassignLabelServer);
server.route("/", renderDocumentServer);
export default server;