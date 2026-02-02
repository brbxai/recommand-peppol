import { requireTeamAccess, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import {
    verifyCompany,
    getCompany,
} from "@peppol/data/companies";
import { getEnterpriseData } from "@peppol/data/cbe-public-search/client";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponseWithZod } from "@peppol/utils/api-docs";
import type { CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const verifyCompanyRouteDescription = describeRoute({
    operationId: "verifyCompany",
    description: "Create a verification session for a company",
    summary: "Verify Company",
    tags: ["Companies"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully created verification session", z.object({ verificationUrl: z.string() })),
        ...describeErrorResponse(400, "Invalid request data"),
        ...describeErrorResponse(404, "Company not found"),
        ...describeErrorResponse(500, "Failed to create verification session"),
    },
});

const verifyCompanyParamSchema = z.object({
    companyId: z.string().openapi({
        description: "The ID of the company to verify",
    }),
});

const verifyCompanyParamSchemaWithTeamId = verifyCompanyParamSchema.extend({
    teamId: z.string(),
});

type VerifyCompanyContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { param: z.input<typeof verifyCompanyParamSchemaWithTeamId> }, out: { param: z.infer<typeof verifyCompanyParamSchemaWithTeamId> } }>;

const _verifyCompanyMinimal = server.post(
    "/companies/:companyId/verify",
    requireTeamAccess(),
    verifyCompanyRouteDescription,
    zodValidator("param", verifyCompanyParamSchema),
    _verifyCompanyImplementation,
);

const _verifyCompany = server.post(
    "/:teamId/companies/:companyId/verify",
    requireTeamAccess(),
    describeRoute({ hide: true }),
    zodValidator("param", verifyCompanyParamSchemaWithTeamId),
    _verifyCompanyImplementation,
);

async function _verifyCompanyImplementation(c: VerifyCompanyContext) {
    try {
        const companyId = c.req.valid("param").companyId;
        const baseUrl = process.env.BASE_URL;
        if (!baseUrl) {
            throw new Error("BASE_URL environment variable is not set");
        }
        const callbackUrl = `${baseUrl}/companies/${companyId}`;
        
        const verificationUrl = await verifyCompany({
            teamId: c.var.team.id,
            companyId,
            callback: callbackUrl,
        });
        return c.json(actionSuccess({ verificationUrl }));
    } catch (error) {
        console.error(error);
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error), 400);
        }
        return c.json(actionFailure("Could not create verification session"), 500);
    }
}

export type VerifyCompany = typeof _verifyCompany | typeof _verifyCompanyMinimal;

const enterpriseDataResponseSchema = z.object({
  enterpriseNumber: z.string(),
  address: z.object({
    street: z.string(),
    number: z.string(),
    postalCode: z.string(),
    city: z.string(),
    country: z.string(),
  }).optional(),
  companyType: z.object({
    juridicalForm: z.object({
      code: z.string(),
      description: z.string(),
      beginDate: z.string().optional(),
    }),
    denomination: z.object({
      code: z.string(),
      description: z.string(),
      beginDate: z.string().optional(),
    }),
  }).optional(),
  representatives: z.array(z.object({
    firstName: z.string(),
    lastName: z.string(),
    function: z.string(),
    beginDate: z.string(),
    endDate: z.string().optional(),
  })),
});

const _getCompanyEnterpriseDataMinimal = server.get(
    "/companies/:companyId/enterprise-data",
    requireTeamAccess(),
    describeRoute({
        operationId: "getCompanyEnterpriseData",
        description: "Get comprehensive enterprise data from CBE registry",
        summary: "Get Company Enterprise Data",
        tags: ["Companies"],
        responses: {
            ...describeSuccessResponseWithZod("Successfully fetched enterprise data", enterpriseDataResponseSchema),
            ...describeErrorResponse(400, "Invalid request data"),
            ...describeErrorResponse(404, "Company not found"),
            ...describeErrorResponse(500, "Failed to fetch enterprise data"),
        },
    }),
    zodValidator("param", verifyCompanyParamSchema),
    _getCompanyEnterpriseDataImplementation,
);

const _getCompanyEnterpriseData = server.get(
    "/:teamId/companies/:companyId/enterprise-data",
    requireTeamAccess(),
    describeRoute({ hide: true }),
    zodValidator("param", verifyCompanyParamSchemaWithTeamId),
    _getCompanyEnterpriseDataImplementation,
);

async function _getCompanyEnterpriseDataImplementation(c: VerifyCompanyContext) {
    try {
        const companyId = c.req.valid("param").companyId;
        const teamId = c.var.team.id;
        
        const company = await getCompany(teamId, companyId);
        if (!company) {
            return c.json(actionFailure("Company not found"), 404);
        }

        if (!company.enterpriseNumber) {
            return c.json(actionFailure("Company does not have an enterprise number"), 400);
        }

        if (company.country !== "BE") {
            return c.json(actionFailure("Enterprise data is only available for Belgian companies"), 400);
        }

        const enterpriseData = await getEnterpriseData(company.enterpriseNumber);
        return c.json(actionSuccess(enterpriseData));
    } catch (error) {
        console.error(error);
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error), 400);
        }
        return c.json(actionFailure("Could not fetch enterprise data"), 500);
    }
}

export type GetCompanyEnterpriseData = typeof _getCompanyEnterpriseData | typeof _getCompanyEnterpriseDataMinimal;

export default server;

