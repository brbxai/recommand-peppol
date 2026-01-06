import {
  billingProfiles,
  companies,
  subscriptionBillingEventLines,
  subscriptionBillingEvents,
  subscriptions,
  transferEvents,
} from "@peppol/db/schema";
import { db } from "@recommand/db";
import { and, eq, isNull, lt, or, gt, count, gte, lte, desc, inArray } from "drizzle-orm";
import {
  differenceInMinutes,
  isSameDay,
  startOfMonth,
  addMilliseconds,
  endOfMonth,
  formatISO,
} from "date-fns";
import Decimal from "decimal.js";
import { getBillingProfile } from "./billing-profile";
import { getMandate, requestPayment } from "./mollie";
import { sendTelegramNotification } from "@peppol/utils/system-notifications/telegram";
import { BillingConfigSchema, type BillingConfig } from "./plans";
import { cleanVatNumber } from "@peppol/utils/util";
import { COUNTRIES } from "@peppol/utils/countries";
import type { VatCategory } from "@peppol/utils/parsing/invoice/schemas";
import { getMinimalTeamMembers } from "@core/data/team-members";
import { TZDate } from "@date-fns/tz";
import type { Mandate } from "@mollie/api-client";

export type SubscriptionBillingLine = {
  subscriptionId: string;
  billingConfig: BillingConfig;
  subscriptionStartDate: Date;
  subscriptionEndDate: Date | null;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  subscriptionLastBilledAt: string | null;
  planId: string | null;
  includedMonthlyDocuments: number;
  basePrice: number;
  incomingDocumentOveragePrice: number;
  outgoingDocumentOveragePrice: number;

  lineName: string;
  lineDescription: string;
  lineTotalExcl: number;
  usedQty: number;
  usedQtyIncoming: number;
  usedQtyOutgoing: number;
  overageQtyIncoming: number;
  overageQtyOutgoing: number;
}

export type TeamBillingResult = {
  status: "success" | "error";
  message: string;
  billingProfileId: string;
  isManuallyBilled: boolean;
  teamId: string;
  subscriptionId: string;
  companyName: string;
  companyStreet: string;
  companyPostalCode: string;
  companyCity: string;
  companyCountry: string;
  companyVatNumber: string | null;
  subscriptionStartDate: string;
  subscriptionEndDate: string | null;
  subscriptionLastBilledAt: string | null;
  planId: string | null;
  includedMonthlyDocuments: number;
  basePrice: number;
  incomingDocumentOveragePrice: number;
  outgoingDocumentOveragePrice: number;
  billingEventId: string | null;
  invoiceId: string | null;
  invoiceReference: number | null;
  lineTotalExcl: number;
  totalAmountExcl: number | null;
  vatCategory: VatCategory;
  vatPercentage: number;
  vatExemptionReason: string | null;
  vatAmount: number | null;
  totalAmountIncl: number | null;
  billingDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string | null;
  usedQty: number;
  usedQtyIncoming: number;
  usedQtyOutgoing: number;
  overageQtyIncoming: number;
  overageQtyOutgoing: number;
}

