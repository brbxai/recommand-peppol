import type { TransmittedDocument } from "@peppol/data/transmitted-documents";
import { BILLING_DOCUMENT_TEMPLATE } from "@peppol/templates/billing-document";
import { PAYMENT_MEANS } from "@peppol/utils/payment-means";
import { getUnitCodeName } from "@peppol/utils/unit-codes";

type AnyParsedDocument =
  | import("@peppol/utils/parsing/invoice/schemas").Invoice
  | import("@peppol/utils/parsing/creditnote/schemas").CreditNote
  | import("@peppol/utils/parsing/self-billing-invoice/schemas").SelfBillingInvoice
  | import("@peppol/utils/parsing/self-billing-creditnote/schemas").SelfBillingCreditNote
  | null;

type TemplateLineDiscount = {
  amount: string;
};

type TemplateLineSurcharge = TemplateLineDiscount;

type TemplateLine = {
  id?: string | null;
  name: string;
  description?: string | null;
  note?: string | null;
  quantity: string;
  unitCode: string;
  unitCodeName: string;
  netPriceAmount: string;
  vatPercentage: string;
  netAmount: string;
  discounts?: TemplateLineDiscount[];
  surcharges?: TemplateLineSurcharge[];
};

type TemplateParty = {
  name?: string | null;
  street?: string | null;
  street2?: string | null;
  postalZone?: string | null;
  city?: string | null;
  country?: string | null;
  vatNumber?: string | null;
};

type TemplateTotals = {
  taxExclusiveAmount?: string | null;
  taxInclusiveAmount?: string | null;
  vatAmount?: string | null;
  discountAmount?: string | null;
  surchargeAmount?: string | null;
  payableAmount?: string | null;
  paidAmount?: string | null;
};

type TemplatePaymentMeans = {
  paymentMethodName: string;
  reference?: string | null;
  iban: string;
  financialInstitutionBranch?: string | null;
};

type TemplateVatSubtotal = {
  taxableAmount: string;
  vatAmount: string;
  category: string;
  percentage: string;
  exemptionReasonCode?: string | null;
  exemptionReason?: string | null;
  currency?: string | null;
};

type BillingTemplateData = {
  documentId: string;
  documentType: string;
  documentTypeLabel: string;
  documentNumber?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  buyerReference?: string | null;
  note?: string | null;
  currency?: string | null;
  seller?: TemplateParty | null;
  buyer?: TemplateParty | null;
  lines: TemplateLine[];
  totals?: TemplateTotals | null;
  vatSubtotals?: TemplateVatSubtotal[] | null;
  paymentMeans?: TemplatePaymentMeans[] | null;
};

const RECOMMAND_RENDER_ENDPOINT = "https://render.recommand.dev";

function getDocumentTypeLabel(type: TransmittedDocument["type"]): string {
  switch (type) {
    case "invoice":
      return "Invoice";
    case "creditNote":
      return "Credit note";
    case "selfBillingInvoice":
      return "Self-billing invoice";
    case "selfBillingCreditNote":
      return "Self-billing credit note";
    default:
      return "Document";
  }
}

