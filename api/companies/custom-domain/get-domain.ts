import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import {
  describeErrorResponse,
  describeSuccessResponseWithZod,
} from "@peppol/utils/api-docs";
import {
  requireCompanyAccess,
  requireCustomDomainAccess,
  type CompanyAccessContext,
} from "@peppol/utils/auth-middleware";
import { companyCustomDomainResponse } from "./shared";
import type {
  AuthenticatedUserContext,
  AuthenticatedTeamContext,
} from "@core/lib/auth-middleware";
import { getCompanyCustomDomain } from "@peppol/data/company-custom-domains";

const server = new Server();

const getDomainRouteDescription = describeRoute({
  operationId: "getCompanyCustomDomain",
  description:
    "Get the custom email domain configuration for a company. Returns null if no custom domain is configured.",
  summary: "Get Company Custom Domain",
  tags: ["Company Custom Domain"],
  responses: {
    ...describeSuccessResponseWithZod(
      "Successfully retrieved company custom domain",
      z.object({ customDomain: companyCustomDomainResponse.nullable() })
    ),
    ...describeErrorResponse(500, "Failed to fetch company custom domain"),
  },
});

const getDomainParamSchema = z.object({
  companyId: z.string().openapi({
    description: "The ID of the company to get the custom domain for",
  }),
});

const getDomainParamSchemaWithTeamId = getDomainParamSchema.extend({
  teamId: z.string(),
});

type GetDomainContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: { param: z.input<typeof getDomainParamSchemaWithTeamId> };
    out: { param: z.infer<typeof getDomainParamSchemaWithTeamId> };
  }
>;

const _getDomainMinimal = server.get(
  "/companies/:companyId/custom-domain",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  getDomainRouteDescription,
  zodValidator("param", getDomainParamSchema),
  _getDomainImplementation
);

const _getDomain = server.get(
  "/:teamId/companies/:companyId/custom-domain",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  describeRoute({ hide: true }),
  zodValidator("param", getDomainParamSchemaWithTeamId),
  _getDomainImplementation
);

async function _getDomainImplementation(c: GetDomainContext) {
  try {
    const customDomain = await getCompanyCustomDomain(c.var.company.id);
    return c.json(actionSuccess({ customDomain: customDomain ?? null }));
  } catch (error) {
    return c.json(
      actionFailure("Could not fetch company custom domain"),
      500
    );
  }
}

export type GetDomain = typeof _getDomain | typeof _getDomainMinimal;

export default server;
