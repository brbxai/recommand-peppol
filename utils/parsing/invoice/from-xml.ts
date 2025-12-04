import { XMLParser } from "fast-xml-parser";
import { invoiceSchema, type Invoice } from "./schemas";
import { getTextContent, getNumberContent, getPercentage, getNullableTextContent, getNullableNumberContent } from "../xml-helpers";
import type { SelfBillingInvoice } from "../self-billing-invoice/schemas";
import { getPaymentKeyByCode } from "@peppol/utils/payment-means";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name, jpath) => {
    return name === "InvoiceLine" ||
      name === "PaymentMeans" ||
      name === "TaxSubtotal" ||
      name === "PartyIdentification" ||
      name === "AdditionalDocumentReference" ||
      name === "AllowanceCharge";
  },
  parseAttributeValue: false,
  parseTagValue: false,
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
  const purchaseOrderReference = getNullableTextContent(invoice.OrderReference?.ID);
  const buyerReference = getNullableTextContent(invoice.BuyerReference);
  const despatchReference = getNullableTextContent(invoice.DespatchDocumentReference?.ID);

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

  // Extract delivery information
  const delivery = invoice.Delivery ? {
    date: getNullableTextContent(invoice.Delivery?.ActualDeliveryDate),
    locationIdentifier: invoice.Delivery?.DeliveryLocation?.ID ? {
      scheme: getTextContent(invoice.Delivery?.DeliveryLocation?.ID?.["@_schemeID"]),
      identifier: getTextContent(invoice.Delivery?.DeliveryLocation?.ID?.["#text"]),
    } : undefined,
    location: invoice.Delivery?.DeliveryLocation?.Address?.Country ? {
      street: getNullableTextContent(invoice.Delivery?.DeliveryLocation?.Address?.StreetName),
      street2: getNullableTextContent(invoice.Delivery?.DeliveryLocation?.Address?.AdditionalStreetName),
      city: getNullableTextContent(invoice.Delivery?.DeliveryLocation?.Address?.CityName),
      postalZone: getNullableTextContent(invoice.Delivery?.DeliveryLocation?.Address?.PostalZone),
      country: getTextContent(invoice.Delivery?.DeliveryLocation?.Address?.Country?.IdentificationCode),
    } : undefined,
    recipientName: invoice.Delivery?.DeliveryParty?.PartyName ? getTextContent(invoice.Delivery?.DeliveryParty?.PartyName?.Name) : undefined,
  } : undefined;

  // Extract payment means
  const paymentMeans = (invoice.PaymentMeans || []).map((payment: any) => ({
    paymentMethod: getPaymentKeyByCode(getTextContent(payment.PaymentMeansCode)),
    reference: getTextContent(payment.PaymentID),
    iban: getTextContent(payment.PayeeFinancialAccount?.ID),
    financialInstitutionBranch: getNullableTextContent(payment.PayeeFinancialAccount?.FinancialInstitutionBranch?.ID),
  }));

  // Extract payment terms if present
  const paymentTerms = invoice.PaymentTerms ? {
    note: getTextContent(invoice.PaymentTerms.Note),
  } : undefined;

  // Extract invoice lines
  const lines = (invoice.InvoiceLine || []).map((line: any) => ({
    id: getTextContent(line.ID),
    name: getTextContent(line.Item?.Name),
    description: getTextContent(line.Item?.Description),
    note: getNullableTextContent(line.Note),
    buyersId: getNullableTextContent(line.Item?.BuyersItemIdentification?.ID),
    sellersId: getNullableTextContent(line.Item?.SellersItemIdentification?.ID),
    standardId: line.Item?.StandardItemIdentification?.ID ? {
      scheme: getTextContent(line.Item.StandardItemIdentification.ID["@_schemeID"]),
      identifier: getTextContent(line.Item.StandardItemIdentification.ID["#text"]),
    } : null,
    originCountry: getNullableTextContent(line.Item?.OriginCountry?.IdentificationCode),
    quantity: getNumberContent(line.InvoicedQuantity),
    unitCode: getTextContent(line.InvoicedQuantity?.["@_unitCode"]),
    netAmount: getNumberContent(line.LineExtensionAmount),
    netPriceAmount: getNumberContent(line.Price?.PriceAmount),
    vat: {
      category: getTextContent(line.Item?.ClassifiedTaxCategory?.ID),
      percentage: getPercentage(line.Item?.ClassifiedTaxCategory?.Percent),
    },
    discounts: (line.AllowanceCharge || []).filter((discount: any) => discount.ChargeIndicator === "false").map((discount: any) => ({
      reasonCode: getNullableTextContent(discount.AllowanceChargeReasonCode),
      reason: getNullableTextContent(discount.AllowanceChargeReason),
      amount: getNumberContent(discount.Amount),
    })),
    surcharges: (line.AllowanceCharge || []).filter((surcharge: any) => surcharge.ChargeIndicator === "true").map((surcharge: any) => ({
      reasonCode: getNullableTextContent(surcharge.AllowanceChargeReasonCode),
      reason: getNullableTextContent(surcharge.AllowanceChargeReason),
      amount: getNumberContent(surcharge.Amount),
    }))
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
      exemptionReasonCode: getNullableTextContent(subtotal.TaxCategory?.TaxExemptionReasonCode),
      exemptionReason: getNullableTextContent(subtotal.TaxCategory?.TaxExemptionReason),
    })),
  };

  // Extract totals
  const legalMonetaryTotal = invoice.LegalMonetaryTotal;
  if (!legalMonetaryTotal) {
    throw new Error("Invalid XML: No legal monetary total information found");
  }

  const totals = {
    linesAmount: getNumberContent(legalMonetaryTotal.LineExtensionAmount),
    discountAmount: getNullableNumberContent(legalMonetaryTotal.AllowanceTotalAmount),
    surchargeAmount: getNullableNumberContent(legalMonetaryTotal.ChargeTotalAmount),
    taxExclusiveAmount: getNumberContent(legalMonetaryTotal.TaxExclusiveAmount),
    taxInclusiveAmount: getNumberContent(legalMonetaryTotal.TaxInclusiveAmount),
    paidAmount: getNullableNumberContent(legalMonetaryTotal.PrepaidAmount),
    payableAmount: getNumberContent(legalMonetaryTotal.PayableAmount),
  };

  // Extract discounts
  const discounts = (invoice.AllowanceCharge || []).filter((discount: any) => discount.ChargeIndicator === "false").map((discount: any) => ({
    reasonCode: getNullableTextContent(discount.AllowanceChargeReasonCode),
    reason: getNullableTextContent(discount.AllowanceChargeReason),
    amount: getNumberContent(discount.Amount),
    vat: {
      category: getTextContent(discount.TaxCategory?.ID),
      percentage: getPercentage(discount.TaxCategory?.Percent),
    },
  }));

  // Extract surcharges
  const surcharges = (invoice.AllowanceCharge || []).filter((surcharge: any) => surcharge.ChargeIndicator === "true").map((surcharge: any) => ({
    reasonCode: getNullableTextContent(surcharge.AllowanceChargeReasonCode),
    reason: getNullableTextContent(surcharge.AllowanceChargeReason),
    amount: getNumberContent(surcharge.Amount),
    vat: {
      category: getTextContent(surcharge.TaxCategory?.ID),
      percentage: getPercentage(surcharge.TaxCategory?.Percent),
    },
  }));

  const parsedInvoice: Invoice & SelfBillingInvoice = {
    invoiceNumber,
    issueDate,
    dueDate,
    note,
    purchaseOrderReference,
    buyerReference,
    despatchReference,
    attachments: attachments.length > 0 ? attachments : [],
    seller,
    buyer,
    delivery,
    paymentMeans,
    paymentTerms,
    lines,
    vat,
    discounts,
    surcharges,
    totals,
    currency: getTextContent(invoice.DocumentCurrencyCode), // TODO: Keep in mind that the VAT accounting curency code and the invoice total VAT amount can technically be in a different currency than the document currency
  };

  // Validate the parsed invoice
  const zodInvoice = invoiceSchema.parse(parsedInvoice);

  return zodInvoice;
} 