import { PageTemplate } from "@core/components/page-template";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@core/components/ui/select";
import { useState } from "react";
import { DocumentForm } from "../../../components/send-document/document-form";
import { ApiPreview } from "../../../components/send-document/api-preview";
import { DocumentPreview } from "../../../components/send-document/document-preview";
import { Card } from "@core/components/ui/card";
import { Switch } from "@core/components/ui/switch";
import { Label } from "@core/components/ui/label";
import { DocumentType } from "@peppol/utils/parsing/send-document";
import type { SendDocument } from "@peppol/utils/parsing/send-document";
import { useLocalStorageState } from "@peppol/utils/react-hooks";
import { rc } from "@recommand/lib/client";
import type { PreviewDocument as PreviewDocumentApi } from "@peppol/api/preview-document";
import { useEffect, useMemo } from "react";
import { useActiveTeam } from "@core/hooks/user";

function getFormType(documentType: string): "invoice" | "creditNote" | "xml" {
  switch (documentType) {
    case DocumentType.INVOICE:
    case DocumentType.SELF_BILLING_INVOICE:
      return "invoice";
    case DocumentType.CREDIT_NOTE:
    case DocumentType.SELF_BILLING_CREDIT_NOTE:
      return "creditNote";
    case DocumentType.XML:
      return "xml";
    default:
      return "invoice";
  }
}

function getDocumentDescription(documentType: string): string {
  switch (documentType) {
    case DocumentType.INVOICE:
      return "Fill in the invoice details including buyer information, line items, and payment terms.";
    case DocumentType.CREDIT_NOTE:
      return "Create a credit note for refunds, adjustments, or corrections to previous invoices.";
    case DocumentType.SELF_BILLING_INVOICE:
      return "Create a self billing invoice where the buyer issues the invoice on behalf of the seller.";
    case DocumentType.SELF_BILLING_CREDIT_NOTE:
      return "Create a self billing credit note for adjustments or corrections in a self billing flow.";
    case DocumentType.XML:
      return "Upload or paste a raw UBL XML document that complies with Peppol standards.";
    default:
      return "Complete the form below to create your document.";
  }
}