export async function getCurrentUsage(teamId: string) {
  const s = startOfMonth(TZDate.tz("UTC"));
  const e = endOfMonth(TZDate.tz("UTC"));
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

export async function getBillingEvents(teamId: string) {
  const events = await db
    .select()
    .from(subscriptionBillingEvents)
    .where(eq(subscriptionBillingEvents.teamId, teamId))
    .orderBy(desc(subscriptionBillingEvents.billingDate));
  return events;
}

export async function endBillingCycle(billingDate: Date, dryRun: boolean = false, teamId?: string): Promise<TeamBillingResult[]> {
  const toBeBilled = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        teamId ? eq(subscriptions.teamId, teamId) : undefined,
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
    )
    .orderBy(subscriptions.teamId, subscriptions.startDate);

  const groupedByTeam = toBeBilled.reduce((acc, subscription) => {
    acc[subscription.teamId] = [...(acc[subscription.teamId] || []), subscription];
    return acc;
  }, {} as Record<string, typeof subscriptions.$inferSelect[]>);

  const results: TeamBillingResult[] = [];
  for (const teamId in groupedByTeam) {
    try {
      const result = await billTeam({
        teamId: teamId,
        toBeBilledSubscriptions: groupedByTeam[teamId],
        billingDate: billingDate,
        dryRun: dryRun,
      });
      results.push(...result);
    } catch (error) {
      console.error(
        `Error ending billing cycle for team ${teamId}: ${error}`
      );
      sendTelegramNotification(`Error billing team ${teamId}: ${error}`);
      results.push({
        status: "error",
        message: error?.toString() ?? "Unknown error",
        billingProfileId: "",
        isManuallyBilled: false,
        teamId: teamId,
        subscriptionId: "",
        companyName: "",
        companyStreet: "",
        companyPostalCode: "",
        companyCity: "",
        companyCountry: "",
        companyVatNumber: "",
        subscriptionStartDate: "",
        subscriptionEndDate: null,
        subscriptionLastBilledAt: null,
        planId: null,
        includedMonthlyDocuments: 0,
        basePrice: 0,
        incomingDocumentOveragePrice: 0,
        outgoingDocumentOveragePrice: 0,
        billingEventId: null,
        invoiceId: null,
        invoiceReference: null,
        lineTotalExcl: 0,
        totalAmountExcl: 0,
        vatCategory: "S",
        vatPercentage: 0,
        vatExemptionReason: null,
        vatAmount: 0,
        totalAmountIncl: 0,
        billingDate: billingDate.toISOString(),
        billingPeriodStart: "",
        billingPeriodEnd: null,
        usedQty: 0,
        usedQtyIncoming: 0,
        usedQtyOutgoing: 0,
        overageQtyIncoming: 0,
        overageQtyOutgoing: 0,
      });
    }
  }
  return results;
}

