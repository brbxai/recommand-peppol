import { billingProfiles } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq } from "drizzle-orm";

export async function getBillingProfile(teamId: string) {
  const billingProfile = await db
    .select()
    .from(billingProfiles)
    .where(eq(billingProfiles.teamId, teamId));

  if (billingProfile.length === 0) {
    throw new Error("Billing profile not found");
  }

  return billingProfile[0];
}

export async function upsertBillingProfile(
  teamId: string,
  billingProfile: Omit<typeof billingProfiles.$inferInsert, 'teamId'>
) {
  const [upsertedBillingProfile] = await db
    .insert(billingProfiles)
    .values({
      teamId,
      ...billingProfile,
    })
    .onConflictDoUpdate({
      target: billingProfiles.teamId,
      set: billingProfile,
    })
    .returning();

  return upsertedBillingProfile;
}

export async function deleteBillingProfile(teamId: string) {
  await db.delete(billingProfiles).where(eq(billingProfiles.teamId, teamId));
}