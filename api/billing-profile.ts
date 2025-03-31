import { zValidator } from "@hono/zod-validator";
import { Server } from "@recommand/lib/api";
import { z } from "zod";
import {
  getBillingProfile,
  upsertBillingProfile,
} from "@peppol/data/billing-profile";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";

const server = new Server();

export type BillingProfileData = {
  id: string;
  teamId: string;
  mollieCustomerId: string | null;
  companyName: string;
  address: string;
  postalCode: string;
  city: string;
  country: "BE";
  vatNumber: string | null;
};

const _getBillingProfile = server.get(
  "/:teamId/billing-profile",
  zValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    // TODO: Perform authentication and authorization

    const teamId = c.req.param("teamId");

    try {
      const billingProfile = await getBillingProfile(teamId);
      return c.json(actionSuccess({ billingProfile }));
    } catch (error) {
      if (error instanceof Error && error.message === "Billing profile not found") {
        return c.json(actionFailure("Billing profile not found"), 404);
      }
      throw error;
    }
  }
);

const _upsertBillingProfile = server.put(
  "/:teamId/billing-profile",
  zValidator("param", z.object({ teamId: z.string() })),
  zValidator(
    "json",
    z.object({
      companyName: z.string(),
      address: z.string(),
      postalCode: z.string(),
      city: z.string(),
      country: z.enum(["BE"]),
      vatNumber: z.string().optional().nullable(),
    })
  ),
  async (c) => {
    // TODO: Perform authentication and authorization

    const teamId = c.req.param("teamId");
    const billingProfileData = c.req.valid("json");

    const billingProfile = await upsertBillingProfile(teamId, billingProfileData);

    return c.json(actionSuccess({ billingProfile }));
  }
);

export type BillingProfile = 
  | typeof _getBillingProfile 
  | typeof _upsertBillingProfile 

export default server;
