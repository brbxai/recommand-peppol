import { z } from "zod";
import "zod-openapi/extend";
import { manifestSchema } from "@peppol/types/integration/manifest";
import { configurationSchema } from "@peppol/types/integration/configuration";
import { stateSchema } from "@peppol/types/integration/state";

export const integrationResponse = z.object({
    id: z.string(),
    teamId: z.string(),
    companyId: z.string(),
    manifest: manifestSchema,
    configuration: configurationSchema,
    state: stateSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

