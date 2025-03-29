import React, { useEffect } from "react";
import { Paperclip, LogOut, User, Settings, Bell, CreditCard } from "lucide-react";
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

        // User menu items - Account group
        registerMenuItem({
            id: 'user.profile',
            title: "Profile",
            icon: User,
            onClick: () => {
                toast.success("Opening profile...");
            }
        });

        registerMenuItem({
            id: 'user.settings',
            title: "Settings",
            icon: Settings,
            onClick: () => {
                toast.success("Opening settings...");
            }
        });

        // User menu items - Notifications group
        registerMenuItem({
            id: 'user.notifications.bell',
            title: "Notifications",
            icon: Bell,
            onClick: () => {
                toast.success("Opening notifications...");
            }
        });

        // User menu items - Billing group
        registerMenuItem({
            id: 'user.billing.payment',
            title: "Payment",
            icon: CreditCard,
            onClick: () => {
                toast.success("Opening payment...");
            }
        });

        // User menu items - Session group
        registerMenuItem({
            id: 'user.session.logout',
            title: "Log out",
            icon: LogOut,
            onClick: () => {
                toast.success("Logging out...");
            }
        });

    }, [registerMenuItem]);

    return children;
}




