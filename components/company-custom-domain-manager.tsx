import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@core/components/ui/button";
import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@core/components/ui/card";
import { AsyncButton } from "@core/components/async-button";
import { toast } from "@core/components/ui/sonner";
import {
  Globe,
  CheckCircle2,
  XCircle,
  Copy,
  Trash2,
  AlertCircle,
  Edit as EditIcon,
  ArrowRight,
  Plus,
} from "lucide-react";
import { rc } from "@recommand/lib/client";
import type { CompanyCustomDomain } from "@peppol/api/companies/custom-domain";
import { stringifyActionFailure } from "@recommand/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@core/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@core/components/ui/alert";

const client = rc<CompanyCustomDomain>("peppol");

type CustomDomainData = {
  id: string;
  companyId: string;
  postmarkDomainId: number;
  domainName: string;
  dkimVerified: boolean;
  dkimPendingHost: string | null;
  dkimPendingValue: string | null;
  dkimHost: string | null;
  dkimValue: string | null;
  returnPathDomain: string | null;
  returnPathVerified: boolean;
  returnPathCnameValue: string | null;
  senderEmail: string;
  createdAt: string;
  updatedAt: string;
};

type CompanyCustomDomainManagerProps = {
  teamId: string;
  companyId: string;
  canUseFeature: boolean;
};

