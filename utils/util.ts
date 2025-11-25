export function cleanVatNumber(vatNumber: string | undefined | null) {
  if (!vatNumber) return undefined;
  // Replace every non-alphanumeric character with an empty string, transform to uppercase
  return vatNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function cleanEnterpriseNumber(enterpriseNumber: string | undefined | null) {
  if (!enterpriseNumber) return undefined;
  // Replace every non-alphanumeric character with an empty string
  return enterpriseNumber.replace(/[^a-zA-Z0-9]/g, "");
}

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function createCleanUrl(parts: string[]) {
  // Remove trailing slash from each part
  const cleanParts = parts.map(part => part.replace(/\/$/, ""));
  return cleanParts.join("/");
}