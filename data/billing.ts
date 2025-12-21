import {
  billingProfiles,
  subscriptionBillingEvents,
  subscriptions,
  transferEvents,
} from "@peppol/db/schema";
import { db } from "@recommand/db";
import { and, eq, isNull, lt, or, gt, count, gte, lte } from "drizzle-orm";
import {
  differenceInMinutes,
  isSameDay,
  startOfMonth,
  addMilliseconds,
  endOfMonth,
} from "date-fns";
import Decimal from "decimal.js";
import { getBillingProfile } from "./billing-profile";
import { getMandate, requestPayment } from "./mollie";
import { sendTelegramNotification } from "@peppol/utils/system-notifications/telegram";
import { BillingConfigSchema } from "./plans";
import { cleanVatNumber } from "@peppol/utils/util";
import { COUNTRIES } from "@peppol/utils/countries";
import type { VatCategory } from "@peppol/utils/parsing/invoice/schemas";

export type BillSubscriptionResult = {
  billingProfileId: string;
  teamId: string;
  subscriptionId: string;
  companyName: string;
  companyStreet: string;
  companyPostalCode: string;
  companyCity: string;
  companyCountry: string;
  companyVatNumber: string | null;
  subscriptionStartDate: Date;
  subscriptionEndDate: Date | null;
  subscriptionLastBilledAt: string | null;
  planId: string | null;
  includedMonthlyDocuments: number;
  basePrice: number;
  incomingDocumentOveragePrice: number;
  outgoingDocumentOveragePrice: number;
  billingEventId: string | null;
  invoiceId: string | null;
  invoiceReference: number | null;
  totalAmountExcl: number;
  vatCategory: VatCategory;
  vatPercentage: number;
  vatExemptionReason: string | null;
  vatAmount: number;
  totalAmountIncl: number;
  billingDate: Date;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  usedQty: number;
  usedQtyIncoming: number;
  usedQtyOutgoing: number;
  includedQty: number;
}

export async function getCurrentUsage(teamId: string) {
  const s = startOfMonth(new Date());
  const e = endOfMonth(new Date());
  const transmittedDocuments = await db
    .select({
      usage: count(),
    })
    .from(transferEvents)
    .where(
      and(
        eq(transferEvents.teamId, teamId),
        gte(transferEvents.createdAt, s),
        lte(transferEvents.createdAt, e)
      )
    );
  return transmittedDocuments[0].usage;
}

export async function endBillingCycle(teamId: string, billingDate: Date, dryRun: boolean = false): Promise<BillSubscriptionResult[]> {
  const results: BillSubscriptionResult[] = [];
  const toBeBilled = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.teamId, teamId),
        lt(subscriptions.startDate, billingDate),
        or(
          isNull(subscriptions.lastBilledAt), // Subscription has not been billed yet
          lt(subscriptions.lastBilledAt, billingDate) // Subscription has been billed, but should be billed again
        ),
        or(
          isNull(subscriptions.endDate), // Subscription is still active
          isNull(subscriptions.lastBilledAt), // Subscription has not been billed yet
          gt(subscriptions.endDate, subscriptions.lastBilledAt) // Subscription has been ended, but not fully billed yet
        )
      )
    );

  for (const subscription of toBeBilled) {
    try {
      const result = await billSubscription(subscription, billingDate, dryRun);
      results.push(result);
    } catch (error) {
      console.error(
        `Error ending billing cycle for subscription ${subscription.id}: ${error}`
      );
      sendTelegramNotification(`Error billing subscription ${subscription.id} for team ${subscription.teamId}: ${error}`);
      results.push({
        billingProfileId: "BILLING FAILED: " + error?.toString(),
        teamId: subscription.teamId,
        subscriptionId: subscription.id,
        companyName: "",
        companyStreet: "",
        companyPostalCode: "",
        companyCity: "",
        companyCountry: "",
        companyVatNumber: "",
        subscriptionStartDate: subscription.startDate,
        subscriptionEndDate: subscription.endDate,
        subscriptionLastBilledAt: subscription.lastBilledAt?.toISOString() ?? null,
        planId: subscription.planId,
        includedMonthlyDocuments: subscription.billingConfig.includedMonthlyDocuments,
        basePrice: subscription.billingConfig.basePrice,
        incomingDocumentOveragePrice: subscription.billingConfig.incomingDocumentOveragePrice !== undefined ? subscription.billingConfig.incomingDocumentOveragePrice : subscription.billingConfig.documentOveragePrice,
        outgoingDocumentOveragePrice: subscription.billingConfig.outgoingDocumentOveragePrice !== undefined ? subscription.billingConfig.outgoingDocumentOveragePrice : subscription.billingConfig.documentOveragePrice,
        billingEventId: null,
        invoiceId: null,
        invoiceReference: null,
        totalAmountExcl: 0,
        vatCategory: "S",
        vatPercentage: 0,
        vatExemptionReason: null,
        vatAmount: 0,
        totalAmountIncl: 0,
        billingDate: billingDate,
        billingPeriodStart: "",
        billingPeriodEnd: "",
        usedQty: 0,
        usedQtyIncoming: 0,
        usedQtyOutgoing: 0,
        includedQty: 0,
      });
    }
  }
  return results;
}

