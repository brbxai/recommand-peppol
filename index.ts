import type { RecommandApp } from "@recommand/lib/app";
import { Server } from "@recommand/lib/api";
import { Logger } from "@recommand/lib/logger";
import invoiceServer from "./api/invoice";
import subscriptionServer from "./api/subscription";
import billingProfileServer from "./api/billing-profile";

export let logger: Logger;

const server = new Server();

export async function init(app: RecommandApp, server: Server) {
  logger = new Logger(app);
  logger.info("Initializing peppol app");
}

server.route("/", invoiceServer);
server.route("/", subscriptionServer);
server.route("/", billingProfileServer);

export default server;
