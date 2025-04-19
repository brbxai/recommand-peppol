import React, { useEffect } from "react";
import { CreditCard, Building, History, Webhook } from "lucide-react";
import { useMenuItemActions } from "@core/lib/menu-store";

export default function Main({ children }: { children: React.ReactNode }) {
  const { registerMenuItem } = useMenuItemActions();

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
  }, [registerMenuItem]);

  return children;
}
