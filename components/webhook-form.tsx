import { Button } from "@core/components/ui/button";
import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@core/components/ui/select";
import type { Company } from "../types/company";
import type { WebhookFormData } from "../types/webhook";

interface WebhookFormProps {
  formData: WebhookFormData;
  companies: Company[];
  onChange: (formData: Partial<WebhookFormData>) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  isEditing: boolean;
}

export const WebhookForm = ({ 
  formData, 
  companies, 
  onChange, 
  onSubmit, 
  onCancel, 
  isEditing 
}: WebhookFormProps) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="url">Webhook URL</Label>
      <Input
        id="url"
        type="url"
        value={formData.url}
        onChange={(e) => onChange({ ...formData, url: e.target.value })}
        placeholder="https://example.com/webhook"
        required
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="companyId">Company (Optional)</Label>
      <Select
        value={formData.companyId ?? "all"}
        onValueChange={(value) => onChange({ ...formData, companyId: value === "all" ? null : value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a company" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All companies</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit">
        {isEditing ? 'Update' : 'Create'}
      </Button>
    </div>
  </form>
); 