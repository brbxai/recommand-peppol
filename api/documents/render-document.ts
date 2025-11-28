import { Server, type Context } from "@recommand/lib/api";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import {
  requireTeamAccess,
  type AuthenticatedTeamContext,
  type AuthenticatedUserContext,
} from "@core/lib/auth-middleware";
import { describeRoute } from "hono-openapi";
import {
  getTransmittedDocument,
} from "@peppol/data/transmitted-documents";
import type { CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { renderDocumentHtml } from "@peppol/utils/document-renderer";

const server = new Server();

const renderDocumentParamSchema = z.object({
  documentId: z.string().openapi({
    description: "The ID of the document to render",
  }),
});

const renderDocumentParamSchemaWithTeamId = renderDocumentParamSchema.extend({
  teamId: z.string(),
});

type RenderDocumentContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: { param: z.input<typeof renderDocumentParamSchemaWithTeamId> };
    out: { param: z.infer<typeof renderDocumentParamSchemaWithTeamId> };
  }
>;

const _renderDocumentMinimal = server.get(
  "/documents/:documentId/render",
  requireTeamAccess(),
  describeRoute({ hide: true }),
  zodValidator("param", renderDocumentParamSchema),
  _renderDocumentImplementation,
);

const _renderDocument = server.get(
  "/:teamId/documents/:documentId/render",
  requireTeamAccess(),
  describeRoute({ hide: true }),
  zodValidator("param", renderDocumentParamSchemaWithTeamId),
  _renderDocumentImplementation,
);

async function _renderDocumentImplementation(c: RenderDocumentContext) {
  try {
    const { documentId } = c.req.valid("param");
    const document = await getTransmittedDocument(c.var.team.id, documentId);

    if (!document) {
      return c.json(actionFailure("Document not found"), 404);
    }

    const html = await renderDocumentHtml(document);

    return c.json(
      actionSuccess({
        html,
      }),
    );
  } catch (error) {
    console.error("Failed to render document HTML:", error);
    return c.json(actionFailure("Failed to render document"), 500);
  }
}

export type RenderDocument =
  | typeof _renderDocument
  | typeof _renderDocumentMinimal;

export default server;


