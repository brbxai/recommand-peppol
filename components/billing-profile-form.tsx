import { Button } from "@core/components/ui/button";
import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@core/components/ui/select";

export type BillingProfileFormData = {
  companyName: string;
  address: string;
  postalCode: string;
  city: string;
  country: "BE";
  vatNumber: string | null;
};

type BillingProfileFormProps = {
  profileForm: BillingProfileFormData;
  onChange: (form: BillingProfileFormData) => void;
  onCancel?: () => void;
  onSubmit?: () => void;
};

export const DEFAULT_BILLING_PROFILE_FORM_DATA: BillingProfileFormData = {
  companyName: "",
  address: "",
  postalCode: "",
  city: "",
  country: "BE",
  vatNumber: null,
};

export function BillingProfileForm({ profileForm, onChange, onCancel, onSubmit }: BillingProfileFormProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="companyName">Company Name</Label>
        <Input
          id="companyName"
          value={profileForm.companyName}
          onChange={(e) => onChange({ ...profileForm, companyName: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={profileForm.address}
          onChange={(e) => onChange({ ...profileForm, address: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            value={profileForm.postalCode}
            onChange={(e) => onChange({ ...profileForm, postalCode: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={profileForm.city}
            onChange={(e) => onChange({ ...profileForm, city: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Select
          value={profileForm.country}
          onValueChange={(value) => onChange({ ...profileForm, country: value as 'BE' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BE">Belgium</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vatNumber">VAT Number (Optional)</Label>
        <Input
          id="vatNumber"
          value={profileForm.vatNumber || ''}
          onChange={(e) => {
            const value = e.target.value.trim();
            if (value === '') {
              onChange({ ...profileForm, vatNumber: null });
            } else {
              onChange({ ...profileForm, vatNumber: value });
            }
          }}
        />
      </div>
      {(onCancel || onSubmit) && <div className="flex justify-end space-x-2 pt-4">
        {onCancel && <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>}
        {onSubmit && <Button onClick={onSubmit}>
          Save Changes
        </Button>}
      </div>}
    </div>
  );
} 