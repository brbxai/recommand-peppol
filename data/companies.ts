import { companies, companyIdentifiers, teamExtensions } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and, or, isNull, asc } from "drizzle-orm";
import { unregisterCompanyRegistrations, upsertCompanyRegistrations } from "./phoss-smp";
import {
  cleanEnterpriseNumber,
  cleanVatNumber,
  UserFacingError,
} from "@peppol/utils/util";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { getTeamExtension, type TeamExtension } from "./teams";
import { createCompanyDocumentType } from "./company-document-types";
import { canUpsertCompanyIdentifier, createCompanyIdentifier, getCompanyIdentifiers } from "./company-identifiers";
import { COUNTRIES } from "@peppol/utils/countries";
import { shouldInteractWithPeppolNetwork } from "@peppol/utils/playground";
import { CREDIT_NOTE_DOCUMENT_TYPE_INFO, INVOICE_DOCUMENT_TYPE_INFO } from "@peppol/utils/document-types";
import { createVerificationSession } from "./didit/client";

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export function validateSmpRecipientVerificationRequirement({
  isSmpRecipient,
  isVerified,
  teamExtension,
}: {
  isSmpRecipient: boolean;
  isVerified: boolean;
  teamExtension: TeamExtension | null;
}): void {
  if (isSmpRecipient && !isVerified && teamExtension?.verificationRequirements === "strict") {
    throw new UserFacingError("Company must be verified before it can be registered as an SMP recipient. Please verify your company first.");
  }
}

export async function getCompanies(
  teamId: string,
  filters?: {
    enterpriseNumber?: string;
    vatNumber?: string;
  }
): Promise<Company[]> {
  const conditions = [eq(companies.teamId, teamId)];

  if (filters?.enterpriseNumber) {
    const cleanedEnterpriseNumber = cleanEnterpriseNumber(filters.enterpriseNumber);
    if (cleanedEnterpriseNumber) {
      conditions.push(eq(companies.enterpriseNumber, cleanedEnterpriseNumber));
    }
  }

  if (filters?.vatNumber) {
    const cleanedVatNumber = cleanVatNumber(filters.vatNumber);
    if (cleanedVatNumber) {
      conditions.push(eq(companies.vatNumber, cleanedVatNumber));
    }
  }

  return await db.select().from(companies).where(and(...conditions)).orderBy(asc(companies.name));
}

export async function getCompany(
  teamId: string,
  companyId: string
): Promise<Company | undefined> {
  return await db
    .select()
    .from(companies)
    .where(and(eq(companies.teamId, teamId), eq(companies.id, companyId)))
    .then((rows) => rows[0]);
}

export async function getCompanyById(
  companyId: string
): Promise<Company | undefined> {
  return await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .then((rows) => rows[0]);
}

/**
 * Get a company by its Peppol ID. When no playgroundTeamId is provided, the function will return a production company, otherwise it will return the company from the requested playground team.
 * @param peppolId The Peppol ID of the company
 * @param playgroundTeamId The team ID of the playground team, if the company is in a playground team. If no playgroundTeamId is provided, the function will return a production company.
 * @returns The company
 */
export async function getCompanyByPeppolId({
  peppolId,
  playgroundTeamId,
  useTestNetwork,
}: {
  peppolId: string,
  playgroundTeamId?: string
  useTestNetwork?: boolean;
}): Promise<Company> {
  let originalPeppolId = peppolId;
  // The peppolId might start with iso6523-actorid-upis::
  if (peppolId.startsWith("iso6523-actorid-upis::")) {
    peppolId = peppolId.split("::")[1];
  }

  // The peppolId is in the format of 0208:1012081766 (e.g. 0208 for enterprise number, 9925 for vat number)
  const scheme = peppolId.split(":")[0];
  const identifier = peppolId.split(":")[1];
  if (!scheme || !identifier) {
    throw new UserFacingError("Invalid Peppol ID. The Peppol ID must be in the format of scheme:identifier");
  }
  const results = await db
    .select()
    .from(companies)
    .innerJoin(companyIdentifiers, eq(companies.id, companyIdentifiers.companyId))
    .leftJoin(teamExtensions, eq(companies.teamId, teamExtensions.id))
    .where(
      and(
        eq(companies.isSmpRecipient, true), // Only include companies that are registered as SMP recipient
        eq(companyIdentifiers.scheme, scheme.toLowerCase()),
        eq(companyIdentifiers.identifier, identifier.toLowerCase()),
        playgroundTeamId ? eq(companies.teamId, playgroundTeamId) : (
          useTestNetwork ? eq(teamExtensions.isPlayground, true) : or(
            isNull(teamExtensions.isPlayground),
            eq(teamExtensions.isPlayground, false)
          )
        ),
        useTestNetwork ? eq(teamExtensions.useTestNetwork, true) : undefined
      )
    );
  if (results.length === 0) {
    throw new Error(`Company with peppol id ${originalPeppolId} not found`);
  }
  return results[0].peppol_companies;
}

