import { Server, type Context } from "@recommand/lib/api";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { actionSuccess } from "@recommand/lib/utils";
import { requireAuth, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { describeRoute } from "hono-openapi";
import {
    describeSuccessResponseWithZod,
} from "@peppol/utils/api-docs";
import type { CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { verifyDocumentSupport } from "@peppol/data/recipient";

const server = new Server();

const verifyDocumentSupportRouteDescription = describeRoute({
    operationId: "verifyDocumentSupport",
    description: "Verify if a recipient can receive a specific document type in the Peppol network",
    summary: "Verify Document Support",
    tags: ["Recipients"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully verified document support", z.object({
            isValid: z.boolean().openapi({ description: "Whether the recipient supports the document type." }),
            smpUrl: z.string().openapi({ description: "The SMP URL of the recipient." }),
        })),
    },
});

const verifyDocumentSupportJsonBodySchema = z.object({
    peppolAddress: z.string().openapi({ description: "The Peppol address of the recipient to verify.", example: "0208:987654321" }),
    documentType: z.string().openapi({ description: "The document type to verify.", example: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1" }),
});

type VerifyDocumentSupportContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { json: z.input<typeof verifyDocumentSupportJsonBodySchema> }, out: { json: z.infer<typeof verifyDocumentSupportJsonBodySchema> } }>;

const _verifyDocumentSupportMinimal = server.post(
    "/verify-document-support",
    requireAuth(),
    verifyDocumentSupportRouteDescription,
    zodValidator("json", verifyDocumentSupportJsonBodySchema),
    _verifyDocumentSupportImplementation,
);

const _verifyDocumentSupport = server.post(
    "/verifyDocumentSupport",
    requireAuth(),
    describeRoute({hide: true}),
    zodValidator("json", verifyDocumentSupportJsonBodySchema),
    _verifyDocumentSupportImplementation,
);

async function _verifyDocumentSupportImplementation(c: VerifyDocumentSupportContext) {
    try {
        const { peppolAddress, documentType } = c.req.valid("json");
        const data = await verifyDocumentSupport(peppolAddress, documentType);
        return c.json(actionSuccess({ isValid: true, ...data }));
    } catch (error) {
        return c.json(actionSuccess({ isValid: false }));
    }
}

export type VerifyDocumentSupport = typeof _verifyDocumentSupport | typeof _verifyDocumentSupportMinimal;

export default server;