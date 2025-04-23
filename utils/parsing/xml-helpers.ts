export function getTextContent(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (value["#text"]) return value["#text"].toString();
  return "";
}

export function getNumberContent(value: any): string {
  if (!value) return "0";
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return value;
  if (value["#text"]) return value["#text"];
  return "0";
}

export function getPercentage(value: any): string {
  const percentage = getTextContent(value);
  if (!percentage) return "0";
  // Remove any non-numeric characters except decimal point
  const cleaned = percentage.replace(/[^0-9.]/g, '');
  return cleaned || "0";
}