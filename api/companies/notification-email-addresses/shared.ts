import z from "zod";

export const companyNotificationEmailAddressResponse = z.object({
    id: z.string(),
    companyId: z.string(),
    email: z.string(),
    notifyIncoming: z.boolean(),
    notifyOutgoing: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});