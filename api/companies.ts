import { requireTeamAccess } from "@core/lib/auth-middleware";
import {
  createCompany,
  deleteCompany,
  getCompany,
  getCompanies,
  updateCompany,
} from "@peppol/data/companies";
import { zodValidCountryCodes } from "@peppol/db/schema";
import { cleanEnterpriseNumber, cleanVatNumber, UserFacingError } from "@peppol/utils/util";
import { Server } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponse } from "@peppol/utils/api-docs";

const server = new Server();

const _companies = server.get(
  "/:teamId/companies",
  requireTeamAccess(),
  describeRoute({
    operationId: "getCompanies",
    description: "Get a list of all companies for a team",
    summary: "List Companies",
    tags: ["Companies"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved companies", {
        companies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              teamId: { type: "string" },
              name: { type: "string" },
              address: { type: "string" },
              postalCode: { type: "string" },
              city: { type: "string" },
              country: { type: "string" },
              enterpriseNumber: { type: "string" },
              vatNumber: { type: "string" },
              isSmpRecipient: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      }),
      ...describeErrorResponse(500, "Failed to fetch companies"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    try {
      const allCompanies = await getCompanies(c.var.team.id);
      return c.json(actionSuccess({ companies: allCompanies }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch companies"), 500);
    }
  }
);

const _company = server.get(
  "/:teamId/companies/:companyId",
  requireTeamAccess(),
  describeRoute({
    operationId: "getCompany",
    description: "Get a specific company by ID",
    summary: "Get Company",
    tags: ["Companies"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved company", {
        company: {
          type: "object",
          properties: {
            id: { type: "string" },
            teamId: { type: "string" },
            name: { type: "string" },
            address: { type: "string" },
            postalCode: { type: "string" },
            city: { type: "string" },
            country: { type: "string" },
            enterpriseNumber: { type: "string" },
            vatNumber: { type: "string" },
            isSmpRecipient: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(404, "Company not found"),
      ...describeErrorResponse(500, "Failed to fetch company"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  async (c) => {
    try {
      const company = await getCompany(
        c.var.team.id,
        c.req.valid("param").companyId
      );
      return c.json(actionSuccess({ company }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch company"), 500);
    }
  }
);

const _createCompany = server.post(
  "/:teamId/companies",
  requireTeamAccess(),
  describeRoute({
    operationId: "createCompany",
    description: "Create a new company",
    summary: "Create Company",
    tags: ["Companies"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: { type: "string" },
              postalCode: { type: "string" },
              city: { type: "string" },
              country: { type: "string" },
              enterpriseNumber: { type: "string", nullable: true },
              vatNumber: { type: "string", nullable: true },
              isSmpRecipient: { type: "boolean", default: true },
            },
            required: ["name", "address", "postalCode", "city", "country"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully created company", {
        company: {
          type: "object",
          properties: {
            id: { type: "string" },
            teamId: { type: "string" },
            name: { type: "string" },
            address: { type: "string" },
            postalCode: { type: "string" },
            city: { type: "string" },
            country: { type: "string" },
            enterpriseNumber: { type: "string" },
            vatNumber: { type: "string" },
            isSmpRecipient: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(400, "Invalid request data"),
      ...describeErrorResponse(500, "Failed to create company"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string() })),
  zodValidator(
    "json",
    z.object({
      name: z.string(),
      address: z.string(),
      postalCode: z.string(),
      city: z.string(),
      country: zodValidCountryCodes,
      enterpriseNumber: z.string().nullish().transform(cleanEnterpriseNumber),
      vatNumber: z.string().nullish().transform(cleanVatNumber),
      isSmpRecipient: z.boolean().default(true),
    })
  ),
  async (c) => {
    let enterpriseNumber = c.req.valid("json").enterpriseNumber;
    if (!enterpriseNumber && c.req.valid("json").vatNumber) {
      enterpriseNumber = cleanEnterpriseNumber(c.req.valid("json").vatNumber!);
    }
    if (!enterpriseNumber) {
      return c.json(
        actionFailure("Enterprise number or VAT number is required"),
        400
      );
    }
    try {
      const company = await createCompany({
        ...c.req.valid("json"),
        teamId: c.var.team.id,
        enterpriseNumber: enterpriseNumber!,
      });
      return c.json(actionSuccess({ company }));
    } catch (error) {
      console.error(error);
      if(error instanceof UserFacingError){
        return c.json(actionFailure(error), 400);
      }
      return c.json(actionFailure("Could not create company"), 500);
    }
  }
);

const _updateCompany = server.put(
  "/:teamId/companies/:companyId",
  requireTeamAccess(),
  describeRoute({
    operationId: "updateCompany",
    description: "Update an existing company",
    summary: "Update Company",
    tags: ["Companies"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: { type: "string" },
              postalCode: { type: "string" },
              city: { type: "string" },
              country: { type: "string" },
              enterpriseNumber: { type: "string", nullable: true },
              vatNumber: { type: "string", nullable: true },
              isSmpRecipient: { type: "boolean", default: true },
            },
            required: [],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("", {
        company: {
          type: "object",
          properties: {
            id: { type: "string" },
            teamId: { type: "string" },
            name: { type: "string" },
            address: { type: "string" },
            postalCode: { type: "string" },
            city: { type: "string" },
            country: { type: "string" },
            enterpriseNumber: { type: "string" },
            vatNumber: { type: "string" },
            isSmpRecipient: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(400, "Invalid request data"),
      ...describeErrorResponse(404, "Company not found"),
      ...describeErrorResponse(500, "Failed to update company"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  zodValidator(
    "json",
    z.object({
      name: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      country: zodValidCountryCodes.optional(),
      enterpriseNumber: z.string().nullish().transform(cleanEnterpriseNumber),
      vatNumber: z.string().nullish().transform(cleanVatNumber),
      isSmpRecipient: z.boolean().optional(),
    })
  ),
  async (c) => {
    try {
      const updateData = c.req.valid("json");

      const company = await updateCompany({
        ...updateData,
        teamId: c.var.team.id,
        id: c.req.valid("param").companyId,
      });
      if (!company) {
        return c.json(actionFailure("Company not found"), 404);
      }
      return c.json(actionSuccess({ company }));
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error), 400);
      }
      console.error(error);
      return c.json(actionFailure("Could not update company"), 500);
    }
  }
);

const _deleteCompany = server.delete(
  "/:teamId/companies/:companyId",
  requireTeamAccess(),
  describeRoute({
    operationId: "deleteCompany",
    description: "Delete a company",
    summary: "Delete Company",
    tags: ["Companies"],
    responses: {
      ...describeSuccessResponse("Successfully deleted company", {}),
      ...describeErrorResponse(500, "Failed to delete company"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  async (c) => {
    try {
      await deleteCompany(c.var.team.id, c.req.valid("param").companyId);
      return c.json(actionSuccess());
    } catch (error) {
      console.error(error);
      return c.json(actionFailure("Could not delete company"), 500);
    }
  }
);

export type Companies =
  | typeof _companies
  | typeof _company
  | typeof _createCompany
  | typeof _updateCompany
  | typeof _deleteCompany;

export default server;
