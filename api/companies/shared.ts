import z from "zod";

export const companyResponse = z.object({
    id: z.string(),
    teamId: z.string(),
    name: z.string(),
    address: z.string(),
    postalCode: z.string(),
    city: z.string(),
    country: z.string(),
    enterpriseNumber: z.string(),
    vatNumber: z.string(),
    isSmpRecipient: z.boolean(),
    isOutgoingDocumentValidationEnforced: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});