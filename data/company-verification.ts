import { companies, companyVerificationLog } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq } from "drizzle-orm";
import { getEnterpriseData } from "./cbe-public-search/client";
import { UserFacingError } from "@peppol/utils/util";
import { getCompany, verifyCompany, type Company } from "./companies";
import { getTeamExtension } from "./teams";
import { shouldRegisterWithSmp } from "@peppol/utils/playground";
import { unregisterCompanyRegistrations, upsertCompanyRegistrations } from "./phoss-smp";
import { callWebhooks } from "@peppol/data/webhooks";

export type CompanyVerificationLog = typeof companyVerificationLog.$inferSelect;
export type CompanyVerificationStatus = CompanyVerificationLog["status"];
export type CompanyVerificationFinalStatus = Extract<CompanyVerificationStatus, "verified" | "rejected" | "error">;

export type FinalizeCompanyVerificationResult = {
  status: CompanyVerificationFinalStatus;
  errorMessage: string | null;
};

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

function getCompanyVerificationErrorMessage({
  error,
  status,
}: {
  error: unknown;
  status: "verified" | "rejected";
}): string {
  if (error instanceof UserFacingError) {
    return error.message;
  }

  if (status === "verified") {
    return "Identity verification succeeded, but we could not activate your company on the Peppol network. Please contact support@recommand.eu for assistance.";
  }

  return "We could not complete this verification because the company could not be updated on the Peppol network. Please contact support@recommand.eu for assistance.";
}

async function setCompanyVerificationError({
  companyVerificationLogId,
  verificationProofReference,
  errorMessage,
}: {
  companyVerificationLogId: string;
  verificationProofReference: string;
  errorMessage: string;
}): Promise<void> {
  await db
    .update(companyVerificationLog)
    .set({
      status: "error",
      verificationProofReference,
      errorMessage,
    })
    .where(eq(companyVerificationLog.id, companyVerificationLogId));
}

export async function finalizeCompanyVerification({
  companyVerificationLogId,
  company,
  status,
  verificationProofReference,
}: {
  companyVerificationLogId: string;
  company: Company;
  status: "verified" | "rejected";
  verificationProofReference: string;
}): Promise<FinalizeCompanyVerificationResult> {
  const isVerified = status === "verified";
  const teamExtension = await getTeamExtension(company.teamId);
  const useTestNetwork = teamExtension?.useTestNetwork ?? false;
  const verificationRequirements = teamExtension?.verificationRequirements ?? undefined;
  const smpStateBase = {
    isPlayground: teamExtension?.isPlayground,
    useTestNetwork,
    isSmpRecipient: company.isSmpRecipient,
    verificationRequirements,
  };
  const wasRegistered = shouldRegisterWithSmp({ ...smpStateBase, isVerified: company.isVerified });
  const shouldBeRegistered = shouldRegisterWithSmp({ ...smpStateBase, isVerified });
  const smpTransition =
    !wasRegistered && shouldBeRegistered
      ? "register"
      : wasRegistered && !shouldBeRegistered
        ? "unregister"
        : "none";

  const rollbackSmpTransition = async (): Promise<void> => {
    if (smpTransition === "register") {
      try {
        await unregisterCompanyRegistrations({ companyId: company.id, useTestNetwork });
      } catch (rollbackError) {
        console.error(`Failed to unregister company ${company.id} while rolling back verification finalization:`, rollbackError);
      }
    }

    if (smpTransition === "unregister") {
      try {
        await upsertCompanyRegistrations({ companyId: company.id, useTestNetwork });
      } catch (rollbackError) {
        console.error(`Failed to restore SMP registrations for company ${company.id} while rolling back verification finalization:`, rollbackError);
      }
    }
  };

  if (smpTransition === "register") {
    try {
      await upsertCompanyRegistrations({ companyId: company.id, useTestNetwork });
    } catch (error) {
      await rollbackSmpTransition();
      console.error(`Failed to register company ${company.id} with SMP while finalizing verification:`, error);
      const errorMessage = getCompanyVerificationErrorMessage({ error, status });
      await setCompanyVerificationError({
        companyVerificationLogId,
        verificationProofReference,
        errorMessage,
      });
      await callWebhooks(company.teamId, company.id, "company.verification", {
        companyId: company.id,
        teamId: company.teamId,
        status: "error",
        errorMessage,
      });
      return { status: "error", errorMessage };
    }
  }

  if (smpTransition === "unregister") {
    try {
      await unregisterCompanyRegistrations({ companyId: company.id, useTestNetwork });
    } catch (error) {
      await rollbackSmpTransition();
      console.error(`Failed to unregister company ${company.id} from SMP while finalizing verification:`, error);
      const errorMessage = getCompanyVerificationErrorMessage({ error, status });
      await setCompanyVerificationError({
        companyVerificationLogId,
        verificationProofReference,
        errorMessage,
      });
      await callWebhooks(company.teamId, company.id, "company.verification", {
        companyId: company.id,
        teamId: company.teamId,
        status: "error",
        errorMessage,
      });
      return { status: "error", errorMessage };
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(companyVerificationLog)
        .set({ status, verificationProofReference, errorMessage: null })
        .where(eq(companyVerificationLog.id, companyVerificationLogId));
      await tx
        .update(companies)
        .set({
          isVerified,
          verificationProofReference,
        })
        .where(eq(companies.id, company.id));
    });
  } catch (error) {
    await rollbackSmpTransition();
    throw error;
  }

  await callWebhooks(company.teamId, company.id, "company.verification", {
    companyId: company.id,
    teamId: company.teamId,
    status,
  });

  return { status, errorMessage: null };
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
): Promise<FinalizeCompanyVerificationResult> {
  if (log.status === "verified" || log.status === "rejected" || log.status === "error") {
    throw new UserFacingError("This verification has already been completed.");
  }

  return await finalizeCompanyVerification({
    companyVerificationLogId,
    company,
    status: "verified",
    verificationProofReference: "PLAYGROUND",
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
