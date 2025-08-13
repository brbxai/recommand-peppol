import {
  createCompanyDocumentType,
  deleteCompanyDocumentType,
  getCompanyDocumentType,
  getCompanyDocumentTypes,
  updateCompanyDocumentType,
} from "@peppol/data/company-document-types";
import { Server } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { validator as zValidator } from "hono-openapi/zod";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponse } from "@peppol/utils/api-docs";
import { requireCompanyAccess } from "@peppol/utils/auth-middleware";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const _companyDocumentTypes = server.get(
  "/:teamId/companies/:companyId/documentTypes",
  requireCompanyAccess(),
  describeRoute({
    operationId: "getCompanyDocumentTypes",
    description: "Get a list of all document types for a specific company",
    summary: "List Company Document Types",
    tags: ["Company Document Types"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved company document types", {
        documentTypes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              companyId: { type: "string" },
              docTypeId: { type: "string" },
              processId: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      }),
      ...describeErrorResponse(404, "Company not found"),
      ...describeErrorResponse(500, "Failed to fetch company document types"),
    },
  }),
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  async (c) => {
    try {
      const documentTypes = await getCompanyDocumentTypes(c.var.company.id);
      return c.json(actionSuccess({ documentTypes }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch company document types"), 500);
    }
  }
);

const _companyDocumentType = server.get(
  "/:teamId/companies/:companyId/documentTypes/:documentTypeId",
  requireCompanyAccess(),
  describeRoute({
    operationId: "getCompanyDocumentType",
    description: "Get a specific company document type by ID",
    summary: "Get Company Document Type",
    tags: ["Company Document Types"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved company document type", {
        documentType: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            docTypeId: { type: "string" },
            processId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(404, "Company document type not found"),
      ...describeErrorResponse(500, "Failed to fetch company document type"),
    },
  }),
  zValidator("param", z.object({ 
    teamId: z.string(), 
    companyId: z.string(), 
    documentTypeId: z.string() 
  })),
  async (c) => {
    try {
      const documentType = await getCompanyDocumentType(c.var.company.id, c.req.valid("param").documentTypeId);
      
      if (!documentType) {
        return c.json(actionFailure("Company document type not found"), 404);
      }

      return c.json(actionSuccess({ documentType }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch company document type"), 500);
    }
  }
);

const _createCompanyDocumentType = server.post(
  "/:teamId/companies/:companyId/documentTypes",
  requireCompanyAccess(),
  describeRoute({
    operationId: "createCompanyDocumentType",
    description: "Create a new company document type",
    summary: "Create Company Document Type",
    tags: ["Company Document Types"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              docTypeId: { type: "string" },
              processId: { type: "string" },
            },
            required: ["docTypeId", "processId"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully created company document type", {
        documentType: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            docTypeId: { type: "string" },
            processId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(400, "Invalid request data"),
      ...describeErrorResponse(404, "Company not found"),
      ...describeErrorResponse(500, "Failed to create company document type"),
    },
  }),
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  zValidator(
    "json",
    z.object({
      docTypeId: z.string().min(1, "Document type ID is required"),
      processId: z.string().min(1, "Process ID is required"),
    })
  ),
  async (c) => {
    try {
      const documentType = await createCompanyDocumentType({
        ...c.req.valid("json"),
        companyId: c.req.valid("param").companyId,
      }, c.var.team.isPlayground || !c.var.company.isSmpRecipient); // Skip SMP registration for playground teams
      
      return c.json(actionSuccess({ documentType }));
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error.message), 400);
      }
      return c.json(actionFailure("Could not create company document type"), 500);
    }
  }
);

const _updateCompanyDocumentType = server.put(
  "/:teamId/companies/:companyId/documentTypes/:documentTypeId",
  requireCompanyAccess(),
  describeRoute({
    operationId: "updateCompanyDocumentType",
    description: "Update an existing company document type",
    summary: "Update Company Document Type",
    tags: ["Company Document Types"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              docTypeId: { type: "string" },
              processId: { type: "string" },
            },
            required: ["docTypeId", "processId"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully updated company document type", {
        documentType: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            docTypeId: { type: "string" },
            processId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(404, "Company document type not found"),
      ...describeErrorResponse(500, "Failed to update company document type"),
    },
  }),
  zValidator("param", z.object({ 
    teamId: z.string(), 
    companyId: z.string(), 
    documentTypeId: z.string() 
  })),
  zValidator(
    "json",
    z.object({
      docTypeId: z.string().min(1, "Document type ID is required"),
      processId: z.string().min(1, "Process ID is required"),
    })
  ),
  async (c) => {
    try {
      const documentType = await updateCompanyDocumentType({
        ...c.req.valid("json"),
        companyId: c.req.valid("param").companyId,
        id: c.req.valid("param").documentTypeId,
      }, c.var.team.isPlayground || !c.var.company.isSmpRecipient); // Skip SMP registration for playground teams
      
      return c.json(actionSuccess({ documentType }));
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error.message), 404);
      }
      return c.json(actionFailure("Could not update company document type"), 500);
    }
  }
);

const _deleteCompanyDocumentType = server.delete(
  "/:teamId/companies/:companyId/documentTypes/:documentTypeId",
  requireCompanyAccess(),
  describeRoute({
    operationId: "deleteCompanyDocumentType",
    description: "Delete a company document type",
    summary: "Delete Company Document Type",
    tags: ["Company Document Types"],
    responses: {
      ...describeSuccessResponse("Successfully deleted company document type", {}),
      ...describeErrorResponse(404, "Company document type not found"),
      ...describeErrorResponse(500, "Failed to delete company document type"),
    },
  }),
  zValidator("param", z.object({ 
    teamId: z.string(), 
    companyId: z.string(), 
    documentTypeId: z.string() 
  })),
  async (c) => {
    try {
      await deleteCompanyDocumentType(
        c.req.valid("param").companyId, 
        c.req.valid("param").documentTypeId,
        c.var.team.isPlayground || !c.var.company.isSmpRecipient // Skip SMP registration for playground teams
      );
      
      return c.json(actionSuccess());
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error.message), 404);
      }
      console.error(error);
      return c.json(actionFailure("Could not delete company document type"), 500);
    }
  }
);

export type CompanyDocumentTypes =
  | typeof _companyDocumentTypes
  | typeof _companyDocumentType
  | typeof _createCompanyDocumentType
  | typeof _updateCompanyDocumentType
  | typeof _deleteCompanyDocumentType;

export default server;
