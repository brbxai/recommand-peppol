import { Server, type Context } from "@recommand/lib/api";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { actionSuccess } from "@recommand/lib/utils";
import { type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { describeRoute } from "hono-openapi";
import {
    describeSuccessResponseWithZod,
} from "@peppol/utils/api-docs";
import { requireIntegrationSupportedAuth, type CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { verifyRecipient } from "@peppol/data/recipient";

const server = new Server();

const verifyRecipientRouteDescription = describeRoute({
    operationId: "verifyRecipient",
    description: "Verify if a recipient address is registered in the Peppol network",
    summary: "Verify Recipient",
    tags: ["Recipients"],
    responses: {
        ...describeSuccessResponseWithZod("Successfully verified recipient", z.object({
            isValid: z.boolean().openapi({ description: "Whether the recipient is registered in the Peppol network." }),
            smpUrl: z.string().openapi({ description: "The SMP URL of the recipient." }),
            serviceMetadataReferences: z.array(z.string()).openapi({ description: "The service metadata references of the recipient." }),
            smpHostnames: z.array(z.string()).openapi({ description: "The SMP hostnames of the recipient." }),
        })),
    },
});

const verifyRecipientJsonBodySchema = z.object({
    peppolAddress: z.string().openapi({ description: "The Peppol address of the recipient to verify." }),
});

type VerifyRecipientContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { json: z.input<typeof verifyRecipientJsonBodySchema> }, out: { json: z.infer<typeof verifyRecipientJsonBodySchema> } }>;

const _verifyRecipient = server.post(
    "/verify",
    requireIntegrationSupportedAuth(),
    verifyRecipientRouteDescription,
    zodValidator("json", verifyRecipientJsonBodySchema),
    _verifyRecipientImplementation,
);

async function _verifyRecipientImplementation(c: VerifyRecipientContext) {
    try {
        const data = await verifyRecipient(c.req.valid("json").peppolAddress);
        return c.json(actionSuccess({ isValid: true, ...data }));
    } catch (error) {
        return c.json(actionSuccess({ isValid: false }));
    }
}

export type VerifyRecipient = typeof _verifyRecipient;

export default server;