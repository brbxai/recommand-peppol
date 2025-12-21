import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import type { Integration } from "@peppol/types/integration";

export default function BearerAuthentication({
    integration,
    onChange,
}: {
    integration: Integration;
    onChange: (integration: Integration) => void;
}) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="token">Token</Label>
                <Input
                    id="token"
                    value={integration.configuration?.auth.token || ""}
                    onChange={(e) => onChange({ 
                        ...integration,
                        configuration: {
                            auth: { type: "bearer", token: e.target.value },
                            fields: integration.configuration?.fields || [],
                            capabilities: integration.configuration?.capabilities || []
                        }
                    })}
                    required
                />
                <p className="text-xs text-pretty text-muted-foreground">The token is used to authenticate the integration with the external service.</p>
            </div>
        </div>
    );
}