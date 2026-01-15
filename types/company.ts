import type { CompanyResponse } from "../api/companies/shared";

export type Company = CompanyResponse;

export type CompanyFormData = Omit<Company, 'id' | 'teamId' | 'createdAt' | 'updatedAt' | 'outboundEmailSlug' | 'outboundEmailEnabled'>;

export const defaultCompanyFormData: CompanyFormData = {
  name: "",
  address: "",
  postalCode: "",
  city: "",
  country: "BE",
  enterpriseNumber: null,
  vatNumber: null,
  isSmpRecipient: true,
}; 