import type { Subscription } from "@peppol/data/subscriptions";

const paidPlanIds = ["starter", "professional", "enterprise"];

export function canUseIntegrations(
  isPlayground: boolean,
  subscription: Subscription | null
): boolean {
  if (isPlayground) {
    return true;
  }

  if (!subscription) {
    return false;
  }

  return subscription.planId !== null && paidPlanIds.includes(subscription.planId);
}

export function canUseCustomDomains(
  isPlayground: boolean,
  subscription: Subscription | null
): boolean {
  if (isPlayground) {
    return true;
  }

  if (!subscription) {
    return false;
  }

  return subscription.planId !== null && paidPlanIds.includes(subscription.planId);
}