async function billTeam({
  teamId,
  toBeBilledSubscriptions,
  billingDate,
  dryRun = false,
}: {
  teamId: string;
  toBeBilledSubscriptions: typeof subscriptions.$inferSelect[];
  billingDate: Date;
  dryRun?: boolean;
}): Promise<TeamBillingResult[]> {

  // Get billing profile for team
  const billingProfile = await getBillingProfile(teamId);

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
  let mandate: Mandate | null = null;
  try {
    mandate = await getMandate(billingProfile.mollieCustomerId);
  } catch (error) {
    console.error(`Error getting mandate for billing profile ${billingProfile.id}: ${error}`);
    throw new Error(`Error getting mandate for billing profile ${billingProfile.id}: ${error}`);
  }
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

  // Bill each subscription
  const billingLine: SubscriptionBillingLine[] = [];
  for (const subscription of toBeBilledSubscriptions) {
    billingLine.push(await calculateSubscription({
      subscription,
      billingDate,
    }));
  }

  // Determine VAT strategy
  const vatStrategy = determineVatStrategy(billingProfile);

  // Calculate totals
  const totalAmountExcl = billingLine.reduce((acc, curr) => acc.plus(curr.lineTotalExcl), new Decimal(0)).toNearest(0.01);
  const totalVatAmount = totalAmountExcl.times(vatStrategy.percentage).div(100).toNearest(0.01);
  const totalAmountIncl = totalAmountExcl.plus(totalVatAmount).toNearest(0.01);

  // Determine billing period
  let billingPeriodStart: Date | null = null;
  let billingPeriodEnd: Date | null = null;
  for (const result of billingLine) {
    if (!billingPeriodStart || result.billingPeriodStart < billingPeriodStart) {
      billingPeriodStart = result.billingPeriodStart;
    }
    if (!billingPeriodEnd || result.billingPeriodEnd && billingPeriodEnd && result.billingPeriodEnd > billingPeriodEnd) {
      billingPeriodEnd = result.billingPeriodEnd;
    }
  }

  if(!billingPeriodStart) {
    throw new Error(
      `Billing period start is not set for team ${teamId}`
    );
  }

  if (!billingPeriodEnd) {
    billingPeriodEnd = billingDate;
  }

  let usedQty = new Decimal(0);
  let usedQtyIncoming = new Decimal(0);
  let usedQtyOutgoing = new Decimal(0);
  let overageQtyIncoming = new Decimal(0);
  let overageQtyOutgoing = new Decimal(0);
  for (const result of billingLine) {
    usedQty = usedQty.plus(result.usedQty);
    usedQtyIncoming = usedQtyIncoming.plus(result.usedQtyIncoming);
    usedQtyOutgoing = usedQtyOutgoing.plus(result.usedQtyOutgoing);
    overageQtyIncoming = overageQtyIncoming.plus(result.overageQtyIncoming);
    overageQtyOutgoing = overageQtyOutgoing.plus(result.overageQtyOutgoing);
  }

  // Create billing event for team
  let invoiceReference: number | null = null;
  let billingEventId: string | null = null;

  // Create billing event
  if (!dryRun) {
    await db.transaction(async (tx) => {
      if (!billingProfile.isManuallyBilled) {
        const [{ id: _billingEventId, invoiceReference: _invoiceReference }] = await tx
          .insert(subscriptionBillingEvents)
          .values({
            teamId,
            billingProfileId: billingProfile.id,
            billingDate: billingDate,
            billingPeriodStart,
            billingPeriodEnd,
            totalAmountExcl: totalAmountExcl.toFixed(2),
            vatAmount: totalVatAmount.toFixed(2),
            vatCategory: vatStrategy.vatCategory,
            vatPercentage: vatStrategy.percentage.toFixed(2),
            totalAmountIncl: totalAmountIncl.toFixed(2),
            usedQty: usedQty.toFixed(2),
            usedQtyIncoming: usedQtyIncoming.toFixed(2),
            usedQtyOutgoing: usedQtyOutgoing.toFixed(2),
            overageQtyIncoming: overageQtyIncoming.toFixed(2),
            overageQtyOutgoing: overageQtyOutgoing.toFixed(2),
            amountDue: totalAmountIncl.toFixed(2),
            paymentStatus: totalAmountIncl.gt(0) ? "none" : "paid",
            paymentId: null,
            paidAmount: totalAmountIncl.gt(0) ? null : new Decimal(0).toFixed(2),
            paymentMethod: totalAmountIncl.gt(0) ? null : "auto-reconcile",
            paymentDate: totalAmountIncl.gt(0) ? null : new Date(),
          })
          .returning({ id: subscriptionBillingEvents.id, invoiceReference: subscriptionBillingEvents.invoiceReference });
        billingEventId = _billingEventId;

        if (!billingEventId) {
          throw new Error(
            `Failed to create billing event for team ${teamId}`
          );
        }

        // Create billing event lines
        for (const result of billingLine) {
          await tx
            .insert(subscriptionBillingEventLines)
            .values({
              subscriptionBillingEventId: billingEventId!,
              subscriptionId: result.subscriptionId,
              billingConfig: result.billingConfig,
              subscriptionStartDate: result.subscriptionStartDate,
              subscriptionEndDate: result.subscriptionEndDate ?? billingPeriodEnd,
              subscriptionLastBilledAt: result.subscriptionLastBilledAt ? new Date(result.subscriptionLastBilledAt) : billingPeriodStart,
              planId: result.planId,
              includedMonthlyDocuments: result.includedMonthlyDocuments.toFixed(2),
              basePrice: result.basePrice.toFixed(2),
              incomingDocumentOveragePrice: result.incomingDocumentOveragePrice.toFixed(2),
              outgoingDocumentOveragePrice: result.outgoingDocumentOveragePrice.toFixed(2),
              usedQty: result.usedQty.toFixed(2),
              usedQtyIncoming: result.usedQtyIncoming.toFixed(2),
              usedQtyOutgoing: result.usedQtyOutgoing.toFixed(2),
              overageQtyIncoming: result.overageQtyIncoming.toFixed(2),
              overageQtyOutgoing: result.overageQtyOutgoing.toFixed(2),
              name: result.lineName,
              description: result.lineDescription,
              totalAmountExcl: result.lineTotalExcl.toFixed(2),
            });
        }
      }

      // Update lastBilledAt date
      await tx
        .update(subscriptions)
        .set({ lastBilledAt: billingDate })
        .where(inArray(subscriptions.id, toBeBilledSubscriptions.map(subscription => subscription.id)));
    });

    if (!billingProfile.isManuallyBilled) {
      if (!billingEventId) {
        throw new Error(
          `Failed to request payment for team ${teamId} due to missing billing event id`
        );
      }

      // Send payment request to mollie (on webhook, update billing event with payment result, notify admin on failure)
      await requestPayment(
        billingProfile.mollieCustomerId!,
        mandate.id,
        billingProfile.id,
        billingEventId,
        totalAmountIncl.toFixed(2)
      );
    }
  }

  // Create invoice for team
  let invoiceId: string | null = null;
  if (!billingProfile.isManuallyBilled) {
    invoiceId = await sendInvoiceAsBRBX({
      teamId: teamId,
      companyName: billingProfile.companyName,
      companyStreet: billingProfile.address,
      companyPostalCode: billingProfile.postalCode,
      companyCity: billingProfile.city,
      companyCountry: billingProfile.country,
      companyVatNumber: billingProfile.vatNumber ?? null,
      invoiceReference: invoiceReference,
      totalAmountExcl: totalAmountExcl.toNumber(),
      totalVatAmount: totalVatAmount.toNumber(),
      vatCategory: vatStrategy.vatCategory,
      vatPercentage: vatStrategy.percentage.toNumber(),
      vatExemptionReason: vatStrategy.vatExemptionReason,
      totalAmountIncl: totalAmountIncl.toNumber(),
      lines: billingLine.map(x => ({
        planId: x.planId ?? null,
        name: x.lineName,
        description: x.lineDescription,
        netPriceAmount: x.lineTotalExcl.toFixed(2),
        netAmount: x.lineTotalExcl.toFixed(2),
        vat: {
          category: vatStrategy.vatCategory,
          percentage: vatStrategy.percentage.toFixed(2),
        },
      })),
    }, billingProfile, dryRun);

    // Update billing event with invoice id and reference
    if (!dryRun) {
      if(!invoiceId) {
        throw new Error(
          `Failed to finalize billing for team ${teamId} due to missing invoice id`
        );
      }
      console.log("Updating billing event with invoice id", invoiceId, "for billing event", billingEventId);
      await db
        .update(subscriptionBillingEvents)
        .set({ invoiceId: invoiceId })
        .where(eq(subscriptionBillingEvents.id, billingEventId!));
    }
  }

  return billingLine.map((x, i) => ({
    status: "success",
    message: "",
    billingProfileId: billingProfile.id,
    isManuallyBilled: billingProfile.isManuallyBilled,
    teamId: teamId,
    subscriptionId: x.subscriptionId,
    companyName: billingProfile.companyName,
    companyStreet: billingProfile.address,
    companyPostalCode: billingProfile.postalCode,
    companyCity: billingProfile.city,
    companyCountry: billingProfile.country,
    companyVatNumber: billingProfile.vatNumber,
    subscriptionStartDate: x.subscriptionStartDate.toISOString(),
    subscriptionEndDate: x.subscriptionEndDate?.toISOString() ?? null,
    subscriptionLastBilledAt: x.subscriptionLastBilledAt,
    planId: x.planId,
    includedMonthlyDocuments: x.includedMonthlyDocuments,
    basePrice: x.basePrice,
    incomingDocumentOveragePrice: x.incomingDocumentOveragePrice,
    outgoingDocumentOveragePrice: x.outgoingDocumentOveragePrice,
    billingEventId: billingEventId,
    invoiceId: invoiceId,
    invoiceReference: invoiceReference,
    lineTotalExcl: x.lineTotalExcl,
    totalAmountExcl: i === 0 ? totalAmountExcl.toNumber() : null,
    vatCategory: vatStrategy.vatCategory,
    vatPercentage: vatStrategy.percentage.toNumber(),
    vatExemptionReason: vatStrategy.vatExemptionReason,
    vatAmount: i === 0 ? totalVatAmount.toNumber() : null,
    totalAmountIncl: i === 0 ? totalAmountIncl.toNumber() : null,
    billingDate: billingDate.toISOString(),
    billingPeriodStart: x.billingPeriodStart.toISOString(),
    billingPeriodEnd: x.billingPeriodEnd.toISOString(),
    usedQty: x.usedQty,
    usedQtyIncoming: x.usedQtyIncoming,
    usedQtyOutgoing: x.usedQtyOutgoing,
    overageQtyIncoming: x.overageQtyIncoming,
    overageQtyOutgoing: x.overageQtyOutgoing,
  }));
}

