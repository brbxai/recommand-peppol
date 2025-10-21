import { z } from 'zod';
import { Decimal } from 'decimal.js';
import "zod-openapi/extend";

export const VAT_CATEGORIES = {
  AE: 'Vat Reverse Charge',
  E: 'Exempt from Tax',
  S: 'Standard rate',
  Z: 'Zero rated goods',
  G: 'Free export item, VAT not charged',
  O: 'Services outside scope of tax',
  K: 'VAT exempt for EEA intra-community supply',
  L: 'Canary Islands general indirect tax',
  M: 'Tax for production, services and importation in Ceuta and Melilla',
  B: 'Transferred (VAT), In Italy',
} as const;

export type VatCategory = keyof typeof VAT_CATEGORIES;

const toDecimalString = (val: number | string) => new Decimal(val).toFixed(2);
const toUnlimitedDecimalString = (val: number | string) => new Decimal(val).toString();

// Create a reusable decimal transform schema
export const decimalSchema = z.union([z.number(), z.string()])
  .refine((val) => {
    try {
      const decimal = new Decimal(val);
      return decimal.isNaN() === false && decimal.isFinite() === true;
    } catch (error) {
      return false;
    }
  }, { message: "Invalid decimal" })
  .transform(toDecimalString)
  .openapi({ type: 'string', example: "21.00", description: "Decimal number as a string with 2 decimal places" });

export const unlimitedDecimalSchema = z.union([z.number(), z.string()])
  .refine((val) => {
    try {
      const decimal = new Decimal(val);
      return decimal.isNaN() === false && decimal.isFinite() === true;
    } catch (error) {
      return false;
    }
  }, { message: "Invalid decimal" })
  .transform(toUnlimitedDecimalString)
  .openapi({ type: 'string', example: "21.00", description: "Decimal number as a string with flexible precision" });

export const partySchema = z.object({
  vatNumber: z.string().nullish().openapi({ example: "BE0123456789" }),
  name: z.string().openapi({ example: "Example Company" }),
  street: z.string().openapi({ example: "Example Street 1" }),
  street2: z.string().nullish().openapi({ example: "Suite 100" }),
  city: z.string().openapi({ example: "Brussels" }),
  postalZone: z.string().openapi({ example: "1000" }),
  country: z.string().length(2, 'Country code must be in ISO 3166-1:Alpha2 format').openapi({ example: "BE" }),
}).openapi({ ref: "Party" });

export const deliverySchema = z.object({
  date: z.string().date().nullish().openapi({ example: "2025-03-20", description: "The date of the delivery." }),
  locationIdentifier: z.object({
    scheme: z.string().openapi({ example: "0088" }),
    identifier: z.string().openapi({ example: "123456789" }),
  }).nullish().openapi({ example: { scheme: "0088", identifier: "123456789" }, description: "The identifier of the delivery location. Schemes can be found [here](https://docs.peppol.eu/poacc/billing/3.0/codelist/ICD/)." }),
  location: z.object({
    street: z.string().nullish().openapi({ example: "Example Street 1" }),
    street2: z.string().nullish().openapi({ example: "Suite 100" }),
    city: z.string().nullish().openapi({ example: "Brussels" }),
    postalZone: z.string().nullish().openapi({ example: "1000" }),
    country: z.string().length(2, 'Country code must be in ISO 3166-1:Alpha2 format').openapi({ example: "BE" }),
  }),
  recipientName: z.string().openapi({ example: "Company Ltd.", description: "The name of the party to which the goods and services are delivered." }),
}).partial().openapi({ ref: "Delivery" });

export const paymentMeansSchema = z.object({
  paymentMethod: z.enum(['credit_transfer']).default('credit_transfer').openapi({ example: "credit_transfer" }),
  reference: z.string().default("").openapi({ example: "INV-2026-001" }),
  iban: z.string().openapi({ example: "BE1234567890" }),
}).openapi({ ref: "PaymentMeans" });

export const vatCategoryEnum = z.enum(Object.keys(VAT_CATEGORIES) as [VatCategory, ...VatCategory[]])
  .openapi({
    example: "S",
    description: "VAT category code. All codes can be found [here](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL5305/). When sending regular invoices, you should most often use the `S` category. When sending an invoice to another EU country, use the `AE` category for VAT Reverse Charge. In those cases, it is still recommended to include a note in the invoice explaining that the VAT Reverse Charge applies.",
    enum: Object.keys(VAT_CATEGORIES)
  });

