import { describe, it, expect } from "bun:test";
import { invoiceToUBL } from "../utils/parsing/invoice/to-xml";
import type { Invoice } from "../utils/parsing/invoice/schemas";
import { parseInvoiceFromXML } from "@peppol/utils/parsing/invoice/from-xml";

function checkInvoiceXML(xml: string, invoice: Invoice) {
  expect(xml).toBeDefined();
  expect(typeof xml).toBe("string");
  expect(xml.length).toBeGreaterThan(0);
  
  expect(xml).toContain('<Invoice');
  expect(xml).toContain('xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');

  expect(xml).toContain(String(invoice.invoiceNumber));
  expect(xml).toContain(String(invoice.issueDate));
  
  if (invoice.dueDate) {
    expect(xml).toContain(String(invoice.dueDate));
  }
  
  if (invoice.currency) {
    expect(xml).toContain(String(invoice.currency));
  }
  expect(xml).toContain(String(invoice.seller.name));
  expect(xml).toContain(String(invoice.buyer.name));
}

describe("invoiceToUBL", () => {
  it("should convert Factuur 25607246 invoice to XML", async () => {
    const invoice: Invoice = {
      invoiceNumber: "1234",
      issueDate: "2025-10-29",
      dueDate: "2025-11-28",
      currency: "EUR",
      note: "Note",
      buyerReference: "REFERENCE",
      purchaseOrderReference: "PurchaseOrderReference",
      seller: {
        name: "BEDRIJF",
        street: "STRAAT",
        city: "STAD",
        postalZone: "1234",
        country: "BE",
        vatNumber: "BE1234567890",
        street2: null,
      },
      buyer: {
        name: "KLANT",
        street: "STRAAT",
        city: "STAD",
        postalZone: "1234",
        country: "BE",
        vatNumber: "BE1234567890",
        street2: null,
      },
      lines: [
        {
          name: "hst",
          quantity: "1",
          unitCode: "C62",
          netPriceAmount: "100",
          netAmount: null,
          vat: {
            category: "S",
            percentage: "21.00",
          },
          buyersId: null,
          sellersId: "HST",
          standardId: null,
          description: null,
          originCountry: null,
        },
      ],
      surcharges: [
        {
          reasonCode: "FC",
          reason: "Freight services",
          amount: "10.00",
          vat: {
            category: "S",
            percentage: "6.00",
          },
        },
      ],
      discounts: [
        {
          reasonCode: "95",
          reason: "Discount",
          amount: "10.00",
          vat: {
            category: "S",
            percentage: "6.00",
          },
        },
      ],
      paymentMeans: [
        {
          iban: "BE1234567890",
          reference: "REFERENCE",
          paymentMethod: "credit_transfer",
        },
      ],
      vat: null,
      delivery: null,
      totals: {
        paidAmount: "0.00",
        linesAmount: null,
        payableAmount: "121.00",
        discountAmount: null,
        surchargeAmount: null,
        taxExclusiveAmount: "100.00",
        taxInclusiveAmount: "121.00",
      },
    };
    
    const senderAddress = "0208:0428643097";
    const recipientAddress = "0208:0598726857";

    const xml = invoiceToUBL(invoice, senderAddress, recipientAddress);

    checkInvoiceXML(xml, invoice);

    const parsed = parseInvoiceFromXML(xml);

    expect(parsed.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(parsed.issueDate).toBe(invoice.issueDate);
    expect(parsed.dueDate).toBe(invoice.dueDate);
    expect(parsed.currency).toBe(invoice.currency);
    expect(parsed.seller.name).toBe(invoice.seller.name);
    expect(parsed.buyer.name).toBe(invoice.buyer.name);
    expect(parsed.lines.length).toBe(invoice.lines.length);
    expect(parsed.totals?.discountAmount).toEqual("10.00");
    expect(parsed.totals?.surchargeAmount).toEqual("10.00");
    expect(parsed.totals?.taxExclusiveAmount).toEqual("100.00");
    expect(parsed.totals?.taxInclusiveAmount).toEqual("121.00");
    expect(parsed.totals?.payableAmount).toEqual("121.00");
    expect(parsed.vat?.totalVatAmount).toEqual("21.00");
    expect(parsed.vat?.subtotals.length).toBe(2);
  });
});