async function calculateSubscription({
  subscription,
  billingDate,
}: {
  subscription: typeof subscriptions.$inferSelect;
  billingDate: Date;
}): Promise<SubscriptionBillingLine> {

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

  if(billingPeriodStartInclusive > billingPeriodEndInclusive) {
    throw new Error(
      `Billing period start is after billing period end for subscription ${subscription.id}`
    );
  }

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
  const monthlyMinutes = new Decimal(31).times(24).times(60); // 31 days * 24 hours * 60 minutes
  let billingRatio = new Decimal(minutesInPeriod).div(monthlyMinutes);
  if (isEntireMonth) {
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
  const incomingUsageByCompany = await db
    .select({ companyId: companies.id, companyName: companies.name, incomingUsage: count() })
    .from(transferEvents)
    .leftJoin(companies, eq(transferEvents.companyId, companies.id))
    .where(
      and(
        eq(transferEvents.teamId, subscription.teamId),
        gte(transferEvents.createdAt, billingPeriodStartInclusive),
        lte(transferEvents.createdAt, billingPeriodEndInclusive),
        eq(transferEvents.direction, "incoming")
      )
    )
    .groupBy(companies.id);
  const outgoingUsageByCompany = await db
    .select({ companyId: companies.id, companyName: companies.name, outgoingUsage: count() })
    .from(transferEvents)
    .leftJoin(companies, eq(transferEvents.companyId, companies.id))
    .where(
      and(
        eq(transferEvents.teamId, subscription.teamId),
        gte(transferEvents.createdAt, billingPeriodStartInclusive),
        lte(transferEvents.createdAt, billingPeriodEndInclusive),
        eq(transferEvents.direction, "outgoing")
      )
    )
    .groupBy(companies.id);

  let incomingUsageDecimal = new Decimal(0);
  let outgoingUsageDecimal = new Decimal(0);
  const perCompanyUsage: Record<string, { companyName: string, incomingUsage: Decimal, outgoingUsage: Decimal }> = {};
  for (const company of incomingUsageByCompany) {
    if (!perCompanyUsage[company.companyId ?? "unknown"]) {
      perCompanyUsage[company.companyId ?? "unknown"] = { companyName: company.companyName ?? "Deleted companies", incomingUsage: new Decimal(0), outgoingUsage: new Decimal(0) };
    }
    perCompanyUsage[company.companyId ?? "unknown"].incomingUsage = perCompanyUsage[company.companyId ?? "unknown"].incomingUsage.plus(company.incomingUsage);
    incomingUsageDecimal = incomingUsageDecimal.plus(company.incomingUsage);
  }
  for (const company of outgoingUsageByCompany) {
    if (!perCompanyUsage[company.companyId ?? "unknown"]) {
      perCompanyUsage[company.companyId ?? "unknown"] = { companyName: company.companyName ?? "Deleted companies", incomingUsage: new Decimal(0), outgoingUsage: new Decimal(0) };
    }
    perCompanyUsage[company.companyId ?? "unknown"].outgoingUsage = perCompanyUsage[company.companyId ?? "unknown"].outgoingUsage.plus(company.outgoingUsage);
    outgoingUsageDecimal = outgoingUsageDecimal.plus(company.outgoingUsage);
  }

  const usageDecimal = incomingUsageDecimal.plus(outgoingUsageDecimal);

  // Calculate billing amount
  const baseAmount = new Decimal(billingConfig.basePrice).times(billingRatio);

  const incomingDocumentOveragePrice = billingConfig.incomingDocumentOveragePrice !== undefined ? billingConfig.incomingDocumentOveragePrice : billingConfig.documentOveragePrice;
  const outgoingDocumentOveragePrice = billingConfig.outgoingDocumentOveragePrice !== undefined ? billingConfig.outgoingDocumentOveragePrice : billingConfig.documentOveragePrice;

  // We have to determine how many documents have to be billed for the overage
  let toBeBilledIncoming: Decimal = incomingUsageDecimal;
  let toBeBilledOutgoing: Decimal = outgoingUsageDecimal;
  // First subtract from the incoming documents
  let remainingIncludedUsage = new Decimal(includedUsage);
  if (incomingUsageDecimal.gt(remainingIncludedUsage)) {
    toBeBilledIncoming = incomingUsageDecimal.minus(remainingIncludedUsage);
    remainingIncludedUsage = new Decimal(0);
  } else {
    toBeBilledIncoming = new Decimal(0);
    remainingIncludedUsage = remainingIncludedUsage.minus(incomingUsageDecimal);
  }
  // Then subtract from the outgoing documents
  if (outgoingUsageDecimal.gt(remainingIncludedUsage)) {
    toBeBilledOutgoing = outgoingUsageDecimal.minus(remainingIncludedUsage);
    remainingIncludedUsage = new Decimal(0);
  } else {
    toBeBilledOutgoing = new Decimal(0);
    remainingIncludedUsage = remainingIncludedUsage.minus(outgoingUsageDecimal);
  }

  const overageAmountExcl = toBeBilledIncoming.times(incomingDocumentOveragePrice).plus(toBeBilledOutgoing.times(outgoingDocumentOveragePrice));
  const totalAmountExcl = baseAmount.plus(overageAmountExcl).toNearest(0.01);

  // Generate description for invoice line
  let lineDescription = `${formatISO(billingPeriodStartInclusive, { representation: "date" })} - ${formatISO(billingPeriodEndInclusive, { representation: "date" })}\n`;
  lineDescription += `Incoming: ${incomingUsageDecimal.toString()} documents\n`;
  lineDescription += `Outgoing: ${outgoingUsageDecimal.toString()} documents\n`;
  lineDescription += `Included in subscription: ${includedUsage} documents\n`;
  lineDescription += `Base price: € ${baseAmount.toNearest(0.01).toString()}\n`;
  lineDescription += `Overage: ${overageAmountExcl.toString()} documents\n`;
  lineDescription += `Overage price per document: € ${incomingDocumentOveragePrice.toString()} in, € ${outgoingDocumentOveragePrice.toString()} out\n`;
  lineDescription += `\n`;
  lineDescription += `Per company usage:\n`;
  // Add document usage per company
  for (const companyId in perCompanyUsage) {
    const company = perCompanyUsage[companyId];
    lineDescription += `- ${company.companyName}: ${company.incomingUsage.toString()} in, ${company.outgoingUsage.toString()} out\n`;
  }

  return {
    subscriptionId: subscription.id,
    billingConfig: subscription.billingConfig,
    subscriptionStartDate: subscription.startDate,
    subscriptionEndDate: subscription.endDate,
    billingPeriodStart: billingPeriodStartInclusive,
    billingPeriodEnd: billingPeriodEndInclusive,
    subscriptionLastBilledAt: subscription.lastBilledAt?.toISOString() ?? null,
    planId: subscription.planId,
    includedMonthlyDocuments: billingConfig.includedMonthlyDocuments,
    basePrice: billingConfig.basePrice,
    incomingDocumentOveragePrice,
    outgoingDocumentOveragePrice,

    // Invoice line
    lineName: billingConfig.name,
    lineDescription: lineDescription,
    lineTotalExcl: totalAmountExcl.toNumber(),
    usedQty: usageDecimal.toNumber(),
    usedQtyIncoming: incomingUsageDecimal.toNumber(),
    usedQtyOutgoing: outgoingUsageDecimal.toNumber(),
    overageQtyIncoming: toBeBilledIncoming.toNumber(),
    overageQtyOutgoing: toBeBilledOutgoing.toNumber(),
  };
}

function determineVatStrategy(billingProfile: typeof billingProfiles.$inferSelect): { percentage: Decimal, vatCategory: VatCategory, vatExemptionReason: string | null } {
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

async function sendInvoiceAsBRBX(
  info: {
    teamId: string;
    companyName: string;
    companyStreet: string;
    companyPostalCode: string;
    companyCity: string;
    companyCountry: string;
    companyVatNumber: string | null;
    invoiceReference: number | null;
    totalAmountExcl: number;
    totalVatAmount: number;
    vatCategory: VatCategory;
    vatPercentage: number;
    vatExemptionReason: string | null;
    totalAmountIncl: number;
    lines: {
      planId: string | null;
      name: string;
      description: string;
      netPriceAmount: string;
      netAmount: string;
      vat: {
        category: VatCategory;
        percentage: string;
      };
    }[];
  },
  billingProfile: typeof billingProfiles.$inferSelect,
  dryRun: boolean = false
): Promise<string> {
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
  if (billingProfile.billingPeppolAddress) {
    recipient = billingProfile.billingPeppolAddress.trim();
  } else if (info.companyVatNumber) {
    const cleanedVat = cleanVatNumber(info.companyVatNumber);
    if (!cleanedVat) {
      throw new Error("Cannot send invoice: company VAT number is invalid");
    }
    if (cleanedVat.startsWith("BE")) {
      const vatWithoutCountryCode = cleanedVat.substring(2);
      recipient = `0208:${vatWithoutCountryCode}`;
    } else {
      recipient = "0000:0000";
    }
  } else {
    throw new Error("Cannot send invoice: company VAT number is missing and billing Peppol address is not set");
  }

  let emailRecipients: string[] = [];
  if (billingProfile.billingEmail) {
    emailRecipients = [billingProfile.billingEmail];
  } else {
    const teamMembers = await getMinimalTeamMembers(info.teamId);
    emailRecipients = teamMembers.map(member => member.user.email);
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
    lines: info.lines.map(line => ({
      sellersId: line.planId ?? null,
      name: line.name,
      description: line.description,
      netPriceAmount: line.netPriceAmount,
      netAmount: line.netAmount,
      vat: {
        category: line.vat.category,
        percentage: line.vat.percentage,
      },
    })),
    totals: {
      taxExclusiveAmount: info.totalAmountExcl,
      taxInclusiveAmount: info.totalAmountIncl,
      linesAmount: info.totalAmountExcl,
      payableAmount: info.totalAmountIncl,
    },
    vat: {
      totalVatAmount: info.totalVatAmount,
      subtotals: [{
        taxableAmount: info.totalAmountExcl,
        vatAmount: info.totalVatAmount,
        category: info.vatCategory,
        percentage: info.vatPercentage,
        exemptionReason: info.vatExemptionReason,
      }],
    }
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
        to: emailRecipients,
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
  return responseJson.id;
}