export const vatSchema = z.object({
  category: vatCategoryEnum.default("S"),
  percentage: decimalSchema,
}).openapi({ ref: "VAT" });

export const vatSubtotalSchema = z.object({
  taxableAmount: decimalSchema,
  vatAmount: decimalSchema,
  category: vatCategoryEnum,
  percentage: decimalSchema,
  exemptionReasonCode: z.string().nullish().openapi({ description: "If the invoice is exempt from VAT, this is required. The exemption reason code identifier must belong to the CEF VATEX code list	found [here](https://docs.peppol.eu/poacc/billing/3.0/2024-Q4/codelist/vatex/)." }),
}).openapi({ ref: "VATSubtotal" });

export const totalsSchema = z.object({
  linesAmount: decimalSchema.nullish().openapi({ description: "The tax exclusive total amount of all lines. Rounded to 2 decimal places." }),
  discountAmount: decimalSchema.nullish().openapi({ description: "The tax exclusive total amount of all discounts. If not provided, this will be calculated automatically." }),
  surchargeAmount: decimalSchema.nullish().openapi({ description: "The tax exclusive total amount of all surcharges. If not provided, this will be calculated automatically." }),
  taxExclusiveAmount: decimalSchema.openapi({ description: "The tax exclusive total amount of all lines, discounts and surcharges. Rounded to 2 decimal places." }),
  taxInclusiveAmount: decimalSchema.openapi({ description: "The tax inclusive total amount of all lines, discounts and surcharges. Rounded to 2 decimal places." }),
  payableAmount: decimalSchema.nullish().openapi({ description: "The amount to be paid. If not provided, this will be taxInclusiveAmount. Can be used in combination with paidAmount to indicate partial payment or payment rounding. Rounded to 2 decimal places." }),
  paidAmount: decimalSchema.nullish().openapi({ description: "The amount paid. If not provided, this will be taxInclusiveAmount - payableAmount. Can be used in combination with payableAmount to indicate partial payment or payment rounding. Rounded to 2 decimal places." }),
}).openapi({ ref: "Totals", description: "If not provided, the totals will be calculated from the document lines." });

export const lineSchema = z.object({
  name: z.string().default("").openapi({ example: "Consulting Services" }),
  description: z.string().nullish().openapi({ example: "Professional consulting services" }),
  buyersId: z.string().nullish().openapi({ example: "CS-001", description: "The item identifier of the item as defined by the buyer." }),
  sellersId: z.string().nullish().openapi({ example: "CS-001", description: "The item identifier of the item as defined by the seller. This is typically a product code or SKU." }),
  standardId: z.object({
    scheme: z.string().openapi({ example: "0160" }),
    identifier: z.string().openapi({ example: "10986700" }),
  }).nullish().openapi({ description: "The standard identifier of the item based on a registered scheme. Schemes can be found [here](https://docs.peppol.eu/poacc/billing/3.0/codelist/ICD/)." }),
  originCountry: z.string().length(2, 'Country code must be in ISO 3166-1:Alpha2 format').nullish().openapi({ example: "BE", description: "The country of origin of the item." }),
  quantity: unlimitedDecimalSchema.default("1.00"),
  unitCode: z.string().default("C62").openapi({ example: "HUR", description: "Recommended unit codes can be found [here](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNECERec20/)." }),
  netPriceAmount: unlimitedDecimalSchema,
  netAmount: decimalSchema.nullish().openapi({ description: "The total net amount of the line: quantity * netPriceAmount. Rounded to 2 decimal places. If not provided, it will be calculated automatically." }),
  vat: vatSchema,
}).openapi({ ref: "Line" });

export const vatTotalsSchema = z.object({
  totalVatAmount: decimalSchema,
  subtotals: z.array(vatSubtotalSchema),
}).openapi({ ref: "VatTotals", description: "If not provided, the VAT totals will be calculated from the document lines." });

export const attachmentSchema = z.object({
  id: z.string().openapi({ example: "ATT-001" }),
  mimeCode: z.string().default("application/pdf").openapi({
    example: "application/pdf",
    description: "MIME type of the document (e.g. application/pdf, text/csv, image/png)"
  }),
  filename: z.string().openapi({ example: "contract.pdf" }),
  description: z.string().nullish().openapi({ example: "Signed contract" }),
  embeddedDocument: z.string().nullish().openapi({ description: "base64 encoded document" }),
  url: z.string().nullish().openapi({ example: "https://example.com/contract.pdf" }),
}).openapi({ ref: "Attachment" });

