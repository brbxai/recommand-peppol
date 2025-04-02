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

export async function endBillingCycle(teamId: string, billingDate: Date) {
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
      await billSubscription(subscription, billingDate);
    } catch (error) {
      console.error(
        `Error ending billing cycle for subscription ${subscription.id}: ${error}`
      );
      // TODO: notify admin!
    }
  }
}

async function billSubscription(
  subscription: typeof subscriptions.$inferSelect,
  billingDate: Date
) {
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
  if (typeof subscription.billingConfig.vatRate !== "number") {
    throw new Error(
      `Invalid vatRate in billing config for subscription ${subscription.id}`
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

  // If the start is the first day of the month, and the end is the last day of the month, it's a full month
  const isEntireMonth =
    isSameDay(
      billingPeriodStartInclusive,
      startOfMonth(billingPeriodStartInclusive)
    ) &&
    isSameDay(billingPeriodEndInclusive, endOfMonth(billingPeriodEndInclusive));

  // If the billing period has ended, calculate the maximum included usage, otherwise assume full period allowance
  let includedUsage = subscription.billingConfig.includedMonthlyDocuments;
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
      new Decimal(subscription.billingConfig.includedMonthlyDocuments)
        .times(billingRatio)
        .toNumber()
    );
  }

  // Get usage for the billing period
  const [{ usage }] = await db
    .select({ usage: count() })
    .from(transferEvents)
    .where(
      and(
        eq(transferEvents.teamId, subscription.teamId),
        gte(transferEvents.createdAt, billingPeriodStartInclusive),
        lte(transferEvents.createdAt, billingPeriodEndInclusive)
      )
    );

  // Calculate billing amount
  const baseAmount = new Decimal(subscription.billingConfig.basePrice).times(
    billingRatio
  );
  const overageQty = Math.max(
    0,
    new Decimal(usage).minus(includedUsage).toNumber()
  );
  const overageAmount = new Decimal(
    subscription.billingConfig.documentOveragePrice
  ).times(overageQty);
  const totalAmountExcl = baseAmount.plus(overageAmount);

  // Add VAT
  const vatAmount = totalAmountExcl.times(subscription.billingConfig.vatRate);
  const totalAmountIncl = totalAmountExcl.plus(vatAmount);

  // Create billing event
  let billingEventId: string | null = null;
  await db.transaction(async (tx) => {
    const [{ id: _billingEventId }] = await tx
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
        totalAmountIncl: totalAmountIncl.toFixed(2),
        billingConfig: subscription.billingConfig,
        usedQty: usage.toString(),
        includedQty: includedUsage.toString(),
        overageQty: overageQty.toString(),
        amountDue: totalAmountIncl.toFixed(2),
        paymentStatus: "none",
        paymentId: null,
        paidAmount: null,
        paymentMethod: null,
        paymentDate: null,
      })
      .returning({ id: subscriptionBillingEvents.id });
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

  // TODO: send invoice to customer
}
