import { companies, teamExtensions } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and, or, isNull, ne } from "drizzle-orm";
import { registerCompany, unregisterCompany } from "./phoss-smp";
import {
  cleanEnterpriseNumber,
  cleanVatNumber,
  UserFacingError,
} from "@peppol/utils/util";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { isPlayground } from "./teams";

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
export async function getCompanyByPeppolId(peppolId: string, playgroundTeamId?: string): Promise<Company> {
  // The peppolId might start with iso6523-actorid-upis::
  if (peppolId.startsWith("iso6523-actorid-upis::")) {
    peppolId = peppolId.split("::")[1];
  }

  // The peppolId is in the format of 0208:0659689080 (0208 for enterprise number, 9925 for vat number)
  if (peppolId.startsWith("0208:")) {
    const enterpriseNumber = cleanEnterpriseNumber(peppolId.split(":")[1]);
    if (!enterpriseNumber) {
      throw new Error(`Invalid peppolId enterprise number (${peppolId})`);
    }
    return await db
      .select()
      .from(companies)
      .leftJoin(teamExtensions, eq(companies.teamId, teamExtensions.id))
      .where(
        and(
          eq(companies.enterpriseNumber, enterpriseNumber),
          playgroundTeamId ? eq(companies.teamId, playgroundTeamId) : or(isNull(teamExtensions.isPlayground), eq(teamExtensions.isPlayground, false))
        )
      )
      .then((rows) => rows[0].peppol_companies);
  } else if (peppolId.startsWith("9925:")) {
    const vatNumber = cleanVatNumber(peppolId.split(":")[1]);
    if (!vatNumber) {
      throw new Error(`Invalid peppolId vat number (${peppolId})`);
    }
    return await db
      .select()
      .from(companies)
      .leftJoin(teamExtensions, eq(companies.teamId, teamExtensions.id))
      .where(
        and(
          eq(companies.vatNumber, vatNumber),
          playgroundTeamId ? eq(companies.teamId, playgroundTeamId) : or(isNull(teamExtensions.isPlayground), eq(teamExtensions.isPlayground, false))
        )
      )
      .then((rows) => rows[0].peppol_companies);
  } else {
    throw new Error(`Invalid peppolId (${peppolId})`);
  }
}

export async function createCompany(company: InsertCompany): Promise<Company> {
  const isPlaygroundTeam = await isPlayground(company.teamId);

  // Check if there exists a company with the same enterprise number or vat number
  if (
    await canUpsertCompany(
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

  // If the company is in a playground team, don't affect the SMP
  if (isPlaygroundTeam) {
    return createdCompany;
  }

  try {
    if (createdCompany.isSmpRecipient) {
      await registerCompany(createdCompany);
    } else {
      await unregisterCompany(createdCompany);
    }
    sendSystemAlert(
      "Company Created",
      `Company ${createdCompany.name} has been created. It is ${createdCompany.isSmpRecipient ? "registered as an SMP recipient" : "not registered as an SMP recipient"}.`
    );
  } catch (error) {
    await db.delete(companies).where(eq(companies.id, createdCompany.id));
    sendSystemAlert(
      "Company Creation Failed",
      `Company ${createdCompany.name} could not be created. Error: \`\`\`\n${error}\n\`\`\``
    );
    throw error;
  }

  return createdCompany;
}

export async function updateCompany(
  company: InsertCompany & { id: string }
): Promise<Company> {
  const oldCompany = await getCompany(company.teamId, company.id);
  if (!oldCompany) {
    throw new UserFacingError("Company not found");
  }

  const isPlaygroundTeam = await isPlayground(company.teamId);

  // Check if there exists a company with the same enterprise number or vat number
  if (
    await canUpsertCompany(
      company.enterpriseNumber,
      company.vatNumber,
      company.id,
      company.teamId,
      isPlaygroundTeam
    )
  ) {
    throw new UserFacingError(
      "Company with this enterprise number or vat number already exists"
    );
  }

  // If the team is a playground team, we don't affect the SMP
  if (!isPlaygroundTeam) {
    const didIdentifierChange =
      oldCompany?.enterpriseNumber !== company.enterpriseNumber ||
      oldCompany?.vatNumber !== company.vatNumber;

    if (didIdentifierChange) {
      // Always unregister the old company registration first
      await unregisterCompany(oldCompany);
    }

    if (company.isSmpRecipient) {
      await registerCompany(company);
    } else if (!didIdentifierChange) {
      // Unregister if the identifier didn't change, otherwise just don't register
      await unregisterCompany(company);
    }
  }

  const updatedCompany = await db
    .update(companies)
    .set(company)
    .where(
      and(eq(companies.teamId, company.teamId), eq(companies.id, company.id))
    )
    .returning()
    .then((rows) => rows[0]);

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
  if (!(await isPlayground(teamId))) {
    await unregisterCompany(company);
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
export async function canUpsertCompany(
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
          isPlaygroundTeam ? undefined : or( // Don't check production companies when on a playground team
            // Include all production companies when not on a playground team
            isNull(teamExtensions.isPlayground),
            eq(teamExtensions.isPlayground, false)
          ),
        ),
        or(
          // Check for the enterprise number or vat number
          eq(companies.enterpriseNumber, enterpriseNumber),
          vatNumber ? eq(companies.vatNumber, vatNumber) : undefined
        )
      )
    )
    .then((rows) => rows.length > 0);
}
