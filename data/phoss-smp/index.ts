import { UserFacingError } from "@peppol/utils/util";
import { getCompanyById, type Company, type InsertCompany } from "../companies";
import { deleteServiceGroup, migrateParticipantToOurSMP, registerServiceGroup } from "./service-group";
import { deleteServiceMetadata, registerServiceMetadata } from "./service-metadata";
import { registerBusinessCard } from "./business-card";
import { getMigrationToken } from "../hermes";
import { getCompanyIdentifiers, type CompanyIdentifier } from "../company-identifiers";
import { getCompanyDocumentTypes, type CompanyDocumentType } from "../company-document-types";
import { verifyRecipient } from "../recipient";

type MinimalCompanyIdentifier = {
  scheme: string;
  identifier: string;
}

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

export async function upsertCompanyRegistration(companyId: string, identifier: MinimalCompanyIdentifier) {
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

export async function registerCompanyIdentifier(company: Company | InsertCompany, identifier: MinimalCompanyIdentifier, documentTypes: CompanyDocumentType[]) {

  if(!company.isSmpRecipient){
    return;
  }

  const address = `${company.address}, ${company.postalCode} ${company.city}, ${company.country}`;
  try{
    await registerServiceGroup(identifier.scheme, identifier.identifier);
  }catch(error){
    try{
      if(identifier.scheme === "0208"){
        // The company might be registered in Hermes already, try to migrate it to our SMP
        const migrationToken = await getMigrationToken(identifier.identifier);
        await migrateParticipantToOurSMP(identifier.scheme, identifier.identifier, migrationToken);
      } else {
        throw error;
      }
    }catch(error){
      console.error(error);
      // Try to get the SMP hostnames so we can make a more descriptive error message
      let smpHostnames: string[] = [];
      try{
        const recipientVerification = await verifyRecipient(identifier.scheme + ":" + identifier.identifier);
        smpHostnames = recipientVerification.smpHostnames;
      }catch(error){
        // Ignore the error
      }
      if(smpHostnames.length > 0){
        throw new UserFacingError(`Failed to register company identifier ${identifier.scheme}:${identifier.identifier}, it might already be registered with another SMP (${smpHostnames.join(", ")}). Please revoke your registration with the other SMP and try again. Feel free to contact support@recommand.eu if you are unsure about how to proceed.`);
      }else{
        throw new UserFacingError(`Failed to register company identifier ${identifier.scheme}:${identifier.identifier}, it might already be registered with another SMP. Please ensure this is not the case. Feel free to contact support@recommand.eu if you are unsure about how to proceed.`);
      }
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