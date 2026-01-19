import { companyCustomDomains } from "@peppol/db/schema";
import { UserFacingError } from "@peppol/utils/util";
import { db } from "@recommand/db";
import { eq } from "drizzle-orm";
import {
  createPostmarkDomain,
  deletePostmarkDomain,
  verifyPostmarkDomainDkim,
  verifyPostmarkDomainReturnPath,
} from "@peppol/lib/postmark-domains";

export type CompanyCustomDomain = typeof companyCustomDomains.$inferSelect;
export type InsertCompanyCustomDomain = typeof companyCustomDomains.$inferInsert;

export async function getCompanyCustomDomain(
  companyId: string
): Promise<CompanyCustomDomain | undefined> {
  return await db
    .select()
    .from(companyCustomDomains)
    .where(eq(companyCustomDomains.companyId, companyId))
    .then((rows) => rows[0]);
}

export async function createCompanyCustomDomain(
  companyId: string,
  domainName: string,
  senderEmail: string
): Promise<CompanyCustomDomain> {
  // Check if company already has a custom domain
  const existing = await getCompanyCustomDomain(companyId);
  if (existing) {
    throw new UserFacingError(
      "This company already has a custom domain configured. Please delete it first to add a new one."
    );
  }

  // Validate domain name format
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domainName)) {
    throw new UserFacingError(
      "Invalid domain name format. Please provide a valid domain (e.g., example.com)"
    );
  }

  // Validate sender email matches domain
  const emailDomain = senderEmail.split("@")[1];
  if (emailDomain?.toLowerCase() !== domainName.toLowerCase()) {
    throw new UserFacingError(
      `Sender email must use the same domain (${domainName})`
    );
  }

  // Create domain in Postmark
  const postmarkDomain = await createPostmarkDomain(domainName);

  // Store in database
  const created = await db
    .insert(companyCustomDomains)
    .values({
      companyId,
      postmarkDomainId: postmarkDomain.ID,
      domainName: postmarkDomain.Name,
      dkimVerified: postmarkDomain.DKIMVerified,
      dkimPendingHost: postmarkDomain.DKIMPendingHost || null,
      dkimPendingValue: postmarkDomain.DKIMPendingTextValue || null,
      dkimHost: postmarkDomain.DKIMHost || null,
      dkimValue: postmarkDomain.DKIMTextValue || null,
      returnPathDomain: postmarkDomain.ReturnPathDomain || null,
      returnPathVerified: postmarkDomain.ReturnPathDomainVerified,
      returnPathCnameValue: postmarkDomain.ReturnPathDomainCNAMEValue || null,
      senderEmail,
    })
    .returning()
    .then((rows) => rows[0]);

  return created;
}

export async function verifyCompanyCustomDomainDkim(
  companyId: string
): Promise<CompanyCustomDomain> {
  const existing = await getCompanyCustomDomain(companyId);
  if (!existing) {
    throw new UserFacingError("No custom domain found for this company");
  }

  // Trigger DKIM verification in Postmark
  const postmarkDomain = await verifyPostmarkDomainDkim(
    existing.postmarkDomainId
  );

  // Update database with latest status
  const updated = await db
    .update(companyCustomDomains)
    .set({
      dkimVerified: postmarkDomain.DKIMVerified,
      dkimPendingHost: postmarkDomain.DKIMPendingHost || null,
      dkimPendingValue: postmarkDomain.DKIMPendingTextValue || null,
      dkimHost: postmarkDomain.DKIMHost || null,
      dkimValue: postmarkDomain.DKIMTextValue || null,
    })
    .where(eq(companyCustomDomains.companyId, companyId))
    .returning()
    .then((rows) => rows[0]);

  return updated;
}

export async function verifyCompanyCustomDomainReturnPath(
  companyId: string
): Promise<CompanyCustomDomain> {
  const existing = await getCompanyCustomDomain(companyId);
  if (!existing) {
    throw new UserFacingError("No custom domain found for this company");
  }

  // Trigger Return Path verification in Postmark
  const postmarkDomain = await verifyPostmarkDomainReturnPath(
    existing.postmarkDomainId
  );

  // Update database with latest status
  const updated = await db
    .update(companyCustomDomains)
    .set({
      returnPathDomain: postmarkDomain.ReturnPathDomain || null,
      returnPathVerified: postmarkDomain.ReturnPathDomainVerified,
      returnPathCnameValue: postmarkDomain.ReturnPathDomainCNAMEValue || null,
    })
    .where(eq(companyCustomDomains.companyId, companyId))
    .returning()
    .then((rows) => rows[0]);

  return updated;
}

export async function updateCompanyCustomDomainSenderEmail(
  companyId: string,
  senderEmail: string
): Promise<CompanyCustomDomain> {
  const existing = await getCompanyCustomDomain(companyId);
  if (!existing) {
    throw new UserFacingError("No custom domain found for this company");
  }

  // Validate sender email matches domain
  const emailDomain = senderEmail.split("@")[1];
  if (emailDomain?.toLowerCase() !== existing.domainName.toLowerCase()) {
    throw new UserFacingError(
      `Sender email must use the same domain (${existing.domainName})`
    );
  }

  const updated = await db
    .update(companyCustomDomains)
    .set({ senderEmail })
    .where(eq(companyCustomDomains.companyId, companyId))
    .returning()
    .then((rows) => rows[0]);

  return updated;
}

export async function deleteCompanyCustomDomain(
  companyId: string
): Promise<void> {
  const existing = await getCompanyCustomDomain(companyId);
  if (!existing) {
    throw new UserFacingError("No custom domain found for this company");
  }

  // Delete from Postmark first
  await deletePostmarkDomain(existing.postmarkDomainId);

  // Then delete from database
  await db
    .delete(companyCustomDomains)
    .where(eq(companyCustomDomains.companyId, companyId));
}
