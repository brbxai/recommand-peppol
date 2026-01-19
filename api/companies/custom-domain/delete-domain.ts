import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import {
  describeErrorResponse,
  describeSuccessResponse,
} from "@peppol/utils/api-docs";
import {
  requireCompanyAccess,
  requireCustomDomainAccess,
  type CompanyAccessContext,
} from "@peppol/utils/auth-middleware";
import type {
  AuthenticatedUserContext,
  AuthenticatedTeamContext,
} from "@core/lib/auth-middleware";
import { deleteCompanyCustomDomain } from "@peppol/data/company-custom-domains";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const deleteDomainRouteDescription = describeRoute({
  operationId: "deleteCompanyCustomDomain",
  description:
    "Delete the custom email domain for a company. This will also remove the domain from Postmark.",
  summary: "Delete Company Custom Domain",
  tags: ["Company Custom Domain"],
  responses: {
    ...describeSuccessResponse("Successfully deleted company custom domain"),
    ...describeErrorResponse(400, "No custom domain configured"),
    ...describeErrorResponse(500, "Failed to delete company custom domain"),
  },
});

const deleteDomainParamSchema = z.object({
  companyId: z.string().openapi({
    description: "The ID of the company",
  }),
});

const deleteDomainParamSchemaWithTeamId = deleteDomainParamSchema.extend({
  teamId: z.string(),
});

type DeleteDomainContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: { param: z.input<typeof deleteDomainParamSchemaWithTeamId> };
    out: { param: z.infer<typeof deleteDomainParamSchemaWithTeamId> };
  }
>;

const _deleteDomainMinimal = server.delete(
  "/companies/:companyId/custom-domain",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  deleteDomainRouteDescription,
  zodValidator("param", deleteDomainParamSchema),
  _deleteDomainImplementation
);

const _deleteDomain = server.delete(
  "/:teamId/companies/:companyId/custom-domain",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  describeRoute({ hide: true }),
  zodValidator("param", deleteDomainParamSchemaWithTeamId),
  _deleteDomainImplementation
);

async function _deleteDomainImplementation(c: DeleteDomainContext) {
  try {
    await deleteCompanyCustomDomain(c.var.company.id);
    return c.json(actionSuccess({}));
  } catch (error) {
    if (error instanceof UserFacingError) {
      return c.json(actionFailure(error.message), 400);
    }
    console.error("Failed to delete company custom domain:", error);
    return c.json(
      actionFailure("Could not delete company custom domain"),
      500
    );
  }
}

export type DeleteDomain = typeof _deleteDomain | typeof _deleteDomainMinimal;

export default server;
