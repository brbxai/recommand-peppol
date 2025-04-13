import React, { useEffect } from "react";
import { CreditCard, Building, History } from "lucide-react";
import { useMenuItemActions } from "@core/lib/menu-store";
import { toast } from "@core/components/ui/sonner";

export default function Main({ children }: { children: React.ReactNode }) {
    const { registerMenuItem } = useMenuItemActions();
    
    useEffect(() => {
        registerMenuItem({
            id: 'main.history',
            title: "Sent and received",
            icon: History,
            href: "/transmitted-documents",
        });

        registerMenuItem({
            id: 'main.companies',
            title: "Companies",
            icon: Building,
            href: "/companies",
        });

        // registerMenuItem({
        //     id: 'main.peppol.peppols',
        //     title: "Peppol sub",
        //     icon: Paperclip,
        //     onClick: () => {
        //         toast.success("Clicked Peppol sub");
        //     }
        // });

        registerMenuItem({
            id: 'user.billing.subscription',
            title: "Subscription",
            icon: CreditCard,
            href: "/billing/subscription",
        });

    }, [registerMenuItem]);

    return children;
}




