import {
  describeErrorResponse,
  describeSuccessResponseWithZod,
  describeValidationErrorResponse,
} from "@core/lib/api-docs";
import {
  requireCompanyVerificationForStrictTeams,
  requireIntegrationSupportedCompanyAccess,
  requireValidSubscription,
} from "@peppol/utils/auth-middleware";
import { sendingPipeline } from "@peppol/utils/pipelines/sending";
import { sendDocumentSchema } from "@peppol/utils/parsing/send-document";
import { Server } from "@recommand/lib/api";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { captureSendDocumentRecording } from "@peppol/data/send-document-recording";
import { trackSendDocument } from "@peppol/utils/metrics";

const server = new Server();

const sendDocumentResponse = z.object({
  sentOverPeppol: z.boolean().openapi({
    description:
      "Whether the recipient's access point accepted the document over Peppol. False when the document could not be routed or the access point refused it, in which case it was delivered by email instead.",
    example: true,
  }),
  sentOverEmail: z.boolean().openapi({
    description:
      "Whether the document was also delivered by email. Email delivery happens when you configure it, either always or only as a fallback when Peppol delivery fails.",
    example: false,
  }),
  emailRecipients: z.array(z.string()).openapi({
    description:
      "The email addresses the document was delivered to. Empty when it was not sent by email; an address the email failed for is left out.",
    example: [],
  }),
  teamId: z.string().openapi({
    description: "The ID of the team the document was sent from.",
    example: "team_01JQZ8X0M4T7RB6K9V2NDHW3PA",
  }),
  companyId: z.string().openapi({
    description: "The ID of the company the document was sent for.",
    example: "c_01JQZ8X0M4T7RB6K9V2NDHW3PA",
  }),
  id: z.string().openapi({
    description:
      "The Recommand document ID of the stored document. Use it with the documents endpoints to fetch, render or download what was sent.",
    example: "doc_01JQZ8X0M4T7RB6K9V2NDHW3PA",
  }),
  peppolMessageId: z.string().nullable().openapi({
    description:
      "The AS4 message ID of the transmission. Null when the document was not transmitted over Peppol, and for playground teams, whose transmissions are simulated.",
    example: "b7c2f0a4-3d1e-4a58-9c6d-0f2e8a1b4c73@recommand.eu",
  }),
  envelopeId: z.string().nullable().openapi({
    description:
      "The envelope ID of the transmission, also known as the SBDH instance identifier (Standard Business Document Header Instance Identifier). Null when the document was not transmitted over Peppol, and for playground teams, whose transmissions are simulated.",
    example: "9f1b3c7e-52a4-4d68-8b0f-6c9d2e4a17b5",
  }),
});

const sendDocumentParamSchema = z.object({
  companyId: z.string().openapi({
    description:
      "The ID of the company sending the document. The document is sent from this company's Peppol identifier.",
    example: "c_01JQZ8X0M4T7RB6K9V2NDHW3PA",
  }),
});

const routeDescription = describeRoute({
  operationId: "sendDocument",
  description:
    "Send a document to a customer over the Peppol network, by email, or both. The document type identifier and process are resolved against the recipient unless you name both yourself. The document is stored under the company and returned document ID, and it counts towards your subscription usage. When Peppol delivery fails and no email fallback applies, the request fails with a 422 and nothing is stored.",
  summary: "Send Document",
  tags: ["Sending"],
  responses: {
    ...describeSuccessResponseWithZod(
      "Successfully sent document",
      sendDocumentResponse,
    ),
    ...describeValidationErrorResponse("Invalid document data provided"),
    ...describeErrorResponse(
      422,
      "Recipient could not be reached and no email fallback was configured or possible",
    ),
  },
});

const sendDocument = server.post(
  "/:companyId/sendDocument",
  trackSendDocument,
  requireIntegrationSupportedCompanyAccess(),
  requireValidSubscription(),
  requireCompanyVerificationForStrictTeams(),
  describeRoute({ hide: true }),
  captureSendDocumentRecording,
  zodValidator("param", sendDocumentParamSchema),
  zodValidator("json", sendDocumentSchema),
  sendingPipeline,
);

const sendDocumentMinimal = server.post(
  "/:companyId/send",
  trackSendDocument,
  requireIntegrationSupportedCompanyAccess(),
  requireValidSubscription(),
  requireCompanyVerificationForStrictTeams(),
  routeDescription,
  captureSendDocumentRecording,
  zodValidator("param", sendDocumentParamSchema),
  zodValidator("json", sendDocumentSchema),
  sendingPipeline,
);

export type SendDocument = typeof sendDocument | typeof sendDocumentMinimal;

export default server;
