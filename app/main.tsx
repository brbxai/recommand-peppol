import React, { useEffect } from "react";
import { CreditCard, Paperclip } from "lucide-react";
import { useMenuItemActions } from "@core/lib/menu-store";
import { toast } from "@core/components/ui/sonner";

export default function Main({ children }: { children: React.ReactNode }) {
    const { registerMenuItem } = useMenuItemActions();
    
    useEffect(() => {
        // Main menu items
        registerMenuItem({
            id: 'main.peppol',
            title: "Peppol",
            icon: Paperclip,
            href: "/peppol",
        });

        // Sub item
        registerMenuItem({
            id: 'main.peppol.peppols',
            title: "Peppol sub",
            icon: Paperclip,
            onClick: () => {
                toast.success("Clicked Peppol sub");
            }
        });

        // Test sub item for todo module
        registerMenuItem({
            id: 'main.todo.list',
            title: "Todo list",
            icon: Paperclip,
            onClick: () => {
                toast.success("Clicked Todo list registered from peppol module");
            }
        });
        
        registerMenuItem({
            id: 'main.peppols',
            title: "Peppols",
            icon: Paperclip,
            onClick: () => {
                toast.success("Clicked Peppols");
            }
        });

        registerMenuItem({
            id: 'user.billing.subscription',
            title: "Subscription",
            icon: CreditCard,
            href: "/billing/subscription",
        });

    }, [registerMenuItem]);

    return children;
}




