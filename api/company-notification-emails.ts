import {
  createCompanyNotificationEmailAddress,
  deleteCompanyNotificationEmailAddress,
  getCompanyNotificationEmailAddress,
  getCompanyNotificationEmailAddresses,
  updateCompanyNotificationEmailAddress,
} from "@peppol/data/company-notification-emails";
import { Server } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import { describeErrorResponse, describeSuccessResponse } from "@peppol/utils/api-docs";
import { requireCompanyAccess } from "@peppol/utils/auth-middleware";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const _companyNotificationEmailAddresses = server.get(
  "/:teamId/companies/:companyId/notification-email-addresses",
  requireCompanyAccess(),
  describeRoute({
    operationId: "getCompanyNotificationEmailAddresses",
    description: "Get a list of all notification email addresses for a specific company",
    summary: "List Company Notification Email Addresses",
    tags: ["Company Notification Email Addresses"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved company notification email addresses", {
        notificationEmailAddresses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              companyId: { type: "string" },
              email: { type: "string" },
              notifyIncoming: { type: "boolean" },
              notifyOutgoing: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      }),
      ...describeErrorResponse(404, "Company not found"),
      ...describeErrorResponse(500, "Failed to fetch company notification email addresses"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  async (c) => {
    try {
      const notificationEmailAddresses = await getCompanyNotificationEmailAddresses(c.var.company.id);
      return c.json(actionSuccess({ notificationEmailAddresses }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch company notification email addresses"), 500);
    }
  }
);

const _companyNotificationEmailAddress = server.get(
  "/:teamId/companies/:companyId/notification-email-addresses/:notificationEmailAddressId",
  requireCompanyAccess(),
  describeRoute({
    operationId: "getCompanyNotificationEmailAddress",
    description: "Get a specific company notification email address by ID",
    summary: "Get Company Notification Email Address",
    tags: ["Company Notification Email Addresses"],
    responses: {
      ...describeSuccessResponse("Successfully retrieved company notification email address", {
        notificationEmailAddress: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            email: { type: "string" },
            notifyIncoming: { type: "boolean" },
            notifyOutgoing: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(404, "Company notification email address not found"),
      ...describeErrorResponse(500, "Failed to fetch company notification email address"),
    },
  }),
  zodValidator("param", z.object({
    teamId: z.string(),
    companyId: z.string(),
    notificationEmailAddressId: z.string()
  })),
  async (c) => {
    try {
      const notificationEmailAddress = await getCompanyNotificationEmailAddress(
        c.var.company.id,
        c.req.valid("param").notificationEmailAddressId
      );

      if (!notificationEmailAddress) {
        return c.json(actionFailure("Company notification email address not found"), 404);
      }

      return c.json(actionSuccess({ notificationEmailAddress }));
    } catch (error) {
      return c.json(actionFailure("Could not fetch company notification email address"), 500);
    }
  }
);

const _createCompanyNotificationEmailAddress = server.post(
  "/:teamId/companies/:companyId/notification-email-addresses",
  requireCompanyAccess(),
  describeRoute({
    operationId: "createCompanyNotificationEmailAddress",
    description: "Create a new company notification email address",
    summary: "Create Company Notification Email Address",
    tags: ["Company Notification Email Addresses"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              email: { type: "string" },
              notifyIncoming: { type: "boolean" },
              notifyOutgoing: { type: "boolean" },
            },
            required: ["email"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully created company notification email address", {
        notificationEmailAddress: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            email: { type: "string" },
            notifyIncoming: { type: "boolean" },
            notifyOutgoing: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(400, "Invalid request data"),
      ...describeErrorResponse(404, "Company not found"),
      ...describeErrorResponse(500, "Failed to create company notification email address"),
    },
  }),
  zodValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  zodValidator(
    "json",
    z.object({
      email: z.string().email("Valid email is required"),
      notifyIncoming: z.boolean(),
      notifyOutgoing: z.boolean(),
    })
  ),
  async (c) => {
    try {
      const json = c.req.valid("json");
      const notificationEmailAddress = await createCompanyNotificationEmailAddress({
        email: json.email,
        notifyIncoming: json.notifyIncoming,
        notifyOutgoing: json.notifyOutgoing,
        companyId: c.var.company.id,
      });

      return c.json(actionSuccess({ notificationEmailAddress }));
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error.message), 400);
      }
      return c.json(actionFailure("Could not create company notification email address"), 500);
    }
  }
);

const _updateCompanyNotificationEmailAddress = server.put(
  "/:teamId/companies/:companyId/notification-email-addresses/:notificationEmailAddressId",
  requireCompanyAccess(),
  describeRoute({
    operationId: "updateCompanyNotificationEmailAddress",
    description: "Update an existing company notification email address",
    summary: "Update Company Notification Email Address",
    tags: ["Company Notification Email Addresses"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              email: { type: "string" },
              notifyIncoming: { type: "boolean" },
              notifyOutgoing: { type: "boolean" },
            },
            required: ["email", "notifyIncoming", "notifyOutgoing"],
          },
        },
      },
    },
    responses: {
      ...describeSuccessResponse("Successfully updated company notification email address", {
        notificationEmailAddress: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            email: { type: "string" },
            notifyIncoming: { type: "boolean" },
            notifyOutgoing: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      }),
      ...describeErrorResponse(404, "Company notification email address not found"),
      ...describeErrorResponse(500, "Failed to update company notification email address"),
    },
  }),
  zodValidator("param", z.object({
    teamId: z.string(),
    companyId: z.string(),
    notificationEmailAddressId: z.string()
  })),
  zodValidator(
    "json",
    z.object({
      email: z.string().email("Valid email is required"),
      notifyIncoming: z.boolean(),
      notifyOutgoing: z.boolean(),
    })
  ),
  async (c) => {
    try {
      const json = c.req.valid("json");
      const notificationEmailAddress = await updateCompanyNotificationEmailAddress({
        email: json.email,
        notifyIncoming: json.notifyIncoming,
        notifyOutgoing: json.notifyOutgoing,
        companyId: c.var.company.id,
        id: c.req.valid("param").notificationEmailAddressId,
      });

      return c.json(actionSuccess({ notificationEmailAddress }));
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error.message), 404);
      }
      return c.json(actionFailure("Could not update company notification email address"), 500);
    }
  }
);

