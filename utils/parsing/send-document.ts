import { z } from "zod";
import "zod-openapi/extend";
import { invoiceSchema } from "./invoice/schemas";

export const SendDocumentType = {
  INVOICE: "invoice",
  UBL: "ubl",
} as const;

export type DocumentType =
  (typeof SendDocumentType)[keyof typeof SendDocumentType];

export const sendDocumentSchema = z.object({
  recipient: z.string().openapi({
    description:
      "The Peppol identifier of the recipient of the document. If no identifier is provided, 0208 (Belgian Enterprise Number) is assumed.",
    example: "0208:987654321",
  }),
  documentType: z
    .enum([SendDocumentType.INVOICE, SendDocumentType.UBL])
    .openapi({
      description: "The type of document to send.",
      example: SendDocumentType.INVOICE,
    }),
  document: z.union([invoiceSchema, z.string().openapi({ ref: "UBL" })]),
  doctypeId: z.string().optional().openapi({
    description:
      "The document type identifier. Not required, only used when documentType is \"ubl\".",
    example:
      "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
  }),
});

export type SendDocument = z.infer<typeof sendDocumentSchema>;
