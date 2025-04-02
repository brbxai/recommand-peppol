import createMollieClient, { SequenceType } from "@mollie/api-client";
import { db } from "@recommand/db";
import { billingProfiles, subscriptionBillingEvents } from "@peppol/db/schema";
import { eq } from "drizzle-orm";
import Decimal from "decimal.js";

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
      value: "0.00",
    },
    customerId: mollieCustomerId,
    sequenceType: SequenceType.first,
    description: "First payment",
    redirectUrl: `${process.env.BASE_URL}/billing/subscription/validation`,
    webhookUrl: `https://mbp-2.tail407c63.ts.net/api/peppol/mollie/mandate-webhook`, // TODO: make this dynamic with the BASE_URL
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
    await db
      .update(billingProfiles)
      .set({
        firstPaymentId: paymentId,
        firstPaymentStatus: payment.status,
        isMandateValidated: true,
      })
      .where(
        eq(billingProfiles.id, (payment.metadata as any).billingProfileId)
      );
  } else {
    await db
      .update(billingProfiles)
      .set({
        firstPaymentId: paymentId,
        firstPaymentStatus: payment.status,
        isMandateValidated: false,
      })
      .where(
        eq(billingProfiles.id, (payment.metadata as any).billingProfileId)
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
    webhookUrl: `https://mbp-2.tail407c63.ts.net/api/peppol/mollie/payment-webhook`, // TODO: make this dynamic with the BASE_URL
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
    });
  } else {
    await db
      .update(subscriptionBillingEvents)
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
  }
}
