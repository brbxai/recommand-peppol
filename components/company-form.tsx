import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { Button } from "@core/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@core/components/ui/select";
import type { Company } from "../app/(dashboard)/companies/page";
import { zodValidCountryCodes } from "../db/schema";
import { z } from "zod";

type CompanyFormProps = {
    company: Partial<Company>;
    onChange: (company: Partial<Company>) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    isEditing?: boolean;
};

export function CompanyForm({ company, onChange, onSubmit, onCancel, isEditing = false }: CompanyFormProps) {
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Company Name</Label>
                <Input
                    id="name"
                    value={company.name || ""}
                    onChange={(e) => onChange({ ...company, name: e.target.value })}
                    required
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                    id="address"
                    value={company.address || ""}
                    onChange={(e) => onChange({ ...company, address: e.target.value })}
                    required
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                        id="postalCode"
                        value={company.postalCode || ""}
                        onChange={(e) => onChange({ ...company, postalCode: e.target.value })}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                        id="city"
                        value={company.city || ""}
                        onChange={(e) => onChange({ ...company, city: e.target.value })}
                        required
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                    value={company.country || ""}
                    onValueChange={(value) => onChange({ ...company, country: value as z.infer<typeof zodValidCountryCodes> })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="BE">🇧🇪 Belgium</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number (Optional)</Label>
                <Input
                    id="vatNumber"
                    value={company.vatNumber || ""}
                    onChange={(e) => onChange({ ...company, vatNumber: e.target.value || null })}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="enterpriseNumber">Enterprise Number (Optional)</Label>
                <Input
                    id="enterpriseNumber"
                    value={company.enterpriseNumber || ""}
                    onChange={(e) => onChange({ ...company, enterpriseNumber: e.target.value })}
                />
            </div>
            <p className="text-sm text-balance text-muted-foreground">Either the VAT number or the enterprise number is required. If no enterprise number is provided, it will be inferred from the VAT number.</p>
            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                >
                    Cancel
                </Button>
                <Button type="submit">
                    {isEditing ? "Save Changes" : "Create Company"}
                </Button>
            </div>
        </form>
    );
} 