export type Representative = {
  firstName: string | null;
  lastName: string | null;
  function: string | null;
  beginDate: string;
  endDate: string | null;
};

export type CompanyAddress = {
  street: string | null;
  number: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
};

export type CompanyType = {
  juridicalForm: {
    code: string | null;
    description: string | null;
    beginDate: string | null;
  } | null;
  denomination: {
    code: string | null;
    description: string | null;
    beginDate: string | null;
  } | null;
};

export type EnterpriseData = {
  enterpriseNumber: string;
  beginDate: string | null;
  address: CompanyAddress | null;
  companyType: CompanyType | null;
  representatives: Representative[];
};
