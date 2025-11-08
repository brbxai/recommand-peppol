import z from "zod";

export const companyDocumentTypeResponse = z.object({
    id: z.string(),
    companyId: z.string(),
    docTypeId: z.string(),
    processId: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});