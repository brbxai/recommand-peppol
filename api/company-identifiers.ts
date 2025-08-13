import {
  createCompanyIdentifier,
  deleteCompanyIdentifier,
  getCompanyIdentifier,
  getCompanyIdentifiers,
  updateCompanyIdentifier,
} from "@peppol/data/company-identifiers";
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

const _companyIdentifiers = server.get(
  "/:teamId/companies/:companyId/identifiers",
  requireCompanyAccess(),
  describeRoute({
    operationId: "getCompanyIdentifiers",
    description: "Get a list of all identifiers for a specific company",
    summary: "List Company Identifiers",
    tags: ["Company Identifiers"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved company identifiers", {
        identifiers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              companyId: { type: "string" },
              scheme: { type: "string" },
              identifier: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      }),
      ...describeErrorResponse(404, "Company not found"),
      ...describeErrorResponse(500, "Failed to fetch company identifiers"),
    },
  }),
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  async (c) => {
    try {
      const identifiers = await getCompanyIdentifiers(c.var.company.id);
      return c.json(actionSuccess({ identifiers }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch company identifiers"), 500);
    }
  }
);

const _companyIdentifier = server.get(
  "/:teamId/companies/:companyId/identifiers/:identifierId",
  requireCompanyAccess(),
  describeRoute({
    operationId: "getCompanyIdentifier",
    description: "Get a specific company identifier by ID",
    summary: "Get Company Identifier",
    tags: ["Company Identifiers"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved company identifier", {
        identifier: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            scheme: { type: "string" },
            identifier: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(404, "Company identifier not found"),
      ...describeErrorResponse(500, "Failed to fetch company identifier"),
    },
  }),
  zValidator("param", z.object({ 
    teamId: z.string(), 
    companyId: z.string(), 
    identifierId: z.string() 
  })),
  async (c) => {
    try {
      const identifier = await getCompanyIdentifier(c.var.company.id, c.req.valid("param").identifierId);
      
      if (!identifier) {
        return c.json(actionFailure("Company identifier not found"), 404);
      }

      return c.json(actionSuccess({ identifier }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch company identifier"), 500);
    }
  }
);

const _createCompanyIdentifier = server.post(
  "/:teamId/companies/:companyId/identifiers",
  requireCompanyAccess(),
  describeRoute({
    operationId: "createCompanyIdentifier",
    description: "Create a new company identifier",
    summary: "Create Company Identifier",
    tags: ["Company Identifiers"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              scheme: { type: "string" },
              identifier: { type: "string" },
            },
            required: ["scheme", "identifier"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully created company identifier", {
        identifier: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            scheme: { type: "string" },
            identifier: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(400, "Invalid request data"),
      ...describeErrorResponse(404, "Company not found"),
      ...describeErrorResponse(500, "Failed to create company identifier"),
    },
  }),
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  zValidator(
    "json",
    z.object({
      scheme: z.string().min(1, "Scheme is required"),
      identifier: z.string().min(1, "Identifier is required"),
    })
  ),
  async (c) => {
    try {
      const identifier = await createCompanyIdentifier({
        ...c.req.valid("json"),
        companyId: c.req.valid("param").companyId,
      }, c.var.team.isPlayground || !c.var.company.isSmpRecipient); // Skip SMP registration for playground teams
      
      return c.json(actionSuccess({ identifier }));
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error.message), 400);
      }
      return c.json(actionFailure("Could not create company identifier"), 500);
    }
  }
);

const _updateCompanyIdentifier = server.put(
  "/:teamId/companies/:companyId/identifiers/:identifierId",
  requireCompanyAccess(),
  describeRoute({
    operationId: "updateCompanyIdentifier",
    description: "Update an existing company identifier",
    summary: "Update Company Identifier",
    tags: ["Company Identifiers"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              scheme: { type: "string" },
              identifier: { type: "string" },
            },
            required: ["scheme", "identifier"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully updated company identifier", {
        identifier: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            scheme: { type: "string" },
            identifier: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(404, "Company identifier not found"),
      ...describeErrorResponse(500, "Failed to update company identifier"),
    },
  }),
  zValidator("param", z.object({ 
    teamId: z.string(), 
    companyId: z.string(), 
    identifierId: z.string() 
  })),
  zValidator(
    "json",
    z.object({
      scheme: z.string().min(1, "Scheme is required"),
      identifier: z.string().min(1, "Identifier is required"),
    })
  ),
  async (c) => {
    try {
      const identifier = await updateCompanyIdentifier({
        ...c.req.valid("json"),
        companyId: c.req.valid("param").companyId,
        id: c.req.valid("param").identifierId,
      }, c.var.team.isPlayground || !c.var.company.isSmpRecipient); // Skip SMP registration for playground teams
      
      return c.json(actionSuccess({ identifier }));
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error.message), 404);
      }
      return c.json(actionFailure("Could not update company identifier"), 500);
    }
  }
);

const _deleteCompanyIdentifier = server.delete(
  "/:teamId/companies/:companyId/identifiers/:identifierId",
  requireCompanyAccess(),
  describeRoute({
    operationId: "deleteCompanyIdentifier",
    description: "Delete a company identifier",
    summary: "Delete Company Identifier",
    tags: ["Company Identifiers"],
    responses: {
      ...describeSuccessResponse("Successfully deleted company identifier", {}),
      ...describeErrorResponse(404, "Company identifier not found"),
      ...describeErrorResponse(500, "Failed to delete company identifier"),
    },
  }),
  zValidator("param", z.object({ 
    teamId: z.string(), 
    companyId: z.string(), 
    identifierId: z.string() 
  })),
  async (c) => {
    try {
      await deleteCompanyIdentifier(
        c.req.valid("param").companyId, 
        c.req.valid("param").identifierId,
        c.var.team.isPlayground || !c.var.company.isSmpRecipient // Skip SMP registration for playground teams
      );
      
      return c.json(actionSuccess());
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error.message), 404);
      }
      console.error(error);
      return c.json(actionFailure("Could not delete company identifier"), 500);
    }
  }
);

export type CompanyIdentifiers =
  | typeof _companyIdentifiers
  | typeof _companyIdentifier
  | typeof _createCompanyIdentifier
  | typeof _updateCompanyIdentifier
  | typeof _deleteCompanyIdentifier;

export default server;
