import { Server, type Context } from "@recommand/lib/api";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { describeRoute } from "hono-openapi";
import {
    describeSuccessResponseWithZod,
} from "@peppol/utils/api-docs";
import { requireIntegrationSupportedAuth, type CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { searchPeppolDirectory } from "@peppol/data/peppol-directory";

const server = new Server();

const searchDirectoryRouteDescription = describeRoute({
    operationId: "searchDirectory",
    description: "Search for recipients in the Peppol Directory",
    summary: "Search Directory",
    tags: ["Recipients"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully searched directory", z.object({ results: z.array(z.object({ peppolAddress: z.string(), name: z.string(), supportedDocumentTypes: z.array(z.string()) })) })),
    },
});

const searchDirectoryJsonBodySchema = z.object({
    query: z.string().openapi({ description: "The search query to find recipients.", example: "Company Name" }),
});

type SearchDirectoryContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { json: z.input<typeof searchDirectoryJsonBodySchema> }, out: { json: z.infer<typeof searchDirectoryJsonBodySchema> } }>;

const _searchDirectoryMinimal = server.post(
    "/search-peppol-directory",
    requireIntegrationSupportedAuth(),
    searchDirectoryRouteDescription,
    zodValidator("json", searchDirectoryJsonBodySchema),
    _searchDirectoryImplementation,
);

const _searchDirectory = server.post(
    "/searchPeppolDirectory",
    requireIntegrationSupportedAuth(),
    describeRoute({hide: true}),
    zodValidator("json", searchDirectoryJsonBodySchema),
    _searchDirectoryImplementation,
);

async function _searchDirectoryImplementation(c: SearchDirectoryContext) {
    try {
        const { query } = c.req.valid("json");
        const results = await searchPeppolDirectory(query);
        return c.json(actionSuccess({ results }));
    } catch (error) {
        return c.json(actionFailure("Failed to search directory"), 500);
    }
}

export type SearchDirectory = typeof _searchDirectory | typeof _searchDirectoryMinimal;

export default server;