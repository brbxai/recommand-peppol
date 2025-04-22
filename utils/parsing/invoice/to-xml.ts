import { XMLBuilder } from "fast-xml-parser";
import type { Invoice } from "./schemas";
import { calculateLineAmount, calculateTotals, calculateVat } from "./calculations";
import { parsePeppolAddress } from "../peppol-address";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressBooleanAttributes: true,
});

export function invoiceToUBL(invoice: Invoice, senderAddress: string, recipientAddress: string): string {
  const totals = invoice.totals || calculateTotals(invoice);
  const vat = invoice.vat || calculateVat(invoice);
  const lines = invoice.lines.map((line) => ({
    ...line,
    netAmount: line.netAmount || calculateLineAmount(line),
  }));

  const sender = parsePeppolAddress(senderAddress);
  const recipient = parsePeppolAddress(recipientAddress);

  const ublInvoice = {
    Invoice: {
      "@_xmlns": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
      "@_xmlns:cac":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      "@_xmlns:cbc":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
      "@_xmlns:ext":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
      "@_xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
      "cbc:CustomizationID":
        "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0",
      "cbc:ProfileID": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
      "cbc:ID": invoice.invoiceNumber,
      "cbc:IssueDate": invoice.issueDate,
      "cbc:DueDate": invoice.dueDate,
      ...(invoice.note && { "cbc:Note": invoice.note }),
      ...(invoice.buyerReference && {
        "cbc:BuyerReference": invoice.buyerReference,
      }),
      "cac:AccountingSupplierParty": {
        "cac:Party": {
          "cac:PartyIdentification": [
            {
              "cbc:ID": {
                "@_schemeID": sender.schemeId,
                "#text": sender.identifier,
              },
            },
          ],
          "cac:PartyName": {
            "cbc:Name": invoice.seller.name,
          },
          "cac:PostalAddress": {
            "cbc:StreetName": invoice.seller.street,
            ...(invoice.seller.street2 && {
              "cbc:AdditionalStreetName": invoice.seller.street2,
            }),
            "cbc:CityName": invoice.seller.city,
            "cbc:PostalZone": invoice.seller.postalZone,
            "cac:Country": {
              "cbc:IdentificationCode": invoice.seller.country,
            },
          },
          "cac:PartyTaxScheme": {
            "cbc:CompanyID": invoice.seller.vatNumber,
            "cac:TaxScheme": {
              "cbc:ID": "VAT",
            },
          },
        },
      },
      "cac:AccountingCustomerParty": {
        "cac:Party": {
          "cac:PartyIdentification": [
            {
              "cbc:ID": {
                "@_schemeID": recipient.schemeId,
                "#text": recipient.identifier,
              },
            },
          ],
          "cac:PartyName": {
            "cbc:Name": invoice.buyer.name,
          },
          "cac:PostalAddress": {
            "cbc:StreetName": invoice.buyer.street,
            ...(invoice.buyer.street2 && {
              "cbc:AdditionalStreetName": invoice.buyer.street2,
            }),
            "cbc:CityName": invoice.buyer.city,
            "cbc:PostalZone": invoice.buyer.postalZone,
            "cac:Country": {
              "cbc:IdentificationCode": invoice.buyer.country,
            },
          },
          "cac:PartyTaxScheme": {
            "cbc:CompanyID": invoice.buyer.vatNumber,
            "cac:TaxScheme": {
              "cbc:ID": "VAT",
            },
          },
        },
      },
      "cac:PaymentMeans": invoice.paymentMeans.map((payment) => ({
        "cbc:PaymentMeansCode": {
          "@_name": "Credit Transfer",
          "#text": "30",
        },
        "cbc:PaymentID": {
          "#text": payment.reference,
        },
        "cac:PayeeFinancialAccount": {
          "cbc:ID": {
            "#text": payment.iban,
          },
        },
      })),
      ...(invoice.paymentTerms && {
        "cac:PaymentTerms": {
          "cbc:Note": invoice.paymentTerms.note,
        },
      }),
      "cac:TaxTotal": {
        "cbc:TaxAmount": {
          "@_currencyID": "EUR",
          "#text": vat.totalVatAmount,
        },
        "cac:TaxSubtotal": vat.subtotals.map((subtotal) => ({
          "cbc:TaxableAmount": {
            "@_currencyID": "EUR",
            "#text": subtotal.taxableAmount,
          },
          "cbc:TaxAmount": {
            "@_currencyID": "EUR",
            "#text": subtotal.vatAmount,
          },
          "cac:TaxCategory": {
            "cbc:ID": subtotal.category,
            "cbc:Percent": subtotal.percentage,
            "cac:TaxScheme": {
              "cbc:ID": "VAT",
            },
            ...(subtotal.exemptionReasonCode && {
              "cbc:TaxExemptionReasonCode": subtotal.exemptionReasonCode,
            }),
          },
        })),
      },
      "cac:LegalMonetaryTotal": {
        "cbc:LineExtensionAmount": {
          "@_currencyID": "EUR",
          "#text": totals.taxExclusiveAmount,
        },
        "cbc:TaxExclusiveAmount": {
          "@_currencyID": "EUR",
          "#text": totals.taxExclusiveAmount,
        },
        "cbc:TaxInclusiveAmount": {
          "@_currencyID": "EUR",
          "#text": totals.taxInclusiveAmount,
        },
        "cbc:PayableAmount": {
          "@_currencyID": "EUR",
          "#text": totals.payableAmount || totals.taxInclusiveAmount,
        },
      },
      "cac:InvoiceLine": invoice.lines.map((item, index) => ({
        "cbc:ID": (index + 1).toString(),
        "cbc:InvoicedQuantity": {
          "@_unitCode": item.unitCode,
          "#text": item.quantity,
        },
        "cbc:LineExtensionAmount": {
          "@_currencyID": "EUR",
          "#text": item.netAmount,
        },
        "cac:Item": {
          ...(item.description && { "cbc:Description": item.description }),
          "cbc:Name": item.name,
          ...(item.sellersId && {
            "cac:SellersItemIdentification": { "cbc:ID": item.sellersId },
          }),
          "cac:ClassifiedTaxCategory": {
            "cbc:ID": item.vat.category,
            "cbc:Percent": item.vat.percentage,
            "cac:TaxScheme": {
              "cbc:ID": "VAT",
            },
          },
        },
        "cac:Price": {
          "cbc:PriceAmount": {
            "@_currencyID": "EUR",
            "#text": item.netPriceAmount,
          },
        },
      })),
    },
  };

  return builder.build(ublInvoice);
}
