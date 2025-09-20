import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@core/components/ui/select";
import { rc } from "@recommand/lib/client";
import { useActiveTeam } from "@core/hooks/user";
import { toast } from "@core/components/ui/sonner";
import type { Companies } from "@peppol/api/companies";

const companiesClient = rc<Companies>("peppol");

interface CompanySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CompanySelector({ value, onChange }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const activeTeam = useActiveTeam();

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!activeTeam?.id) {
        setCompanies([]);
        setIsLoading(false);
        return;
      }

      try {
        const response = await companiesClient[":teamId"]["companies"].$get({
          param: { teamId: activeTeam.id },
        });
        const json = await response.json();

        if (!json.success || !Array.isArray(json.companies)) {
          toast.error("Failed to load companies");
          setCompanies([]);
        } else {
          const companiesList = json.companies.map(
            (company: { id: string; name: string }) => ({
              id: company.id,
              name: company.name,
            })
          );
          setCompanies(companiesList);
        }
      } catch (error) {
        toast.error("Failed to load companies");
        setCompanies([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, [activeTeam?.id]);

  useEffect(() => {
    if (!hasAutoSelected && !value && companies.length > 0) {
      onChange(companies[0].id);
      setHasAutoSelected(true);
    }
  }, [companies, value, hasAutoSelected]);
  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading companies..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (companies.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="No companies available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a company" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