function buildTemplateData(document: TransmittedDocument): BillingTemplateData {
  const parsed = document.parsed as AnyParsedDocument;

  const isInvoice =
    document.type === "invoice" || document.type === "selfBillingInvoice";
  const isCreditNote =
    document.type === "creditNote" ||
    document.type === "selfBillingCreditNote";

  const documentNumber =
    (isInvoice && (parsed as any)?.invoiceNumber) ||
    (isCreditNote && (parsed as any)?.creditNoteNumber) ||
    null;

  const issueDate = parsed?.issueDate ?? null;
  const dueDate = (parsed as any)?.dueDate ?? null;
  const buyerReference = parsed?.buyerReference && parsed.buyerReference !== documentNumber ? parsed.buyerReference : null;

  const sellerRaw = (parsed as any)?.seller;
  const buyerRaw = (parsed as any)?.buyer;

  const toParty = (p: any | null | undefined): TemplateParty | null => {
    if (!p) return null;
    return {
      name: p.name ?? null,
      street: p.street ?? null,
      street2: p.street2 ?? null,
      postalZone: p.postalZone ?? null,
      city: p.city ?? null,
      country: p.country ?? null,
      vatNumber: p.vatNumber ?? null,
    };
  };

  const linesRaw: any[] = Array.isArray((parsed as any)?.lines)
    ? (parsed as any).lines
    : [];

  const lines: TemplateLine[] = linesRaw.map((line, index) => {
    const unitCode = line.unitCode ?? "";
    return {
      id: line.id ?? null,
      name: line.name ?? "",
      description: line.description ?? null,
      note: line.note ?? null,
      quantity: String(line.quantity ?? ""),
      unitCode,
      unitCodeName: getUnitCodeName(unitCode),
      netPriceAmount: String(line.netPriceAmount ?? ""),
      vatPercentage: line.vat?.percentage
        ? String(line.vat.percentage)
        : "",
      netAmount: line.netAmount ? String(line.netAmount) : "",
      discounts: Array.isArray(line.discounts) && line.discounts.length > 0
        ? line.discounts.map((discount: any) => ({
            amount: String(discount.amount ?? ""),
          }))
        : undefined,
      surcharges: Array.isArray(line.surcharges) && line.surcharges.length > 0
        ? line.surcharges.map((surcharge: any) => ({
            amount: String(surcharge.amount ?? ""),
          }))
        : undefined,
      // Mustache doesn't support @index, so we synthesise index+1 when building data
    };
  });

  // Inject index+1 into each line for template display
  (lines as any).forEach((line: any, index: number) => {
    line["@indexPlusOne"] = index + 1;
  });

  const totalsRaw = (parsed as any)?.totals;
  const totals: TemplateTotals | null = totalsRaw
    ? (() => {
        const taxExclusiveAmount =
          totalsRaw.taxExclusiveAmount != null
            ? String(totalsRaw.taxExclusiveAmount)
            : null;
        const taxInclusiveAmount =
          totalsRaw.taxInclusiveAmount != null
            ? String(totalsRaw.taxInclusiveAmount)
            : null;

        let vatAmount: string | null = String(parsed?.vat?.totalVatAmount ?? "");

        const payableAmountRaw =
          totalsRaw.payableAmount != null
            ? String(totalsRaw.payableAmount)
            : totalsRaw.taxInclusiveAmount != null
              ? String(totalsRaw.taxInclusiveAmount)
              : null;

        const payableAmount =
          payableAmountRaw != null &&
          taxInclusiveAmount != null &&
          payableAmountRaw !== taxInclusiveAmount
            ? payableAmountRaw
            : null;

        return {
          taxExclusiveAmount,
          taxInclusiveAmount,
          vatAmount,
          discountAmount:
            totalsRaw.discountAmount != null
              ? String(totalsRaw.discountAmount)
              : null,
          surchargeAmount:
            totalsRaw.surchargeAmount != null
              ? String(totalsRaw.surchargeAmount)
              : null,
          payableAmount,
          paidAmount:
            totalsRaw.paidAmount != null && totalsRaw.paidAmount !== "0.00"
              ? String(totalsRaw.paidAmount)
              : null,
        };
      })()
    : null;

  const paymentMeansRaw = parsed?.paymentMeans;
  const paymentMeans: TemplatePaymentMeans[] | null = paymentMeansRaw && Array.isArray(paymentMeansRaw) && paymentMeansRaw.length > 0
    ? paymentMeansRaw.map((payment) => {
        const paymentMethod = PAYMENT_MEANS.find((pm) => pm.key === payment.paymentMethod);
        return {
          paymentMethodName: payment.name || paymentMethod?.name || payment.paymentMethod || "Payment",
          reference: payment.reference || null,
          iban: payment.iban || "",
          financialInstitutionBranch: payment.financialInstitutionBranch || null,
        };
      })
    : null;

  const currency = (parsed as any)?.currency ?? null;
  const vatSubtotalsRaw = (parsed as any)?.vat?.subtotals;
  const vatSubtotals: TemplateVatSubtotal[] | null = vatSubtotalsRaw && Array.isArray(vatSubtotalsRaw) && vatSubtotalsRaw.length > 0
    ? vatSubtotalsRaw.map((subtotal: any) => ({
        taxableAmount: String(subtotal.taxableAmount ?? ""),
        vatAmount: String(subtotal.vatAmount ?? ""),
        category: String(subtotal.category ?? ""),
        percentage: String(subtotal.percentage ?? ""),
        exemptionReasonCode: subtotal.exemptionReasonCode ?? null,
        exemptionReason: subtotal.exemptionReason ?? null,
        currency,
      }))
    : null;

  return {
    documentId: document.id,
    documentType: document.type,
    documentTypeLabel: getDocumentTypeLabel(document.type),
    documentNumber,
    issueDate,
    dueDate,
    buyerReference,
    note: (parsed as any)?.note ?? null,
    currency: (parsed as any)?.currency ?? null,
    seller: toParty(sellerRaw),
    buyer: toParty(buyerRaw),
    lines,
    totals,
    vatSubtotals,
    paymentMeans,
  };
}

async function callTailwindPdfGenerator(
  templateHtml: string,
  data: BillingTemplateData,
  options: { preview: boolean },
): Promise<string | Buffer> {
  const body = JSON.stringify({ html: templateHtml, data });

  const url = options.preview
    ? `${RECOMMAND_RENDER_ENDPOINT}/?preview=true`
    : RECOMMAND_RENDER_ENDPOINT;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Failed to generate document using Tailwind PDF generator");
  }

  if (options.preview) {
    return await response.text();
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function renderDocumentHtml(
  document: TransmittedDocument,
): Promise<string> {
  const data = buildTemplateData(document);
  const html = await callTailwindPdfGenerator(
    BILLING_DOCUMENT_TEMPLATE,
    data,
    { preview: true },
  );
  return html.toString();
}

export async function renderDocumentPdf(
  document: TransmittedDocument,
): Promise<Buffer> {
  const data = buildTemplateData(document);
  const pdf = await callTailwindPdfGenerator(
    BILLING_DOCUMENT_TEMPLATE,
    data,
    { preview: false },
  );
  return pdf as Buffer;
}


