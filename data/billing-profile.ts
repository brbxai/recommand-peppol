import { billingProfiles } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq } from "drizzle-orm";
import { createMollieCustomer } from "./mollie";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";

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
  billingProfile: typeof billingProfiles.$inferInsert
) {
  const [upsertedBillingProfile] = await db
    .insert(billingProfiles)
    .values(billingProfile)
    .onConflictDoUpdate({
      target: billingProfiles.teamId,
      set: billingProfile,
    })
    .returning();

  sendSystemAlert(
    "Billing Profile Created",
    `Billing profile ${upsertedBillingProfile.id} for company ${upsertedBillingProfile.companyName} has been created.`
  );

  if (!upsertedBillingProfile.mollieCustomerId) {
    const mollieCustomer = await createMollieCustomer(
      upsertedBillingProfile.companyName,
      upsertedBillingProfile.teamId,
      upsertedBillingProfile.id
    );
    const [updatedBillingProfile] = await db
      .update(billingProfiles)
      .set({ mollieCustomerId: mollieCustomer.id })
      .where(eq(billingProfiles.id, upsertedBillingProfile.id))
      .returning();

    return updatedBillingProfile;
  }

  return upsertedBillingProfile;
}

export async function deleteBillingProfile(teamId: string) {
  await db.delete(billingProfiles).where(eq(billingProfiles.teamId, teamId));
}
