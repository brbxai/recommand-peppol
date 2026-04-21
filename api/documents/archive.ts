import JSZip from "jszip";
import { renderDocumentPdf } from "@peppol/utils/document-renderer";
import type { PublicTransmittedDocumentWithLabels } from "@peppol/data/transmitted-documents";

export async function buildDocumentsArchive(
  documents: PublicTransmittedDocumentWithLabels[],
  options: {
    outputType: "flat" | "nested";
    generatePdf: "never" | "always" | "when_no_pdf_attachment";
  }
) {
  const zip = new JSZip();

  if (options.outputType === "flat") {
    for (const document of documents) {
      if (document.xml) {
        zip.file(`${document.id}.xml`, document.xml);
      } else {
        const pdfBuffer = await renderDocumentPdf(document);
        zip.file(`${document.id}.pdf`, pdfBuffer);
      }
    }

    return zip.generateAsync({ type: "nodebuffer" });
  }

  for (const document of documents) {
    const folder = zip.folder(document.id);

    if (!folder) {
      continue;
    }

    const { xml, ...documentMetadata } = document;
    folder.file("document.json", JSON.stringify(documentMetadata, null, 2));

    if (xml) {
      folder.file("document.xml", xml);
    }

    let hasPdfAttachment = false;

    if (document.parsed && "attachments" in document.parsed && document.parsed.attachments) {
      for (const attachment of document.parsed.attachments) {
        const base64 = attachment.embeddedDocument;
        const mimeCode = attachment.mimeCode;
        const filename = attachment.filename;

        if (base64 && mimeCode && filename) {
          folder.file(filename, Buffer.from(base64, "base64"));

          if (mimeCode === "application/pdf") {
            hasPdfAttachment = true;
          }
        }
      }
    }

    const shouldGeneratePdf =
      options.generatePdf === "always" ||
      (options.generatePdf === "when_no_pdf_attachment" && !hasPdfAttachment);

    if (!shouldGeneratePdf) {
      continue;
    }

    try {
      const pdfBuffer = await renderDocumentPdf(document);
      folder.file("auto-generated.pdf", pdfBuffer);
    } catch (error) {
      console.error(`Failed to generate PDF for document ${document.id}:`, error);
    }
  }

  return zip.generateAsync({ type: "nodebuffer" });
}
