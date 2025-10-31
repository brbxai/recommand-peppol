import { XMLBuilder } from "fast-xml-parser";
import type { Invoice } from "./schemas";
import {
  calculateLineAmount,
  calculateTotals,
  calculateVat,
  extractTotals,
} from "./calculations";
import { parsePeppolAddress } from "../peppol-address";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressBooleanAttributes: true,
});

export function invoiceToUBL(
  invoice: Invoice,
  senderAddress: string,
  recipientAddress: string
): string {
  const ublInvoice = prebuildInvoiceUBL(invoice, senderAddress, recipientAddress);
  return builder.build(ublInvoice);
}

export function prebuildInvoiceUBL(invoice: Invoice, senderAddress: string, recipientAddress: string) {
  const totals = calculateTotals(invoice);
  const vat = invoice.vat || calculateVat(invoice);
  const lines = invoice.lines.map((line) => ({
    ...line,
    netAmount: line.netAmount || calculateLineAmount(line),
  }));

  const extractedTotals = extractTotals(totals);

  const sender = parsePeppolAddress(senderAddress);
  const recipient = parsePeppolAddress(recipientAddress);
  return {
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
      "cbc:InvoiceTypeCode": "380",
      ...(invoice.note && { "cbc:Note": invoice.note }),
      "cbc:DocumentCurrencyCode": "EUR",
      ...(invoice.buyerReference && {
        "cbc:BuyerReference": invoice.buyerReference,
      }),
      ...(invoice.purchaseOrderReference && {
        "cac:OrderReference": {
          "cbc:ID": invoice.purchaseOrderReference,
        },
      }),
      ...(!invoice.buyerReference &&
        !invoice.purchaseOrderReference && {
        "cbc:BuyerReference": invoice.invoiceNumber,
      }),
      ...(invoice.despatchReference && {
        "cac:DespatchDocumentReference": {
          "cbc:ID": invoice.despatchReference,
        },
      }),
      ...(invoice.attachments && {
        "cac:AdditionalDocumentReference": invoice.attachments.map(
          (attachment) => ({
            "cbc:ID": attachment.id,
            ...(attachment.description && {"cbc:DocumentDescription": attachment.description}),
            ...((attachment.embeddedDocument || attachment.url) && {
              "cac:Attachment": {
                ...(attachment.embeddedDocument && {
                  "cbc:EmbeddedDocumentBinaryObject": {
                    "@_mimeCode": attachment.mimeCode,
                    "@_filename": attachment.filename,
                    "#text": attachment.embeddedDocument,
                  },
                }),
                ...(attachment.url && {
                  "cac:ExternalReference": {
                    "cbc:URI": attachment.url,
                  },
                }),
              },
            }),
          })
        ),
      }),
      "cac:AccountingSupplierParty": {
        "cac:Party": {
          "cbc:EndpointID": {
            "@_schemeID": sender.schemeId,
            "#text": sender.identifier,
          },
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
          ...(invoice.seller.vatNumber && {
            "cac:PartyTaxScheme": {
              "cbc:CompanyID": invoice.seller.vatNumber,
              "cac:TaxScheme": {
                "cbc:ID": "VAT",
              },
            },
          }),
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": invoice.seller.name,
          },
        },
      },
      "cac:AccountingCustomerParty": {
        "cac:Party": {
          "cbc:EndpointID": {
            "@_schemeID": recipient.schemeId,
            "#text": recipient.identifier,
          },
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
          ...(invoice.buyer.vatNumber && {
            "cac:PartyTaxScheme": {
              "cbc:CompanyID": invoice.buyer.vatNumber,
              "cac:TaxScheme": {
                "cbc:ID": "VAT",
              },
            },
          }),
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": invoice.buyer.name,
          },
        },
      },
      ...(invoice.delivery && {
        "cac:Delivery": {
          ...(invoice.delivery.date && { "cbc:ActualDeliveryDate": invoice.delivery.date }),
          ...(invoice.delivery.location && {
            "cac:DeliveryLocation": {
              ...(invoice.delivery.locationIdentifier && { "cbc:ID": {
                "@_schemeID": invoice.delivery.locationIdentifier.scheme,
                "#text": invoice.delivery.locationIdentifier.identifier,
              }}),
              ...(invoice.delivery.location && { "cac:Address": {
                ...(invoice.delivery.location.street && { "cbc:StreetName": invoice.delivery.location.street }),
                ...(invoice.delivery.location.street2 && { "cbc:AdditionalStreetName": invoice.delivery.location.street2 }),
                ...(invoice.delivery.location.city && { "cbc:CityName": invoice.delivery.location.city }),
                ...(invoice.delivery.location.postalZone && { "cbc:PostalZone": invoice.delivery.location.postalZone }),
                "cac:Country": {
                  "cbc:IdentificationCode": invoice.delivery.location.country,
                },
              }}),
            },
          }),
          ...(invoice.delivery.recipientName && {
            "cac:DeliveryParty": {
              "cac:PartyName": {
                "cbc:Name": invoice.delivery.recipientName,
              },
            },
          }),
        },
      }),
      ...(invoice.paymentMeans && {
        "cac:PaymentMeans": invoice.paymentMeans.map((payment) => ({
          "cbc:PaymentMeansCode": {
            "@_name": "Credit Transfer",
            "#text": "30",
          },
          ...(payment.reference && {
            "cbc:PaymentID": {
              "#text": payment.reference,
            },
          }),
          "cac:PayeeFinancialAccount": {
            "cbc:ID": {
              "#text": payment.iban,
            },
          },
        })),
      }),
      ...(invoice.paymentTerms && {
        "cac:PaymentTerms": {
          "cbc:Note": invoice.paymentTerms.note,
        },
      }),
      ...((invoice.discounts || invoice.surcharges) && {
        "cac:AllowanceCharge": [
          ...(invoice.discounts && invoice.discounts.map((discount) => ({
            "cbc:ChargeIndicator": "false",
            ...(discount.reasonCode && { "cbc:AllowanceChargeReasonCode": discount.reasonCode }),
            ...(discount.reason && { "cbc:AllowanceChargeReason": discount.reason }),
            "cbc:Amount": {
              "@_currencyID": "EUR",
              "#text": discount.amount,
            },
            "cac:TaxCategory": {
              "cbc:ID": discount.vat.category,
              "cbc:Percent": discount.vat.percentage,
              "cac:TaxScheme": {
                "cbc:ID": "VAT",
              },
            },
          })) || []),
          ...(invoice.surcharges && invoice.surcharges.map((surcharge) => ({
            "cbc:ChargeIndicator": "true",
            ...(surcharge.reasonCode && { "cbc:AllowanceChargeReasonCode": surcharge.reasonCode }),
            ...(surcharge.reason && { "cbc:AllowanceChargeReason": surcharge.reason }),
            "cbc:Amount": {
              "@_currencyID": "EUR",
              "#text": surcharge.amount,
            },
            "cac:TaxCategory": {
              "cbc:ID": surcharge.vat.category,
              "cbc:Percent": surcharge.vat.percentage,
              "cac:TaxScheme": {
                "cbc:ID": "VAT",
              },
            },
          })) || []),
        ],
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
            ...(subtotal.exemptionReasonCode && {
              "cbc:TaxExemptionReasonCode": subtotal.exemptionReasonCode,
            }),
            ...(subtotal.exemptionReason && {
              "cbc:TaxExemptionReason": subtotal.exemptionReason,
            }),
            "cac:TaxScheme": {
              "cbc:ID": "VAT",
            },
          },
        })),
      },
      "cac:LegalMonetaryTotal": {
        "cbc:LineExtensionAmount": {
          "@_currencyID": "EUR",
          "#text": extractedTotals.linesAmount,
        },
        "cbc:TaxExclusiveAmount": {
          "@_currencyID": "EUR",
          "#text": extractedTotals.taxExclusiveAmount,
        },
        "cbc:TaxInclusiveAmount": {
          "@_currencyID": "EUR",
          "#text": extractedTotals.taxInclusiveAmount,
        },
        ...(extractedTotals.discountAmount && {
          "cbc:AllowanceTotalAmount": {
          "@_currencyID": "EUR",
          "#text": extractedTotals.discountAmount,
        },
        }),
        ...(extractedTotals.surchargeAmount && {
          "cbc:ChargeTotalAmount": {
            "@_currencyID": "EUR",
            "#text": extractedTotals.surchargeAmount,
          },
        }),
        "cbc:PrepaidAmount": {
          "@_currencyID": "EUR",
          "#text": extractedTotals.paidAmount,
        },
        "cbc:PayableRoundingAmount": {
          "@_currencyID": "EUR",
          "#text": extractedTotals.payableRoundingAmount,
        },
        "cbc:PayableAmount": {
          "@_currencyID": "EUR",
          "#text": extractedTotals.payableAmount,
        },
      },
      "cac:InvoiceLine": lines.map((item, index) => ({
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
          ...(item.buyersId && {
            "cac:BuyersItemIdentification": { "cbc:ID": item.buyersId },
          }),
          ...(item.sellersId && {
            "cac:SellersItemIdentification": { "cbc:ID": item.sellersId },
          }),
          ...(item.standardId && {
            "cac:StandardItemIdentification": {
              "cbc:ID": {
                "@_schemeID": item.standardId.scheme,
                "#text": item.standardId.identifier,
              },
            },
          }),
          ...(item.originCountry && {
            "cac:OriginCountry": {
              "cbc:IdentificationCode": item.originCountry,
            },
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

}