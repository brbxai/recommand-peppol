import { requireTeamAccess, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { getSupplierByIdOrExternalId, getLabelsForSuppliers } from "@peppol/data/suppliers";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponseWithZod } from "@peppol/utils/api-docs";
import { UserFacingError } from "@peppol/utils/util";
import { supplierResponse, supplierIdParamSchema, companyIdQuerySchema } from "./shared";

const server = new Server();

const getSupplierRouteDescription = describeRoute({
  operationId: "getSupplier",
  description: "Get a supplier by ID or external ID. The supplierId parameter works with both internal and external IDs.",
  summary: "Get Supplier",
  tags: ["Suppliers"],
  responses: {
    ...describeSuccessResponseWithZod("Successfully retrieved supplier", z.object({ supplier: supplierResponse })),
    ...describeErrorResponse(404, "Supplier not found"),
    ...describeErrorResponse(500, "Failed to fetch supplier"),
  },
});

const getSupplierParamSchemaWithTeamId = supplierIdParamSchema.extend({
  teamId: z.string(),
});

type GetSupplierContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext, string, { in: { param: z.input<typeof getSupplierParamSchemaWithTeamId>, query: z.input<typeof companyIdQuerySchema> }, out: { param: z.infer<typeof getSupplierParamSchemaWithTeamId>, query: z.infer<typeof companyIdQuerySchema> } }>;

const _getSupplierMinimal = server.get(
    "/suppliers/:supplierId",
    requireTeamAccess(),
    getSupplierRouteDescription,
    zodValidator("param", supplierIdParamSchema),
    zodValidator("query", companyIdQuerySchema),
    _getSupplierImplementation,
);

const _getSupplier = server.get(
    "/:teamId/suppliers/:supplierId",
    requireTeamAccess(),
    describeRoute({hide: true}),
    zodValidator("param", getSupplierParamSchemaWithTeamId),
    zodValidator("query", companyIdQuerySchema),
    _getSupplierImplementation,
);

async function _getSupplierImplementation(c: GetSupplierContext) {
    try {
        const { supplierId } = c.req.valid("param");
        const { companyId } = c.req.valid("query");
        const teamId = c.var.team.id;

        const supplier = await getSupplierByIdOrExternalId(teamId, supplierId, companyId);

        if (!supplier) {
            return c.json(actionFailure(new UserFacingError("Supplier not found")), 404);
        }

        const supplierIds = [supplier.id];
        const supplierLabelsMap = await getLabelsForSuppliers(supplierIds);

        const supplierWithLabels = {
            ...supplier,
            labels: supplierLabelsMap.get(supplier.id) || [],
        };

        return c.json(actionSuccess({ supplier: supplierWithLabels }));
    } catch (error) {
        console.error(error);
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error), 404);
        }
        return c.json(actionFailure("Could not fetch supplier"), 500);
    }
}

export type GetSupplier = typeof _getSupplier | typeof _getSupplierMinimal;

export default server;

