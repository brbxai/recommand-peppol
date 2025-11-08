import z from "zod";

export const companyIdentifierResponse = z.object({
    id: z.string(),
    companyId: z.string(),
    scheme: z.string(),
    identifier: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});