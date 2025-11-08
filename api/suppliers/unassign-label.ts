import { requireTeamAccess, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { unassignLabelFromSupplier } from "@peppol/data/supplier-labels";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponseWithZod } from "@peppol/utils/api-docs";
import { UserFacingError } from "@peppol/utils/util";
import { supplierIdParamSchema, companyIdQuerySchema } from "./shared";

const server = new Server();

const unassignLabelRouteDescription = describeRoute({
    operationId: "unassignLabelFromSupplier",
    description: "Unassign a label from a supplier",
    summary: "Unassign Label from Supplier",
    tags: ["Suppliers"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully unassigned label from supplier", z.object({})),
        ...describeErrorResponse(404, "Supplier or label not found"),
        ...describeErrorResponse(500, "Failed to unassign label"),
    },
});

const unassignLabelParamSchema = supplierIdParamSchema.extend({
    labelId: z.string().openapi({
        description: "The ID of the label to unassign",
    }),
});

const unassignLabelParamSchemaWithTeamId = unassignLabelParamSchema.extend({
    teamId: z.string(),
});

type UnassignLabelContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext, string, { in: { param: z.input<typeof unassignLabelParamSchemaWithTeamId>, query: z.input<typeof companyIdQuerySchema> }, out: { param: z.infer<typeof unassignLabelParamSchemaWithTeamId>, query: z.infer<typeof companyIdQuerySchema> } }>;

const _unassignLabelMinimal = server.delete(
    "/suppliers/:supplierId/labels/:labelId",
    requireTeamAccess(),
    unassignLabelRouteDescription,
    zodValidator("param", unassignLabelParamSchema),
    zodValidator("query", companyIdQuerySchema),
    _unassignLabelImplementation,
);

const _unassignLabel = server.delete(
    "/:teamId/suppliers/:supplierId/labels/:labelId",
    requireTeamAccess(),
    describeRoute({hide: true}),
    zodValidator("param", unassignLabelParamSchemaWithTeamId),
    zodValidator("query", companyIdQuerySchema),
    _unassignLabelImplementation,
);

async function _unassignLabelImplementation(c: UnassignLabelContext) {
    try {
        const { supplierId, labelId } = c.req.valid("param");
        const { companyId } = c.req.valid("query");
        await unassignLabelFromSupplier(c.var.team.id, supplierId, labelId, companyId);
        return c.json(actionSuccess({}));
    } catch (error) {
        console.error(error);
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error), 404);
        }
        return c.json(actionFailure("Could not unassign label"), 500);
    }
}

export type UnassignLabel = typeof _unassignLabel | typeof _unassignLabelMinimal;

export default server;

