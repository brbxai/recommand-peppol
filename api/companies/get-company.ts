import { requireTeamAccess, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import {
    getCompany,
} from "@peppol/data/companies";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponseWithZod } from "@peppol/utils/api-docs";
import { companyResponse } from "./shared";
import type { CompanyAccessContext } from "@peppol/utils/auth-middleware";

const server = new Server();

const getCompanyRouteDescription = describeRoute({
    operationId: "getCompany",
    description: "Get a specific company by ID",
    summary: "Get Company",
    tags: ["Companies"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully retrieved company", z.object({ company: companyResponse })),
        ...describeErrorResponse(404, "Company not found"),
        ...describeErrorResponse(500, "Failed to fetch company"),
    },
});

const getCompanyParamSchema = z.object({
    companyId: z.string().openapi({
        description: "The ID of the company to retrieve",
    }),
});

type GetCompanyContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { param: z.input<typeof getCompanyParamSchema> }, out: { param: z.infer<typeof getCompanyParamSchema> } }>;

const _getCompanyMinimal = server.get(
    "/companies/:companyId",
    requireTeamAccess(),
    getCompanyRouteDescription,
    zodValidator("param", getCompanyParamSchema),
    _getCompanyImplementation,
);

const _getCompany = server.get(
    "/:teamId/companies/:companyId",
    requireTeamAccess(),
    describeRoute({hide: true}),
    zodValidator("param", getCompanyParamSchema.extend({
        teamId: z.string().openapi({
            description: "The ID of the team",
        }),
    })),
    _getCompanyImplementation,
);

async function _getCompanyImplementation(c: GetCompanyContext) {
    try {
        const company = await getCompany(
            c.var.team.id,
            c.req.valid("param").companyId
        );
        return c.json(actionSuccess({ company }));
    } catch (error) {
        return c.json(actionFailure("Could not fetch company"), 500);
    }
}

export type GetCompany = typeof _getCompany | typeof _getCompanyMinimal;

export default server;