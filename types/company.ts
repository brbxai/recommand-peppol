import { z } from "zod";
import { zodValidCountryCodes } from "../db/schema";

export type Company = {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  country: z.infer<typeof zodValidCountryCodes>;
  enterpriseNumber: string | null;
  vatNumber: string | null;
  isSmpRecipient: boolean;
  isOutgoingDocumentValidationEnforced: boolean;
};

export type CompanyFormData = Omit<Company, 'id'>;

export const defaultCompanyFormData: CompanyFormData = {
  name: "",
  address: "",
  postalCode: "",
  city: "",
  country: "BE",
  enterpriseNumber: null,
  vatNumber: null,
  isSmpRecipient: true,
  isOutgoingDocumentValidationEnforced: true,
}; 