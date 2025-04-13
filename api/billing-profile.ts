import { zValidator } from "@hono/zod-validator";
import { Server } from "@recommand/lib/api";
import { z } from "zod";
import {
  getBillingProfile,
  upsertBillingProfile,
} from "@peppol/data/billing-profile";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { createFirstPayment, processFirstPayment, processPayment } from "@peppol/data/mollie";
import { endBillingCycle, getCurrentUsage } from "@peppol/data/billing";
import { endOfMonth, subMonths } from "date-fns";
import { requireAdmin, requireTeamAccess } from "@core/lib/auth-middleware";

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
  firstPaymentId: string | null;
  firstPaymentStatus: 'none' | 'open' | 'pending' | 'authorized' | 'paid' | 'canceled' | 'expired' | 'failed';
  isMandateValidated: boolean;
};

const _getBillingProfile = server.get(
  "/:teamId/billing-profile",
  requireTeamAccess(),
  zValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    try {
      const billingProfile = await getBillingProfile(c.var.team.id);
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
  requireTeamAccess(),
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
    const billingProfileData = c.req.valid("json");

    const billingProfile = await upsertBillingProfile({
      teamId: c.var.team.id,
      ...billingProfileData,
    });

    // Validate that the billing profile has a Mollie customer ID
    if (!billingProfile.mollieCustomerId) {
      return c.json(actionFailure("Billing profile customer not found"), 404);
    }

    if(billingProfile.isMandateValidated) {
      return c.json(actionSuccess({ billingProfile, checkoutUrl: null }));
    }

    // Create first payment
    const payment = await createFirstPayment(billingProfile.mollieCustomerId, billingProfile.id);

    // If checkout URL is not present, return error
    if (!payment._links?.checkout?.href) {
      return c.json(actionFailure("Payment checkout URL not found"), 500);
    }

    return c.json(actionSuccess({ billingProfile, checkoutUrl: payment._links.checkout.href }));
  }
);

const _endBillingCycle = server.post(
  "/:teamId/billing-profile/end-billing-cycle",
  requireAdmin(),
  zValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    const endOfPreviousMonth = endOfMonth(subMonths(new Date(), 1));
    await endBillingCycle(c.req.param("teamId"), endOfPreviousMonth);
    return c.json(actionSuccess());
  }
);

const _getCurrentUsage = server.get(
  "/:teamId/billing-profile/current-usage",
  requireTeamAccess(),
  zValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    try {
      const usage = await getCurrentUsage(c.var.team.id);
      return c.json(actionSuccess({ usage }));
    } catch (error) {
      return c.json(actionFailure("Failed to get current usage"), 500);
    }
  }
);
server.post(
  "/mollie/mandate-webhook",
  async (c) => {
    const webhookData = await c.req.formData();
    const paymentId = webhookData.get("id");
    console.log("Mollie webhook received", webhookData);
    await processFirstPayment(paymentId as string);

    return c.json(actionSuccess());
  }
);

server.post(
  "/mollie/payment-webhook",
  async (c) => {
    const webhookData = await c.req.formData();
    const paymentId = webhookData.get("id");
    console.log("Mollie webhook received", webhookData);
    await processPayment(paymentId as string);

    return c.json(actionSuccess());
  }
)

export type BillingProfile = 
  | typeof _getBillingProfile 
  | typeof _upsertBillingProfile
  | typeof _endBillingCycle
  | typeof _getCurrentUsage;

export default server;
