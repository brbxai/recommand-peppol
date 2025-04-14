import type { RecommandApp } from "@recommand/lib/app";
import { Server } from "@recommand/lib/api";
import { Logger } from "@recommand/lib/logger";
import subscriptionServer from "./api/subscription";
import billingProfileServer from "./api/billing-profile";
import companiesServer from "./api/companies";
import sendDocumentServer from "./api/send-document";
import receiveDocumentServer from "./api/internal/receive-document";
import transmittedDocumentsServer from "./api/transmitted-documents";
import { openAPISpecs } from "hono-openapi";
import { apiReference } from "@scalar/hono-api-reference";

export let logger: Logger;

const server = new Server();

export async function init(app: RecommandApp, server: Server) {
  logger = new Logger(app);
  logger.info("Initializing peppol app");

  // Add OpenAPI documentation
server.get(
  "/openapi",
  openAPISpecs(server, {
    documentation: {
      info: {
        title: "Recommand Peppol API",
        version: "1.0.0",
        description: `
Welcome to the Recommand Peppol API documentation. This API provides a comprehensive set of endpoints for managing and interacting with the Recommand Peppol platform.

## Getting Started

To get started with the API:

1. Create an API key and secret in the Recommand dashboard
2. Use Basic Authentication with your API key and secret
3. Make requests to the available endpoints

## Authentication

All API requests must be authenticated using Basic Authentication. Your API key should be used as the username, and your API secret as the password.

> [!TIP]
> If you are signed in to the Recommand dashboard in this browser, you can use the API client that is embedded below without creating an API key, you will be authenticated via a session cookie.

## Team and company IDs

For some endpoints, you will need to provide a team or company ID.

- You can find your team ID [here](/api-keys).
- You can find your company IDs [here](/companies).

## Support

For additional support or questions, don't hesitate to contact our support team.`,
      },
      servers: [{ url: "http://localhost:3000", description: "Local Server" }],
      components: {
        securitySchemes: {
          httpBasic: {
            type: "http",
            scheme: "basic",
            description: "Basic API key authentication. Create a new API key and secret in the Recommand dashboard.",
          },
        },
      },
      security: [{ httpBasic: [] }],
    },
  })
);
}

server.route("/", sendDocumentServer);
server.route("/", subscriptionServer);
server.route("/", billingProfileServer);
server.route("/", companiesServer);
server.route("/internal/", receiveDocumentServer);
server.route("/", transmittedDocumentsServer);

export default server;
