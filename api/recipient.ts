import { verifyRecipient, verifyDocumentSupport } from "@peppol/data/recipient";
import { Server } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { validator as zValidator } from "hono-openapi/zod";
import { describeRoute } from "hono-openapi";
import { describeSuccessResponse } from "@peppol/utils/api-docs";
import { requireAuth } from "@core/lib/auth-middleware";
import { searchPeppolDirectory } from "@peppol/data/peppol-directory";

const server = new Server();

const _verifyRecipient = server.post(
  "/verify",
  requireAuth(),
  describeRoute({
    operationId: "verifyRecipient",
    description: "Verify if a recipient address is registered in the Peppol network",
    summary: "Verify Recipient",
    tags: ["Recipients"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              peppolAddress: { type: "string", description: "The Peppol address of the recipient to verify." },
            },
            required: ["peppolAddress"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully verified recipient", {
        isValid: { type: "boolean", description: "Whether the recipient is registered in the Peppol network." },
        smpUrl: { type: "string", description: "The SMP URL of the recipient." },
        serviceMetadataReferences: { type: "array", items: { type: "string" }, description: "The service metadata references of the recipient." },
        smpHostnames: { type: "array", items: { type: "string" }, description: "The SMP hostnames of the recipient." },
      }),
    },
  }),
  zValidator(
    "json",
    z.object({
      peppolAddress: z.string().openapi({
        description: "The Peppol address of the recipient to verify.",
        example: "0208:987654321",
      }),
    })
  ),
  async (c) => {
    try {
      const data = await verifyRecipient(c.req.valid("json").peppolAddress);
      return c.json(actionSuccess({ isValid: true, ...data }));
    } catch (error) {
      return c.json(actionSuccess({ isValid: false }));
    }
  }
);

const _verifyDocumentSupport = server.post(
  "/verifyDocumentSupport",
  requireAuth(),
  describeRoute({
    operationId: "verifyDocumentSupport",
    description: "Verify if a recipient can receive a specific document type in the Peppol network",
    summary: "Verify Document Support",
    tags: ["Recipients"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              peppolAddress: { type: "string" },
              documentType: { type: "string" },
            },
            required: ["peppolAddress", "documentType"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully verified document Support", {
        isValid: { type: "boolean", description: "Whether the recipient supports the document type." },
        smpUrl: { type: "string", description: "The SMP URL of the recipient." },
      }),
    },
  }),
  zValidator(
    "json",
    z.object({
      peppolAddress: z.string().openapi({
        description: "The Peppol address of the recipient to verify.",
        example: "0208:987654321",
      }),
      documentType: z.string().openapi({
        description: "The document type to verify.",
        example: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
      }),
    })
  ),
  async (c) => {
    try {
      const { peppolAddress, documentType } = c.req.valid("json");
      const data = await verifyDocumentSupport(peppolAddress, documentType);
      return c.json(actionSuccess({ isValid: true, ...data }));
    } catch (error) {
      return c.json(actionSuccess({ isValid: false }));
    }
  }
);

const _searchDirectory = server.post(
  "/searchPeppolDirectory",
  requireAuth(),
  describeRoute({
    operationId: "searchPeppolDirectory",
    description: "Search for recipients in the Peppol directory",
    summary: "Search Directory",
    tags: ["Recipients"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              query: { type: "string", description: "The search query to find recipients." },
            },
            required: ["query"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully searched directory", {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              peppolAddress: { type: "string", description: "The Peppol address of the recipient." },
              name: { type: "string", description: "The name of the recipient." },
              supportedDocumentTypes: { 
                type: "array", 
                items: { type: "string" },
                description: "List of document types supported by the recipient."
              },
            },
          },
        },
      }),
    },
  }),
  zValidator(
    "json",
    z.object({
      query: z.string().openapi({
        description: "The search query to find recipients.",
        example: "Company Name",
      }),
    })
  ),
  async (c) => {
    try {
      const { query } = c.req.valid("json");
      const results = await searchPeppolDirectory(query);
      return c.json(actionSuccess({ results }));
    } catch (error) {
      return c.json(actionFailure("Failed to search directory"));
    }
  }
);

export type Recipients = typeof _verifyRecipient | typeof _verifyDocumentSupport | typeof _searchDirectory;

export default server;