export async function createCompany(company: InsertCompany & { skipDefaultCompanySetup: boolean }): Promise<Company> {
  const teamExtension = await getTeamExtension(company.teamId);
  const isPlaygroundTeam = teamExtension?.isPlayground ?? false;
  const useTestNetwork = teamExtension?.useTestNetwork ?? false;

  validateSmpRecipientVerificationRequirement({
    isSmpRecipient: company.isSmpRecipient ?? false,
    isVerified: company.isVerified ?? false,
    teamExtension,
  });

  const createdCompany = await db
    .insert(companies)
    .values(company)
    .returning()
    .then((rows) => rows[0]);

  try {
    sendSystemAlert(
      "Company Created",
      `Company ${createdCompany.name} has been created. It is ${createdCompany.isSmpRecipient ? "registered as an SMP recipient" : "not registered as an SMP recipient"}.`
    );
    if (!company.skipDefaultCompanySetup) {
      await setupCompanyDefaults({ company: createdCompany, isPlayground: isPlaygroundTeam, useTestNetwork });
    }
  } catch (error) {
    sendSystemAlert(
      "Company Creation Failed",
      `Company ${createdCompany.name} could not be created. Error: \`\`\`\n${error}\n\`\`\``
    );
    await db.delete(companies).where(eq(companies.id, createdCompany.id));
    throw error;
  }

  return createdCompany;
}

/**
 * Setup the default document types and identifiers for a company.
 * @param company The company to setup defaults for
 * @param isPlayground Whether the company is in a playground team, if so we don't register the company in the SMP
 */
async function setupCompanyDefaults({ company, isPlayground, useTestNetwork }: { company: Company, isPlayground: boolean, useTestNetwork: boolean }): Promise<void> {
  const skipSmpRegistration = !shouldInteractWithPeppolNetwork({ isPlayground, useTestNetwork }) || !company.isSmpRecipient;
  await createCompanyDocumentType({
    companyDocumentType: {
      companyId: company.id,
      docTypeId: INVOICE_DOCUMENT_TYPE_INFO.docTypeId,
      processId: INVOICE_DOCUMENT_TYPE_INFO.processId,
    },
    skipSmpRegistration,
    useTestNetwork,
  });
  await createCompanyDocumentType({
    companyDocumentType: {
      companyId: company.id,
      docTypeId: CREDIT_NOTE_DOCUMENT_TYPE_INFO.docTypeId,
      processId: CREDIT_NOTE_DOCUMENT_TYPE_INFO.processId,
    },
    skipSmpRegistration,
    useTestNetwork,
  });

  const countryInfo = COUNTRIES.find((country) => country.code === company.country);
  const cleanedEnterpriseNumber = cleanEnterpriseNumber(company.enterpriseNumber);
  if (countryInfo?.defaultEnterpriseNumberScheme && cleanedEnterpriseNumber) {
    try {
      await createCompanyIdentifier({
        companyIdentifier: {
          companyId: company.id,
          scheme: countryInfo.defaultEnterpriseNumberScheme,
          identifier: cleanedEnterpriseNumber,
        },
        skipSmpRegistration,
        useTestNetwork,
      });
    } catch (error) {
      console.error(`Failed to create enterprise number identifier for company ${company.id}: ${error}`);
    }
  }
  const cleanedVatNumber = cleanVatNumber(company.vatNumber);
  if (countryInfo?.defaultVatScheme && cleanedVatNumber) {
    try {
      await createCompanyIdentifier({
        companyIdentifier: {
          companyId: company.id,
          scheme: countryInfo.defaultVatScheme,
          identifier: cleanedVatNumber,
        },
        skipSmpRegistration,
        useTestNetwork,
      });
    } catch (error) {
      console.error(`Failed to create vat number identifier for company ${company.id}: ${error}`);
    }
  }
}

