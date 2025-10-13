import { companyNotificationEmailAddresses } from "@peppol/db/schema";
import { UserFacingError } from "@peppol/utils/util";
import { db } from "@recommand/db";
import { eq, and, asc } from "drizzle-orm";

export type CompanyNotificationEmailAddress = typeof companyNotificationEmailAddresses.$inferSelect;
export type InsertCompanyNotificationEmailAddress = typeof companyNotificationEmailAddresses.$inferInsert;

const cleanEmail = (email: string): string => {
  const cleanedEmail = email.toLowerCase().trim();
  if (!cleanedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new UserFacingError("Invalid email address format");
  }
  return cleanedEmail;
};

export async function getCompanyNotificationEmailAddresses(companyId: string): Promise<CompanyNotificationEmailAddress[]> {
  return await db
    .select()
    .from(companyNotificationEmailAddresses)
    .where(eq(companyNotificationEmailAddresses.companyId, companyId))
    .orderBy(asc(companyNotificationEmailAddresses.email));
}

export async function getOutgoingCompanyNotificationEmailAddresses(companyId: string): Promise<CompanyNotificationEmailAddress[]> {
  return await db
    .select()
    .from(companyNotificationEmailAddresses)
    .where(and(eq(companyNotificationEmailAddresses.companyId, companyId), eq(companyNotificationEmailAddresses.notifyOutgoing, true)))
    .orderBy(asc(companyNotificationEmailAddresses.email));
}

export async function getIncomingCompanyNotificationEmailAddresses(companyId: string): Promise<CompanyNotificationEmailAddress[]> {
  return await db
    .select()
    .from(companyNotificationEmailAddresses)
    .where(and(eq(companyNotificationEmailAddresses.companyId, companyId), eq(companyNotificationEmailAddresses.notifyIncoming, true)))
    .orderBy(asc(companyNotificationEmailAddresses.email));
}

export async function getCompanyNotificationEmailAddress(
  companyId: string,
  notificationEmailAddressId: string
): Promise<CompanyNotificationEmailAddress | undefined> {
  return await db
    .select()
    .from(companyNotificationEmailAddresses)
    .where(
      and(
        eq(companyNotificationEmailAddresses.companyId, companyId),
        eq(companyNotificationEmailAddresses.id, notificationEmailAddressId)
      )
    )
    .then((rows) => rows[0]);
}

export async function getCompanyNotificationEmailAddressByEmail(
  companyId: string,
  email: string
): Promise<CompanyNotificationEmailAddress | undefined> {
  return await db
    .select()
    .from(companyNotificationEmailAddresses)
    .where(
      and(
        eq(companyNotificationEmailAddresses.companyId, companyId),
        eq(companyNotificationEmailAddresses.email, cleanEmail(email))
      )
    )
    .then((rows) => rows[0]);
}

export async function createCompanyNotificationEmailAddress(
  notificationEmailAddress: InsertCompanyNotificationEmailAddress
): Promise<CompanyNotificationEmailAddress> {
  const cleaned = cleanEmail(notificationEmailAddress.email);

  const existing = await getCompanyNotificationEmailAddressByEmail(notificationEmailAddress.companyId, cleaned);
  if (existing) {
    throw new UserFacingError("This email address is already registered for notifications");
  }

  if(!notificationEmailAddress.notifyIncoming && !notificationEmailAddress.notifyOutgoing) {
    throw new UserFacingError("At least one notification type must be enabled");
  }

  const created = await db
    .insert(companyNotificationEmailAddresses)
    .values({
      companyId: notificationEmailAddress.companyId,
      email: cleaned,
      notifyIncoming: notificationEmailAddress.notifyIncoming ?? false,
      notifyOutgoing: notificationEmailAddress.notifyOutgoing ?? false,
    })
    .returning()
    .then((rows) => rows[0]);

  return created;
}

export async function updateCompanyNotificationEmailAddress(
  notificationEmailAddress: InsertCompanyNotificationEmailAddress & { id: string }
): Promise<CompanyNotificationEmailAddress> {
  const existing = await getCompanyNotificationEmailAddress(
    notificationEmailAddress.companyId,
    notificationEmailAddress.id
  );

  if (!existing) {
    throw new UserFacingError("Notification email address not found");
  }

  if(!notificationEmailAddress.notifyIncoming && !notificationEmailAddress.notifyOutgoing) {
    throw new UserFacingError("At least one notification type must be enabled");
  }

  const cleaned = cleanEmail(notificationEmailAddress.email);

  if (existing.email !== cleaned) {
    const duplicate = await getCompanyNotificationEmailAddressByEmail(notificationEmailAddress.companyId, cleaned);
    if (duplicate) {
      throw new UserFacingError("This email address is already registered for notifications");
    }
  }

  const updated = await db
    .update(companyNotificationEmailAddresses)
    .set({
      email: cleaned,
      notifyIncoming: notificationEmailAddress.notifyIncoming ?? false,
      notifyOutgoing: notificationEmailAddress.notifyOutgoing ?? false,
    })
    .where(
      and(
        eq(companyNotificationEmailAddresses.companyId, notificationEmailAddress.companyId),
        eq(companyNotificationEmailAddresses.id, notificationEmailAddress.id)
      )
    )
    .returning()
    .then((rows) => rows[0]);

  return updated;
}

export async function deleteCompanyNotificationEmailAddress(
  companyId: string,
  notificationEmailAddressId: string
): Promise<void> {
  const existing = await getCompanyNotificationEmailAddress(companyId, notificationEmailAddressId);
  if (!existing) {
    throw new UserFacingError("Notification email not found");
  }

  await db
    .delete(companyNotificationEmailAddresses)
    .where(
      and(
        eq(companyNotificationEmailAddresses.companyId, companyId),
        eq(companyNotificationEmailAddresses.id, notificationEmailAddressId)
      )
    );
}