export default function SendDocumentPage() {
  const activeTeam = useActiveTeam();
  const [documentType, setDocumentType] = useState<string>(
    DocumentType.INVOICE
  );
  const [formData, setFormData] = useState<Partial<SendDocument>>({
    documentType: DocumentType.INVOICE,
    recipient: "",
    document: {
      invoiceNumber: "",
      lines: [],
    } as any,
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const legacyKey = "peppol.sendDocument.showApiPreview";
  const legacyValueRaw =
    typeof window !== "undefined"
      ? window.localStorage.getItem(legacyKey)
      : null;
  const legacyValue =
    legacyValueRaw !== null ? (JSON.parse(legacyValueRaw) as boolean) : null;

  const [developerMode, setDeveloperMode] = useLocalStorageState<boolean>(
    "peppol.sendDocument.developerMode",
    legacyValue ?? false
  );
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [, setIsPreviewLoading] = useState(false);

  const client = useMemo(() => rc<PreviewDocumentApi>("peppol"), []);

  const handleFormChange = (data: Partial<SendDocument>) => {
    setFormData(data);
  };

  useEffect(() => {
    setDocumentType(DocumentType.INVOICE);
    setSelectedCompanyId("");
    setFormData({
      documentType: DocumentType.INVOICE,
      recipient: "",
      document: {
        invoiceNumber: "",
        lines: [],
      } as any,
    });
    setPreviewHtml(null);
    setIsPreviewLoading(false);
  }, [activeTeam?.id]);

  const handleDocumentTypeChange = (value: string) => {
    setDocumentType(value);
    const newDocumentType =
      value as (typeof DocumentType)[keyof typeof DocumentType];

    setFormData({
      ...formData,
      documentType: newDocumentType,
      document:
        newDocumentType === DocumentType.XML
          ? ""
          : newDocumentType === DocumentType.CREDIT_NOTE ||
              newDocumentType === DocumentType.SELF_BILLING_CREDIT_NOTE
            ? ({ creditNoteNumber: "", lines: [] } as any)
            : ({ invoiceNumber: "", lines: [] } as any),
      doctypeId:
        newDocumentType === DocumentType.XML ? formData.doctypeId : undefined,
      processId:
        newDocumentType === DocumentType.XML ? formData.processId : undefined,
    });
  };

  useEffect(() => {
    if (developerMode) {
      setPreviewHtml(null);
      setIsPreviewLoading(false);
      return;
    }

    if (!selectedCompanyId) {
      setPreviewHtml(null);
      setIsPreviewLoading(false);
      return;
    }

    if (
      formData.documentType === DocumentType.XML ||
      typeof formData.documentType !== "string"
    ) {
      setPreviewHtml(null);
      setIsPreviewLoading(false);
      return;
    }

    const canPreview = (() => {
      const recipient =
        typeof formData.recipient === "string" ? formData.recipient.trim() : "";
      if (!recipient) return false;
      const doc: any = formData.document;
      const hasLines =
        Array.isArray(doc?.lines) &&
        doc.lines.length > 0 &&
        doc.lines.every(
          (l: any) =>
            typeof l?.name === "string" &&
            l.name.trim().length > 0 &&
            l?.quantity != null &&
            l?.netPriceAmount != null
        );
      const hasParty = (p: any) =>
        !!p &&
        typeof p.name === "string" &&
        p.name.trim() &&
        typeof p.street === "string" &&
        p.street.trim() &&
        typeof p.city === "string" &&
        p.city.trim() &&
        typeof p.postalZone === "string" &&
        p.postalZone.trim() &&
        typeof p.country === "string" &&
        p.country.trim().length === 2;

      if (
        formData.documentType === DocumentType.INVOICE &&
        typeof doc?.invoiceNumber === "string" &&
        doc.invoiceNumber.trim() &&
        hasParty(doc?.buyer) &&
        hasLines
      ) {
        return true;
      }

      if (
        formData.documentType === DocumentType.CREDIT_NOTE &&
        typeof doc?.creditNoteNumber === "string" &&
        doc.creditNoteNumber.trim() &&
        hasParty(doc?.buyer) &&
        hasLines
      ) {
        return true;
      }

      if (
        formData.documentType === DocumentType.SELF_BILLING_INVOICE &&
        typeof doc?.invoiceNumber === "string" &&
        doc.invoiceNumber.trim() &&
        hasParty(doc?.seller) &&
        hasLines
      ) {
        return true;
      }

      if (
        formData.documentType === DocumentType.SELF_BILLING_CREDIT_NOTE &&
        typeof doc?.creditNoteNumber === "string" &&
        doc.creditNoteNumber.trim() &&
        hasParty(doc?.seller) &&
        hasLines
      ) {
        return true;
      }

      return false;
    })();

    if (!canPreview) {
      setPreviewHtml(null);
      setIsPreviewLoading(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        setIsPreviewLoading(false);
        const response = await client[":companyId"]["previewDocument"][
          "render"
        ][":type"].$post({
          param: { companyId: selectedCompanyId, type: "html" },
          json: formData as SendDocument,
        });

        if (!response.ok) {
          setPreviewHtml(null);
          return;
        }

        const html = await response.text();
        setPreviewHtml(html);
      } catch {
        setPreviewHtml(null);
      } finally {
        setIsPreviewLoading(false);
      }
    }, 500);

    return () => {
      window.clearTimeout(handle);
    };
  }, [client, developerMode, formData, selectedCompanyId]);

  return (
    <PageTemplate
      breadcrumbs={[{ label: "Peppol" }, { label: "Send document" }]}
      description="Send invoices and credit notes through the Peppol network with a billing preview (and a developer view for API details)."
      buttons={[
        <div key="developer-mode" className="flex items-center gap-2">
          <Switch
            id="developer-mode"
            checked={developerMode}
            onCheckedChange={setDeveloperMode}
          />
          <Label htmlFor="developer-mode" className="text-sm">
            Developer
          </Label>
        </div>,
      ]}
    >
      <div
        className={`grid gap-6 ${developerMode ? "lg:grid-cols-2" : "lg:grid-cols-2"}`}
      >
        <div className="space-y-6">
          {/* Document Type Selection */}
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Document Type</h3>
                <p className="text-sm text-muted-foreground">
                  Choose the type of document you want to send
                </p>
              </div>
              <Select
                value={documentType}
                onValueChange={handleDocumentTypeChange}
              >
                <SelectTrigger id="documentType" className="px-4 py-6">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DocumentType.INVOICE}>
                    <div className="flex flex-col py-1">
                      <span className="font-medium">Invoice</span>
                      <span className="text-xs text-muted-foreground">
                        Standard billing document
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value={DocumentType.CREDIT_NOTE}>
                    <div className="flex flex-col py-1">
                      <span className="font-medium">Credit Note</span>
                      <span className="text-xs text-muted-foreground">
                        Refund or adjustment document
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value={DocumentType.SELF_BILLING_INVOICE}>
                    <div className="flex flex-col py-1">
                      <span className="font-medium">Self Billing Invoice</span>
                      <span className="text-xs text-muted-foreground">
                        Self billing invoice
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value={DocumentType.SELF_BILLING_CREDIT_NOTE}>
                    <div className="flex flex-col py-1">
                      <span className="font-medium">
                        Self Billing Credit Note
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Self billing credit note
                      </span>
                    </div>
                  </SelectItem>
                  {developerMode && (
                    <SelectItem value={DocumentType.XML}>
                      <div className="flex flex-col py-1">
                        <span className="font-medium">Raw XML</span>
                        <span className="text-xs text-muted-foreground">
                          Custom UBL document
                        </span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Document Details */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold">Document Details</h3>
                <p className="text-sm text-muted-foreground">
                  {getDocumentDescription(documentType)}
                </p>
              </div>
              <DocumentForm
                key={activeTeam?.id ?? "no-team"}
                type={getFormType(documentType)}
                formData={formData}
                onFormChange={handleFormChange}
                selectedCompanyId={selectedCompanyId}
                onCompanyChange={setSelectedCompanyId}
                mode={developerMode ? "developer" : "billing"}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {developerMode ? (
            <ApiPreview formData={formData} companyId={selectedCompanyId} />
          ) : (
            <DocumentPreview
              html={previewHtml}
              emptyText="Fill in the company, recipient, and required invoice fields to see a preview."
            />
          )}
        </div>
      </div>
    </PageTemplate>
  );
}
