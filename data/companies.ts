import { companies } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and } from "drizzle-orm";
import { registerCompany, unregisterCompany } from "./phoss-smp";
import { cleanEnterpriseNumber, cleanVatNumber } from "@peppol/utils/util";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";

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

export async function getCompanyByPeppolId(peppolId: string): Promise<Company> {
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
      .where(eq(companies.enterpriseNumber, enterpriseNumber))
      .then((rows) => rows[0]);
  } else if (peppolId.startsWith("9925:")) {
    const vatNumber = cleanVatNumber(peppolId.split(":")[1]);
    if (!vatNumber) {
      throw new Error(`Invalid peppolId vat number (${peppolId})`);
    }
    return await db
      .select()
      .from(companies)
      .where(eq(companies.vatNumber, vatNumber))
      .then((rows) => rows[0]);
  } else {
    throw new Error(`Invalid peppolId (${peppolId})`);
  }
}

export async function createCompany(company: InsertCompany): Promise<Company> {
  const createdCompany = await db
    .insert(companies)
    .values(company)
    .returning()
    .then((rows) => rows[0]);

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
  if (company.isSmpRecipient) {
    await registerCompany(company);
  } else {
    await unregisterCompany(company);
  }

  const updatedCompany = await db
    .update(companies)
    .set(company)
    .where(
      and(eq(companies.teamId, company.teamId), eq(companies.id, company.id))
    )
    .returning()
    .then((rows) => rows[0]);

  sendSystemAlert(
    "Company Updated",
    `Company ${updatedCompany.name} has been updated. It is ${updatedCompany.isSmpRecipient ? "registered as an SMP recipient" : "not registered as an SMP recipient"}.`
  );

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
