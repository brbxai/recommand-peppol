import type { RecommandApp } from "@recommand/lib/app";
import { Server } from "@recommand/lib/api";
import { Logger } from "@recommand/lib/logger";
import subscriptionServer from "./api/subscription";
import billingProfileServer from "./api/billing-profile";
import companiesServer from "./api/companies";
import sendDocumentServer from "./api/send-document";
import receiveDocumentServer from "./api/internal/receive-document";

export let logger: Logger;

const server = new Server();

export async function init(app: RecommandApp, server: Server) {
  logger = new Logger(app);
  logger.info("Initializing peppol app");
}

server.route("/", sendDocumentServer);
server.route("/", subscriptionServer);
server.route("/", billingProfileServer);
server.route("/", companiesServer);
server.route("/internal/", receiveDocumentServer);

export default server;
