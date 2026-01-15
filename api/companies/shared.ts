import z from "zod";

export const companyResponse = z.object({
    id: z.string(),
    teamId: z.string(),
    name: z.string(),
    address: z.string(),
    postalCode: z.string(),
    city: z.string(),
    country: z.string(),
    enterpriseNumber: z.string().nullable(),
    vatNumber: z.string().nullable(),
    isSmpRecipient: z.boolean(),
    outboundEmailSlug: z.string().nullable(),
    outboundEmailEnabled: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type CompanyResponse = z.infer<typeof companyResponse>;