async function billSubscription(
  subscription: typeof subscriptions.$inferSelect,
  billingDate: Date,
  dryRun: boolean = false
): Promise<BillSubscriptionResult> {
  // Get billing profile for team
  const billingProfile = await getBillingProfile(subscription.teamId);

  // Check if billing profile mandate is validated
  if (!billingProfile.isMandateValidated) {
    throw new Error(
      "Billing profile mandate is not validated for billing profile " +
      billingProfile.id
    );
  }

  // Get the customer mandate
  if (!billingProfile.mollieCustomerId) {
    throw new Error(
      "Billing profile has no Mollie customer id for billing profile " +
      billingProfile.id
    );
  }
  const mandate = await getMandate(billingProfile.mollieCustomerId);
  if (!mandate) {
    // Update billing profile mandate status
    await db
      .update(billingProfiles)
      .set({
        isMandateValidated: false,
      })
      .where(eq(billingProfiles.id, billingProfile.id));
    throw new Error(
      "Billing profile mandate is not validated according to Mollie for billing profile " +
      billingProfile.id
    );
  }
  const mollieMandateId = mandate.id;

  // Get billing period
  const subscriptionHasEnded =
    subscription.endDate && subscription.endDate < billingDate;
  const billingPeriodStartInclusive = addMilliseconds(
    subscription.lastBilledAt || subscription.startDate,
    1
  );
  const billingPeriodEndInclusive = subscriptionHasEnded
    ? subscription.endDate!
    : billingDate;

  // Validate billing config
  if (!subscription.billingConfig) {
    throw new Error(
      `Billing config is missing for subscription ${subscription.id}`
    );
  }
  if (typeof subscription.billingConfig.basePrice !== "number") {
    throw new Error(
      `Invalid basePrice in billing config for subscription ${subscription.id}`
    );
  }
  if (typeof subscription.billingConfig.includedMonthlyDocuments !== "number") {
    throw new Error(
      `Invalid includedMonthlyDocuments in billing config for subscription ${subscription.id}`
    );
  }
  if (typeof subscription.billingConfig.documentOveragePrice !== "number") {
    throw new Error(
      `Invalid documentOveragePrice in billing config for subscription ${subscription.id}`
    );
  }

  const billingConfigCheck = BillingConfigSchema.safeParse(subscription.billingConfig);
  if (!billingConfigCheck.success) {
    throw new Error(
      `Invalid billing config for subscription ${subscription.id}: ${billingConfigCheck.error.message}`
    );
  }
  const billingConfig = billingConfigCheck.data;

  // If the start is the first day of the month, and the end is the last day of the month, it's a full month
  const isEntireMonth =
    isSameDay(
      billingPeriodStartInclusive,
      startOfMonth(billingPeriodStartInclusive)
    ) &&
    isSameDay(billingPeriodEndInclusive, endOfMonth(billingPeriodEndInclusive));

  // If the billing period has ended, calculate the maximum included usage, otherwise assume full period allowance
  let includedUsage = billingConfig.includedMonthlyDocuments;
  const minutesInPeriod = differenceInMinutes(
    billingPeriodEndInclusive,
    billingPeriodStartInclusive
  );
  const monthlyMinutes = new Decimal(30).times(24).times(60); // 30 days * 24 hours * 60 minutes
  let billingRatio = new Decimal(minutesInPeriod).div(monthlyMinutes);
  if (billingRatio.gt(1) || isEntireMonth) {
    billingRatio = new Decimal(1);
  }
  if (subscriptionHasEnded) {
    includedUsage = Math.ceil(
      new Decimal(billingConfig.includedMonthlyDocuments)
        .times(billingRatio)
        .toNumber()
    );
  }

  // Get usage for the billing period
  const [{ incomingUsage }] = await db
    .select({ incomingUsage: count() })
    .from(transferEvents)
    .where(
      and(
        eq(transferEvents.teamId, subscription.teamId),
        gte(transferEvents.createdAt, billingPeriodStartInclusive),
        lte(transferEvents.createdAt, billingPeriodEndInclusive),
        eq(transferEvents.direction, "incoming")
      )
    );
  const [{ outgoingUsage }] = await db
    .select({ outgoingUsage: count() })
    .from(transferEvents)
    .where(
      and(
        eq(transferEvents.teamId, subscription.teamId),
        gte(transferEvents.createdAt, billingPeriodStartInclusive),
        lte(transferEvents.createdAt, billingPeriodEndInclusive),
        eq(transferEvents.direction, "outgoing")
      )
    );
  const incomingUsageDecimal = new Decimal(incomingUsage);
  const outgoingUsageDecimal = new Decimal(outgoingUsage);
  const usageDecimal = incomingUsageDecimal.plus(outgoingUsageDecimal);

  // Calculate billing amount
  const baseAmount = new Decimal(billingConfig.basePrice).times(billingRatio);

  const incomingDocumentOveragePrice = billingConfig.incomingDocumentOveragePrice !== undefined ? billingConfig.incomingDocumentOveragePrice : billingConfig.documentOveragePrice;
  const outgoingDocumentOveragePrice = billingConfig.outgoingDocumentOveragePrice !== undefined ? billingConfig.outgoingDocumentOveragePrice : billingConfig.documentOveragePrice;

  const amountIncomingExcl = Decimal.max(0, incomingUsageDecimal).times(incomingDocumentOveragePrice);
  const amountOutgoingExcl = Decimal.max(0, outgoingUsageDecimal).times(outgoingDocumentOveragePrice);

  const includedPrice = Decimal.min(incomingDocumentOveragePrice, outgoingDocumentOveragePrice); // For the included documents, the lowest price is used to keep it simple
  const amountIncludedExcl = includedPrice.mul(includedUsage);

  const overageAmountExcl = Decimal.max(0, amountIncomingExcl.plus(amountOutgoingExcl).minus(amountIncludedExcl));
  const totalAmountExcl = baseAmount.plus(overageAmountExcl);

  // Add VAT
  const vat = calculateVat(billingProfile);
  const vatAmount = totalAmountExcl.times(vat.percentage).div(100);
  const totalAmountIncl = totalAmountExcl.plus(vatAmount);

  let invoiceReference: number | null = null;
  let billingEventId: string | null = null;

  // Create billing event
  if (!dryRun) {
    await db.transaction(async (tx) => {
      const [{ id: _billingEventId, invoiceReference: _invoiceReference }] = await tx
        .insert(subscriptionBillingEvents)
        .values({
          teamId: subscription.teamId,
          subscriptionId: subscription.id,
          billingProfileId: billingProfile.id,
          billingDate: billingDate,
          billingPeriodStart: billingPeriodStartInclusive,
          billingPeriodEnd: billingPeriodEndInclusive,
          totalAmountExcl: totalAmountExcl.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          vatCategory: vat.vatCategory,
          vatPercentage: vat.percentage.toFixed(2),
          totalAmountIncl: totalAmountIncl.toFixed(2),
          billingConfig: billingConfig,
          usedQty: usageDecimal.toString(),
          usedQtyIncoming: incomingUsageDecimal.toString(),
          usedQtyOutgoing: outgoingUsageDecimal.toString(),
          includedQty: includedUsage.toString(),
          amountDue: totalAmountIncl.toFixed(2),
          paymentStatus: "none",
          paymentId: null,
          paidAmount: null,
          paymentMethod: null,
          paymentDate: null,
        })
        .returning({ id: subscriptionBillingEvents.id, invoiceReference: subscriptionBillingEvents.invoiceReference });
      billingEventId = _billingEventId;

      if (!billingEventId) {
        throw new Error(
          `Failed to create billing event for subscription ${subscription.id}`
        );
      }

      // Update lastBilledAt date
      await tx
        .update(subscriptions)
        .set({ lastBilledAt: billingDate })
        .where(eq(subscriptions.id, subscription.id));
    });

    if (!billingEventId) {
      throw new Error(
        `Failed to request payment for subscription ${subscription.id} due to missing billing event id`
      );
    }

    // Send payment request to mollie (on webhook, update billing event with payment result, notify admin on failure)
    await requestPayment(
      billingProfile.mollieCustomerId,
      mollieMandateId,
      billingProfile.id,
      billingEventId,
      totalAmountIncl.toFixed(2)
    );
  }

  const info: BillSubscriptionResult = {
    billingProfileId: billingProfile.id,
    teamId: subscription.teamId,
    subscriptionId: subscription.id,
    companyName: billingProfile.companyName,
    companyStreet: billingProfile.address,
    companyPostalCode: billingProfile.postalCode,
    companyCity: billingProfile.city,
    companyCountry: billingProfile.country,
    companyVatNumber: billingProfile.vatNumber,
    subscriptionStartDate: subscription.startDate,
    subscriptionEndDate: subscription.endDate,
    subscriptionLastBilledAt: subscription.lastBilledAt?.toISOString() ?? null,
    planId: subscription.planId,
    includedMonthlyDocuments: billingConfig.includedMonthlyDocuments,
    basePrice: billingConfig.basePrice,
    incomingDocumentOveragePrice,
    outgoingDocumentOveragePrice: billingConfig.outgoingDocumentOveragePrice !== undefined ? billingConfig.outgoingDocumentOveragePrice : billingConfig.documentOveragePrice,
    billingEventId: billingEventId,
    invoiceId: null,
    invoiceReference: invoiceReference,
    totalAmountExcl: totalAmountExcl.toNumber(),
    vatCategory: vat.vatCategory,
    vatPercentage: vat.percentage.toNumber(),
    vatExemptionReason: vat.vatExemptionReason,
    vatAmount: vatAmount.toNumber(),
    totalAmountIncl: totalAmountIncl.toNumber(),
    billingDate: billingDate,
    billingPeriodStart: billingPeriodStartInclusive.toISOString(),
    billingPeriodEnd: billingPeriodEndInclusive.toISOString(),
    usedQty: usageDecimal.toNumber(),
    usedQtyIncoming: incomingUsageDecimal.toNumber(),
    usedQtyOutgoing: outgoingUsageDecimal.toNumber(),
    includedQty: includedUsage,
  };

  // Send invoice to customer
  const invoiceId = await sendInvoiceAsBRBX(info, dryRun);
  info.invoiceId = invoiceId;

  // Update billing event with invoice id and reference
  if(!dryRun) {
    await db
      .update(subscriptionBillingEvents)
      .set({ invoiceId: invoiceId })
      .where(eq(subscriptionBillingEvents.id, billingEventId!));
  }

  return info;
}

