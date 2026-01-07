import type { SubscriptionBillingLine, TeamBillingResultSubscriptionBase } from "./billing-types";
import type { TeamBillingResult } from "./billing-types";

export function subscriptionBillingLineToTeamBillingResult(x: SubscriptionBillingLine, params: Partial<TeamBillingResult> = {}): TeamBillingResultSubscriptionBase {
    return {
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