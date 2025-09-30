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
import { Card } from "@core/components/ui/card";
import { Switch } from "@core/components/ui/switch";
import { Label } from "@core/components/ui/label";
import { SendDocumentType } from "@peppol/utils/parsing/send-document";
import type { SendDocument } from "@peppol/utils/parsing/send-document";
import { Code } from "lucide-react";

function getFormType(documentType: string): "invoice" | "creditNote" | "xml" {
  switch (documentType) {
    case SendDocumentType.INVOICE:
      return "invoice";
    case SendDocumentType.CREDIT_NOTE:
      return "creditNote";
    case SendDocumentType.XML:
      return "xml";
    default:
      return "invoice";
  }
}

function getDocumentDescription(documentType: string): string {
  switch (documentType) {
    case SendDocumentType.INVOICE:
      return "Fill in the invoice details including buyer information, line items, and payment terms.";
    case SendDocumentType.CREDIT_NOTE:
      return "Create a credit note for refunds, adjustments, or corrections to previous invoices.";
    case SendDocumentType.XML:
      return "Upload or paste a raw UBL XML document that complies with Peppol standards.";
    default:
      return "Complete the form below to create your document.";
  }
}

export default function SendDocumentPage() {
  const [documentType, setDocumentType] = useState<string>(
    SendDocumentType.INVOICE
  );
  const [formData, setFormData] = useState<Partial<SendDocument>>({
    documentType: SendDocumentType.INVOICE,
    recipient: "",
    document: {
      invoiceNumber: "",
      lines: [],
    } as any,
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [showApiPreview, setShowApiPreview] = useState<boolean>(true);

  const handleFormChange = (data: Partial<SendDocument>) => {
    setFormData(data);
  };

  const handleDocumentTypeChange = (value: string) => {
    setDocumentType(value);
    const newDocumentType =
      value as (typeof SendDocumentType)[keyof typeof SendDocumentType];

    setFormData({
      ...formData,
      documentType: newDocumentType,
      document:
        newDocumentType === SendDocumentType.XML
          ? ""
          : newDocumentType === SendDocumentType.CREDIT_NOTE
            ? ({ creditNoteNumber: "", lines: [] } as any)
            : ({ invoiceNumber: "", lines: [] } as any),
    });
  };

  return (
    <PageTemplate
      breadcrumbs={[{ label: "Peppol" }, { label: "Send document" }]}
      description="Send invoices and credit notes through the Peppol network with live API preview."
    >
      <div className="mb-6 flex justify-end items-center">
        <div className="flex items-center space-x-2">
          <Code className="h-4 w-4 text-muted-foreground" />
          <Switch
            id="api-preview"
            checked={showApiPreview}
            onCheckedChange={setShowApiPreview}
          />
          <Label htmlFor="api-preview" className="text-sm">
            API Preview
          </Label>
        </div>
      </div>
      <div
        className={`grid gap-6 ${showApiPreview ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}
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
                  <SelectItem value={SendDocumentType.INVOICE}>
                    <div className="flex flex-col py-1">
                      <span className="font-medium">Invoice</span>
                      <span className="text-xs text-muted-foreground">
                        Standard billing document
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value={SendDocumentType.CREDIT_NOTE}>
                    <div className="flex flex-col py-1">
                      <span className="font-medium">Credit Note</span>
                      <span className="text-xs text-muted-foreground">
                        Refund or adjustment document
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value={SendDocumentType.XML}>
                    <div className="flex flex-col py-1">
                      <span className="font-medium">Raw XML</span>
                      <span className="text-xs text-muted-foreground">
                        Custom UBL document
                      </span>
                    </div>
                  </SelectItem>
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
                type={getFormType(documentType)}
                formData={formData}
                onFormChange={handleFormChange}
                selectedCompanyId={selectedCompanyId}
                onCompanyChange={setSelectedCompanyId}
              />
            </div>
          </Card>
        </div>

        {showApiPreview && (
          <div className="space-y-6">
            <ApiPreview formData={formData} companyId={selectedCompanyId} />
          </div>
        )}
      </div>
    </PageTemplate>
  );
}