export async function updateCompany(company: Partial<InsertCompany> & { id: string; teamId: string }): Promise<Company> {
  const oldCompany = await getCompany(company.teamId, company.id);
  if (!oldCompany) {
    throw new UserFacingError("Company not found");
  }

  const teamExtension = await getTeamExtension(company.teamId);

  // Merge with existing company data, only updating provided fields
  const updatedFields: Partial<InsertCompany> = Object.fromEntries(
    Object.entries(company).filter(([_, value]) => value !== undefined)
  );
  
  // Check if cleaned vat number or enterprise number changed, and reset verification if so
  const oldCleanedEnterpriseNumber = cleanEnterpriseNumber(oldCompany.enterpriseNumber);
  const newCleanedEnterpriseNumber = cleanEnterpriseNumber(company.enterpriseNumber);
  const oldCleanedVatNumber = cleanVatNumber(oldCompany.vatNumber);
  const newCleanedVatNumber = cleanVatNumber(company.vatNumber);
  
  const enterpriseNumberChanged = company.enterpriseNumber !== undefined && oldCleanedEnterpriseNumber !== newCleanedEnterpriseNumber;
  const vatNumberChanged = company.vatNumber !== undefined && oldCleanedVatNumber !== newCleanedVatNumber;
  
  if ((enterpriseNumberChanged || vatNumberChanged) && oldCompany.isVerified) {
    updatedFields.isVerified = false;
    updatedFields.verificationProofReference = null;
  }
  
  // Validate that isSmpRecipient cannot be true if company is not verified and team has strict verification requirements
  validateSmpRecipientVerificationRequirement({
    isSmpRecipient: company.isSmpRecipient !== undefined ? company.isSmpRecipient : oldCompany.isSmpRecipient,
    isVerified: updatedFields.isVerified !== undefined ? updatedFields.isVerified : oldCompany.isVerified,
    teamExtension,
  });

  const updatedCompany = await db
    .update(companies)
    .set(updatedFields)
    .where(
      and(eq(companies.teamId, company.teamId), eq(companies.id, company.id))
    )
    .returning()
    .then((rows) => rows[0]);

  const useTestNetwork = teamExtension?.useTestNetwork ?? false;
  const isPlaygroundTeam = teamExtension?.isPlayground ?? false;
  if (shouldInteractWithPeppolNetwork({ isPlayground: isPlaygroundTeam, useTestNetwork }) && oldCompany.isSmpRecipient !== updatedCompany.isSmpRecipient) {
    if (updatedCompany.isSmpRecipient) {
      try {
        await upsertCompanyRegistrations({ companyId: updatedCompany.id, useTestNetwork });
      } catch (error) {
        // If registration fails, unregister any company registrations that might have been registered
        try {
          await unregisterCompanyRegistrations({ companyId: updatedCompany.id, useTestNetwork });
        } catch (error) {
          // If this fails, we can't do much about it, we at least want to rollback the update of the company
          console.error(`Failed to unregister company registrations for company ${updatedCompany.id} after registration failed: ${error}`);
        }
        // Also rollback the update of the company
        await db.update(companies).set(oldCompany).where(eq(companies.id, company.id));
        throw error;
      }
    } else {
      try {
        await unregisterCompanyRegistrations({ companyId: updatedCompany.id, useTestNetwork });
      } catch (error) {
        // If unregistration fails, register all company registrations that might have been unregistered
        try {
          await upsertCompanyRegistrations({ companyId: updatedCompany.id, useTestNetwork });
        } catch (error) {
          // If this fails, we can't do much about it, we at least want to rollback the update of the company
          console.error(`Failed to register company registrations for company ${updatedCompany.id} after unregistration failed: ${error}`);
        }
        // Also rollback the update of the company
        await db.update(companies).set(oldCompany).where(eq(companies.id, company.id));
        throw error;
      }
    }
  } else {
    try {
      // Ensure none of the company's identifiers are already registered as recipient with another company within the same class (playground, playground with test network, production)
      const identifiers = await getCompanyIdentifiers(updatedCompany.id);
      for (const identifier of identifiers) {
        const canUpsert = await canUpsertCompanyIdentifier(identifier.scheme, identifier.identifier, identifier.id, updatedCompany.id);
        if (!canUpsert) {
          throw new UserFacingError("Company cannot be registered as SMP recipient, it has identifiers that are already registered as recipient with another company.");
        }
      }
    } catch (error) {
      // If the check fails, rollback the update of the company
      await db.update(companies).set(oldCompany).where(eq(companies.id, company.id));
      throw error;
    }
  }

  if (!isPlaygroundTeam) {
    sendSystemAlert(
      "Company Updated",
      `Company ${updatedCompany.name} has been updated. It is ${updatedCompany.isSmpRecipient ? "registered as an SMP recipient" : "not registered as an SMP recipient"}.`
    );
  }

  return updatedCompany;
}

export async function deleteCompany({
  teamId,
  companyId,
}: {
  teamId: string;
  companyId: string;
}): Promise<void> {
  const company = await db
    .select()
    .from(companies)
    .where(and(eq(companies.teamId, teamId), eq(companies.id, companyId)))
    .then((rows) => rows[0]);
  if (!company) {
    throw new Error("Company not found");
  }

  const teamExtension = await getTeamExtension(teamId);
  const isPlaygroundTeam = teamExtension?.isPlayground ?? false;
  const useTestNetwork = teamExtension?.useTestNetwork ?? false;
  if (shouldInteractWithPeppolNetwork({ isPlayground: isPlaygroundTeam, useTestNetwork }) && company.isSmpRecipient) {
    await unregisterCompanyRegistrations({ companyId, useTestNetwork });
  }
  await db
    .delete(companies)
    .where(and(eq(companies.teamId, teamId), eq(companies.id, companyId)));
}

export async function verifyCompany({
  teamId,
  companyId,
  callback,
}: {
  teamId: string;
  companyId: string;
  callback?: string;
}): Promise<string> {
  const company = await getCompany(teamId, companyId);
  if (!company) {
    throw new UserFacingError("Company not found");
  }

  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey) {
    throw new Error("DIDIT_API_KEY environment variable is not set");
  }

  const workflowId = process.env.DIDIT_WORKFLOW_ID;
  if (!workflowId) {
    throw new Error("DIDIT_WORKFLOW_ID environment variable is not set");
  }

  const session = await createVerificationSession({
    apiKey,
    workflowId,
    vendorData: companyId,
    callback,
  });

  if (!session || !session.url) {
    throw new UserFacingError("Failed to create verification session");
  }

  return session.url;
}