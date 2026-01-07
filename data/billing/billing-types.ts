import type { VatCategory } from "@peppol/utils/parsing/invoice/schemas";
import type { BillingConfig } from "../plans";

export const ERROR_TEAM_BILLING_RESULT: TeamBillingResult = {
  status: "error",
  isInvoiceSent: "?",
  isPaymentRequested: "?",
  message: "Unknown error",
  billingProfileId: "",
  isManuallyBilled: false,
  teamId: "",
  subscriptionId: "",
  companyName: "",
  companyStreet: "",
  companyPostalCode: "",
  companyCity: "",
  companyCountry: "",
  companyVatNumber: "",
  subscriptionStartDate: "",
  subscriptionEndDate: null,
  subscriptionLastBilledAt: null,
  planId: null,
  includedMonthlyDocuments: 0,
  basePrice: 0,
  incomingDocumentOveragePrice: 0,
  outgoingDocumentOveragePrice: 0,
  billingEventId: null,
  invoiceId: null,
  invoiceReference: null,
  lineTotalExcl: 0,
  totalAmountExcl: 0,
  vatCategory: "S",
  vatPercentage: 0,
  vatExemptionReason: null,
  vatAmount: 0,
  totalAmountIncl: 0,
  billingDate: "",
  billingPeriodStart: "",
  billingPeriodEnd: null,
  usedQty: 0,
  usedQtyIncoming: 0,
  usedQtyOutgoing: 0,
  overageQtyIncoming: 0,
  overageQtyOutgoing: 0,
}

export class TeamBillingResultError extends Error {
  public readonly teamBillingResult: TeamBillingResult[];
  constructor(message: string, teamBillingResult: Partial<TeamBillingResult>[]) {
    super(message);
    this.name = "TeamBillingResultError";
    this.teamBillingResult = teamBillingResult.map(x => ({
      ...ERROR_TEAM_BILLING_RESULT,
      message: message,
      ...x,
    }));
  }
}

export type SubscriptionBillingLine = {
  subscriptionId: string;
  billingConfig: BillingConfig;
  subscriptionStartDate: Date;
  subscriptionEndDate: Date | null;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  subscriptionLastBilledAt: string | null;
  planId: string | null;
  includedMonthlyDocuments: number;
  basePrice: number;
  incomingDocumentOveragePrice: number;
  outgoingDocumentOveragePrice: number;

  lineName: string;
  lineDescription: string;
  lineTotalExcl: number;
  usedQty: number;
  usedQtyIncoming: number;
  usedQtyOutgoing: number;
  overageQtyIncoming: number;
  overageQtyOutgoing: number;
}

export type TeamBillingResultSubscriptionBase = {
  subscriptionId: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string | null;
  subscriptionLastBilledAt: string | null;
  planId: string | null;
  includedMonthlyDocuments: number;
  basePrice: number;
  incomingDocumentOveragePrice: number;
  outgoingDocumentOveragePrice: number;
  lineTotalExcl: number;
  billingPeriodStart: string;
  billingPeriodEnd: string | null;
  usedQty: number;
  usedQtyIncoming: number;
  usedQtyOutgoing: number;
  overageQtyIncoming: number;
  overageQtyOutgoing: number;
}

export type TeamBillingResult = TeamBillingResultSubscriptionBase & {
  status: "success" | "error";
  isInvoiceSent: "x" | "?" | "";
  isPaymentRequested: "x" | "?" | "";
  message: string;
  billingProfileId: string;
  isManuallyBilled: boolean;
  teamId: string;
  companyName: string;
  companyStreet: string;
  companyPostalCode: string;
  companyCity: string;
  companyCountry: string;
  companyVatNumber: string | null;
  billingEventId: string | null;
  invoiceId: string | null;
  invoiceReference: number | null;
  totalAmountExcl: number | null;
  vatCategory: VatCategory;
  vatPercentage: number;
  vatExemptionReason: string | null;
  vatAmount: number | null;
  totalAmountIncl: number | null;
  billingDate: string;
}