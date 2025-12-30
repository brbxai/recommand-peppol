import { zodValidator } from "@recommand/lib/zod-validator";
import { Server } from "@recommand/lib/api";
import { z } from "zod";
import { actionFailure } from "@recommand/lib/utils";
import { endBillingCycle } from "@peppol/data/billing";
import { endOfMonth, format, subMonths } from "date-fns";
import { requireAdmin } from "@core/lib/auth-middleware";
import { describeRoute } from "hono-openapi";
import ExcelJS from "exceljs";

const server = new Server();

const _endBillingCycle = server.post(
  "/billing/end-billing-cycle",
  requireAdmin(),
  describeRoute({ hide: true }),
  zodValidator("query", z.object({ dryRun: z.string().optional().default("false") })),
  async (c) => {
    try {
      const endOfPreviousMonth = endOfMonth(subMonths(new Date(), 1));
      const isDryRun = c.req.query("dryRun") === "true";
      console.log("Ending billing cycle for all teams on", endOfPreviousMonth, "with dry run", isDryRun);
      const results = await endBillingCycle(endOfPreviousMonth, isDryRun);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Billing Results");

      worksheet.columns = [
        { header: "Status", key: "status", width: 15 },
        { header: "Message", key: "message", width: 40 },
        { header: "Billing Profile ID", key: "billingProfileId", width: 30 },
        { header: "Is Manually Billed", key: "isManuallyBilled", width: 20 },
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
        { header: "Billing Event ID", key: "billingEventId", width: 30 },
        { header: "Invoice ID", key: "invoiceId", width: 30 },
        { header: "Invoice Reference", key: "invoiceReference", width: 20 },
        { header: "Total Amount (Excl. VAT)", key: "totalAmountExcl", width: 25 },
        { header: "VAT Category", key: "vatCategory", width: 15 },
        { header: "VAT Percentage", key: "vatPercentage", width: 15 },
        { header: "VAT Exemption Reason", key: "vatExemptionReason", width: 40 },
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

export type Billing = typeof _endBillingCycle;

export default server;