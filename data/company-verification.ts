import { companies, companyVerificationLog } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq } from "drizzle-orm";
import { getEnterpriseData } from "./cbe-public-search/client";
import { UserFacingError } from "@peppol/utils/util";
import { getCompany, verifyCompany, type Company } from "./companies";
import { getTeamExtension } from "./teams";
import { shouldRegisterWithSmp } from "@peppol/utils/playground";
import { upsertCompanyRegistrations } from "./phoss-smp";
import { callWebhooks } from "@peppol/data/webhooks";

export type CompanyVerificationLog = typeof companyVerificationLog.$inferSelect;

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z]/g, "");
}

export async function getCompanyVerificationLog(
  id: string
): Promise<CompanyVerificationLog | undefined> {
  return await db
    .select()
    .from(companyVerificationLog)
    .where(eq(companyVerificationLog.id, id))
    .then((rows) => rows[0]);
}

export function getBaseUrlOrThrow(): string {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    throw new Error("BASE_URL environment variable is not set");
  }

  return baseUrl;
}

export async function createCompanyVerificationLog({
  teamId,
  companyId,
}: {
  teamId: string;
  companyId: string;
}): Promise<{ log: CompanyVerificationLog; verificationUrl: string }> {
  const baseUrl = getBaseUrlOrThrow();

  const company = await getCompany(teamId, companyId);
  if (!company) {
    throw new UserFacingError("Company not found");
  }

  const log = await db
    .insert(companyVerificationLog)
    .values({
      companyId,
      companyName: company.name,
      enterpriseNumber: company.enterpriseNumber,
    })
    .returning()
    .then((rows) => rows[0]);

  const verificationUrl = `${baseUrl}/company-verification/${log.id}/verify`;
  return { log, verificationUrl };
}

export async function submitIdentityForm(
  companyVerificationLogId: string,
  log: CompanyVerificationLog,
  company: Company,
  firstName: string,
  lastName: string
): Promise<string> {
  if (log.status !== "opened") {
    throw new UserFacingError("This verification has already been submitted.");
  }

  if (company.country === "BE") {
    if (!company.enterpriseNumber) {
      throw new UserFacingError("Company does not have an enterprise number. Please complete the company details first.");
    }
    const enterpriseData = await getEnterpriseData(company.enterpriseNumber, company.country);
    const isRepresentative = enterpriseData.representatives.some(
      (rep) =>
        rep.firstName && rep.lastName &&
        normalizeName(rep.firstName) === normalizeName(firstName) &&
        normalizeName(rep.lastName) === normalizeName(lastName)
    );
    if (!isRepresentative) {
      throw new UserFacingError(
        "The provided name does not match any representative of this company in the CBE registry. Please contact support@recommand.eu to proceed with the verification."
      );
    }
  }

  const verificationUrl = await createIdVerificationUrl(companyVerificationLogId);

  await db
    .update(companyVerificationLog)
    .set({
      firstName,
      lastName,
      status: "idVerificationRequested",
    })
    .where(eq(companyVerificationLog.id, companyVerificationLogId))
    .returning()
    .then((rows) => rows[0]);

  return verificationUrl;
}

export async function submitPlaygroundVerification(
  companyVerificationLogId: string,
  log: CompanyVerificationLog,
  company: Company
): Promise<void> {
  if (log.status === "verified" || log.status === "rejected") {
    throw new UserFacingError("This verification has already been completed.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(companyVerificationLog)
      .set({ status: "verified", verificationProofReference: "PLAYGROUND" })
      .where(eq(companyVerificationLog.id, companyVerificationLogId));
    await tx
      .update(companies)
      .set({ isVerified: true, verificationProofReference: "PLAYGROUND" })
      .where(eq(companies.id, company.id));
  });

  try {
    const teamExtension = await getTeamExtension(company.teamId);
    const useTestNetwork = teamExtension?.useTestNetwork ?? false;
    if (
      shouldRegisterWithSmp({
        isPlayground: teamExtension?.isPlayground,
        useTestNetwork,
        isSmpRecipient: company.isSmpRecipient,
        isVerified: true,
        verificationRequirements: teamExtension?.verificationRequirements ?? undefined,
      })
    ) {
      await upsertCompanyRegistrations({ companyId: company.id, useTestNetwork });
    }
  } catch (error) {
    console.error(`Failed to register company ${company.id} with SMP after playground verification:`, error);
  }

  await callWebhooks(company.teamId, company.id, "company.verification", {
    companyId: company.id,
    teamId: company.teamId,
    status: "verified",
  });
}

export async function requestIdVerification(
  companyVerificationLogId: string,
  log: CompanyVerificationLog
): Promise<string> {
  if (log.status !== "idVerificationRequested") {
    throw new UserFacingError("Verification is not in a state that allows identity verification.");
  }

  const verificationUrl = await createIdVerificationUrl(companyVerificationLogId);

  await db
    .update(companyVerificationLog)
    .set({ status: "idVerificationRequested" })
    .where(eq(companyVerificationLog.id, companyVerificationLogId))
    .returning()
    .then((rows) => rows[0]);
  
  return verificationUrl;
}

async function createIdVerificationUrl(companyVerificationLogId: string): Promise<string> {
  const baseUrl = getBaseUrlOrThrow();

  const callbackUrl = `${baseUrl}/company-verification/${companyVerificationLogId}/status`;
  const verificationUrl = await verifyCompany({
    companyVerificationLogId,
    callback: callbackUrl,
  });
  if (!verificationUrl) {
    throw new UserFacingError("Failed to create verification session");
  }

  return verificationUrl;
}
