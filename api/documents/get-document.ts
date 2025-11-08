import { Server, type Context } from "@recommand/lib/api";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { requireTeamAccess, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { describeRoute } from "hono-openapi";
import {
    getTransmittedDocument,
} from "@peppol/data/transmitted-documents";
import {
  describeErrorResponse,
  describeSuccessResponseWithZod,
} from "@peppol/utils/api-docs";
import type { CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { transmittedDocumentResponse } from "./shared";

const server = new Server();

const getTransmittedDocumentRouteDescription = describeRoute({
    operationId: "getDocument",
    description: "Get a single transmitted document by ID",
    summary: "Get Document",
    tags: ["Documents"],
    responses: {
      ...describeSuccessResponseWithZod("Successfully retrieved the document", z.object({ document: transmittedDocumentResponse })),
      ...describeErrorResponse(404, "Document not found"),
      ...describeErrorResponse(500, "Failed to fetch document"),
    },
});

const getTransmittedDocumentParamSchema = z.object({
    documentId: z.string().openapi({
        description: "The ID of the document to retrieve",
    }),
});

type GetTransmittedDocumentContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, {in: { param: z.input<typeof getTransmittedDocumentParamSchema> }, out: { param: z.infer<typeof getTransmittedDocumentParamSchema> } }>;

const _getTransmittedDocumentMinimal = server.get(
    "/documents/:documentId",
    requireTeamAccess(),
    getTransmittedDocumentRouteDescription,
    zodValidator("param", getTransmittedDocumentParamSchema),
    _getTransmittedDocumentImplementation,
);

const _getTransmittedDocument = server.get(
    "/:teamId/documents/:documentId",
    requireTeamAccess(),
    describeRoute({hide: true}),
    zodValidator("param", getTransmittedDocumentParamSchema.extend({
        teamId: z.string().openapi({
            description: "The ID of the team",
        })
    })),
    _getTransmittedDocumentImplementation,
);

async function _getTransmittedDocumentImplementation(c: GetTransmittedDocumentContext) {
    try {
        const { documentId } = c.req.valid("param");
        const document = await getTransmittedDocument(c.var.team.id, documentId);
  
        if (!document) {
          return c.json(actionFailure("Document not found"), 404);
        }
  
        return c.json(actionSuccess({ document }));
      } catch (error) {
        return c.json(actionFailure("Failed to fetch document"), 500);
      }
};

export type GetTransmittedDocument = typeof _getTransmittedDocument | typeof _getTransmittedDocumentMinimal;

export default server;