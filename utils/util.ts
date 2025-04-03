export function cleanVatNumber(vatNumber: string | undefined | null) {
  if (!vatNumber) return undefined;
  // Replace every non-alphanumeric character with an empty string, transform to uppercase
  return vatNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function cleanEnterpriseNumber(enterpriseNumber: string | undefined | null) {
  if (!enterpriseNumber) return undefined;
  // Replace every non-numeric character with an empty string
  return enterpriseNumber.replace(/[^0-9]/g, "");
}
