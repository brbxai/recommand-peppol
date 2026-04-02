import { webhooks } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and, isNull, or } from "drizzle-orm";

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = typeof webhooks.$inferInsert;

export async function getWebhooks(teamId: string): Promise<Webhook[]> {
  return await db.select().from(webhooks).where(eq(webhooks.teamId, teamId));
}

export async function getWebhook(
  teamId: string,
  webhookId: string
): Promise<Webhook | undefined> {
  return await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.teamId, teamId), eq(webhooks.id, webhookId)))
    .then((rows) => rows[0]);
}

export async function getWebhookById(
  webhookId: string
): Promise<Webhook | undefined> {
  return await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .then((rows) => rows[0]);
}

export async function getWebhooksByCompany(
  teamId: string,
  companyId: string
): Promise<Webhook[]> {
  return await db
    .select()
    .from(webhooks)
    .where(
      and(eq(webhooks.teamId, teamId), or(eq(webhooks.companyId, companyId), isNull(webhooks.companyId)))
    );
}

export async function createWebhook(webhook: InsertWebhook): Promise<Webhook> {
  return await db
    .insert(webhooks)
    .values(webhook)
    .returning()
    .then((rows) => rows[0]);
}

export async function updateWebhook(
  webhook: InsertWebhook & { id: string }
): Promise<Webhook> {
  return await db
    .update(webhooks)
    .set(webhook)
    .where(
      and(eq(webhooks.teamId, webhook.teamId), eq(webhooks.id, webhook.id))
    )
    .returning()
    .then((rows) => rows[0]);
}

export async function deleteWebhook(
  teamId: string,
  webhookId: string
): Promise<void> {
  await db
    .delete(webhooks)
    .where(and(eq(webhooks.teamId, teamId), eq(webhooks.id, webhookId)));
} 

export async function callWebhooks(
  teamId: string,
  companyId: string,
  eventType: string,
  data: Record<string, string> = {}
) {
  try {
    const matchedWebhooks = await getWebhooksByCompany(teamId, companyId);
    for (const webhook of matchedWebhooks) {
      try {
        await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventType,
            ...data,
          }),
        });
      } catch (error) {
        console.error("Failed to call webhook:", error);
      }
    }
  } catch (error) {
    console.error("Failed to call webhooks:", error);
  }
}
