import {
    createCompanyIdentifier,
} from "@peppol/data/company-identifiers";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponseWithZod } from "@peppol/utils/api-docs";
import { requireCompanyAccess, type CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { companyIdentifierResponse } from "./shared";
import type { AuthenticatedUserContext, AuthenticatedTeamContext } from "@core/lib/auth-middleware";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const createIdentifierRouteDescription = describeRoute({
    operationId: "createCompanyIdentifier",
    description: "Create a new company identifier",
    summary: "Create Company Identifier",
    tags: ["Company Identifiers"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully created company identifier", z.object({ identifier: companyIdentifierResponse })),
        ...describeErrorResponse(400, "Invalid request data"),
        ...describeErrorResponse(500, "Failed to create company identifier"),
    },
});

const createIdentifierParamSchema = z.object({
    companyId: z.string().openapi({
        description: "The ID of the company to create an identifier for",
    }),
});

const createIdentifierJsonBodySchema = z.object({
    scheme: z.string().min(1, "Scheme is required").openapi({
        description: "The scheme of the identifier",
    }),
    identifier: z.string().min(1, "Identifier is required").openapi({
        description: "The value of the identifier",
    }),
});

type CreateIdentifierContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { param: z.input<typeof createIdentifierParamSchema>, json: z.input<typeof createIdentifierJsonBodySchema> }, out: { param: z.infer<typeof createIdentifierParamSchema>, json: z.infer<typeof createIdentifierJsonBodySchema> } }>;

const _createIdentifierMinimal = server.post(
    "/companies/:companyId/identifiers",
    requireCompanyAccess(),
    createIdentifierRouteDescription,
    zodValidator("param", createIdentifierParamSchema),
    zodValidator("json", createIdentifierJsonBodySchema),
    _createIdentifierImplementation,
);

const _createIdentifier = server.post(
    "/:teamId/companies/:companyId/identifiers",
    requireCompanyAccess(),
    describeRoute({hide: true}),
    zodValidator("param", createIdentifierParamSchema.extend({ teamId: z.string() })),
    zodValidator("json", createIdentifierJsonBodySchema),
    _createIdentifierImplementation,
);

async function _createIdentifierImplementation(c: CreateIdentifierContext) {
    try {
        const identifier = await createCompanyIdentifier({
            ...c.req.valid("json"),
            companyId: c.req.valid("param").companyId,
        }, c.var.team.isPlayground || !c.var.company.isSmpRecipient); // Skip SMP registration for playground teams

        return c.json(actionSuccess({ identifier }));
    } catch (error) {
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error.message), 400);
        }
        return c.json(actionFailure("Could not create company identifier"), 500);
    }
}

export type CreateIdentifier = typeof _createIdentifier | typeof _createIdentifierMinimal;

export default server;