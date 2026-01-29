import type { billingProfiles } from "@peppol/db/schema";
import type { SubscriptionBillingLine, TeamBillingResultSubscriptionBase } from "./billing-types";
import type { TeamBillingResult } from "./billing-types";

export function generateTeamBillingResult(x: SubscriptionBillingLine, billingProfile?: typeof billingProfiles.$inferSelect, params: Partial<TeamBillingResult> = {}): TeamBillingResultSubscriptionBase {
    return {
      ...(billingProfile ? {
        billingProfileId: billingProfile.id,
        billingProfileStanding: billingProfile.profileStanding,
        isManuallyBilled: billingProfile.isManuallyBilled,
        companyName: billingProfile.companyName,
        companyStreet: billingProfile.address,
        companyPostalCode: billingProfile.postalCode,
        companyCity: billingProfile.city,
        companyCountry: billingProfile.country,
        companyVatNumber: billingProfile.vatNumber,
      } : {}),
      subscriptionId: x.subscriptionId,
      subscriptionStartDate: x.subscriptionStartDate.toISOString(),
      subscriptionEndDate: x.subscriptionEndDate?.toISOString() ?? null,
      subscriptionLastBilledAt: x.subscriptionLastBilledAt,
      planId: x.planId,
      includedMonthlyDocuments: x.includedMonthlyDocuments,
      basePrice: x.basePrice,
      incomingDocumentOveragePrice: x.incomingDocumentOveragePrice,
      outgoingDocumentOveragePrice: x.outgoingDocumentOveragePrice,
      lineTotalExcl: x.lineTotalExcl,
      billingPeriodStart: x.billingPeriodStart.toISOString(),
      billingPeriodEnd: x.billingPeriodEnd.toISOString(),
      usedQty: x.usedQty,
      usedQtyIncoming: x.usedQtyIncoming,
      usedQtyOutgoing: x.usedQtyOutgoing,
      overageQtyIncoming: x.overageQtyIncoming,
      overageQtyOutgoing: x.overageQtyOutgoing,
      ...params,
    }
  }