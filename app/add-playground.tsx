import { useEffect, useState } from "react";
import { useMenuItemActions } from "@core/lib/menu-store";
import { ToyBrick } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@core/components/ui/dialog";
import { Label } from "@core/components/ui/label";
import { Input } from "@core/components/ui/input";
import { Button } from "@core/components/ui/button";
import { toast } from "@core/components/ui/sonner";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { useUserStore } from "@core/lib/user-store";
import { createPlayground } from "@peppol/lib/client/playgrounds";

export default function AddPlayground() {

    const { registerMenuItem } = useMenuItemActions();
    const [isOpen, setIsOpen] = useState(false);
    const [newPlaygroundName, setNewPlaygroundName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const fetchUser = useUserStore(x => x.fetchUser);
    const setActiveTeam = useUserStore(x => x.setActiveTeam);

    const handleCreatePlayground = async () => {
        if (isCreating) return;

        if (!newPlaygroundName.trim()) {
            toast.error("Please enter a name for the playground");
            return;
        }

        setIsCreating(true);
        try{
            const response = await createPlayground(newPlaygroundName.trim());
            if (!response.success) {
                toast.error(stringifyActionFailure(response.errors));
                return;
            }

            // Refresh the user data such that the new team is available and the onboarding steps are completed
            await fetchUser();

            setActiveTeam(response.playground.id);

            setIsOpen(false);
            setNewPlaygroundName("");
            toast.success("Playground created successfully");
        }catch(error){
            toast.error("Failed to create playground");
            console.error(error);
        } finally {
            setIsCreating(false);
        }
    };

    useEffect(() => {
        registerMenuItem({
            id: "team.add-playground",
            title: "Add playground",
            icon: ToyBrick,
            onClick: () => {
                setIsOpen(true);
            },
        });
    }, []);
    return <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add playground</DialogTitle>
                <DialogDescription>
                    Create a new playground to test your Peppol API integrations.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label>Playground name</Label>
                    <Input 
                        value={newPlaygroundName}
                        onChange={(e) => setNewPlaygroundName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleCreatePlayground();
                            }
                        }}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button onClick={handleCreatePlayground} disabled={isCreating || !newPlaygroundName.trim()}>Create playground</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>;
}