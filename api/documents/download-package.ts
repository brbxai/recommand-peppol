import { Server, type Context } from "@recommand/lib/api";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { actionFailure } from "@recommand/lib/utils";
import { type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { describeRoute } from "hono-openapi";
import {
    getTransmittedDocument,
} from "@peppol/data/transmitted-documents";
import {
    describeErrorResponse,
} from "@peppol/utils/api-docs";
import { requireIntegrationSupportedTeamAccess, type CompanyAccessContext } from "@peppol/utils/auth-middleware";
import JSZip from "jszip";
import { renderDocumentPdf } from "@peppol/utils/document-renderer";

const server = new Server();

const downloadPackageRouteDescription = describeRoute({
    operationId: "downloadPackage",
    description: "Download a document as a zip file containing the document JSON, XML, and any binary attachments",
    summary: "Download Document Package",
    tags: ["Documents"],
    responses: {
        "200": {
            description: "Successfully downloaded the document",
            content: {
                "application/zip": {
                    schema: {
                        type: "string",
                        format: "binary",
                    },
                },
            },
        },
        ...describeErrorResponse(404, "Document not found"),
        ...describeErrorResponse(500, "Failed to download document"),
    },
});

const downloadPackageParamSchema = z.object({
    documentId: z.string().openapi({
        description: "The ID of the document to download",
    }),
});

const downloadPackageParamSchemaWithTeamId = downloadPackageParamSchema.extend({
    teamId: z.string(),
});

type DownloadPackageContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { param: z.input<typeof downloadPackageParamSchemaWithTeamId> }, out: { param: z.infer<typeof downloadPackageParamSchemaWithTeamId> } }>;

const _downloadPackageMinimal = server.get(
    "/documents/:documentId/download-package",
    requireIntegrationSupportedTeamAccess(),
    downloadPackageRouteDescription,
    zodValidator("param", downloadPackageParamSchema),
    _downloadPackageImplementation,
);

const _downloadPackage = server.get(
    "/:teamId/documents/:documentId/downloadPackage",
    requireIntegrationSupportedTeamAccess(),
    describeRoute({hide: true}),
    zodValidator("param", downloadPackageParamSchemaWithTeamId),
    _downloadPackageImplementation,
);

async function _downloadPackageImplementation(c: DownloadPackageContext) {
    try {
        const { documentId } = c.req.valid("param");
        const document = await getTransmittedDocument(c.var.team.id, documentId);

        if (!document) {
            return c.json(actionFailure("Document not found"), 404);
        }

        // Create a new zip file
        const zip = new JSZip();

        // Add document metadata as JSON
        const { xml, ...documentMetadata } = document;
        zip.file("document.json", JSON.stringify(documentMetadata, null, 2));

        // Add XML if available
        if (xml) {
            zip.file("document.xml", xml);
        }

        // If there are attachments, add them to the zip
        if (document.parsed?.attachments) {
            for (const attachment of document.parsed.attachments) {
                const base64 = attachment.embeddedDocument;
                const mimeCode = attachment.mimeCode;
                const filename = attachment.filename;

                if (base64 && mimeCode && filename) {
                    zip.file(filename, Buffer.from(base64, 'base64'));
                }
            }
        }

        // Try to generate a PDF representation and add it to the zip
        // try {
        //     const pdfBuffer = await renderDocumentPdf(document);
        //     zip.file("auto-generated.pdf", pdfBuffer);
        // } catch (error) {
        //     // If PDF generation fails, we still want to return the rest of the package
        //     console.error("Failed to generate PDF for document package:", error);
        // }

        // Generate the zip file
        const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

        // Set headers for file download
        c.header("Content-Type", "application/zip");
        c.header("Content-Disposition", `attachment; filename="${documentId}.zip"`);

        return c.body(zipBuffer);
    } catch (error) {
        return c.json(actionFailure("Failed to download document"), 500);
    }
}

export type DownloadPackage = typeof _downloadPackage | typeof _downloadPackageMinimal;

export default server;