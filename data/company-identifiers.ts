import { companies, companyIdentifiers, teamExtensions } from "@peppol/db/schema";
import { UserFacingError } from "@peppol/utils/util";
import { db } from "@recommand/db";
import { eq, and, asc, ne, or, isNull } from "drizzle-orm";
import { unregisterCompanyIdentifier, upsertCompanyRegistration } from "./phoss-smp";
import { getTeamExtensionAndCompanyByCompanyId } from "./teams";

export type CompanyIdentifier = typeof companyIdentifiers.$inferSelect;
export type InsertCompanyIdentifier = typeof companyIdentifiers.$inferInsert;

export const cleanScheme = (scheme: string): string => {
  const cleanScheme = scheme.toLowerCase().trim().replace(/[^0-9]/g, "");
  if(cleanScheme.length === 0){
    throw new UserFacingError("Invalid scheme. The scheme must be a non-empty string.");
  }
  return cleanScheme;
}

export const cleanIdentifier = (identifier: string): string => {
  const cleanIdentifier = identifier.toLowerCase().trim().replace(/[^a-zA-Z0-9\-._~]/g, "");
  if(cleanIdentifier.length === 0){
    throw new UserFacingError("Invalid identifier. The identifier must be a non-empty string.");
  }
  return cleanIdentifier;
}

export async function getCompanyIdentifiers(companyId: string): Promise<CompanyIdentifier[]> {
  return await db
    .select()
    .from(companyIdentifiers)
    .where(eq(companyIdentifiers.companyId, companyId))
    .orderBy(asc(companyIdentifiers.scheme), asc(companyIdentifiers.identifier));
}

export async function getCompanyIdentifier(
  companyId: string,
  identifierId: string
): Promise<CompanyIdentifier | undefined> {
  return await db
    .select()
    .from(companyIdentifiers)
    .where(
      and(
        eq(companyIdentifiers.companyId, companyId),
        eq(companyIdentifiers.id, identifierId)
      )
    )
    .then((rows) => rows[0]);
}

export async function getCompanyIdentifierBySchemeAndValue(
  companyId: string,
  scheme: string,
  identifier: string
): Promise<CompanyIdentifier | undefined> {
  return await db
    .select()
    .from(companyIdentifiers)
    .where(
      and(
        eq(companyIdentifiers.companyId, companyId),
        eq(companyIdentifiers.scheme, cleanScheme(scheme)),
        eq(companyIdentifiers.identifier, cleanIdentifier(identifier))
      )
    )
    .then((rows) => rows[0]);
}

export async function getSendingCompanyIdentifier(companyId: string): Promise<CompanyIdentifier> {
  const identifiers = await db
    .select()
    .from(companyIdentifiers)
    .where(and(eq(companyIdentifiers.companyId, companyId)))
    .orderBy(asc(companyIdentifiers.scheme))
    .limit(1);

  if(identifiers.length === 0){
    throw new UserFacingError("No sending company identifier found. Ensure you have added a company identifier to your company.");
  }

  return identifiers[0];
}

export async function createCompanyIdentifier(
  companyIdentifier: InsertCompanyIdentifier,
  skipSmpRegistration: boolean = false
): Promise<CompanyIdentifier> {
  const canUpsert = await canUpsertCompanyIdentifier(companyIdentifier.scheme, companyIdentifier.identifier, undefined, companyIdentifier.companyId);
  if(!canUpsert){
    throw new UserFacingError(
      `Company identifier with scheme '${companyIdentifier.scheme}' and value '${companyIdentifier.identifier}' already exists for this company`
    );
  }

  const createdIdentifier = await db
    .insert(companyIdentifiers)
    .values({
      companyId: companyIdentifier.companyId,
      scheme: cleanScheme(companyIdentifier.scheme),
      identifier: cleanIdentifier(companyIdentifier.identifier),
    })
    .returning()
    .then((rows) => rows[0]);

  if(!skipSmpRegistration){
    await upsertCompanyRegistration(companyIdentifier.companyId, createdIdentifier);
  }

  return createdIdentifier;
}

