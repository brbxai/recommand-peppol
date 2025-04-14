import { requireTeamAccess } from "@core/lib/auth-middleware";
import {
  createCompany,
  deleteCompany,
  getCompany,
  getCompanies,
  updateCompany,
} from "@peppol/data/companies";
import { zodValidCountryCodes } from "@peppol/db/schema";
import { cleanEnterpriseNumber, cleanVatNumber } from "@peppol/utils/util";
import { Server } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { validator as zValidator } from "hono-openapi/zod";
import { describeRoute } from "hono-openapi";

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
      200: {
        description: "Successfully retrieved companies",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
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
                      createdAt: { type: "string", format: "date-time" },
                      updatedAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      500: {
        description: "Failed to fetch companies",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
    },
  }),
  zValidator("param", z.object({ teamId: z.string() })),
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
      200: {
        description: "Successfully retrieved company",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
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
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
      404: {
        description: "Company not found",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
      500: {
        description: "Failed to fetch company",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
    },
  }),
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
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
            },
            required: ["name", "address", "postalCode", "city", "country"],
          },
        },
      },
    },
    responses: {
      200: {
        description: "Successfully created company",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
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
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Invalid request data",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
      500: {
        description: "Failed to create company",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
    },
  }),
  zValidator("param", z.object({ teamId: z.string() })),
  zValidator(
    "json",
    z.object({
      name: z.string(),
      address: z.string(),
      postalCode: z.string(),
      city: z.string(),
      country: zodValidCountryCodes,
      enterpriseNumber: z.string().nullish().transform(cleanEnterpriseNumber),
      vatNumber: z.string().nullish().transform(cleanVatNumber),
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
            },
            required: ["name", "address", "postalCode", "city", "country"],
          },
        },
      },
    },
    responses: {
      200: {
        description: "Successfully updated company",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
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
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Invalid request data",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
      404: {
        description: "Company not found",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
      500: {
        description: "Failed to update company",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
    },
  }),
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  zValidator(
    "json",
    z.object({
      name: z.string(),
      address: z.string(),
      postalCode: z.string(),
      city: z.string(),
      country: zodValidCountryCodes,
      enterpriseNumber: z.string().nullish().transform(cleanEnterpriseNumber),
      vatNumber: z.string().nullish().transform(cleanVatNumber),
    })
  ),
  async (c) => {
    try {
      let enterpriseNumber = c.req.valid("json").enterpriseNumber;
      if (!enterpriseNumber && c.req.valid("json").vatNumber) {
        enterpriseNumber = cleanEnterpriseNumber(
          c.req.valid("json").vatNumber!
        );
      }
      if (!enterpriseNumber) {
        return c.json(
          actionFailure("Enterprise number or VAT number is required"),
          400
        );
      }

      const company = await updateCompany({
        ...c.req.valid("json"),
        teamId: c.var.team.id,
        id: c.req.valid("param").companyId,
        enterpriseNumber: enterpriseNumber!,
      });
      if (!company) {
        return c.json(actionFailure("Company not found"), 404);
      }
      return c.json(actionSuccess({ company }));
    } catch (error) {
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
      200: {
        description: "Successfully deleted company",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
              },
            },
          },
        },
      },
      500: {
        description: "Failed to delete company",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                errors: {
                  type: "object",
                  additionalProperties: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
              required: ["success", "errors"],
            },
          },
        },
      },
    },
  }),
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  async (c) => {
    try {
      await deleteCompany(c.var.team.id, c.req.valid("param").companyId);
      return c.json(actionSuccess());
    } catch (error) {
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
