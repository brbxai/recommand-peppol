import { zodValidator } from "@recommand/lib/zod-validator";
import { Server } from "@recommand/lib/api";
import { z } from "zod";
import {
  getBillingProfile,
  upsertBillingProfile,
} from "@peppol/data/billing-profile";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { createFirstPayment, processFirstPayment, processPayment } from "@peppol/data/mollie";
import { endBillingCycle, getCurrentUsage } from "@peppol/data/billing";
import { endOfMonth, format, subMonths } from "date-fns";
import { requireAdmin, requireTeamAccess } from "@core/lib/auth-middleware";
import { zodValidCountryCodes } from "@peppol/db/schema";
import { describeRoute } from "hono-openapi";
import ExcelJS from "exceljs";

const server = new Server();

export type BillingProfileData = {
  id: string;
  teamId: string;
  mollieCustomerId: string | null;
  companyName: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  vatNumber: string | null;
  firstPaymentId: string | null;
  firstPaymentStatus: 'none' | 'open' | 'pending' | 'authorized' | 'paid' | 'canceled' | 'expired' | 'failed';
  isMandateValidated: boolean;
};

const _getBillingProfile = server.get(
  "/:teamId/billing-profile",
  requireTeamAccess(),
  describeRoute({hide: true}),
  zodValidator("param", z.object({ teamId: z.string() })),
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
  describeRoute({hide: true}),
  zodValidator("param", z.object({ teamId: z.string() })),
  zodValidator(
    "json",
    z.object({
      companyName: z.string(),
      address: z.string(),
      postalCode: z.string(),
      city: z.string(),
      country: zodValidCountryCodes,
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
  describeRoute({hide: true}),
  zodValidator("param", z.object({ teamId: z.string() })),
  zodValidator("query", z.object({ dryRun: z.string().optional().default("false") })),
  async (c) => {
    try {
      const endOfPreviousMonth = endOfMonth(subMonths(new Date(), 1));
      const isDryRun = c.req.query("dryRun") === "true";
      console.log("Ending billing cycle for team", c.req.param("teamId"), "on", endOfPreviousMonth, "with dry run", isDryRun);
      const results = await endBillingCycle(c.req.param("teamId"), endOfPreviousMonth, isDryRun);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Billing Results");
      
      worksheet.columns = [
        { header: "Billing Profile ID", key: "billingProfileId", width: 30 },
        { header: "Team ID", key: "teamId", width: 30 },
        { header: "Subscription ID", key: "subscriptionId", width: 30 },
        { header: "Company Name", key: "companyName", width: 30 },
        { header: "Company Street", key: "companyStreet", width: 30 },
        { header: "Company Postal Code", key: "companyPostalCode", width: 20 },
        { header: "Company City", key: "companyCity", width: 20 },
        { header: "Company Country", key: "companyCountry", width: 15 },
        { header: "Company VAT Number", key: "companyVatNumber", width: 20 },
        { header: "Subscription Start Date", key: "subscriptionStartDate", width: 20 },
        { header: "Subscription End Date", key: "subscriptionEndDate", width: 20 },
        { header: "Subscription Last Billed At", key: "subscriptionLastBilledAt", width: 25 },
        { header: "Plan ID", key: "planId", width: 30 },
        { header: "Included Monthly Documents", key: "includedMonthlyDocuments", width: 25 },
        { header: "Base Price", key: "basePrice", width: 15 },
        { header: "Incoming Document Overage Price", key: "incomingDocumentOveragePrice", width: 30 },
        { header: "Outgoing Document Overage Price", key: "outgoingDocumentOveragePrice", width: 30 },
        { header: "Total Amount (Excl. VAT)", key: "totalAmountExcl", width: 25 },
        { header: "VAT Amount", key: "vatAmount", width: 15 },
        { header: "Total Amount (Incl. VAT)", key: "totalAmountIncl", width: 25 },
        { header: "Billing Date", key: "billingDate", width: 20 },
        { header: "Billing Period Start", key: "billingPeriodStart", width: 25 },
        { header: "Billing Period End", key: "billingPeriodEnd", width: 25 },
        { header: "Used Quantity", key: "usedQty", width: 15 },
        { header: "Used Quantity Incoming", key: "usedQtyIncoming", width: 25 },
        { header: "Used Quantity Outgoing", key: "usedQtyOutgoing", width: 25 },
        { header: "Included Quantity", key: "includedQty", width: 20 },
      ];
      
      worksheet.getRow(1).font = { bold: true };
      
      for (const result of results) {
        worksheet.addRow(result);
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `billing-cycle-${format(endOfPreviousMonth, "yyyy-MM-dd")}-${isDryRun ? "dry-run" : "live"}.xlsx`;
      
      c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      
      return c.body(buffer);
    } catch (error) {
      console.error(error);
      return c.json(actionFailure("Failed to generate billing cycle report"), 500);
    }
  }
);

const _getCurrentUsage = server.get(
  "/:teamId/billing-profile/current-usage",
  requireTeamAccess(),
  describeRoute({hide: true}),
  zodValidator("param", z.object({ teamId: z.string() })),
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
