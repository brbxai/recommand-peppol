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

// Create a reusable decimal transform schema
const decimalSchema = z.union([z.number(), z.string()])
  .transform(toDecimalString)
  .openapi({ type: 'string', example: "100.00" });

const partySchema = z.object({
  vatNumber: z.string().openapi({ example: "BE0123456789" }),
  enterpriseNumber: z.string().openapi({ example: "0123456789" }),
  name: z.string().openapi({ example: "Example Company" }),
  street: z.string().openapi({ example: "Example Street 1" }),
  street2: z.string().nullish().openapi({ example: "Suite 100" }),
  city: z.string().openapi({ example: "Brussels" }),
  postalZone: z.string().openapi({ example: "1000" }),
  country: z.string().length(2, 'Country code must be in ISO 3166-1:Alpha2 format').openapi({ example: "BE" }),
}).openapi({ ref: "Party" });

const paymentMeansSchema = z.object({
  paymentMethod: z.enum(['credit_transfer']).default('credit_transfer').openapi({ example: "credit_transfer" }),
  reference: z.string().openapi({ example: "INV-2026-001" }),
  iban: z.string().openapi({ example: "BE1234567890" }),
}).openapi({ ref: "PaymentMeans" });

const vatCategoryEnum = z.enum(Object.keys(VAT_CATEGORIES) as [VatCategory, ...VatCategory[]])
  .openapi({
    example: "S",
    description: "VAT category code",
    enum: Object.entries(VAT_CATEGORIES).map(([key, value]) => (`${key}: ${value}`))
  });

const vatSchema = z.object({
  category: vatCategoryEnum,
  percentage: decimalSchema,
}).openapi({ ref: "VAT" });

const vatSubtotalSchema = z.object({
  taxableAmount: decimalSchema,
  vatAmount: decimalSchema,
  category: vatCategoryEnum,
  percentage: decimalSchema,
  exemptionReasonCode: z.string().nullish().openapi({description: "If the invoice is exempt from VAT, this is required. The exemption reason code identifier must belong to the CEF VATEX code list	found [here](https://docs.peppol.eu/poacc/billing/3.0/2024-Q4/codelist/vatex/)."}),
}).openapi({ ref: "VATSubtotal" });

const totalsSchema = z.object({
  taxExclusiveAmount: decimalSchema,
  taxInclusiveAmount: decimalSchema,
  payableAmount: decimalSchema.nullish(),
}).openapi({ ref: "Totals", description: "If not provided, the totals will be calculated from the invoice lines." });

const lineSchema = z.object({
  name: z.string().openapi({ example: "Consulting Services" }),
  description: z.string().nullish().openapi({ example: "Professional consulting services" }),
  sellersId: z.string().nullish().openapi({ example: "CS-001" }),
  quantity: decimalSchema,
  unitCode: z.string().openapi({ example: "HUR" }),
  netPriceAmount: decimalSchema,
  netAmount: decimalSchema,
  vat: vatSchema,
}).openapi({ ref: "Line" });

const vatTotalsSchema = z.object({
  totalVatAmount: decimalSchema,
  subtotals: z.array(vatSubtotalSchema),
}).openapi({ ref: "VatTotals", description: "If not provided, the VAT totals will be calculated from the invoice lines." });

export const invoiceSchema = z.object({
  invoiceNumber: z.string().openapi({ example: "INV-2024-001" }),
  issueDate: z.string().date().openapi({ example: "2024-03-20" }),
  dueDate: z.string().date().openapi({ example: "2024-04-20" }),
  note: z.string().nullish().openapi({ example: "Thank you for your business" }),
  buyerReference: z.string().nullish().openapi({ example: "PO-2024-001" }),
  seller: partySchema,
  buyer: partySchema,
  paymentMeans: z.array(paymentMeansSchema),
  paymentTerms: z.object({
    note: z.string().openapi({ example: "Net 30" }),
  }).nullish(),
  lines: z.array(lineSchema),
  totals: totalsSchema.nullish(),
  vat: vatTotalsSchema.nullish(),
}).openapi({ ref: "invoice" });

export type Invoice = z.infer<typeof invoiceSchema>;
export type Party = z.infer<typeof partySchema>;
export type PaymentMeans = z.infer<typeof paymentMeansSchema>;
export type PaymentTerms = z.infer<typeof invoiceSchema.shape.paymentTerms>;
export type Item = z.infer<typeof lineSchema>;
export type Vat = z.infer<typeof vatSchema>;
export type VatSubtotal = z.infer<typeof vatSubtotalSchema>;
export type Totals = z.infer<typeof totalsSchema>;
