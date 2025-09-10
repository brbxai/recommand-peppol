import { companies, companyIdentifiers, teamExtensions } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and, or, isNull, ne } from "drizzle-orm";
import { unregisterCompanyRegistrations, upsertCompanyRegistrations } from "./phoss-smp";
import {
  cleanEnterpriseNumber,
  cleanVatNumber,
  UserFacingError,
} from "@peppol/utils/util";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { isPlayground } from "./teams";
import { createCompanyDocumentType } from "./company-document-types";
import { createCompanyIdentifier } from "./company-identifiers";
import { COUNTRIES } from "@peppol/utils/countries";

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export async function getCompanies(teamId: string): Promise<Company[]> {
  return await db.select().from(companies).where(eq(companies.teamId, teamId));
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
export async function getCompanyByPeppolId(
  peppolId: string,
  playgroundTeamId?: string
): Promise<Company> {
  let originalPeppolId = peppolId;
  // The peppolId might start with iso6523-actorid-upis::
  if (peppolId.startsWith("iso6523-actorid-upis::")) {
    peppolId = peppolId.split("::")[1];
  }

  // The peppolId is in the format of 0208:0659689080 (e.g. 0208 for enterprise number, 9925 for vat number)
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
        eq(companyIdentifiers.scheme, scheme.toLowerCase()),
        eq(companyIdentifiers.identifier, identifier.toLowerCase()),
        playgroundTeamId ? eq(companies.teamId, playgroundTeamId) : or(
          isNull(teamExtensions.isPlayground),
          eq(teamExtensions.isPlayground, false)
        )
      )
    );
  if (results.length === 0) {
    throw new Error(`Company with peppol id ${originalPeppolId} not found`);
  }
  return results[0].peppol_companies;
}

export async function createCompany(company: InsertCompany): Promise<Company> {
  const isPlaygroundTeam = await isPlayground(company.teamId);

  // Check if there exists a company with the same enterprise number or vat number
  if (
    !await canUpsertCompany(
      company.enterpriseNumber,
      company.vatNumber,
      undefined,
      company.teamId,
      isPlaygroundTeam
    )
  ) {
    throw new UserFacingError(
      "Company with this enterprise number or vat number already exists"
    );
  }

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
    await setupCompanyDefaults(createdCompany, isPlaygroundTeam);
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
export async function setupCompanyDefaults(company: Company, isPlayground: boolean): Promise<void> {
  await createCompanyDocumentType({
    companyId: company.id,
    docTypeId: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
    processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
  }, isPlayground || !company.isSmpRecipient);
  await createCompanyDocumentType({
    companyId: company.id,
    docTypeId: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
    processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
  }, isPlayground || !company.isSmpRecipient);

  const countryInfo = COUNTRIES.find((country) => country.code === company.country);
  if (countryInfo?.defaultEnterpriseNumberScheme) {
    await createCompanyIdentifier({
      companyId: company.id,
      scheme: countryInfo.defaultEnterpriseNumberScheme,
      identifier: cleanEnterpriseNumber(company.enterpriseNumber)!,
    }, isPlayground || !company.isSmpRecipient);
  }
  const cleanedVatNumber = cleanVatNumber(company.vatNumber);
  if (countryInfo?.defaultVatScheme && cleanedVatNumber) {
    await createCompanyIdentifier({
      companyId: company.id,
      scheme: countryInfo.defaultVatScheme,
      identifier: cleanedVatNumber,
    }, isPlayground || !company.isSmpRecipient);
  }
}

export async function updateCompany(
  company: Partial<InsertCompany> & { id: string; teamId: string }
): Promise<Company> {
  const oldCompany = await getCompany(company.teamId, company.id);
  if (!oldCompany) {
    throw new UserFacingError("Company not found");
  }

  const isPlaygroundTeam = await isPlayground(company.teamId);

  // Merge with existing company data, only updating provided fields
  const updatedFields = Object.fromEntries(
    Object.entries(company).filter(([_, value]) => value !== undefined)
  );
  const mergedCompany = {
    ...oldCompany,
    ...updatedFields,
  } as InsertCompany & { id: string };

  // Check if there exists a company with the same enterprise number or vat number
  if (
    !await canUpsertCompany(
      mergedCompany.enterpriseNumber,
      mergedCompany.vatNumber,
      company.id,
      company.teamId,
      isPlaygroundTeam
    )
  ) {
    throw new UserFacingError(
      "Company with this enterprise number or vat number already exists"
    );
  }

  const updatedCompany = await db
    .update(companies)
    .set(updatedFields)
    .where(
      and(eq(companies.teamId, company.teamId), eq(companies.id, company.id))
    )
    .returning()
    .then((rows) => rows[0]);

  if (!(await isPlayground(company.teamId)) && oldCompany.isSmpRecipient !== updatedCompany.isSmpRecipient) {
    if (updatedCompany.isSmpRecipient) {
      try {
        await upsertCompanyRegistrations(updatedCompany.id);
      } catch (error) {
        // If registration fails, unregister any company registrations that might have been registered
        await unregisterCompanyRegistrations(updatedCompany.id);
        // Also rollback the update of the company
        await db.update(companies).set(oldCompany).where(eq(companies.id, company.id));
        throw error;
      }
    } else {
      await unregisterCompanyRegistrations(updatedCompany.id);
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

export async function deleteCompany(
  teamId: string,
  companyId: string
): Promise<void> {
  const company = await db
    .select()
    .from(companies)
    .where(and(eq(companies.teamId, teamId), eq(companies.id, companyId)))
    .then((rows) => rows[0]);
  if (!company) {
    throw new Error("Company not found");
  }
  if (!(await isPlayground(teamId)) && company.isSmpRecipient) {
    await unregisterCompanyRegistrations(companyId);
  }
  await db
    .delete(companies)
    .where(and(eq(companies.teamId, teamId), eq(companies.id, companyId)));
}

/**
 * Check if a company can be upserted.
 * Whether a company can be upserted depends on whether we're in a playground or production context:
 * - In a playground context, we can upsert a company with an enterprise number or vat number as long as it doesn't already exist on the same playground team.
 * - In a production context, we can upsert a company with an enterprise number or vat number as long as it is not already registered as a production company.
 * @param enterpriseNumber The enterprise number of the company
 * @param vatNumber The vat number of the company
 * @param currentCompanyId The ID of the current company, so we can exclude it from the check in update operations
 * @param teamId The ID of the team
 * @param isPlaygroundTeam Whether the team is a playground team
 * @returns Whether the company can be upserted
 */
async function canUpsertCompany(
  enterpriseNumber: string,
  vatNumber: string | undefined | null,
  currentCompanyId: string | undefined,
  teamId: string,
  isPlaygroundTeam: boolean
): Promise<boolean> {
  return await db
    .select()
    .from(companies)
    .leftJoin(teamExtensions, eq(companies.teamId, teamExtensions.id))
    .where(
      and(
        currentCompanyId ? ne(companies.id, currentCompanyId) : undefined, // Exclude the current company from the check
        or(
          eq(companies.teamId, teamId), // Include all companies on the same team
          isPlaygroundTeam
            ? undefined
            : or(
              // Include all production companies when not on a playground team
              isNull(teamExtensions.isPlayground),
              eq(teamExtensions.isPlayground, false)
            )
        ),
        or(
          // Check for the enterprise number or vat number
          eq(companies.enterpriseNumber, enterpriseNumber),
          vatNumber ? eq(companies.vatNumber, vatNumber) : undefined
        )
      )
    )
    .then((rows) => rows.length === 0);
}
