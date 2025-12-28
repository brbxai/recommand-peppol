import { useEffect, useRef, useState } from "react";
import { Button } from "@core/components/ui/button";
import { Label } from "@core/components/ui/label";
import { toast } from "@core/components/ui/sonner";
import { rc } from "@recommand/lib/client";
import type { SendDocument } from "@peppol/utils/parsing/send-document";
import type { SendDocument as SendDocumentAPI } from "@peppol/api/send-document";
import { DocumentType } from "@peppol/utils/parsing/send-document";
import { InvoiceForm } from "./invoice-form";
import { CreditNoteForm } from "./credit-note-form";
import { XmlForm } from "./xml-form";
import { RecipientSelector } from "./recipient-selector";
import { CompanySelector } from "./company-selector";
import { EmailOptions } from "./email-options";
import { Loader2, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { Card } from "@core/components/ui/card";
import { Switch } from "@core/components/ui/switch";
import { Input } from "@core/components/ui/input";
import {
  ensureFileExtension,
  getDocumentFilename,
} from "@peppol/utils/document-filename";

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
  const lastAutoPdfFilenameRef = useRef<string | null>(null);

  const getAutoPdfFilename = (): string | null => {
    const docType = formData.documentType;
    const doc: any = formData.document;
    if (
      docType === DocumentType.INVOICE ||
      docType === DocumentType.SELF_BILLING_INVOICE
    ) {
      const invoiceNumber =
        typeof doc?.invoiceNumber === "string" ? doc.invoiceNumber.trim() : "";
      if (!invoiceNumber) {
        return null;
      }
      const base = getDocumentFilename(docType, doc);
      return ensureFileExtension(base, "pdf");
    }
    if (
      docType === DocumentType.CREDIT_NOTE ||
      docType === DocumentType.SELF_BILLING_CREDIT_NOTE
    ) {
      const creditNoteNumber =
        typeof doc?.creditNoteNumber === "string"
          ? doc.creditNoteNumber.trim()
          : "";
      if (!creditNoteNumber) {
        return null;
      }
      const base = getDocumentFilename(docType, doc);
      return ensureFileExtension(base, "pdf");
    }
    return null;
  };

  useEffect(() => {
    if (!formData.pdfGeneration?.enabled) {
      return;
    }
    const auto = getAutoPdfFilename();
    if (!auto) {
      return;
    }
    const current = formData.pdfGeneration.filename;
    const isAuto =
      current === undefined || current === lastAutoPdfFilenameRef.current;
    if (!isAuto || current === auto) {
      return;
    }
    lastAutoPdfFilenameRef.current = auto;
    onFormChange({
      ...formData,
      pdfGeneration: { enabled: true, filename: auto },
    });
  }, [
    formData,
    formData.documentType,
    formData.document,
    formData.pdfGeneration?.enabled,
    formData.pdfGeneration?.filename,
    onFormChange,
  ]);

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

  const handlePdfGenerationToggle = (enabled: boolean) => {
    const auto = getAutoPdfFilename();
    onFormChange({
      ...formData,
      pdfGeneration: enabled
        ? auto
          ? (() => {
              lastAutoPdfFilenameRef.current = auto;
              return { enabled: true, filename: auto };
            })()
          : { enabled: true }
        : undefined,
    });
  };

  const handlePdfFilenameChange = (filename: string) => {
    const nextFilename = filename.trim().length > 0 ? filename : undefined;
    onFormChange({
      ...formData,
      pdfGeneration: {
        enabled: true,
        ...(nextFilename ? { filename: nextFilename } : {}),
      },
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
          <Label htmlFor="company">Sending Company *</Label>
          <CompanySelector
            value={selectedCompanyId}
            onChange={onCompanyChange}
          />
        </div>

        <div>
          <Label htmlFor="recipient">Recipient Peppol ID *</Label>
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
            isSelfBilling={
              formData.documentType === DocumentType.SELF_BILLING_INVOICE
            }
          />
        )}
        {type === "creditNote" && (
          <CreditNoteForm
            document={formData.document || {}}
            onChange={handleDocumentChange}
            companyId={selectedCompanyId}
            isSelfBilling={
              formData.documentType === DocumentType.SELF_BILLING_CREDIT_NOTE
            }
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
            processId={formData.processId}
            onProcessIdChange={(id) =>
              onFormChange({ ...formData, processId: id })
            }
          />
        )}

        {type !== "xml" && (
          <div className="mt-6">
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="pdf-generation-enabled">
                      Include generated PDF
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Generates a PDF of the document and embeds it as an
                      attachment.
                    </p>
                  </div>
                  <Switch
                    id="pdf-generation-enabled"
                    checked={formData.pdfGeneration?.enabled === true}
                    onCheckedChange={handlePdfGenerationToggle}
                  />
                </div>

                {formData.pdfGeneration?.enabled && (
                  <div className="space-y-2">
                    <Label htmlFor="pdf-generation-filename">
                      PDF filename
                    </Label>
                    <Input
                      id="pdf-generation-filename"
                      value={formData.pdfGeneration.filename ?? ""}
                      onChange={(e) => handlePdfFilenameChange(e.target.value)}
                      placeholder={getAutoPdfFilename() ?? "document.pdf"}
                    />
                  </div>
                )}
              </div>
            </Card>
          </div>
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
