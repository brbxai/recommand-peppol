import { cleanEnterpriseNumber, cleanVatNumber } from "@peppol/utils/util";
import type { Company, InsertCompany } from "../companies";
import { deleteServiceGroup, registerServiceGroup } from "./service-group";
import { registerServiceMetadata } from "./service-metadata";
import { registerBusinessCard } from "./business-card";

const DOCUMENT_TYPE_CODES = [
  "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1"
]
const DOCUMENT_PROCESS_ID_CODES = [
  "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
]

export async function registerCompany(company: Company | InsertCompany) {
  
  const address = `${company.address}, ${company.postalCode} ${company.city}, ${company.country}`;

  // EAS 0208 - Enterprise Number
  const cleanedEnterpriseNumber = cleanEnterpriseNumber(company.enterpriseNumber)!;
  await registerServiceGroup("0208", cleanedEnterpriseNumber);
  await registerAllServiceMetadata("0208", cleanedEnterpriseNumber);
  await registerBusinessCard("0208", cleanedEnterpriseNumber, company.name, company.country, address, company.vatNumber);

  // EAS 9925 - VAT Number
  const cleanedVatNumber = cleanVatNumber(company.vatNumber);
  if (cleanedVatNumber) {
    await registerServiceGroup("9925", cleanedVatNumber);
    await registerAllServiceMetadata("9925", cleanedVatNumber);
    await registerBusinessCard("9925", cleanedVatNumber, company.name, company.country, address, company.vatNumber);
  }
  
}

export async function unregisterCompany(company: Company | InsertCompany) {
  // EAS 0208 - Enterprise Number
  const cleanedEnterpriseNumber = cleanEnterpriseNumber(company.enterpriseNumber)!;
  await deleteServiceGroup("0208", cleanedEnterpriseNumber);

  // EAS 9925 - VAT Number
  const cleanedVatNumber = cleanVatNumber(company.vatNumber);
  if (cleanedVatNumber) {
    await deleteServiceGroup("9925", cleanedVatNumber);
  }
}

async function registerAllServiceMetadata(
  peppolIdentifierEas: string,
  peppolIdentifierAddress: string,
) {
  for (const documentTypeCode of DOCUMENT_TYPE_CODES) {
    for (const documentProcessIdCode of DOCUMENT_PROCESS_ID_CODES) {
      await registerServiceMetadata(peppolIdentifierEas, peppolIdentifierAddress, documentTypeCode, documentProcessIdCode);
    }
  }
}
