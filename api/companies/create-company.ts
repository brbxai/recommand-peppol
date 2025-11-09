import { requireTeamAccess, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import {
    createCompany,
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
import { cleanEnterpriseNumber, cleanVatNumber, UserFacingError } from "@peppol/utils/util";
import { zodValidCountryCodes } from "@peppol/db/schema";

const server = new Server();

const createCompanyRouteDescription = describeRoute({
    operationId: "createCompany",
    description: "Create a new company",
    summary: "Create Company",
    tags: ["Companies"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully created company", z.object({ company: companyResponse })),
        ...describeErrorResponse(400, "Invalid request data"),
        ...describeErrorResponse(500, "Failed to create company"),
    },
});

const createCompanyJsonBodySchema = z.object({
    name: z.string(),
    address: z.string(),
    postalCode: z.string(),
    city: z.string(),
    country: zodValidCountryCodes,
    enterpriseNumber: z.string().nullish().transform(cleanEnterpriseNumber),
    vatNumber: z.string().nullish().transform(cleanVatNumber),
    isSmpRecipient: z.boolean().default(true),
});

type CreateCompanyContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { json: z.input<typeof createCompanyJsonBodySchema> }, out: { json: z.infer<typeof createCompanyJsonBodySchema> } }>;

const _createCompanyMinimal = server.post(
    "/companies",
    requireTeamAccess(),
    createCompanyRouteDescription,
    zodValidator("json", createCompanyJsonBodySchema),
    _createCompanyImplementation,
);

const _createCompany = server.post(
    "/:teamId/companies",
    requireTeamAccess(),
    describeRoute({hide: true}),
    zodValidator("param", z.object({ teamId: z.string() })),
    zodValidator("json", createCompanyJsonBodySchema),
    _createCompanyImplementation,
);

async function _createCompanyImplementation(c: CreateCompanyContext) {
    let enterpriseNumber = c.req.valid("json").enterpriseNumber;
    if (!enterpriseNumber && c.req.valid("json").vatNumber) {
        enterpriseNumber = cleanEnterpriseNumber(c.req.valid("json").vatNumber!);
    }

    try {
        const company = await createCompany({
            ...c.req.valid("json"),
            teamId: c.var.team.id,
            enterpriseNumber,
        });
        return c.json(actionSuccess({ company }));
    } catch (error) {
        console.error(error);
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error), 400);
        }
        return c.json(actionFailure("Could not create company"), 500);
    }
}

export type CreateCompany = typeof _createCompany | typeof _createCompanyMinimal;

export default server;