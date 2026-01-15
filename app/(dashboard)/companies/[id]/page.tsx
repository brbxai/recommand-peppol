import { PageTemplate } from "@core/components/page-template";
import { rc } from "@recommand/lib/client";
import type { Companies } from "@peppol/api/companies";
import type { Subscription } from "@peppol/api/subscription";
import { useEffect, useState } from "react";
import { Button } from "@core/components/ui/button";
import { toast } from "@core/components/ui/sonner";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { useActiveTeam } from "@core/hooks/user";
import { Loader2, Trash2, ArrowRight, Plug } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { CompanyForm } from "../../../../components/company-form";
import { CompanyIdentifiersManager } from "../../../../components/company-identifiers-manager";
import { CompanyDocumentTypesManager } from "../../../../components/company-document-types-manager";
import { CompanyNotificationsManager } from "../../../../components/company-notifications-manager";
import { CompanyOutboundEmailManager } from "../../../../components/company-outbound-email-manager";
import { CompanyIntegrationsManager } from "../../../../components/company-integrations-manager";
import type { Company, CompanyFormData } from "../../../../types/company";
import { defaultCompanyFormData } from "../../../../types/company";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@core/components/ui/card";
import { useIsPlayground } from "@peppol/lib/client/playgrounds";
import { canUseIntegrations } from "@peppol/utils/plan-validation";
import { BUILT_IN_INTEGRATIONS } from "@peppol/utils/integrations";
import type { Subscription as SubscriptionType } from "@peppol/data/subscriptions";
import { ConfirmDialog } from "@core/components/confirm-dialog";

const client = rc<Companies>("peppol");
const subscriptionClient = rc<Subscription>("v1");

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<CompanyFormData>(defaultCompanyFormData);
  const [subscription, setSubscription] = useState<SubscriptionType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const activeTeam = useActiveTeam();
  const isPlayground = useIsPlayground();

  useEffect(() => {
    if (id && activeTeam?.id) {
      fetchCompany();
      fetchSubscription();
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

  const fetchSubscription = async () => {
    if (!activeTeam?.id) return;

    try {
      const response = await subscriptionClient[":teamId"]["subscription"].$get({
        param: { teamId: activeTeam.id },
      });
      const data = await response.json();

      if (data.success && data.subscription) {
        setSubscription({
          ...data.subscription,
          createdAt: new Date(data.subscription.createdAt),
          updatedAt: new Date(data.subscription.updatedAt),
          startDate: new Date(data.subscription.startDate),
          endDate: data.subscription.endDate
            ? new Date(data.subscription.endDate)
            : null,
          lastBilledAt: data.subscription.lastBilledAt
            ? new Date(data.subscription.lastBilledAt)
            : null,
        });
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
      setSubscription(null);
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
      console.error(error);
      toast.error("Failed to update company. (" + error + ")");
    }
  };

  const handleDeleteCompany = async () => {
    if (!activeTeam?.id || !company) return;

    try {
      setIsDeleting(true);
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
      toast.error("Failed to delete company: " + error);
    } finally {
      setIsDeleting(false);
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
        <ConfirmDialog
          key="delete-button"
          title="Delete Company"
          description="Are you sure you want to delete this company? This action cannot be undone."
          confirmButtonText="Delete"
          onConfirm={handleDeleteCompany}
          isLoading={isDeleting}
          variant="destructive"
          trigger={
            <Button variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Company
            </Button>
          }
        />,
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
              showEnterpriseNumberForBelgianCompanies={true}
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
            <CompanyNotificationsManager
              teamId={activeTeam.id}
              companyId={company.id}
            />
            <CompanyOutboundEmailManager
              teamId={activeTeam.id}
              company={company}
              onUpdate={fetchCompany}
            />
            {canUseIntegrations(isPlayground, subscription) ? (
              <CompanyIntegrationsManager
                teamId={activeTeam.id}
                companyId={company.id}
              />
            ) : (
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2 mt-0.5">
                      <Plug className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle>Integrations</CardTitle>
                      <CardDescription>
                        Connect external services to automate document processing and workflows. Integrations are available on Starter, Professional, or Enterprise plans.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {BUILT_IN_INTEGRATIONS.length > 0 && (
                      <div className="text-sm">
                        <p className="mb-2 font-medium">Available integrations:</p>
                        <ul className="space-y-1">
                          {BUILT_IN_INTEGRATIONS.map((integration) => (
                            <li key={integration.url} className="flex items-center gap-2 text-muted-foreground">
                              <Plug className="h-3 w-3" />
                              <span>{integration.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      <p className="mb-2">With integrations, you can:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Automatically sync documents with your accounting software</li>
                        <li>Receive real-time notifications for incoming documents</li>
                        <li>Streamline your document processing workflow</li>
                      </ul>
                    </div>
                    <Button
                      onClick={() => navigate("/billing/subscription")}
                      className="w-full"
                    >
                      View Available Plans
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </PageTemplate>
  );
}
