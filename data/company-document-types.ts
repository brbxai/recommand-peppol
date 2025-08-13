import { companyDocumentTypes } from "@peppol/db/schema";
import { UserFacingError } from "@peppol/utils/util";
import { db } from "@recommand/db";
import { eq, and } from "drizzle-orm";
import { unregisterCompanyDocumentType, upsertCompanyRegistrations } from "./phoss-smp";

export type CompanyDocumentType = typeof companyDocumentTypes.$inferSelect;
export type InsertCompanyDocumentType = typeof companyDocumentTypes.$inferInsert;

export async function getCompanyDocumentTypes(companyId: string): Promise<CompanyDocumentType[]> {
  return await db
    .select()
    .from(companyDocumentTypes)
    .where(eq(companyDocumentTypes.companyId, companyId));
}

export async function getCompanyDocumentType(
  companyId: string,
  documentTypeId: string
): Promise<CompanyDocumentType | undefined> {
  return await db
    .select()
    .from(companyDocumentTypes)
    .where(
      and(
        eq(companyDocumentTypes.companyId, companyId),
        eq(companyDocumentTypes.id, documentTypeId)
      )
    )
    .then((rows) => rows[0]);
}

export async function getCompanyDocumentTypeByDocTypeAndProcess(
  companyId: string,
  docTypeId: string,
  processId: string
): Promise<CompanyDocumentType | undefined> {
  return await db
    .select()
    .from(companyDocumentTypes)
    .where(
      and(
        eq(companyDocumentTypes.companyId, companyId),
        eq(companyDocumentTypes.docTypeId, docTypeId),
        eq(companyDocumentTypes.processId, processId)
      )
    )
    .then((rows) => rows[0]);
}

export async function createCompanyDocumentType(
  companyDocumentType: InsertCompanyDocumentType,
  skipSmpRegistration: boolean = false
): Promise<CompanyDocumentType> {
  // Check if there already exists a document type with the same docTypeId and processId for this company
  const existingDocumentType = await getCompanyDocumentTypeByDocTypeAndProcess(
    companyDocumentType.companyId,
    companyDocumentType.docTypeId,
    companyDocumentType.processId
  );

  if (existingDocumentType) {
    throw new UserFacingError(
      `Company document type with docTypeId '${companyDocumentType.docTypeId}' and processId '${companyDocumentType.processId}' already exists for this company`
    );
  }

  const createdDocumentType = await db
    .insert(companyDocumentTypes)
    .values(companyDocumentType)
    .returning()
    .then((rows) => rows[0]);

  if(!skipSmpRegistration){
    await upsertCompanyRegistrations(companyDocumentType.companyId);
  }

  return createdDocumentType;
}

export async function updateCompanyDocumentType(
  companyDocumentType: InsertCompanyDocumentType & { id: string },
  skipSmpRegistration: boolean = false
): Promise<CompanyDocumentType> {
  const oldDocumentType = await getCompanyDocumentType(
    companyDocumentType.companyId,
    companyDocumentType.id
  );
  
  if (!oldDocumentType) {
    throw new UserFacingError("Company document type not found");
  }

  // Check if there already exists another document type with the same docTypeId and processId for this company
  const existingDocumentType = await getCompanyDocumentTypeByDocTypeAndProcess(
    companyDocumentType.companyId,
    companyDocumentType.docTypeId,
    companyDocumentType.processId
  );

  if (existingDocumentType && existingDocumentType.id !== companyDocumentType.id) {
    throw new UserFacingError(
      `Company document type with docTypeId '${companyDocumentType.docTypeId}' and processId '${companyDocumentType.processId}' already exists for this company`
    );
  }

  // Return if there is no change
  if(oldDocumentType.docTypeId === companyDocumentType.docTypeId && oldDocumentType.processId === companyDocumentType.processId){
    return oldDocumentType;
  }

  const updatedDocumentType = await db
    .update(companyDocumentTypes)
    .set(companyDocumentType)
    .where(
      and(
        eq(companyDocumentTypes.companyId, companyDocumentType.companyId),
        eq(companyDocumentTypes.id, companyDocumentType.id)
      )
    )
    .returning()
    .then((rows) => rows[0]);

  if(!skipSmpRegistration){
    await unregisterCompanyDocumentType(oldDocumentType); // Unregister the old document type
    await upsertCompanyRegistrations(companyDocumentType.companyId); // Register the new document type
  }

  return updatedDocumentType;
}

export async function deleteCompanyDocumentType(
  companyId: string,
  documentTypeId: string,
  skipSmpRegistration: boolean = false
): Promise<void> {
  const documentType = await getCompanyDocumentType(companyId, documentTypeId);
  if (!documentType) {
    throw new UserFacingError("Company document type not found");
  }

  await db
    .delete(companyDocumentTypes)
    .where(
      and(
        eq(companyDocumentTypes.companyId, companyId),
        eq(companyDocumentTypes.id, documentTypeId)
      )
    );

  if(!skipSmpRegistration){
    await unregisterCompanyDocumentType(documentType);
  }
}
