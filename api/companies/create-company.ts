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
    enterpriseNumber: z.string().nullish().transform(cleanEnterpriseNumber).openapi({ description: "The enterprise number of the company. For Belgian businesses it will be inferred from the VAT number if not provided." }),
    vatNumber: z.string().nullish().transform(cleanVatNumber),
    isSmpRecipient: z.boolean().default(true),
});

const createCompanyParamSchemaWithTeamId = z.object({
    teamId: z.string(),
});

type CreateCompanyContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { param: z.input<typeof createCompanyParamSchemaWithTeamId>, json: z.input<typeof createCompanyJsonBodySchema> }, out: { param: z.infer<typeof createCompanyParamSchemaWithTeamId>, json: z.infer<typeof createCompanyJsonBodySchema> } }>;

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
    zodValidator("param", createCompanyParamSchemaWithTeamId),
    zodValidator("json", createCompanyJsonBodySchema),
    _createCompanyImplementation,
);

async function _createCompanyImplementation(c: CreateCompanyContext) {
    let enterpriseNumber = c.req.valid("json").enterpriseNumber;
    if (!enterpriseNumber && c.req.valid("json").vatNumber && c.req.valid("json").country === "BE") {
        // If the country is Belgium and the vat number is provided, we can use the vat number to autogenerate the enterprise number
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