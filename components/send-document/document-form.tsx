import { useState } from "react";
import { Button } from "@core/components/ui/button";
import { Label } from "@core/components/ui/label";
import { toast } from "@core/components/ui/sonner";
import { rc } from "@recommand/lib/client";
import type { SendDocument } from "@peppol/utils/parsing/send-document";
import type { SendDocument as SendDocumentAPI } from "@peppol/api/send-document";
import { InvoiceForm } from "./invoice-form";
import { CreditNoteForm } from "./credit-note-form";
import { XmlForm } from "./xml-form";
import { RecipientSelector } from "./recipient-selector";
import { CompanySelector } from "./company-selector";
import { EmailOptions } from "./email-options";
import { Loader2, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { stringifyActionFailure } from "@recommand/lib/utils";

const client = rc<SendDocumentAPI>("peppol");

interface DocumentFormProps {
  type: "invoice" | "creditNote" | "xml";
  formData: Partial<SendDocument>;
  onFormChange: (data: Partial<SendDocument>) => void;
  selectedCompanyId: string;
  onCompanyChange: (companyId: string) => void;
}

export function DocumentForm({
  type,
  formData,
  onFormChange,
  selectedCompanyId,
  onCompanyChange,
}: DocumentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleDocumentChange = (documentData: any) => {
    onFormChange({
      ...formData,
      document: documentData,
    });
  };

  const handleRecipientChange = (recipient: string) => {
    onFormChange({
      ...formData,
      recipient,
    });
  };

  const handleEmailOptionsChange = (emailOptions: any) => {
    onFormChange({
      ...formData,
      email: emailOptions,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompanyId) {
      toast.error("Please select a company");
      return;
    }

    if (!formData.recipient) {
      toast.error("Please enter a recipient Peppol ID");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await client[":companyId"]["sendDocument"].$post({
        param: { companyId: selectedCompanyId },
        json: formData as SendDocument,
      });

      const json = await response.json();

      if (!json.success) {
        toast.error(stringifyActionFailure(json.errors));
      } else {
        toast.success(
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Document sent successfully!</p>
            {json.sentOverPeppol && (
              <p className="text-xs">✓ Sent over Peppol network</p>
            )}
            {json.sentOverEmail && (
              <p className="text-xs">
                ✓ Sent to {json.emailRecipients?.join(", ")}
              </p>
            )}
          </div>
        );

        // Navigate to transmitted documents page
        navigate("/transmitted-documents");
      }
    } catch (error) {
      console.error("Error sending document:", error);
      toast.error("Failed to send document");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="company">Sending Company</Label>
          <CompanySelector
            value={selectedCompanyId}
            onChange={onCompanyChange}
          />
        </div>

        <div>
          <Label htmlFor="recipient">Recipient Peppol ID</Label>
          <RecipientSelector
            value={formData.recipient || ""}
            onChange={handleRecipientChange}
          />
        </div>

        <EmailOptions
          value={formData.email}
          onChange={handleEmailOptionsChange}
        />
      </div>

      <div className="border-t pt-6">
        {type === "invoice" && (
          <InvoiceForm
            document={formData.document || {}}
            onChange={handleDocumentChange}
            companyId={selectedCompanyId}
          />
        )}
        {type === "creditNote" && (
          <CreditNoteForm
            document={formData.document || {}}
            onChange={handleDocumentChange}
            companyId={selectedCompanyId}
          />
        )}
        {type === "xml" && (
          <XmlForm
            document={(formData.document as string) || ""}
            onChange={handleDocumentChange}
            doctypeId={formData.doctypeId}
            onDoctypeIdChange={(id) =>
              onFormChange({ ...formData, doctypeId: id })
            }
          />
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/transmitted-documents")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Document
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
