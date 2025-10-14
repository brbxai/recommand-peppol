import { XMLParser } from "fast-xml-parser";
import { invoiceSchema, type Invoice } from "./schemas";
import { getTextContent, getNumberContent, getPercentage, getNullableTextContent } from "../xml-helpers";
import type { SelfBillingInvoice } from "../self-billing-invoice/schemas";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name, jpath) => {
    return name === "InvoiceLine" || 
           name === "PaymentMeans" || 
           name === "TaxSubtotal" ||
           name === "PartyIdentification" ||
           name === "AdditionalDocumentReference";
  },
  removeNSPrefix: true,
});

export function parseInvoiceFromXML(xml: string): Invoice & SelfBillingInvoice {
  const parsed = parser.parse(xml);
  const invoice = parsed.Invoice;

  if (!invoice) {
    throw new Error("Invalid XML: No Invoice element found");
  }

  // Extract basic invoice information
  const invoiceNumber = getTextContent(invoice.ID);
  const issueDate = getTextContent(invoice.IssueDate);
  const dueDate = getNullableTextContent(invoice.DueDate);
  const note = getTextContent(invoice.Note);
  const buyerReference = getTextContent(invoice.BuyerReference);

  // Extract attachments
  const attachments = (invoice.AdditionalDocumentReference || []).map((ref: any) => ({
    id: getTextContent(ref.ID),
    description: getTextContent(ref.DocumentDescription),
    mimeCode: getTextContent(ref.Attachment?.EmbeddedDocumentBinaryObject?.["@_mimeCode"]),
    filename: getTextContent(ref.Attachment?.EmbeddedDocumentBinaryObject?.["@_filename"]),
    embeddedDocument: getTextContent(ref.Attachment?.EmbeddedDocumentBinaryObject?.["#text"]),
    url: getTextContent(ref.Attachment?.ExternalReference?.URI),
  }));

  // Extract seller information
  const sellerParty = invoice.AccountingSupplierParty?.Party;
  if (!sellerParty) {
    throw new Error("Invalid XML: No seller party information found");
  }

  const seller = {
    name: getTextContent(sellerParty.PartyName?.Name),
    street: getTextContent(sellerParty.PostalAddress?.StreetName),
    street2: getTextContent(sellerParty.PostalAddress?.AdditionalStreetName),
    city: getTextContent(sellerParty.PostalAddress?.CityName),
    postalZone: getTextContent(sellerParty.PostalAddress?.PostalZone),
    country: getTextContent(sellerParty.PostalAddress?.Country?.IdentificationCode),
    vatNumber: sellerParty.PartyTaxScheme?.CompanyID ? getTextContent(sellerParty.PartyTaxScheme?.CompanyID) : null,
  };

  // Extract buyer information
  const buyerParty = invoice.AccountingCustomerParty?.Party;
  if (!buyerParty) {
    throw new Error("Invalid XML: No buyer party information found");
  }

  const buyer = {
    name: getTextContent(buyerParty.PartyName?.Name),
    street: getTextContent(buyerParty.PostalAddress?.StreetName),
    street2: getTextContent(buyerParty.PostalAddress?.AdditionalStreetName),
    city: getTextContent(buyerParty.PostalAddress?.CityName),
    postalZone: getTextContent(buyerParty.PostalAddress?.PostalZone),
    country: getTextContent(buyerParty.PostalAddress?.Country?.IdentificationCode),
    vatNumber: buyerParty.PartyTaxScheme?.CompanyID ? getTextContent(buyerParty.PartyTaxScheme?.CompanyID) : null,
  };

  // Extract payment means
  const paymentMeans = (invoice.PaymentMeans || []).map((payment: any) => ({
    paymentMethod: 'credit_transfer' as const,
    reference: getTextContent(payment.PaymentID),
    iban: getTextContent(payment.PayeeFinancialAccount?.ID),
  }));

  // Extract payment terms if present
  const paymentTerms = invoice.PaymentTerms ? {
    note: getTextContent(invoice.PaymentTerms.Note),
  } : undefined;

  // Extract invoice lines
  const lines = (invoice.InvoiceLine || []).map((line: any) => ({
    name: getTextContent(line.Item?.Name),
    description: getTextContent(line.Item?.Description),
    sellersId: getTextContent(line.Item?.StandardItemIdentification?.ID),
    quantity: getNumberContent(line.InvoicedQuantity),
    unitCode: getTextContent(line.InvoicedQuantity?.["@_unitCode"]),
    netAmount: getNumberContent(line.LineExtensionAmount),
    netPriceAmount: getNumberContent(line.Price?.PriceAmount),
    vat: {
      category: getTextContent(line.Item?.ClassifiedTaxCategory?.ID),
      percentage: getPercentage(line.Item?.ClassifiedTaxCategory?.Percent),
    },
  }));

  // Extract VAT information
  const taxTotal = invoice.TaxTotal;
  if (!taxTotal) {
    throw new Error("Invalid XML: No tax total information found");
  }

  const vat = {
    totalVatAmount: getNumberContent(taxTotal.TaxAmount),
    subtotals: (taxTotal.TaxSubtotal || []).map((subtotal: any) => ({
      taxableAmount: getNumberContent(subtotal.TaxableAmount),
      vatAmount: getNumberContent(subtotal.TaxAmount),
      category: getTextContent(subtotal.TaxCategory?.ID),
      percentage: getPercentage(subtotal.TaxCategory?.Percent),
      exemptionReasonCode: getTextContent(subtotal.TaxCategory?.TaxExemptionReasonCode),
    })),
  };

  // Extract totals
  const legalMonetaryTotal = invoice.LegalMonetaryTotal;
  if (!legalMonetaryTotal) {
    throw new Error("Invalid XML: No legal monetary total information found");
  }

  const totals = {
    taxExclusiveAmount: getNumberContent(legalMonetaryTotal.TaxExclusiveAmount),
    taxInclusiveAmount: getNumberContent(legalMonetaryTotal.TaxInclusiveAmount),
    payableAmount: getNumberContent(legalMonetaryTotal.PayableAmount),
  };

  const parsedInvoice = {
    invoiceNumber,
    issueDate,
    dueDate,
    note,
    buyerReference,
    attachments: attachments.length > 0 ? attachments : [],
    seller,
    buyer,
    paymentMeans,
    paymentTerms,
    lines,
    vat,
    totals,
  };

  // Validate the parsed invoice
  const zodInvoice = invoiceSchema.parse(parsedInvoice);

  return zodInvoice;
} 