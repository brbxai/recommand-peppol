import z from "zod";

export const labelResponse = z.object({
    id: z.string(),
    teamId: z.string(),
    externalId: z.string().nullable(),
    name: z.string(),
    colorHex: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

