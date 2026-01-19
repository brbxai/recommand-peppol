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
import { createCompanyCustomDomain } from "@peppol/data/company-custom-domains";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const createDomainRouteDescription = describeRoute({
  operationId: "createCompanyCustomDomain",
  description:
    "Register a custom email domain for a company. This will create the domain in Postmark and return the DNS records that need to be configured for verification. Requires a paid plan (Starter, Professional, or Enterprise).",
  summary: "Create Company Custom Domain",
  tags: ["Company Custom Domain"],
  responses: {
    ...describeSuccessResponseWithZod(
      "Successfully created company custom domain",
      z.object({ customDomain: companyCustomDomainResponse })
    ),
    ...describeErrorResponse(400, "Invalid request data"),
    ...describeErrorResponse(403, "Custom domains require a paid plan"),
    ...describeErrorResponse(404, "Company not found"),
    ...describeErrorResponse(500, "Failed to create company custom domain"),
  },
});

const createDomainParamSchema = z.object({
  companyId: z.string().openapi({
    description: "The ID of the company to create a custom domain for",
  }),
});

const createDomainParamSchemaWithTeamId = createDomainParamSchema.extend({
  teamId: z.string(),
});

const createDomainJsonBodySchema = z.object({
  domainName: z
    .string()
    .min(1, "Domain name is required")
    .openapi({
      description: "The domain name to register (e.g., example.com)",
      example: "example.com",
    }),
  senderEmail: z
    .string()
    .email("Valid email is required")
    .openapi({
      description:
        "The sender email address to use for outgoing emails. Must use the same domain.",
      example: "invoices@example.com",
    }),
});

type CreateDomainContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: {
      param: z.input<typeof createDomainParamSchemaWithTeamId>;
      json: z.input<typeof createDomainJsonBodySchema>;
    };
    out: {
      param: z.infer<typeof createDomainParamSchemaWithTeamId>;
      json: z.infer<typeof createDomainJsonBodySchema>;
    };
  }
>;

const _createDomainMinimal = server.post(
  "/companies/:companyId/custom-domain",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  createDomainRouteDescription,
  zodValidator("param", createDomainParamSchema),
  zodValidator("json", createDomainJsonBodySchema),
  _createDomainImplementation
);

const _createDomain = server.post(
  "/:teamId/companies/:companyId/custom-domain",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  describeRoute({ hide: true }),
  zodValidator("param", createDomainParamSchemaWithTeamId),
  zodValidator("json", createDomainJsonBodySchema),
  _createDomainImplementation
);

async function _createDomainImplementation(c: CreateDomainContext) {
  try {
    const json = c.req.valid("json");
    const customDomain = await createCompanyCustomDomain(
      c.var.company.id,
      json.domainName.trim().toLowerCase(),
      json.senderEmail.trim().toLowerCase()
    );

    return c.json(actionSuccess({ customDomain }));
  } catch (error) {
    if (error instanceof UserFacingError) {
      return c.json(actionFailure(error.message), 400);
    }
    console.error("Failed to create company custom domain:", error);
    return c.json(
      actionFailure("Could not create company custom domain"),
      500
    );
  }
}

export type CreateDomain = typeof _createDomain | typeof _createDomainMinimal;

export default server;
