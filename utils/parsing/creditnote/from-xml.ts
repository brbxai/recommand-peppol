import { XMLParser } from "fast-xml-parser";
import { creditNoteSchema, type CreditNote } from "./schemas";
import { getTextContent, getNumberContent, getPercentage, getNullableTextContent, getNullableNumberContent } from "../xml-helpers";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name, jpath) => {
    return name === "CreditNoteLine" || 
           name === "PaymentMeans" || 
           name === "TaxSubtotal" ||
           name === "PartyIdentification" ||
           name === "AdditionalDocumentReference" ||
           name === "BillingReference" ||
           name === "AllowanceCharge";
  },
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
});

export function parseCreditNoteFromXML(xml: string): CreditNote {
  const parsed = parser.parse(xml);
  const creditNote = parsed.CreditNote;

  if (!creditNote) {
    throw new Error("Invalid XML: No CreditNote element found");
  }

  // Extract basic credit note information
  const creditNoteNumber = getTextContent(creditNote.ID);
  const issueDate = getTextContent(creditNote.IssueDate);
  const note = getTextContent(creditNote.Note);
  const purchaseOrderReference = getNullableTextContent(creditNote.OrderReference?.ID);
  const buyerReference = getNullableTextContent(creditNote.BuyerReference);
  const despatchReference = getNullableTextContent(creditNote.DespatchDocumentReference?.ID);
  const invoiceReferences = (creditNote.BillingReference || []).map((reference: any) => ({
    id: getTextContent(reference.InvoiceDocumentReference?.ID),
    issueDate: reference.InvoiceDocumentReference?.IssueDate ? getTextContent(reference.InvoiceDocumentReference?.IssueDate) : null,
  }));

  // Extract attachments
  const attachments = (creditNote.AdditionalDocumentReference || []).map((ref: any) => ({
    id: getTextContent(ref.ID),
    description: getTextContent(ref.DocumentDescription),
    mimeCode: getTextContent(ref.Attachment?.EmbeddedDocumentBinaryObject?.["@_mimeCode"]),
    filename: getTextContent(ref.Attachment?.EmbeddedDocumentBinaryObject?.["@_filename"]),
    embeddedDocument: getTextContent(ref.Attachment?.EmbeddedDocumentBinaryObject?.["#text"]),
    url: getTextContent(ref.Attachment?.ExternalReference?.URI),
  }));

  // Extract seller information
  const sellerParty = creditNote.AccountingSupplierParty?.Party;
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
  const buyerParty = creditNote.AccountingCustomerParty?.Party;
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
  const delivery = creditNote.Delivery ? {
    date: getNullableTextContent(creditNote.Delivery?.ActualDeliveryDate),
    locationIdentifier: creditNote.Delivery?.DeliveryLocation?.ID ? {
      scheme: getTextContent(creditNote.Delivery?.DeliveryLocation?.ID?.["@_schemeID"]),
      identifier: getTextContent(creditNote.Delivery?.DeliveryLocation?.ID?.["#text"]),
    } : undefined,
    location: creditNote.Delivery?.DeliveryLocation?.Address?.Country ? {
      street: getNullableTextContent(creditNote.Delivery?.DeliveryLocation?.Address?.StreetName),
      street2: getNullableTextContent(creditNote.Delivery?.DeliveryLocation?.Address?.AdditionalStreetName),
      city: getNullableTextContent(creditNote.Delivery?.DeliveryLocation?.Address?.CityName),
      postalZone: getNullableTextContent(creditNote.Delivery?.DeliveryLocation?.Address?.PostalZone),
      country: getTextContent(creditNote.Delivery?.DeliveryLocation?.Address?.Country?.IdentificationCode),
    } : undefined,
    recipientName: creditNote.Delivery?.DeliveryParty?.PartyName ? getTextContent(creditNote.Delivery?.DeliveryParty?.PartyName?.Name) : undefined,
  } : undefined;

  // Extract payment means
  const paymentMeans = (creditNote.PaymentMeans || []).map((payment: any) => ({
    paymentMethod: 'credit_transfer' as const,
    reference: getTextContent(payment.PaymentID),
    iban: getTextContent(payment.PayeeFinancialAccount?.ID),
  }));

  // Extract payment terms if present
  const paymentTerms = creditNote.PaymentTerms ? {
    note: getTextContent(creditNote.PaymentTerms.Note),
  } : undefined;

  // Extract credit note lines
  const lines = (creditNote.CreditNoteLine || []).map((line: any) => ({
    name: getTextContent(line.Item?.Name),
    description: getTextContent(line.Item?.Description),
    buyersId: getNullableTextContent(line.Item?.BuyersItemIdentification?.ID),
    sellersId: getNullableTextContent(line.Item?.SellersItemIdentification?.ID),
    standardId: line.Item?.StandardItemIdentification?.ID ? {
      scheme: getTextContent(line.Item.StandardItemIdentification.ID["@_schemeID"]),
      identifier: getTextContent(line.Item.StandardItemIdentification.ID["#text"]),
    } : null,
    originCountry: getNullableTextContent(line.Item?.OriginCountry?.IdentificationCode),
    quantity: getNumberContent(line.CreditedQuantity),
    unitCode: getTextContent(line.CreditedQuantity?.["@_unitCode"]),
    netAmount: getNumberContent(line.LineExtensionAmount),
    netPriceAmount: getNumberContent(line.Price?.PriceAmount),
    vat: {
      category: getTextContent(line.Item?.ClassifiedTaxCategory?.ID),
      percentage: getPercentage(line.Item?.ClassifiedTaxCategory?.Percent),
    },
  }));

  // Extract VAT information
  const taxTotal = creditNote.TaxTotal;
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
  const legalMonetaryTotal = creditNote.LegalMonetaryTotal;
  if (!legalMonetaryTotal) {
    throw new Error("Invalid XML: No legal monetary total information found");
  }

  const totals = {
    linesAmount: getNumberContent(legalMonetaryTotal.LineExtensionAmount),
    discountAmount: getNullableNumberContent(legalMonetaryTotal.AllowanceTotalAmount),
    surchargeAmount: getNullableNumberContent(legalMonetaryTotal.ChargeTotalAmount),
    taxExclusiveAmount: getNumberContent(legalMonetaryTotal.TaxExclusiveAmount),
    taxInclusiveAmount: getNumberContent(legalMonetaryTotal.TaxInclusiveAmount),
    payableAmount: getNumberContent(legalMonetaryTotal.PayableAmount),
  };

  // Extract discounts
  const discounts = (creditNote.AllowanceCharge || []).filter((discount: any) => discount.ChargeIndicator === "false").map((discount: any) => ({
    reasonCode: getNullableTextContent(discount.AllowanceChargeReasonCode),
    reason: getNullableTextContent(discount.AllowanceChargeReason),
    amount: getNumberContent(discount.Amount),
    vat: {
      category: getTextContent(discount.TaxCategory?.ID),
      percentage: getPercentage(discount.TaxCategory?.Percent),
    },
  }));

  // Extract surcharges
  const surcharges = (creditNote.AllowanceCharge || []).filter((surcharge: any) => surcharge.ChargeIndicator === "true").map((surcharge: any) => ({
    reasonCode: getNullableTextContent(surcharge.AllowanceChargeReasonCode),
    reason: getNullableTextContent(surcharge.AllowanceChargeReason),
    amount: getNumberContent(surcharge.Amount),
    vat: {
      category: getTextContent(surcharge.TaxCategory?.ID),
      percentage: getPercentage(surcharge.TaxCategory?.Percent),
    },
  }));

  const parsedCreditNote = {
    creditNoteNumber,
    issueDate,
    note,
    purchaseOrderReference,
    buyerReference,
    despatchReference,
    invoiceReferences,
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
  };

  // Validate the parsed credit note
  const zodCreditNote = creditNoteSchema.parse(parsedCreditNote);

  return zodCreditNote;
} 