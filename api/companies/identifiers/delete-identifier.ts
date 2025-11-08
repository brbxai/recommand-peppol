import {
    deleteCompanyIdentifier,
} from "@peppol/data/company-identifiers";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponseWithZod } from "@peppol/utils/api-docs";
import { requireCompanyAccess, type CompanyAccessContext } from "@peppol/utils/auth-middleware";
import type { AuthenticatedUserContext, AuthenticatedTeamContext } from "@core/lib/auth-middleware";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const deleteIdentifierRouteDescription = describeRoute({
    operationId: "deleteCompanyIdentifier",
    description: "Delete a company identifier",
    summary: "Delete Company Identifier",
    tags: ["Company Identifiers"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully deleted company identifier", z.object({})),
        ...describeErrorResponse(404, "Company identifier not found"),
        ...describeErrorResponse(500, "Failed to delete company identifier"),
    },
});

const deleteIdentifierParamSchema = z.object({
    companyId: z.string().openapi({
        description: "The ID of the company to delete an identifier for",
    }),
    identifierId: z.string().openapi({
        description: "The ID of the identifier to delete",
    }),
});

const deleteIdentifierParamSchemaWithTeamId = deleteIdentifierParamSchema.extend({ teamId: z.string() });

type DeleteIdentifierContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { param: z.input<typeof deleteIdentifierParamSchemaWithTeamId> }, out: { param: z.infer<typeof deleteIdentifierParamSchemaWithTeamId> } }>;

const _deleteIdentifierMinimal = server.delete(
    "/companies/:companyId/identifiers/:identifierId",
    requireCompanyAccess(),
    deleteIdentifierRouteDescription,
    zodValidator("param", deleteIdentifierParamSchema),
    _deleteIdentifierImplementation,
);

const _deleteIdentifier = server.delete(
    "/:teamId/companies/:companyId/identifiers/:identifierId",
    requireCompanyAccess(),
    describeRoute({hide: true}),
    zodValidator("param", deleteIdentifierParamSchemaWithTeamId),
    _deleteIdentifierImplementation,
);

async function _deleteIdentifierImplementation(c: DeleteIdentifierContext) {
    try {
        await deleteCompanyIdentifier(
            c.req.valid("param").companyId,
            c.req.valid("param").identifierId,
            c.var.team.isPlayground || !c.var.company.isSmpRecipient // Skip SMP registration for playground teams
        );

        return c.json(actionSuccess());
    } catch (error) {
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error.message), 404);
        }
        console.error(error);
        return c.json(actionFailure("Could not delete company identifier"), 500);
    }
}

export type DeleteIdentifier = typeof _deleteIdentifier | typeof _deleteIdentifierMinimal;

export default server;