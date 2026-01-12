import createMollieClient, { SequenceType } from "@mollie/api-client";
import { db } from "@recommand/db";
import { billingProfiles, subscriptionBillingEvents } from "@peppol/db/schema";
import { eq, and, not } from "drizzle-orm";
import Decimal from "decimal.js";
import { sendTelegramNotification } from "@peppol/utils/system-notifications/telegram";

if (!process.env.MOLLIE_API_KEY) {
  throw new Error("MOLLIE_API_KEY is not set");
}
if (!process.env.BASE_URL) {
  throw new Error("BASE_URL is not set");
}

const mollie = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY as string,
});

export async function createMollieCustomer(
  name: string,
  teamId: string,
  billingProfileId: string
) {
  const customer = await mollie.customers.create({
    name: name,
    metadata: {
      teamId: teamId,
      billingProfileId: billingProfileId,
    },
  });

  return customer;
}

export async function createFirstPayment(
  mollieCustomerId: string,
  billingProfileId: string
) {
  const payment = await mollie.payments.create({
    amount: {
      currency: "EUR",
      value: "0.02",
    },
    customerId: mollieCustomerId,
    sequenceType: SequenceType.first,
    description: "To complete your registration, we need to securely verify your payment method.",
    redirectUrl: `${process.env.BASE_URL}/`,
    webhookUrl: `${process.env.BASE_URL}/api/peppol/mollie/mandate-webhook`,
    metadata: {
      billingProfileId: billingProfileId,
    },
  });

  return payment;
}

export async function processFirstPayment(paymentId: string) {
  const payment = await mollie.payments.get(paymentId);
  console.log("Payment", payment);

  if (payment.status === "paid") {
    const { profileStanding } = await db
      .select({ profileStanding: billingProfiles.profileStanding })
      .from(billingProfiles)
      .where(
        eq(billingProfiles.id, (payment.metadata as any).billingProfileId)
      )
      .limit(1)
      .then(result => result[0]);

    await db
      .update(billingProfiles)
      .set({
        firstPaymentId: paymentId,
        firstPaymentStatus: payment.status,
        isMandateValidated: true,
        profileStanding: profileStanding === "suspended" ? "suspended" : "active", // If the profile is suspended, keep it suspended
        graceStartedAt: null,
        graceReason: null,
      })
      .where(
        eq(billingProfiles.id, (payment.metadata as any).billingProfileId)
      );
  } else {
    const { graceStartedAt, graceReason, profileStanding } = await db
      .select({ graceStartedAt: billingProfiles.graceStartedAt, graceReason: billingProfiles.graceReason, profileStanding: billingProfiles.profileStanding })
      .from(billingProfiles)
      .where(
        eq(billingProfiles.id, (payment.metadata as any).billingProfileId),
      )
      .limit(1)
      .then(result => result[0]);


    const isGracePeriodTrigger = ["canceled", "expired", "failed"].includes(payment.status);
    await db
      .update(billingProfiles)
      .set({
        firstPaymentId: paymentId,
        firstPaymentStatus: payment.status,
        isMandateValidated: false,
        ...(isGracePeriodTrigger ? {
          profileStanding: "grace",
          graceStartedAt: (graceStartedAt ?? new Date()),
          graceReason: graceReason ? graceReason : "payment_" + payment.status,
        } : {}),
      })
      .where(
        and(
          eq(billingProfiles.id, (payment.metadata as any).billingProfileId),
          eq(billingProfiles.isMandateValidated, false), // Only update if the mandate is not validated, so we don't reset a validated mandate
          not(eq(billingProfiles.profileStanding, "suspended")) // Only update if the profile is not suspended
        )
      );
  }
}

export async function getMandate(mollieCustomerId: string) {
  const mandates = mollie.customerMandates.iterate({
    customerId: mollieCustomerId,
  });

  for await (const mandate of mandates) {
    if (mandate.status === "valid") {
      return mandate;
    }
  }

  return null;
}

