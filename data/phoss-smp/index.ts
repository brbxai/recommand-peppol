import { UserFacingError } from "@peppol/utils/util";
import { getCompanyById, type Company, type InsertCompany } from "../companies";
import { deleteServiceGroup, migrateParticipantToOurSMP, registerServiceGroup } from "./service-group";
import { deleteServiceMetadata, registerServiceMetadata } from "./service-metadata";
import { registerBusinessCard } from "./business-card";
import { getMigrationToken } from "../hermes";
import { getCompanyIdentifiers, type CompanyIdentifier } from "../company-identifiers";
import { getCompanyDocumentTypes, type CompanyDocumentType } from "../company-document-types";

export async function upsertCompanyRegistrations(companyId: string) {
  const company = await getCompanyById(companyId);
  if(company && !company.isSmpRecipient){
    return;
  }
  const identifiers = await getCompanyIdentifiers(companyId);
  const documentTypes = await getCompanyDocumentTypes(companyId);
  if(!company || !identifiers || !documentTypes){
    throw new UserFacingError("Company or identifiers or document types not found, could not upsert company registration");
  }

  for (const identifier of identifiers) {
    await registerCompanyIdentifier(company, identifier, documentTypes);
  }
}

export async function unregisterCompanyRegistrations(companyId: string) {
  const identifiers = await getCompanyIdentifiers(companyId);
  if(!identifiers){
    throw new UserFacingError("Identifiers not found, could not unregister company registration");
  }

  for (const identifier of identifiers) {
    await unregisterCompanyIdentifier(identifier);
  }
}

export async function upsertCompanyRegistration(companyId: string, identifier: CompanyIdentifier) {
  const company = await getCompanyById(companyId);
  const documentTypes = await getCompanyDocumentTypes(companyId);
  if(!company || !documentTypes){
    throw new UserFacingError("Company or document types not found, could not upsert company registration");
  }

  await registerCompanyIdentifier(company, identifier, documentTypes);
}

export async function unregisterCompanyDocumentType(documentType: CompanyDocumentType) {
  const identifiers = await getCompanyIdentifiers(documentType.companyId);

  for (const identifier of identifiers) {
    await deleteServiceMetadata(identifier.scheme, identifier.identifier, documentType.docTypeId);
  }
}

export async function registerCompanyIdentifier(company: Company | InsertCompany, identifier: CompanyIdentifier, documentTypes: CompanyDocumentType[]) {

  if(!company.isSmpRecipient){
    return;
  }

  const address = `${company.address}, ${company.postalCode} ${company.city}, ${company.country}`;
  try{
    await registerServiceGroup(identifier.scheme, identifier.identifier);
  }catch(error){
    if(identifier.scheme === "0208"){
      // The company might be registered in Hermes already, try to migrate it to our SMP
      const migrationToken = await getMigrationToken(identifier.identifier);
      await migrateParticipantToOurSMP(identifier.scheme, identifier.identifier, migrationToken);
    } else {
      throw error;
    }
  }

  for (const documentType of documentTypes) {
    await registerServiceMetadata(identifier.scheme, identifier.identifier, documentType.docTypeId, documentType.processId);
  }

  await registerBusinessCard(identifier.scheme, identifier.identifier, company.name, company.country, address, company.vatNumber);

}

export async function unregisterCompanyIdentifier(identifier: CompanyIdentifier) {
  await deleteServiceGroup(identifier.scheme, identifier.identifier);
}