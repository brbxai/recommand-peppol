import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@core/components/ui/select";
import { Label } from "@core/components/ui/label";

interface CompanyDropdownProps {
  companies: { id: string; name: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
}

export function CompanyDropdown({
  companies,
  value,
  onChange,
  label = "Company",
  placeholder = "All companies"
}: CompanyDropdownProps) {
  return (
    <div>
      <Label htmlFor="company">{label}</Label>
      <Select
        value={value ?? "all"}
        onValueChange={(value) => onChange(value === "all" ? null : value)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
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
  );
} 