function calculateVat(billingProfile: typeof billingProfiles.$inferSelect): { percentage: Decimal, vatCategory: VatCategory, vatExemptionReason: string | null } {
  // Clean the vat number
  let vatNumber = cleanVatNumber(billingProfile.vatNumber);
  if (!vatNumber) {
    return { percentage: new Decimal(21), vatCategory: "S", vatExemptionReason: null }; // 21% VAT (treated as a consumer in Belgium)
  }

  // Get the country code from the vat number, if it's not a valid country code, use the billing profile country
  let countryCode = vatNumber.substring(0, 2);
  if (!COUNTRIES.some(country => country.code === countryCode)) {
    countryCode = billingProfile.country;
    vatNumber = countryCode + vatNumber.substring(2);
  }

  // Get the vat percentage for the country
  switch (countryCode) {
    case "BE":
      return { percentage: new Decimal(21), vatCategory: "S", vatExemptionReason: null }; // 21% VAT
    default:
      return { percentage: new Decimal(0), vatCategory: "AE", vatExemptionReason: "Reverse charge mechanism - Article 196 of VAT Directive 2006/112/EC" }; // VAT Reverse Charge
  }

}

async function sendInvoiceAsBRBX(info: BillSubscriptionResult, dryRun: boolean = false) {
  const companyId = dryRun 
    ? process.env.BRBX_BILLING_DRY_RUN_COMPANY_ID 
    : process.env.BRBX_BILLING_LIVE_COMPANY_ID;
  const jwt = dryRun 
    ? process.env.BRBX_BILLING_DRY_RUN_JWT 
    : process.env.BRBX_BILLING_LIVE_JWT;

  if (!companyId) {
    throw new Error(`BRBX_BILLING_${dryRun ? "DRY_RUN" : "LIVE"}_COMPANY_ID environment variable is not set`);
  }
  if (!jwt) {
    throw new Error(`BRBX_BILLING_${dryRun ? "DRY_RUN" : "LIVE"}_JWT environment variable is not set`);
  }

  let recipient: string;
  if (info.companyVatNumber) {
    const cleanedVat = cleanVatNumber(info.companyVatNumber);
    if (!cleanedVat) {
      throw new Error("Cannot send invoice: company VAT number is invalid");
    }
    // TODO: Handle non-BE VAT numbers
    const vatWithoutCountryCode = cleanedVat.substring(2);
    recipient = `0208:${vatWithoutCountryCode}`;
  } else {
    throw new Error("Cannot send invoice: company VAT number is missing");
  }

  const invoice = {
    invoiceNumber: info.invoiceReference ? info.invoiceReference.toString() : "no-number",
    buyer: {
      name: info.companyName,
      street: info.companyStreet,
      city: info.companyCity,
      postalZone: info.companyPostalCode,
      country: info.companyCountry,
      vatNumber: info.companyVatNumber,
    },
    lines: [
      {
        name: "Subscription",
        netPriceAmount: info.totalAmountExcl.toFixed(2),
        vat: {
          category: info.vatCategory,
          percentage: info.vatPercentage.toFixed(2),
          exemptionReason: info.vatExemptionReason ? info.vatExemptionReason : null,
        },
      },
    ],
  };

  const response = await fetch(`https://app.recommand.eu/api/v1/${companyId}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      documentType: "invoice",
      recipient,
      document: invoice,
      email: dryRun ? undefined : {
        to: [],
        when: "always",
        subject: "Recommand invoice " + invoice.invoiceNumber,
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send invoice via BRBX API: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const responseJson = await response.json();
  return responseJson.invoiceId;
}