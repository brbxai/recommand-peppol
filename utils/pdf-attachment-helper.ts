import { renderDocumentPdf } from "@peppol/utils/document-renderer";
import {
  ensureFileExtension,
  getDocumentFilename,
  type ParsedDocument,
} from "@peppol/utils/document-filename";
import type { SupportedDocumentType } from "@peppol/utils/document-types";
import type { Attachment } from "@peppol/utils/parsing/invoice/schemas";

export async function generateAndAttachPdf(
  documentId: string,
  documentType: SupportedDocumentType,
  document: any,
  attachments: Attachment[] | null | undefined,
  customPdfFilename?: string
): Promise<Attachment[]> {
  const pdfFilename = customPdfFilename
    ? ensureFileExtension(customPdfFilename, "pdf")
    : ensureFileExtension(
        getDocumentFilename(documentType, document as ParsedDocument | null),
        "pdf"
      );

  const pdfBuffer = await renderDocumentPdf({
    id: documentId,
    type: documentType,
    parsed: document,
  } as any);

  const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
  const existingAttachments = Array.isArray(attachments)
    ? (attachments as Attachment[])
    : [];

  const nextAttachments = existingAttachments.filter(
    (a: Attachment) => a.filename !== pdfFilename && a.id !== pdfFilename
  );

  nextAttachments.push({
    id: pdfFilename,
    filename: pdfFilename,
    mimeCode: "application/pdf",
    description: null,
    embeddedDocument: pdfBase64,
    url: null,
  });

  return nextAttachments;
}
