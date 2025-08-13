import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import type { Companies } from "@peppol/api/companies";
import { useEffect, useState } from "react";
import { Button } from "@core/components/ui/button";
import { toast } from "@core/components/ui/sonner";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { useActiveTeam } from "@core/hooks/user";
import { Loader2, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { CompanyForm } from "../../../../components/company-form";
import { CompanyIdentifiersManager } from "../../../../components/company-identifiers-manager";
import { CompanyDocumentTypesManager } from "../../../../components/company-document-types-manager";
import type { Company, CompanyFormData } from "../../../../types/company";
import { defaultCompanyFormData } from "../../../../types/company";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@core/components/ui/card";
import { AsyncButton } from "@core/components/async-button";

const client = rc<Companies>("peppol");

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<CompanyFormData>(defaultCompanyFormData);
  const activeTeam = useActiveTeam();

  useEffect(() => {
    if (id && activeTeam?.id) {
      fetchCompany();
    }
  }, [id, activeTeam?.id]);

  const fetchCompany = async () => {
    if (!id || !activeTeam?.id) return;

    try {
      setIsLoading(true);
      const response = await client[":teamId"]["companies"][":companyId"].$get({
        param: {
          teamId: activeTeam.id,
          companyId: id,
        },
      });
      const json = await response.json();

      if (!json.success) {
        toast.error(stringifyActionFailure(json.errors));
        navigate("/companies");
        return;
      }

      const companyData = json.company as Company;
      setCompany(companyData);
      setFormData(companyData);
    } catch (error) {
      console.error("Error fetching company:", error);
      toast.error("Failed to load company");
      navigate("/companies");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyUpdate = async () => {
    if (!activeTeam?.id || !company) return;

    try {
      const response = await client[":teamId"]["companies"][":companyId"].$put({
        param: {
          teamId: activeTeam.id,
          companyId: company.id,
        },
        json: {
          ...formData,
          vatNumber: formData.vatNumber || undefined,
        },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      const companyData = json.company as Company;
      setCompany(companyData);
      setFormData(companyData);
      toast.success("Company updated successfully");
    } catch (error) {
      toast.error("Failed to update company. (" + error + ")");
    }
  };

  const handleDeleteCompany = async () => {
    if (!activeTeam?.id || !company) return;

    if (!confirm("Are you sure you want to delete this company? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await client[":teamId"]["companies"][":companyId"].$delete({
        param: {
          teamId: activeTeam.id,
          companyId: company.id,
        },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Company deleted successfully");
      navigate("/companies");
    } catch (error) {
      toast.error("Failed to delete company");
    }
  };

  if (isLoading) {
    return (
      <PageTemplate
        breadcrumbs={[
          { label: "Peppol", href: "/" },
          { label: "Companies", href: "/companies" },
          { label: "Loading..." },
        ]}
        description="Loading company details..."
      >
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <div className="text-lg">Loading company details...</div>
          </div>
        </div>
      </PageTemplate>
    );
  }

  if (!company) {
    return (
      <PageTemplate
        breadcrumbs={[
          { label: "Peppol", href: "/" },
          { label: "Companies", href: "/companies" },
          { label: "Not Found" },
        ]}
        description="Company not found"
      >
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-lg mb-4">Company not found</div>
            <Button onClick={() => navigate("/companies")}>
              Back to Companies
            </Button>
          </div>
        </div>
      </PageTemplate>
    );
  }

  return (
    <PageTemplate
      breadcrumbs={[
        { label: "Peppol", href: "/" },
        { label: "Companies", href: "/companies" },
        { label: company.name },
      ]}
      description={`Edit company details for ${company.name}`}
      buttons={[
        <AsyncButton
          key="delete-button"
          variant="destructive"
          onClick={handleDeleteCompany}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Company
        </AsyncButton>,
      ]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Company Form */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Edit Company</CardTitle>
              <CardDescription>
                Make changes to the company information below
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CompanyForm
              company={formData}
              onChange={(data) => setFormData(data as CompanyFormData)}
              onSubmit={handleCompanyUpdate}
              onCancel={() => navigate("/companies")}
              isEditing={true}
            />
          </CardContent>
        </Card>

        {activeTeam && (
          <div className="space-y-4">
            <CompanyIdentifiersManager
              teamId={activeTeam.id}
              companyId={company.id}
            />
            <CompanyDocumentTypesManager
              teamId={activeTeam.id}
              companyId={company.id}
            />
          </div>
        )}
      </div>
    </PageTemplate>
  );
}
