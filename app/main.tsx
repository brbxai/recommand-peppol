import React, { useEffect } from "react";
import { CreditCard, Building, History, Webhook } from "lucide-react";
import { useMenuItemActions } from "@core/lib/menu-store";
import { useOnboardingActions } from "@core/lib/onboarding-store";
import BillingOnboarding from "@peppol/components/onboarding/billing";
import SubscriptionOnboarding from "@peppol/components/onboarding/subscription";

export default function Main({ children }: { children: React.ReactNode }) {
    const { registerMenuItem } = useMenuItemActions();
    const { registerOnboardingStep } = useOnboardingActions();

    useEffect(() => {
        registerMenuItem({
            id: "main.history",
            title: "Sent and received",
            icon: History,
            href: "/transmitted-documents",
        });

        registerMenuItem({
            id: "main.companies",
            title: "Companies",
            icon: Building,
            href: "/companies",
        });

        registerMenuItem({
            id: "user.billing.subscription",
            title: "Subscription",
            icon: CreditCard,
            href: "/billing/subscription",
        });

        registerMenuItem({
            id: "user.api.webhooks",
            title: "Webhooks",
            icon: Webhook,
            href: "/webhooks",
        });

        registerOnboardingStep({
            id: "peppol.subscription",
            scope: "team",
            title: "Pick a plan",
            description: "We offer a variety of plans, pick one that suits your needs.",
            render: ({ onComplete }) => {
                return <SubscriptionOnboarding onComplete={onComplete} />;
            },
        });

        registerOnboardingStep({
            id: "peppol.billing",
            scope: "team",
            title: "Create a billing profile",
            description: "A billing profile is required to get started.",
            render: ({ onComplete }) => {
                return <BillingOnboarding onComplete={onComplete} />;
            },
        });

    }, [registerMenuItem]);

    return children;
}