export const discountSchema = z.object({
  reasonCode: z.string().nullish().openapi({ example: "95", description: "The reason code for the discount. This must be one of the codes in the [UNCL5189 subset](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL5189/) code list. For example, `95` for regular discounts. Either reason or reasonCode must be provided." }),
  reason: z.string().nullish().openapi({ example: "Discount", description: "The reason for the discount. This is a free text field. Either reason or reasonCode must be provided." }),
  amount: decimalSchema,
  vat: vatSchema,
})
.refine((data) => data.reasonCode || data.reason, { message: "Either reason or reasonCode must be provided." })
.openapi({ ref: "Discount" });

export const surchargeSchema = z.object({
  reasonCode: z.string().nullish().openapi({ example: "FC", description: "The reason code for the surcharge. This must be one of the codes in the [UNCL7161 subset](https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL7161/) code list. For example, `FC` for freight services. Either reason or reasonCode must be provided." }),
  reason: z.string().nullish().openapi({ example: "Freight services", description: "The reason for the surcharge. This is a free text field. Either reason or reasonCode must be provided." }),
  amount: decimalSchema,
  vat: vatSchema,
})
.refine((data) => data.reasonCode || data.reason, { message: "Either reason or reasonCode must be provided." })
.openapi({ ref: "Surcharge" });

export const _invoiceSchema = z.object({
  invoiceNumber: z.string().openapi({ example: "INV-2024-001" }),
  issueDate: z.string().date().openapi({ example: "2024-03-20" }),
  dueDate: z.string().date().nullish().openapi({ example: "2024-04-20" }),
  note: z.string().nullish().openapi({ example: "Thank you for your business" }),
  buyerReference: z.string().nullish().openapi({ example: "PO-2024-001" }),
  purchaseOrderReference: z.string().nullish().openapi({ example: "PO-2024-001", description: "A reference to a related purchase order" }),
  despatchReference: z.string().nullish().openapi({ example: "DE-2024-001", description: "A reference to a related despatch advice document (e.g. packing slip)" }),
  seller: partySchema,
  buyer: partySchema,
  delivery: deliverySchema.nullish().openapi({ description: "Optional delivery information." }),
  paymentMeans: z.array(paymentMeansSchema).nullish().openapi({ description: "Optional payment information. For most invoices, this should be provided. For prepaid invoices, this could be omitted." }),
  paymentTerms: z.object({
    note: z.string().openapi({ example: "Net 30" }),
  }).nullish(),
  lines: z.array(lineSchema).min(1),
  discounts: z.array(discountSchema).nullish().openapi({ description: "Optional global discounts" }),
  surcharges: z.array(surchargeSchema).nullish().openapi({ description: "Optional global surcharges" }),
  totals: totalsSchema.nullish(),
  vat: vatTotalsSchema.nullish(),
  attachments: z.array(attachmentSchema).nullish().openapi({ description: "Optional attachments to the invoice" }),
})

export const invoiceSchema = _invoiceSchema.openapi({ ref: "Invoice" });

export const _sendInvoiceSchema = invoiceSchema.extend({
  issueDate: z.string().date().nullish().openapi({ example: "2024-03-20", description: "If not provided, the issue date will be the current date." }),
  dueDate: z.string().date().nullish().openapi({ example: "2024-04-20", description: "If not provided, the due date will be 1 month from the issue date." }),
  seller: partySchema.nullish().openapi({ description: "If not provided, the seller will be the company that is sending the invoice." }),
})

export const sendInvoiceSchema = _sendInvoiceSchema.openapi({ ref: "SendInvoice", title: "Invoice to send", description: "Invoice to send to a recipient" });

export type Invoice = z.infer<typeof invoiceSchema>;
export type DocumentLine = z.infer<typeof lineSchema>;
export type Party = z.infer<typeof partySchema>;
export type PaymentMeans = z.infer<typeof paymentMeansSchema>;
export type PaymentTerms = z.infer<typeof invoiceSchema.shape.paymentTerms>;
export type Item = z.infer<typeof lineSchema>;
export type Vat = z.infer<typeof vatSchema>;
export type VatSubtotal = z.infer<typeof vatSubtotalSchema>;
export type Totals = z.infer<typeof totalsSchema>;
