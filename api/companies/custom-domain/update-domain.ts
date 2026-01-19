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
import { updateCompanyCustomDomainSenderEmail } from "@peppol/data/company-custom-domains";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const updateDomainRouteDescription = describeRoute({
  operationId: "updateCompanyCustomDomain",
  description: "Update the sender email address for the company's custom domain.",
  summary: "Update Company Custom Domain",
  tags: ["Company Custom Domain"],
  responses: {
    ...describeSuccessResponseWithZod(
      "Successfully updated company custom domain",
      z.object({ customDomain: companyCustomDomainResponse })
    ),
    ...describeErrorResponse(400, "Invalid request data"),
    ...describeErrorResponse(404, "Custom domain not found"),
    ...describeErrorResponse(500, "Failed to update company custom domain"),
  },
});

const updateDomainParamSchema = z.object({
  companyId: z.string().openapi({
    description: "The ID of the company",
  }),
});

const updateDomainParamSchemaWithTeamId = updateDomainParamSchema.extend({
  teamId: z.string(),
});

const updateDomainJsonBodySchema = z.object({
  senderEmail: z
    .string()
    .email("Valid email is required")
    .openapi({
      description:
        "The sender email address to use for outgoing emails. Must use the same domain as the registered custom domain.",
      example: "invoices@example.com",
    }),
});

type UpdateDomainContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: {
      param: z.input<typeof updateDomainParamSchemaWithTeamId>;
      json: z.input<typeof updateDomainJsonBodySchema>;
    };
    out: {
      param: z.infer<typeof updateDomainParamSchemaWithTeamId>;
      json: z.infer<typeof updateDomainJsonBodySchema>;
    };
  }
>;

const _updateDomainMinimal = server.patch(
  "/companies/:companyId/custom-domain",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  updateDomainRouteDescription,
  zodValidator("param", updateDomainParamSchema),
  zodValidator("json", updateDomainJsonBodySchema),
  _updateDomainImplementation
);

const _updateDomain = server.patch(
  "/:teamId/companies/:companyId/custom-domain",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  describeRoute({ hide: true }),
  zodValidator("param", updateDomainParamSchemaWithTeamId),
  zodValidator("json", updateDomainJsonBodySchema),
  _updateDomainImplementation
);

async function _updateDomainImplementation(c: UpdateDomainContext) {
  try {
    const json = c.req.valid("json");
    const customDomain = await updateCompanyCustomDomainSenderEmail(
      c.var.company.id,
      json.senderEmail
    );

    return c.json(actionSuccess({ customDomain }));
  } catch (error) {
    if (error instanceof UserFacingError) {
      return c.json(actionFailure(error.message), 400);
    }
    console.error("Failed to update company custom domain:", error);
    return c.json(
      actionFailure("Could not update company custom domain"),
      500
    );
  }
}

export type UpdateDomain = typeof _updateDomain | typeof _updateDomainMinimal;

export default server;
