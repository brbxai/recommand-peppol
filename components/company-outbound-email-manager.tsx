import { useState } from "react";
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
import { Mail, Copy, Check, RefreshCw } from "lucide-react";
import { rc } from "@recommand/lib/client";
import type { CompanyEmailOutbound } from "@peppol/api/companies/email/outbound";
import { stringifyActionFailure } from "@recommand/lib/utils";
import type { Company } from "@peppol/types/company";

const client = rc<CompanyEmailOutbound>("peppol");

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .substring(0, 30); // Limit length
}

function generateRandomToken(length: number = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateEmailSlug(companyName: string): string {
  const companySlug = slugify(companyName);
  const token = generateRandomToken();
  return `${companySlug}-${token}`;
}

type CompanyOutboundEmailManagerProps = {
  teamId: string;
  company: Company;
  onUpdate?: () => void;
};

export function CompanyOutboundEmailManager({
  teamId,
  company,
  onUpdate,
}: CompanyOutboundEmailManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slug, setSlug] = useState(company.outboundEmailSlug || "");
  const [enabled, setEnabled] = useState(company.outboundEmailEnabled);
  const [copied, setCopied] = useState(false);

  const outboundEmailAddress = slug
    ? `${slug}@out.recommand.eu`
    : null;

  const handleCopy = async () => {
    if (!outboundEmailAddress) return;

    try {
      await navigator.clipboard.writeText(outboundEmailAddress);
      setCopied(true);
      toast.success("Email address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleSave = async () => {
    if (!slug.trim()) {
      toast.error("Email slug is required");
      return;
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error(
        "Slug must contain only lowercase letters, numbers, and hyphens"
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await client[":teamId"]["companies"][":companyId"][
        "email"]["outbound"
      ].$put({
        param: { teamId, companyId: company.id },
        json: {
          slug,
          enabled,
        },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Outbound email settings updated successfully");
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Failed to update outbound email settings: " + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSlug(company.outboundEmailSlug || "");
    setEnabled(company.outboundEmailEnabled);
    setIsEditing(false);
  };

  const handleRegenerateSlug = () => {
    setSlug(generateEmailSlug(company.name));
  };

  const handleEnable = async () => {
    if (!company.outboundEmailSlug) {
      setSlug(generateEmailSlug(company.name));
      setIsEditing(true);
      setEnabled(true);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await client[":teamId"]["companies"][":companyId"][
        "email"]["outbound"
      ].$put({
        param: { teamId, companyId: company.id },
        json: {
          slug: company.outboundEmailSlug,
          enabled: true,
        },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Email sending enabled");
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Failed to enable email sending: " + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable = async () => {
    try {
      setIsSubmitting(true);
      const response = await client[":teamId"]["companies"][":companyId"][
        "email"]["outbound"
      ].$put({
        param: { teamId, companyId: company.id },
        json: {
          slug: company.outboundEmailSlug || "",
          enabled: false,
        },
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(stringifyActionFailure(json.errors));
      }

      toast.success("Email sending disabled");
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error("Failed to disable email sending: " + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Email to Peppol</CardTitle>
            <CardDescription className="text-balance">
              Send documents over the Peppol network by forwarding emails with
              XML attachments
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!company.outboundEmailEnabled && !isEditing ? (
          <div className="text-center py-8 space-y-4">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Email sending is not enabled for this company.
              </p>
              <Button onClick={handleEnable} disabled={isSubmitting}>
                Enable Email Sending
              </Button>
            </div>
          </div>
        ) : isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="outbound-email-slug">Email Address Slug</Label>
              <div className="flex gap-2">
                <Input
                  id="outbound-email-slug"
                  type="text"
                  placeholder="your-company"
                  value={slug}
                  readOnly
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleRegenerateSlug}
                  title="Generate new slug"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <div className="flex items-center px-3 border rounded-md bg-muted text-muted-foreground text-sm whitespace-nowrap">
                  @out.recommand.eu
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Only lowercase letters, numbers, and hyphens allowed
              </p>
            </div>

            {slug && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">
                  Your outbound email address will be:
                </p>
                <code className="text-sm">
                  {slug}@out.recommand.eu
                </code>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <AsyncButton onClick={handleSave} disabled={isSubmitting}>
                Save Settings
              </AsyncButton>
              <Button
                onClick={handleCancel}
                variant="outline"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Your Outbound Email Address
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono flex-1">
                    {outboundEmailAddress}
                  </code>
                  <Button
                    onClick={handleCopy}
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">How to use:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    Forward an email with a XML attachment to this address
                  </li>
                  <li>We automatically validate and send it over Peppol</li>
                  <li>
                    You receive a confirmation email when sent successfully
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
              >
                Edit Settings
              </Button>
              <AsyncButton
                onClick={handleDisable}
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
              >
                Disable
              </AsyncButton>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
