import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import type { IntegrationConfigurationField } from "@peppol/types/integration";

export default function NumberField({
    field,
    value,
    onChange,
    required,
    title,
    description,
}: {
    field: IntegrationConfigurationField & { type: "number" };
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    required: boolean;
    title: string;
    description: string;
}) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        if (inputValue === "") {
            onChange(undefined);
        } else {
            const numValue = parseFloat(inputValue);
            if (!isNaN(numValue)) {
                onChange(numValue);
            }
        }
    };

    return (
        <div className="space-y-2">
            <Label htmlFor={field.id}>
                {title}
                {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
                id={field.id}
                type="number"
                value={value === undefined ? "" : value}
                onChange={handleChange}
                required={required}
            />
            {description && (
                <p className="text-xs text-pretty text-muted-foreground">{description}</p>
            )}
        </div>
    );
}
