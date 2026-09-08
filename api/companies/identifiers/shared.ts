import z from "zod";
import "zod-openapi/extend";

export const companyIdentifierResponse = z.object({
    id: z.string().openapi({
        description: "The ID of the identifier record. Use it with the get, update and delete identifier endpoints.",
        example: "ci_01JQZ8X0M4T7RB6K9V2NDHW3PA",
    }),
    companyId: z.string().openapi({
        description: "The ID of the company this identifier belongs to.",
        example: "c_01JQZ8X0M4T7RB6K9V2NDHW3PA",
    }),
    scheme: z.string().openapi({
        description: "The Peppol identifier scheme, an ISO/IEC 6523 ICD code. It says which register the identifier comes from, for example `0208` for the Belgian enterprise number register.",
        example: "0208",
    }),
    identifier: z.string().openapi({
        description: "The value within the scheme. Together with the scheme it forms the company's Peppol address, written as `scheme:identifier`.",
        example: "1012081766",
    }),
    createdAt: z.string().datetime().openapi({
        description: "When the identifier was added to the company.",
    }),
    updatedAt: z.string().datetime().openapi({
        description: "When the identifier was last changed.",
    }),
});
