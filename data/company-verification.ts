import { companyVerificationLog } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq } from "drizzle-orm";
import { getEnterpriseData } from "./cbe-public-search/client";
import { UserFacingError } from "@peppol/utils/util";
import { getCompany, verifyCompany, type Company } from "./companies";

export type CompanyVerificationLog = typeof companyVerificationLog.$inferSelect;

export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-zA-Z]/g, "");
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

export async function createCompanyVerificationLog({
  teamId,
  companyId,
}: {
  teamId: string;
  companyId: string;
}): Promise<CompanyVerificationLog> {
  const company = await getCompany(teamId, companyId);
  if (!company) {
    throw new UserFacingError("Company not found");
  }

  return await db
    .insert(companyVerificationLog)
    .values({
      companyId,
      companyName: company.name,
      enterpriseNumber: company.enterpriseNumber,
    })
    .returning()
    .then((rows) => rows[0]);
}

export async function submitIdentityForm(
  companyVerificationLogId: string,
  company: Company,
  firstName: string,
  lastName: string
): Promise<CompanyVerificationLog> {
  if (company.country === "BE" && company.enterpriseNumber) {
    const enterpriseData = await getEnterpriseData(company.enterpriseNumber, company.country);
    const isRepresentative = enterpriseData.representatives.some(
      (rep) =>
        normalizeName(rep.firstName) === normalizeName(firstName) &&
        normalizeName(rep.lastName) === normalizeName(lastName)
    );
    if (!isRepresentative) {
      throw new UserFacingError(
        "The provided name does not match any representative of this company in the CBE registry. Please contact support@recommand.eu to proceed with the verification."
      );
    }
  }

  return await db
    .update(companyVerificationLog)
    .set({
      firstName,
      lastName,
      status: "formSubmitted",
    })
    .where(eq(companyVerificationLog.id, companyVerificationLogId))
    .returning()
    .then((rows) => rows[0]);
}

export async function requestIdVerification(
  companyVerificationLogId: string
): Promise<string> {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    throw new Error("BASE_URL environment variable is not set");
  }
  
  const callbackUrl = `${baseUrl}/company-verification/${companyVerificationLogId}/status`;
  const verificationUrl = await verifyCompany({
    companyVerificationLogId,
    callback: callbackUrl,
  });
  if (!verificationUrl) {
    throw new UserFacingError("Failed to create verification session");
  }

  await db
    .update(companyVerificationLog)
    .set({ status: "idVerificationRequested" })
    .where(eq(companyVerificationLog.id, companyVerificationLogId))
    .returning()
    .then((rows) => rows[0]);
  
  return verificationUrl;
}