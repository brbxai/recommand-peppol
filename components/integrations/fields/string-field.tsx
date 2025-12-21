import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import type { IntegrationConfigurationField } from "@peppol/types/integration";

export default function StringField({
    field,
    value,
    onChange,
    required,
    title,
    description,
}: {
    field: IntegrationConfigurationField & { type: "string" };
    value: string;
    onChange: (value: string) => void;
    required: boolean;
    title: string;
    description: string;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={field.id}>
                {title}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
                id={field.id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
            />
            {description && (
                <p className="text-xs text-pretty text-muted-foreground">{description}</p>
            )}
        </div>
    );
}

