import {
  subscriptionBillingEvents,
  transferEvents,
} from "@peppol/db/schema";
import { db } from "@recommand/db";
import { and, eq, count, gte, lte, desc } from "drizzle-orm";
import {
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { TZDate } from "@date-fns/tz";


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