export type Representative = {
  firstName: string;
  lastName: string;
  function: string;
  beginDate: string;
  endDate?: string;
};

export type CompanyAddress = {
  street: string;
  number: string;
  postalCode: string;
  city: string;
  country: string;
};

export type CompanyType = {
  juridicalForm: {
    code: string;
    description: string;
    beginDate: string;
  };
  denomination: {
    code: string;
    description: string;
    beginDate: string;
  };
};

export type EnterpriseData = {
  enterpriseNumber: string;
  beginDate: string;
  address: CompanyAddress;
  companyType: CompanyType;
  representatives: Representative[];
};
