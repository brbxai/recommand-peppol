import { useState, useEffect } from "react";
import { Button } from "@core/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@core/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@core/components/ui/dialog";
import { toast } from "@core/components/ui/sonner";
import { Plus, Trash2, Plug } from "lucide-react";
import { rc } from "@recommand/lib/client";
import type { Integrations } from "@peppol/api/integrations";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { BUILT_IN_INTEGRATIONS, getBuiltInIntegration, type BuiltInIntegration } from "@peppol/utils/integrations";
import { useNavigate } from "react-router-dom";
import type { Integration } from "@peppol/types/integration";
import { ConfirmDialog } from "@core/components/confirm-dialog";

const client = rc<Integrations>("peppol");

type CompanyIntegrationsManagerProps = {
  teamId: string;
  companyId: string;
};

export function CompanyIntegrationsManager({ teamId, companyId }: CompanyIntegrationsManagerProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingIntegrationId, setDeletingIntegrationId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchIntegrations();
  }, [teamId, companyId]);

  const fetchIntegrations = async () => {
    try {
      setIsLoading(true);
      const response = await client[":teamId"]["integrations"].$get({
        param: { teamId },
        query: { companyId },
      });
      const json = await response.json();

      if (!json.success) {
        toast.error(stringifyActionFailure(json.errors));
        return;
      }

      setIntegrations(json.integrations || []);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      toast.error("Failed to load integrations: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateIntegration = async (builtInIntegration: BuiltInIntegration) => {
    try {
      setIsCreating(true);
      const response = await client[":teamId"]["integrations"].$post({
        param: { teamId },
        json: {
          companyId,
          url: builtInIntegration.url,
        },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Integration added successfully");
      setIsDialogOpen(false);
      const integration = json.integration as Integration;
      navigate(`/companies/${companyId}/integrations/${integration.id}`);
    } catch (error) {
      console.error("Error creating integration:", error);
      toast.error("Failed to add integration: " + error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (integrationId: string) => {
    try {
      setDeletingIntegrationId(integrationId);
      const response = await client[":teamId"]["integrations"][":integrationId"].$delete({
        param: { teamId, integrationId },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Integration deleted successfully");
      fetchIntegrations();
    } catch (error) {
      toast.error("Failed to delete integration: " + error);
    } finally {
      setDeletingIntegrationId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Manage integrations for this company</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Integrations</CardTitle>
              <CardDescription className="text-balance">
                Connect external services to automate document processing and workflows.
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4" />
              Add Integration
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {integrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Plug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No integrations configured</p>
                <p className="text-sm">Add an integration to get started</p>
              </div>
            ) : (
              integrations.map((integration) => (
                <div key={integration.id} className="flex items-center justify-between p-3 border rounded-lg gap-4 hover:bg-muted/50 transition-colors">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => navigate(`/companies/${companyId}/integrations/${integration.id}`)}
                  >
                    <div className="font-medium">{integration.manifest.name}</div>
                    {integration.manifest.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {getBuiltInIntegration(integration.manifest.url)?.description || integration.manifest.description}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <ConfirmDialog
                      title="Delete Integration"
                      description="Are you sure you want to delete this integration? This action cannot be undone."
                      confirmButtonText="Delete"
                      onConfirm={async () => {
                        await handleDelete(integration.id);
                      }}
                      isLoading={deletingIntegrationId === integration.id}
                      variant="destructive"
                      trigger={
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Integration</DialogTitle>
            <DialogDescription>
              Select an integration to connect to this company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {BUILT_IN_INTEGRATIONS.map((integration) => (
              <button
                key={integration.url}
                onClick={() => handleCreateIntegration(integration)}
                disabled={isCreating}
                className="w-full text-left p-4 border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium">{integration.name}</div>
                {integration.description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {integration.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