const _deleteCompanyNotificationEmailAddress = server.delete(
  "/:teamId/companies/:companyId/notification-email-addresses/:notificationEmailAddressId",
  requireCompanyAccess(),
  describeRoute({
    operationId: "deleteCompanyNotificationEmailAddress",
    description: "Delete a company notification email address",
    summary: "Delete Company Notification Email Address",
    tags: ["Company Notification Email Addresses"],
    responses: {
      ...describeSuccessResponse("Successfully deleted company notification email address", {}),
      ...describeErrorResponse(404, "Company notification email address not found"),
      ...describeErrorResponse(500, "Failed to delete company notification email address"),
    },
  }),
  zodValidator("param", z.object({
    teamId: z.string(),
    companyId: z.string(),
    notificationEmailAddressId: z.string()
  })),
  async (c) => {
    try {
      await deleteCompanyNotificationEmailAddress(
        c.var.company.id,
        c.req.valid("param").notificationEmailAddressId
      );

      return c.json(actionSuccess());
    } catch (error) {
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error.message), 404);
      }
      console.error(error);
      return c.json(actionFailure("Could not delete company notification email address"), 500);
    }
  }
);

export type CompanyNotificationEmailAddresses =
  | typeof _companyNotificationEmailAddresses
  | typeof _companyNotificationEmailAddress
  | typeof _createCompanyNotificationEmailAddress
  | typeof _updateCompanyNotificationEmailAddress
  | typeof _deleteCompanyNotificationEmailAddress;

export default server;
