import { z } from "zod";
import { zodValidCountryCodes } from "../db/schema";

export type Company = {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  country: z.infer<typeof zodValidCountryCodes>;
  enterpriseNumberScheme: string | null;
  enterpriseNumber: string | null;
  vatNumber: string | null;
  email: string | null;
  phone: string | null;
  isSmpRecipient: boolean;
  isVerified: boolean;
};

export type CompanyFormData = Omit<Company, 'id'>;

export const defaultCompanyFormData: CompanyFormData = {
  name: "",
  address: "",
  postalCode: "",
  city: "",
  country: "BE",
  enterpriseNumberScheme: null,
  enterpriseNumber: null,
  vatNumber: null,
  email: null,
  phone: null,
  isSmpRecipient: true,
  isVerified: false,
}; 