export async function requestPayment(
  mollieCustomerId: string,
  mollieMandateId: string,
  billingProfileId: string,
  billingEventId: string,
  amountDue: string
) {
  const payment = await mollie.payments.create({
    amount: {
      currency: "EUR",
      value: amountDue,
    },
    customerId: mollieCustomerId,
    mandateId: mollieMandateId,
    sequenceType: SequenceType.recurring,
    description: `Recommand Peppol - ${billingEventId}`,
    webhookUrl: `${process.env.BASE_URL}/api/peppol/mollie/payment-webhook`,
    metadata: {
      billingProfileId: billingProfileId,
      billingEventId: billingEventId,
    },
  });

  return payment;
}

export async function processPayment(paymentId: string) {
  const payment = await mollie.payments.get(paymentId);
  console.log("Payment", payment);

  // Get billing profile id from the subscription billing event
  const billingProfileId = await db
    .select({ billingProfileId: subscriptionBillingEvents.billingProfileId })
    .from(subscriptionBillingEvents)
    .where(eq(subscriptionBillingEvents.id, (payment.metadata as any).billingEventId))
    .limit(1)
    .then(result => result[0].billingProfileId);

  if (payment.status === "paid") {
    await db.transaction(async (tx) => {
      const [{ amountDue, previouslyPaidAmount }] = await tx
        .select({
          amountDue: subscriptionBillingEvents.amountDue,
          previouslyPaidAmount: subscriptionBillingEvents.paidAmount,
        })
        .from(subscriptionBillingEvents)
        .where(
          eq(
            subscriptionBillingEvents.id,
            (payment.metadata as any).billingEventId
          )
        );

      await tx
        .update(subscriptionBillingEvents)
        .set({
          amountDue: new Decimal(amountDue)
            .minus(payment.amount.value)
            .toFixed(2),
          paymentStatus: payment.status,
          paymentId: paymentId,
          paidAmount: new Decimal(previouslyPaidAmount || 0)
            .plus(payment.amount.value)
            .toFixed(2),
          paymentMethod: payment.method,
          paymentDate: payment.paidAt ? new Date(payment.paidAt) : null,
        })
        .where(
          eq(
            subscriptionBillingEvents.id,
            (payment.metadata as any).billingEventId
          )
        );

      await tx
        .update(billingProfiles)
        .set({
          profileStanding: "active",
          graceStartedAt: null,
          graceReason: null,
          suspendedAt: null,
        })
        .where(and(
          eq(billingProfiles.id, billingProfileId),
          not(eq(billingProfiles.profileStanding, "suspended")) // Only update if the profile is not suspended
        ));
    });
  } else {

    const { graceStartedAt, profileStanding } = await db
      .select({ graceStartedAt: billingProfiles.graceStartedAt, profileStanding: billingProfiles.profileStanding })
      .from(billingProfiles)
      .where(eq(billingProfiles.id, (payment.metadata as any).billingProfileId))
      .limit(1)
      .then(result => result[0]);
    const isGracePeriodTrigger = ["canceled", "expired", "failed"].includes(payment.status);

    await db.transaction(async (tx) => {
      await tx.update(subscriptionBillingEvents)
        .set({
          paymentStatus: payment.status,
          paymentId: paymentId,
        })
        .where(
          eq(
            subscriptionBillingEvents.id,
            (payment.metadata as any).billingEventId
          )
        );
      if (isGracePeriodTrigger) {
        await tx.update(billingProfiles)
          .set({
            profileStanding: "grace",
            graceStartedAt: graceStartedAt ?? new Date(),
            graceReason: "payment_" + payment.status,
          })
          .where(and(
            eq(billingProfiles.id, billingProfileId),
            not(eq(billingProfiles.profileStanding, "suspended")) // Only update if the profile is not suspended
          ));
      }
    });
    sendTelegramNotification(`Payment ${paymentId} failed for billing event ${(payment.metadata as any).billingEventId} with status ${payment.status}`);
  }
}
