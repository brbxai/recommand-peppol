import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import listDocumentsServer, { type ListTransmittedDocuments } from "./list-documents";
import getDocumentServer, { type GetTransmittedDocument } from "./get-document";
import deleteDocumentServer, { type DeleteTransmittedDocument } from "./delete-document";
import getInboxServer, { type GetInbox } from "./get-inbox";
import markAsReadServer, { type MarkAsRead } from "./mark-as-read";
import downloadPackageServer, { type DownloadPackage } from "./download-package";

export type TransmittedDocuments = ListTransmittedDocuments | GetTransmittedDocument | DeleteTransmittedDocument | GetInbox | MarkAsRead | DownloadPackage;

const server = new Server();
server.route("/", listDocumentsServer);
server.route("/", getDocumentServer);
server.route("/", deleteDocumentServer);
server.route("/", getInboxServer);
server.route("/", markAsReadServer);
server.route("/", downloadPackageServer);
export default server;