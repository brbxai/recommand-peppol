import createMollieClient, { SequenceType } from '@mollie/api-client';
import { db } from '@recommand/db';
import { billingProfiles } from '@peppol/db/schema';
import { eq } from 'drizzle-orm';

if (!process.env.MOLLIE_API_KEY) {
  throw new Error('MOLLIE_API_KEY is not set');
}
if(!process.env.BASE_URL) {
  throw new Error('BASE_URL is not set');
}

const mollie = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY as string,
});

export async function createMollieCustomer(name: string, teamId: string, billingProfileId: string) {
  const customer = await mollie.customers.create({
    name: name,
    metadata: {
      teamId: teamId,
      billingProfileId: billingProfileId,
    }
  });

  return customer;
}

export async function createFirstPayment(mollieCustomerId: string, billingProfileId: string) {
  const payment = await mollie.payments.create({
    amount: {
      currency: 'EUR',
      value: '0.00',
    },
    customerId: mollieCustomerId,
    sequenceType: SequenceType.first,
    description: 'First payment',
    redirectUrl: `${process.env.BASE_URL}/billing/subscription/validation`,
    webhookUrl: `https://mbp-2.tail407c63.ts.net/api/peppol/mollie/mandate-webhook`, // TODO: make this dynamic with the BASE_URL
    metadata: {
      billingProfileId: billingProfileId,
    }
  });

  return payment;
}

export async function processFirstPayment(paymentId: string) {
  const payment = await mollie.payments.get(paymentId);
  console.log("Payment", payment);

  if(payment.status === "paid") {
    await db.update(billingProfiles).set({
      firstPaymentId: paymentId,
      firstPaymentStatus: payment.status,
      isMandateValidated: true,
    }).where(eq(billingProfiles.id, (payment.metadata as any).billingProfileId));
  }else{
    await db.update(billingProfiles).set({
      firstPaymentId: paymentId,
      firstPaymentStatus: payment.status,
      isMandateValidated: false,
    }).where(eq(billingProfiles.id, (payment.metadata as any).billingProfileId));
  }
}