import { companies } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and } from "drizzle-orm";
import { registerCompany, unregisterCompany } from "./phoss-smp";

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

export async function createCompany(company: InsertCompany): Promise<Company> {
  const createdCompany = await db
    .insert(companies)
    .values(company)
    .returning()
    .then((rows) => rows[0]);

  try {
    await registerCompany(createdCompany);
  } catch (error) {
    await db
      .delete(companies)
      .where(eq(companies.id, createdCompany.id));
    throw error;
  }

  return createdCompany;
}

export async function updateCompany(
  company: InsertCompany & { id: string }
): Promise<Company> {
  await registerCompany(company);

  const updatedCompany = await db
    .update(companies)
    .set(company)
    .where(
      and(eq(companies.teamId, company.teamId), eq(companies.id, company.id))
    )
    .returning()
    .then((rows) => rows[0]);

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
  await unregisterCompany(company);
  await db
    .delete(companies)
    .where(and(eq(companies.teamId, teamId), eq(companies.id, companyId)));
}
