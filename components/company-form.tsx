import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { Button } from "@core/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@core/components/ui/select";
import type { Company } from "../types/company";
import { zodValidCountryCodes } from "../db/schema";
import { z } from "zod";
import { AsyncButton } from "@core/components/async-button";
import { Checkbox } from "@core/components/ui/checkbox";
import { COUNTRIES } from "@peppol/utils/countries";
import { Combobox } from "@core/components/ui/combobox";
import { ISO_ICD_SCHEME_IDENTIFIERS } from "@peppol/utils/iso-icd-scheme-identifiers";
import { Alert, AlertDescription, AlertTitle } from "@core/components/ui/alert";
import { AlertTriangle } from "lucide-react";

type CompanyFormProps = {
    company: Partial<Company>;
    onChange: (company: Partial<Company>) => void;
    onSubmit: () => Promise<void>;
    onCancel: () => void;
    isEditing?: boolean;
    showEnterpriseNumberForBelgianCompanies?: boolean;
};

export function CompanyForm({ company, onChange, onSubmit, onCancel, isEditing = false, showEnterpriseNumberForBelgianCompanies = false }: CompanyFormProps) {
    const handleCountryChange = (value: string) => {
        const countryCode = value as z.infer<typeof zodValidCountryCodes>;
        const countryInfo = COUNTRIES.find((c) => c.code === countryCode);
        const updates: Partial<Company> = {
            enterpriseNumber: null,
            vatNumber: null,
            country: countryCode,
        };
        if (countryInfo?.defaultEnterpriseNumberScheme && ISO_ICD_SCHEME_IDENTIFIERS.find((scheme) => scheme.key === countryInfo.defaultEnterpriseNumberScheme)) {
            updates.enterpriseNumberScheme = countryInfo.defaultEnterpriseNumberScheme;
        } else {
            updates.enterpriseNumberScheme = null;
        }
        onChange({ ...company, ...updates });
    };

    return (
        <div className="space-y-4">
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
                    onValueChange={handleCountryChange}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                        {COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                                {country.flag} {country.name}
                            </SelectItem>
                        ))}
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
                {company.country === "BE" && <p className="text-xs text-pretty text-muted-foreground">For Belgian businesses, the VAT number will be used to infer the enterprise number.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                        id="email"
                        type="email"
                        value={company.email || ""}
                        onChange={(e) => onChange({ ...company, email: e.target.value || null })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Phone (Optional)</Label>
                    <Input
                        id="phone"
                        type="tel"
                        value={company.phone || ""}
                        onChange={(e) => onChange({ ...company, phone: e.target.value || null })}
                    />
                </div>
            </div>
            {(company.country !== "BE" || showEnterpriseNumberForBelgianCompanies) && <div className="space-y-1">
                <div className="space-y-2">
                    <Label htmlFor="enterpriseNumber">Enterprise Number (Optional)</Label>
                    <div className="flex gap-2">
                        <div className="w-48">
                            <Combobox
                                value={company.enterpriseNumberScheme || ""}
                                onValueChange={(value) => onChange({ ...company, enterpriseNumberScheme: value || null })}
                                options={ISO_ICD_SCHEME_IDENTIFIERS.map((scheme) => {
                                    const truncatedName = scheme.name.length > 30 
                                        ? scheme.name.substring(0, 30) + "..." 
                                        : scheme.name;
                                    return {
                                        value: scheme.key,
                                        label: `${scheme.key} - ${truncatedName}`,
                                    };
                                })}
                                placeholder="Select scheme..."
                                searchPlaceholder="Search scheme..."
                                emptyText="No scheme found."
                                className="w-full"
                            />
                        </div>
                        <Input
                            id="enterpriseNumber"
                            value={company.enterpriseNumber || ""}
                            onChange={(e) => onChange({ ...company, enterpriseNumber: e.target.value || null })}
                            className="flex-1"
                        />
                    </div>
                    {company.country === "NL" && company.enterpriseNumberScheme !== "0106" && company.enterpriseNumberScheme !== "0190" && company.enterpriseNumber?.trim() && (
                        <Alert variant="destructive" className="bg-transparent">
                            <AlertTriangle />
                            <AlertTitle>Enterprise number scheme 0106 or 0190 required</AlertTitle>
                            <AlertDescription>
                                For Dutch sellers, the scheme identifier is required to be able to send invoices and credit notes.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </div>}
            <div className="space-y-1">
                <div className="flex items-start gap-2">
                    <Checkbox
                        id="isSmpRecipient"
                        checked={company.isSmpRecipient}
                        onCheckedChange={(checked) => onChange({ ...company, isSmpRecipient: checked === true })}
                    />
                    <Label htmlFor="isSmpRecipient" className="text-sm mt-0 pt-0">Register as recipient</Label>
                </div>
                <p className="text-xs text-pretty text-muted-foreground">If enabled, the company will be registered as a recipient in our SMP (the Peppol address book). This will allow you to send and receive documents. If disabled, you will only be able to send documents via Recommand.</p>
            </div>
            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                >
                    Cancel
                </Button>
                <AsyncButton type="submit" onClick={onSubmit}>
                    {isEditing ? "Save Changes" : "Create Company"}
                </AsyncButton>
            </div>
        </div>
    );
} 