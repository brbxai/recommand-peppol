import { z } from "zod";
import "zod-openapi/extend";
import { sendInvoiceSchema } from "./invoice/schemas";
import { sendCreditNoteSchema } from "./creditnote/schemas";

export const SendDocumentType = {
  INVOICE: "invoice",
  CREDIT_NOTE: "creditNote",
  XML: "xml",
} as const;

export type DocumentType =
  (typeof SendDocumentType)[keyof typeof SendDocumentType];

export const sendDocumentSchema = z.object({
  recipient: z.string().openapi({
    description:
      "The Peppol address of the recipient of the document. If no identifier is provided, 0208 (Belgian Enterprise Number) is assumed.",
    example: "0208:987654321",
  }),
  documentType: z
    .enum([SendDocumentType.INVOICE, SendDocumentType.CREDIT_NOTE, SendDocumentType.XML])
    .openapi({
      description: "The type of document to send.",
      example: SendDocumentType.INVOICE,
    }),
  document: z.union([sendInvoiceSchema, sendCreditNoteSchema, z.string().openapi({ ref: "XML", title: "XML", description: "XML document as a string" })]),
  doctypeId: z.string().optional().openapi({
    description:
      "The document type identifier. Not required, only used when documentType is \"xml\".",
    example:
      "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
  }),
});

export type SendDocument = z.infer<typeof sendDocumentSchema>;