function DnsRecordRow({
  label,
  type,
  host,
  value,
  verified,
}: {
  label: string;
  type: string;
  host: string | null;
  value: string | null;
  verified: boolean;
}) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (!host || !value) return null;

  return (
    <div className="space-y-2 p-3 border rounded-lg">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{label}</span>
        {verified ? (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <XCircle className="h-3 w-3" />
            Pending
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">Type:</span>
          <code className="text-xs bg-muted px-1 rounded">{type}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">Host:</span>
          <code className="text-xs bg-muted px-1 rounded flex-1 truncate">
            {host}
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => copyToClipboard(host)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">Value:</span>
          <code className="text-xs bg-muted px-1 rounded flex-1 truncate">
            {value}
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => copyToClipboard(value)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CompanyCustomDomainManager({
  teamId,
  companyId,
  canUseFeature,
}: CompanyCustomDomainManagerProps) {
  const navigate = useNavigate();
  const [customDomain, setCustomDomain] = useState<CustomDomainData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditingSenderEmail, setIsEditingSenderEmail] = useState(false);
  const [domainName, setDomainName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  useEffect(() => {
    fetchCustomDomain();
  }, [teamId, companyId]);

  const fetchCustomDomain = async () => {
    try {
      setIsLoading(true);
      const response = await client[":teamId"]["companies"][":companyId"][
        "custom-domain"
      ].$get({
        param: { teamId, companyId },
      });
      const json = await response.json();

      if (!json.success) {
        toast.error(stringifyActionFailure(json.errors));
        return;
      }

      setCustomDomain(json.customDomain);
    } catch (error) {
      console.error("Error fetching custom domain:", error);
      toast.error("Failed to load custom domain");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!domainName.trim()) {
      toast.error("Domain name is required");
      return;
    }
    if (!senderEmail.trim()) {
      toast.error("Sender email is required");
      return;
    }

    try {
      const response = await client[":teamId"]["companies"][":companyId"][
        "custom-domain"
      ].$post({
        param: { teamId, companyId },
        json: {
          domainName: domainName.trim().toLowerCase(),
          senderEmail: senderEmail.trim().toLowerCase(),
        },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Custom domain registered successfully");
      setDomainName("");
      setSenderEmail("");
      setIsAdding(false);
      fetchCustomDomain();
    } catch (error) {
      toast.error("Failed to register domain: " + error);
    }
  };

  const handleVerifyDkim = async () => {
    try {
      const response = await client[":teamId"]["companies"][":companyId"][
        "custom-domain"
      ]["verify-dkim"].$post({
        param: { teamId, companyId },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      if (json.customDomain.dkimVerified) {
        toast.success("DKIM verified successfully");
      } else {
        toast.info(
          "DKIM not yet verified. Please ensure the DNS record is correctly configured."
        );
      }
      fetchCustomDomain();
    } catch (error) {
      toast.error("Failed to verify DKIM: " + error);
    }
  };

  const handleVerifyReturnPath = async () => {
    try {
      const response = await client[":teamId"]["companies"][":companyId"][
        "custom-domain"
      ]["verify-return-path"].$post({
        param: { teamId, companyId },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      if (json.customDomain.returnPathVerified) {
        toast.success("Return Path verified successfully");
      } else {
        toast.info(
          "Return Path not yet verified. Please ensure the CNAME record is correctly configured."
        );
      }
      fetchCustomDomain();
    } catch (error) {
      toast.error("Failed to verify Return Path: " + error);
    }
  };

  const handleUpdateSenderEmail = async () => {
    if (!senderEmail.trim()) {
      toast.error("Sender email is required");
      return;
    }

    try {
      const response = await client[":teamId"]["companies"][":companyId"][
        "custom-domain"
      ].$patch({
        param: { teamId, companyId },
        json: { senderEmail: senderEmail.trim() },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Sender email updated successfully");
      fetchCustomDomain();
    } catch (error) {
      toast.error("Failed to update sender email: " + error);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await client[":teamId"]["companies"][":companyId"][
        "custom-domain"
      ].$delete({
        param: { teamId, companyId },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Custom domain deleted successfully");
      setCustomDomain(null);
    } catch (error) {
      toast.error("Failed to delete custom domain: " + error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Custom Email Domain</CardTitle>
          <CardDescription>
            Send document emails from your own domain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show upgrade prompt if user doesn't have access to feature
  if (!canUseFeature) {
    return (
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 mt-0.5">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>Custom Email Domain</CardTitle>
              <CardDescription>
                Send document emails from your own domain instead of noreply-documents@recommand.eu. Custom domains are available on Starter, Professional, or Enterprise plans.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {customDomain && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Domain Inactive</AlertTitle>
                <AlertDescription>
                  Your custom domain <strong>{customDomain.domainName}</strong> is configured but inactive because your current plan doesn't include this feature. Upgrade to reactivate it.
                </AlertDescription>
              </Alert>
            )}
            <Button
              onClick={() => navigate("/billing/subscription")}
              className="w-full"
            >
              Upgrade Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Custom Email Domain</CardTitle>
            <CardDescription className="text-balance">
              Send document emails from your own domain instead of
              noreply-documents@recommand.eu
            </CardDescription>
          </div>
          {!customDomain && !isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="h-4 w-4" />
              Add Domain
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!customDomain && !isAdding && (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No custom domain configured</p>
            <p className="text-sm">Add a domain to get started</p>
          </div>
        )}

        {isAdding && !customDomain && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="domain-name">Domain Name</Label>
              <Input
                id="domain-name"
                placeholder="example.com"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your domain without any subdomain (e.g., example.com)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-email">Sender Email Address</Label>
              <Input
                id="sender-email"
                type="email"
                placeholder="invoices@example.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The email address that will appear as the sender. Must use the
                same domain.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <AsyncButton onClick={handleCreate} size="sm">
                Register Domain
              </AsyncButton>
              <Button
                onClick={() => {
                  setIsAdding(false);
                  setDomainName("");
                  setSenderEmail("");
                }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {customDomain && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">{customDomain.domainName}</div>
                <div className="text-xs text-muted-foreground">
                  {customDomain.dkimVerified && customDomain.returnPathVerified
                    ? "Fully verified and ready to use"
                    : "DNS verification required"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {customDomain.dkimVerified &&
                customDomain.returnPathVerified ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                )}
              </div>
            </div>

            {(!customDomain.dkimVerified ||
              !customDomain.returnPathVerified) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>DNS Configuration Required</AlertTitle>
                <AlertDescription>
                  Add the following DNS records to your domain to enable email
                  sending. DNS changes can take up to 48 hours to propagate.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">DNS Records</h4>
              </div>

              <DnsRecordRow
                label="DKIM Record"
                type="TXT"
                host={
                  customDomain.dkimVerified
                    ? customDomain.dkimHost
                    : customDomain.dkimPendingHost
                }
                value={
                  customDomain.dkimVerified
                    ? customDomain.dkimValue
                    : customDomain.dkimPendingValue
                }
                verified={customDomain.dkimVerified}
              />

              {!customDomain.dkimVerified && (
                <AsyncButton
                  onClick={handleVerifyDkim}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Verify DKIM
                </AsyncButton>
              )}

              <DnsRecordRow
                label="Return Path (Bounce Handling)"
                type="CNAME"
                host={customDomain.returnPathDomain}
                value={customDomain.returnPathCnameValue}
                verified={customDomain.returnPathVerified}
              />

              {!customDomain.returnPathVerified && (
                <AsyncButton
                  onClick={handleVerifyReturnPath}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Verify Return Path
                </AsyncButton>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>Sender Email Address</Label>
              {isEditingSenderEmail ? (
                <div className="flex gap-2">
                  <Input
                    id="update-sender-email"
                    type="email"
                    placeholder={`invoices@${customDomain.domainName}`}
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                  />
                  <AsyncButton
                    onClick={async () => {
                      await handleUpdateSenderEmail();
                      setIsEditingSenderEmail(false);
                    }}
                    size="sm"
                  >
                    Save
                  </AsyncButton>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingSenderEmail(false);
                      setSenderEmail("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {customDomain.senderEmail}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setSenderEmail(customDomain.senderEmail || "");
                      setIsEditingSenderEmail(true);
                    }}
                  >
                    <EditIcon className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                This email address will be used as the sender for document
                emails once the domain is verified.
              </p>
            </div>

            <div className="pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4" />
                    Delete Custom Domain
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Custom Domain</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this custom domain? This
                      will remove it from Postmark and you will need to
                      reconfigure it if you want to use it again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="border border-destructive bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
