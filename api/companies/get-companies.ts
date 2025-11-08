import { requireTeamAccess, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import {
    getCompanies,
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

const getCompaniesRouteDescription = describeRoute({
    operationId: "getCompanies",
    description: "Get a list of all companies for a team",
    summary: "List Companies",
    tags: ["Companies"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully retrieved companies", z.object({ companies: z.array(companyResponse) })),
        ...describeErrorResponse(500, "Failed to fetch companies"),
    },
});

type GetCompaniesContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string>;

const _getCompaniesMinimal = server.get(
    "/companies",
    requireTeamAccess(),
    getCompaniesRouteDescription,
    _getCompaniesImplementation,
);

const _getCompanies = server.get(
    "/:teamId/companies",
    requireTeamAccess(),
    describeRoute({hide: true}),
    zodValidator("param", z.object({
        teamId: z.string(),
    })),
    _getCompaniesImplementation,
);

async function _getCompaniesImplementation(c: GetCompaniesContext) {
    try {
        const allCompanies = await getCompanies(c.var.team.id);
        return c.json(actionSuccess({ companies: allCompanies }));
    } catch (error) {
        return c.json(actionFailure("Could not fetch companies"), 500);
    }
}

export type GetCompanies = typeof _getCompanies | typeof _getCompaniesMinimal;

export default server;