import type { RecommandApp } from "@recommand/lib/app";
import { Server } from "@recommand/lib/api";
import { Logger } from "@recommand/lib/logger";
import subscriptionServer from "./api/subscription";
import billingProfileServer from "./api/billing-profile";
import companiesServer from "./api/companies";
import companyIdentifiersServer from "./api/company-identifiers";
import companyDocumentTypesServer from "./api/company-document-types";
import sendDocumentServer from "./api/send-document";
import receiveDocumentServer from "./api/internal/receive-document";
import transmittedDocumentsServer from "./api/transmitted-documents";
import { openAPISpecs } from "hono-openapi";
import webhooksServer from "./api/webhooks";
import recipientServer from "./api/recipient";
import playgroundsServer from "./api/playgrounds";

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
      servers: [{ url: process.env.BASE_URL!, description: "Recommand API" }],
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
      tags: [
        {
          name: "Authentication",
          description: "Authentication endpoints for the Recommand Peppol API.",
        },
        {
          name: "Sending",
          description: "Endpoints for sending documents",
        },
        {
          name: "Documents",
          description: "Endpoints for managing documents.",
        },
        {
          name: "Companies",
          description: "You can manage all companies for a team. Each business you want to send or receive Peppol documents for needs to be registered as a company.",
        },
        {
          name: "Company Identifiers",
          description: "You can manage all Peppol identifiers for a company. Peppol identifiers are used to identify a company in the Peppol network. They are structured as scheme:identifier, e.g. '0208:1012081766' for the Belgian business with enterprise number 1012081766.",
        },
        {
          name: "Company Document Types",
          description: "You can manage all Peppol document types for a company. Peppol document types are used to identify the type of document that can be received by a company.",
        },
        {
          name: "Recipients",
          description: "Interaction with the Peppol directory. For now, this always returns results from the production Peppol directory, even in playground teams.",
        },
        {
          name: "Playgrounds",
          description: "Endpoints for working with playgrounds. Playgrounds are used to test the Recommand API without affecting production data or communicating over the Peppol network. A new playground can be created via the Recommand dashboard by clicking the team switcher in the top left, or via the API outlined below. Usage of the playground is free.",
        },
      ],
    },
  })
);
}

server.route("/", sendDocumentServer);
server.route("/", subscriptionServer);
server.route("/", billingProfileServer);
server.route("/", companiesServer);
server.route("/", companyIdentifiersServer);
server.route("/", companyDocumentTypesServer);
server.route("/internal/", receiveDocumentServer);
server.route("/", transmittedDocumentsServer);
server.route("/", webhooksServer);
server.route("/", recipientServer);
server.route("/", playgroundsServer);

export default server;