export async function updateCompanyIdentifier(
  companyIdentifier: InsertCompanyIdentifier & { id: string },
  skipSmpRegistration: boolean = false
): Promise<CompanyIdentifier> {
  const oldIdentifier = await getCompanyIdentifier(
    companyIdentifier.companyId,
    companyIdentifier.id
  );
  
  if (!oldIdentifier) {
    throw new UserFacingError("Company identifier not found");
  }

  // Check if the company identifier can be upserted
  const canUpsert = await canUpsertCompanyIdentifier(companyIdentifier.scheme, companyIdentifier.identifier, companyIdentifier.id, companyIdentifier.companyId);
  if (!canUpsert) {
    throw new UserFacingError(
      `Company identifier with scheme '${companyIdentifier.scheme}' and value '${companyIdentifier.identifier}' already exists for this company`
    );
  }

  // Return if there is no change (taking lowercase into account)
  if(oldIdentifier.scheme === cleanScheme(companyIdentifier.scheme) && oldIdentifier.identifier === cleanIdentifier(companyIdentifier.identifier)){
    return oldIdentifier;
  }

  const updatedIdentifier = await db
    .update(companyIdentifiers)
    .set({
      scheme: cleanScheme(companyIdentifier.scheme),
      identifier: cleanIdentifier(companyIdentifier.identifier),
    })
    .where(
      and(
        eq(companyIdentifiers.companyId, companyIdentifier.companyId),
        eq(companyIdentifiers.id, companyIdentifier.id)
      )
    )
    .returning()
    .then((rows) => rows[0]);

  if(!skipSmpRegistration){
    await unregisterCompanyIdentifier(oldIdentifier); // Unregister the old identifier
    await upsertCompanyRegistration(companyIdentifier.companyId, updatedIdentifier); // Register the new identifier
  }

  return updatedIdentifier;
}

export async function deleteCompanyIdentifier(
  companyId: string,
  identifierId: string,
  skipSmpRegistration: boolean = false
): Promise<void> {
  const identifier = await getCompanyIdentifier(companyId, identifierId);
  if (!identifier) {
    throw new UserFacingError("Company identifier not found");
  }

  await db
    .delete(companyIdentifiers)
    .where(
      and(
        eq(companyIdentifiers.companyId, companyId),
        eq(companyIdentifiers.id, identifierId)
      )
    );

  if(!skipSmpRegistration){
    await unregisterCompanyIdentifier(identifier);
  }
}

/**
 * Check if a company identifier can be upserted.
 * Whether a company identifier can be upserted depends on whether we're in a playground or production context:
 * - In a playground context, we can upsert a company identifier as long as it doesn't already exist on the same playground team.
 * - In a production context, we can upsert a company identifier as long as it is not already registered with a production company.
 * @param scheme 
 * @param identifier 
 * @param currentIdentifierId 
 * @param companyId
 * @returns 
 */
async function canUpsertCompanyIdentifier(scheme: string, identifier: string, currentIdentifierId: string | undefined, companyId: string): Promise<boolean> {
  const teamInfo = await getTeamExtensionAndCompanyByCompanyId(companyId);
  if(!teamInfo){
    console.error("Company is not associated with a team", companyId);
    // This should never happen, a company is always associated with a team
    throw new Error("Company is not associated with a team");
  }
  const isPlaygroundTeam = teamInfo.teamExtension?.isPlayground ?? false;
  return await db
    .select()
    .from(companyIdentifiers)
    .innerJoin(companies, eq(companies.id, companyIdentifiers.companyId))
    .leftJoin(teamExtensions, eq(companies.teamId, teamExtensions.id))
    .where(
      and(
        currentIdentifierId ? ne(companyIdentifiers.id, currentIdentifierId) : undefined, // Exclude the current identifier from the check
        or(
          eq(companies.teamId, teamInfo.company.teamId), // Include all companies on the same team
          isPlaygroundTeam
            ? undefined
            : or(
              // Include all production companies when not on a playground team
              isNull(teamExtensions.isPlayground),
              eq(teamExtensions.isPlayground, false)
            )
        ),
        // The identifier and scheme must be the same for there to be a match
        and(
          eq(companyIdentifiers.scheme, scheme.toLowerCase().trim()),
          eq(companyIdentifiers.identifier, identifier.toLowerCase().trim()),
        )
      )
    )
    .then((rows) => rows.length === 0);
}