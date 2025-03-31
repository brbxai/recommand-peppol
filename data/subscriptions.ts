import { db } from "@recommand/db";
import { subscriptions } from "@peppol/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import type { BillingConfig } from "./plans";

export type Subscription = typeof subscriptions.$inferSelect;

export async function getSubscriptions(teamId: string) {
  const allSubscriptions = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.teamId, teamId));

  return allSubscriptions;
}

export async function getActiveSubscription(teamId: string) {
  const activeSubscription = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.teamId, teamId), isNull(subscriptions.endDate))
    );

  if (activeSubscription.length === 0) {
    return null;
  }

  return activeSubscription[0];
}

export async function startSubscription(
  teamId: string,
  planId: string | null,
  planName: string,
  billingConfig: BillingConfig
) {
  return await db.transaction(async (tx) => {
    // End all active subscriptions for this team
    await tx
      .update(subscriptions)
      .set({ endDate: new Date() })
      .where(
        and(eq(subscriptions.teamId, teamId), isNull(subscriptions.endDate))
      );

    // Start new subscription
    const [subscription] = await tx
      .insert(subscriptions)
      .values({
        teamId,
        planId,
        planName,
        billingConfig,
        startDate: new Date(),
      })
      .returning();

    return subscription;
  });
}

export async function cancelSubscription(teamId: string) {
  await db
    .update(subscriptions)
    .set({ endDate: new Date() })
    .where(eq(subscriptions.teamId, teamId));
}
