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
  sendEmailSlug: string | null;
  sendEmailEnabled: boolean;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CompanyFormData = Omit<Company, 'id' | 'teamId' | 'createdAt' | 'updatedAt' | 'sendEmailSlug' | 'sendEmailEnabled'>;

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