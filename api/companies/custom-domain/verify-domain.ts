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
import {
  verifyCompanyCustomDomainDkim,
  verifyCompanyCustomDomainReturnPath,
} from "@peppol/data/company-custom-domains";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

// Verify DKIM
const verifyDkimRouteDescription = describeRoute({
  operationId: "verifyCompanyCustomDomainDkim",
  description:
    "Trigger DKIM verification for the company's custom domain. Make sure the DKIM DNS record has been added before calling this.",
  summary: "Verify Custom Domain DKIM",
  tags: ["Company Custom Domain"],
  responses: {
    ...describeSuccessResponseWithZod(
      "Successfully triggered DKIM verification",
      z.object({ customDomain: companyCustomDomainResponse })
    ),
    ...describeErrorResponse(400, "No custom domain configured"),
    ...describeErrorResponse(500, "Failed to verify DKIM"),
  },
});

const verifyDomainParamSchema = z.object({
  companyId: z.string().openapi({
    description: "The ID of the company",
  }),
});

const verifyDomainParamSchemaWithTeamId = verifyDomainParamSchema.extend({
  teamId: z.string(),
});

type VerifyDomainContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: { param: z.input<typeof verifyDomainParamSchemaWithTeamId> };
    out: { param: z.infer<typeof verifyDomainParamSchemaWithTeamId> };
  }
>;

const _verifyDkimMinimal = server.post(
  "/companies/:companyId/custom-domain/verify-dkim",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  verifyDkimRouteDescription,
  zodValidator("param", verifyDomainParamSchema),
  _verifyDkimImplementation
);

const _verifyDkim = server.post(
  "/:teamId/companies/:companyId/custom-domain/verify-dkim",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  describeRoute({ hide: true }),
  zodValidator("param", verifyDomainParamSchemaWithTeamId),
  _verifyDkimImplementation
);

async function _verifyDkimImplementation(c: VerifyDomainContext) {
  try {
    const customDomain = await verifyCompanyCustomDomainDkim(c.var.company.id);
    return c.json(actionSuccess({ customDomain }));
  } catch (error) {
    if (error instanceof UserFacingError) {
      return c.json(actionFailure(error.message), 400);
    }
    console.error("Failed to verify DKIM:", error);
    return c.json(actionFailure("Could not verify DKIM"), 500);
  }
}

// Verify Return Path
const verifyReturnPathRouteDescription = describeRoute({
  operationId: "verifyCompanyCustomDomainReturnPath",
  description:
    "Trigger Return Path verification for the company's custom domain. Make sure the Return Path CNAME record has been added before calling this.",
  summary: "Verify Custom Domain Return Path",
  tags: ["Company Custom Domain"],
  responses: {
    ...describeSuccessResponseWithZod(
      "Successfully triggered Return Path verification",
      z.object({ customDomain: companyCustomDomainResponse })
    ),
    ...describeErrorResponse(400, "No custom domain configured"),
    ...describeErrorResponse(500, "Failed to verify Return Path"),
  },
});

const _verifyReturnPathMinimal = server.post(
  "/companies/:companyId/custom-domain/verify-return-path",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  verifyReturnPathRouteDescription,
  zodValidator("param", verifyDomainParamSchema),
  _verifyReturnPathImplementation
);

const _verifyReturnPath = server.post(
  "/:teamId/companies/:companyId/custom-domain/verify-return-path",
  requireCompanyAccess(),
  requireCustomDomainAccess(),
  describeRoute({ hide: true }),
  zodValidator("param", verifyDomainParamSchemaWithTeamId),
  _verifyReturnPathImplementation
);

async function _verifyReturnPathImplementation(c: VerifyDomainContext) {
  try {
    const customDomain = await verifyCompanyCustomDomainReturnPath(
      c.var.company.id
    );
    return c.json(actionSuccess({ customDomain }));
  } catch (error) {
    if (error instanceof UserFacingError) {
      return c.json(actionFailure(error.message), 400);
    }
    console.error("Failed to verify Return Path:", error);
    return c.json(actionFailure("Could not verify Return Path"), 500);
  }
}

export type VerifyDkim = typeof _verifyDkim | typeof _verifyDkimMinimal;
export type VerifyReturnPath =
  | typeof _verifyReturnPath
  | typeof _verifyReturnPathMinimal;

export default server;
