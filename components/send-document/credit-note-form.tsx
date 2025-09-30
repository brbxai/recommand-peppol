import { useState, useEffect } from "react";
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
import type { CreditNote } from "@peppol/utils/parsing/creditnote/schemas";
import { format } from "date-fns";
import { rc } from "@recommand/lib/client";
import type { Companies } from "@peppol/api/companies";
import { useActiveTeam } from "@core/hooks/user";

const companiesClient = rc<Companies>("peppol");

interface CreditNoteFormProps {
  document: any;
  onChange: (document: any) => void;
  companyId: string;
}

export function CreditNoteForm({
  document,
  onChange,
  companyId,
}: CreditNoteFormProps) {
  const [creditNote, setCreditNote] = useState<Partial<CreditNote>>({
    creditNoteNumber: "",
    issueDate: format(new Date(), "yyyy-MM-dd"),
    lines: [],
    ...document,
  });
  const [openSections, setOpenSections] = useState({
    buyer: true,
    seller: false,
    payment: false,
    notes: false,
    lines: true,
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
          setCreditNote((prev) => ({
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
    onChange(creditNote);
  }, [creditNote]);

  const handleFieldChange = (field: keyof CreditNote, value: any) => {
    setCreditNote((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="creditNoteNumber">Credit Note Number *</Label>
          <Input
            id="creditNoteNumber"
            value={creditNote.creditNoteNumber || ""}
            onChange={(e) =>
              handleFieldChange("creditNoteNumber", e.target.value)
            }
            placeholder="CN-2026-001"
            required
          />
        </div>

        <div>
          <Label htmlFor="issueDate">Issue Date</Label>
          <Input
            id="issueDate"
            type="date"
            value={creditNote.issueDate || ""}
            onChange={(e) => handleFieldChange("issueDate", e.target.value?.trim() ? e.target.value.trim() : null)}
          />
        </div>

        <div>
          <Label htmlFor="buyerReference">Buyer Reference</Label>
          <Input
            id="buyerReference"
            value={creditNote.buyerReference || ""}
            onChange={(e) =>
              handleFieldChange("buyerReference", e.target.value)
            }
            placeholder="Original invoice reference"
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
            party={creditNote.buyer || {}}
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
            party={creditNote.seller || {}}
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
          <span>Credit Note Lines *</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${openSections.lines ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <LineItemsEditor
            lines={creditNote.lines || []}
            onChange={(lines) => handleFieldChange("lines", lines)}
            isCreditNote
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
            paymentMeans={creditNote.paymentMeans || []}
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
              value={creditNote.note || ""}
              onChange={(e) => handleFieldChange("note", e.target.value)}
              placeholder="Reason for credit note"
              rows={3}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
