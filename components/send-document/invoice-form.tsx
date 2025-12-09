import { useState, useEffect, useMemo } from "react";
import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { Textarea } from "@core/components/ui/textarea";
import { LineItemsEditor } from "./line-items-editor";
import { PartyForm } from "./party-form";
import { PaymentMeansForm } from "./payment-means-form";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@core/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
import { format } from "date-fns";
import { rc } from "@recommand/lib/client";
import type { Companies } from "@peppol/api/companies";
import { useActiveTeam } from "@core/hooks/user";
import { AttachmentsEditor } from "./attachments-editor";
import { isTaxExemptionReasonRequired } from "@peppol/utils/parsing/invoice/calculations";

const companiesClient = rc<Companies>("peppol");

interface InvoiceFormProps {
  document: any;
  onChange: (document: any) => void;
  companyId: string;
}

export function InvoiceForm({
  document,
  onChange,
  companyId,
}: InvoiceFormProps) {
  const [invoice, setInvoice] = useState<Partial<Invoice>>({
    invoiceNumber: "",
    issueDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd"
    ),
    lines: [],
    attachments: [],
    ...document,
  });
  const [openSections, setOpenSections] = useState({
    buyer: true,
    seller: false,
    payment: false,
    notes: false,
    lines: true,
    attachments: false,
  });
  const activeTeam = useActiveTeam();

  // Auto-populate seller info when company changes
  useEffect(() => {
    const loadCompanyInfo = async () => {
      if (!companyId || !activeTeam?.id) return;

      try {
        const response = await companiesClient[":teamId"]["companies"][
          ":companyId"
        ].$get({
          param: { teamId: activeTeam.id, companyId },
        });
        const json = await response.json();

        if (json.success && json.company) {
          const company = json.company;
          setInvoice((prev) => ({
            ...prev,
            seller: {
              vatNumber: company.vatNumber || "",
              name: company.name,
              street: company.address,
              city: company.city,
              postalZone: company.postalCode,
              country: company.country,
            },
          }));
        }
      } catch (error) {
        console.error("Failed to load company info:", error);
      }
    };

    loadCompanyInfo();
  }, [companyId, activeTeam?.id]);

  useEffect(() => {
    onChange(invoice);
  }, [invoice]);

  const handleFieldChange = (field: keyof Invoice, value: any) => {
    setInvoice((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const requiresExemptionReason = useMemo(() => {
    return (invoice.lines || []).some(
      (line) => line.vat && isTaxExemptionReasonRequired(line.vat.category)
    );
  }, [invoice.lines]);

  useEffect(() => {
    if (!requiresExemptionReason && invoice.vat && typeof invoice.vat === "object" && "exemptionReason" in invoice.vat) {
      setInvoice((prev) => {
        const { vat, ...rest } = prev;
        return rest;
      });
    }
  }, [requiresExemptionReason]);

  const handleVatExemptionReasonChange = (value: string) => {
    setInvoice((prev) => ({
      ...prev,
      vat: value.trim() ? ({ exemptionReason: value } as any) : undefined,
    }));
  };

  const vatExemptionReason =
    invoice.vat && typeof invoice.vat === "object" && "exemptionReason" in invoice.vat
      ? (invoice.vat.exemptionReason as string) || ""
      : "";

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="invoiceNumber">Invoice Number *</Label>
          <Input
            id="invoiceNumber"
            value={invoice.invoiceNumber || ""}
            onChange={(e) => handleFieldChange("invoiceNumber", e.target.value)}
            placeholder="INV-2026-001"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="issueDate">Issue Date</Label>
            <Input
              id="issueDate"
              type="date"
              value={invoice.issueDate || ""}
              onChange={(e) => handleFieldChange("issueDate", e.target.value?.trim() ? e.target.value.trim() : null)}
            />
          </div>
          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={invoice.dueDate || ""}
              onChange={(e) => handleFieldChange("dueDate", e.target.value?.trim() ? e.target.value.trim() : null)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="buyerReference">Buyer Reference</Label>
          <Input
            id="buyerReference"
            value={invoice.buyerReference || ""}
            onChange={(e) =>
              handleFieldChange("buyerReference", e.target.value)
            }
            placeholder="PO-2026-001"
          />
        </div>
      </div>

      <Collapsible open={openSections.buyer}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between py-2 font-medium transition-colors hover:text-primary"
          onClick={() => toggleSection("buyer")}
        >
          <span>Buyer Information *</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${openSections.buyer ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <PartyForm
            party={invoice.buyer || {}}
            onChange={(buyer) => handleFieldChange("buyer", buyer)}
            required
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openSections.seller}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between py-2 font-medium transition-colors hover:text-primary"
          onClick={() => toggleSection("seller")}
        >
          <span>Seller Information (Auto-populated)</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${openSections.seller ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <PartyForm
            party={invoice.seller || {}}
            onChange={(seller) => handleFieldChange("seller", seller)}
            disabled
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openSections.lines}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between py-2 font-medium transition-colors hover:text-primary"
          onClick={() => toggleSection("lines")}
        >
          <span>Invoice Lines *</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${openSections.lines ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <LineItemsEditor
            lines={invoice.lines || []}
            onChange={(lines) => handleFieldChange("lines", lines)}
          />
        </CollapsibleContent>
      </Collapsible>

      {requiresExemptionReason && (
        <div>
          <Label htmlFor="vatExemptionReason">VAT Exemption Reason *</Label>
          <Textarea
            id="vatExemptionReason"
            value={vatExemptionReason}
            onChange={(e) => handleVatExemptionReasonChange(e.target.value)}
            placeholder="Reason why the invoice is exempt from VAT"
            rows={3}
            required
          />
        </div>
      )}

      <Collapsible open={openSections.attachments}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between py-2 font-medium transition-colors hover:text-primary"
          onClick={() => toggleSection("attachments")}
        >
          <span>Attachments</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${openSections.attachments ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <AttachmentsEditor
            attachments={invoice.attachments || []}
            onChange={(attachments) =>
              handleFieldChange("attachments", attachments)
            }
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openSections.payment}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between py-2 font-medium transition-colors hover:text-primary"
          onClick={() => toggleSection("payment")}
        >
          <span>Payment Information</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${openSections.payment ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <PaymentMeansForm
            paymentMeans={invoice.paymentMeans || []}
            onChange={(paymentMeans) =>
              handleFieldChange("paymentMeans", paymentMeans)
            }
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={openSections.notes}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between py-2 font-medium transition-colors hover:text-primary"
          onClick={() => toggleSection("notes")}
        >
          <span>Additional Notes</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${openSections.notes ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div>
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={invoice.note || ""}
              onChange={(e) => handleFieldChange("note", e.target.value)}
              placeholder="Thank you for your business"
              rows={3}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
