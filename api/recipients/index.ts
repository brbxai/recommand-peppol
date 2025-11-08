import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import verifyRecipientServer, { type VerifyRecipient } from "./verify";
import verifyDocumentSupportServer, { type VerifyDocumentSupport } from "./verify-document.support";
import searchDirectoryServer, { type SearchDirectory } from "./search-directory";

export type Recipients = VerifyRecipient | VerifyDocumentSupport | SearchDirectory;

const server = new Server();
server.route("/", verifyRecipientServer);
server.route("/", verifyDocumentSupportServer);
server.route("/", searchDirectoryServer);
export default server;