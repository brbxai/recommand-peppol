import { XMLBuilder } from "fast-xml-parser";
import type { CreditNote } from "./schemas";
import {
  calculateLineAmount,
  calculateTotals,
  calculateVat,
  extractTotals,
} from "../invoice/calculations";
import { parsePeppolAddress } from "../peppol-address";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressBooleanAttributes: true,
});

export function creditNoteToUBL(
  creditNote: CreditNote,
  senderAddress: string,
  recipientAddress: string
): string {
  const ublCreditNote = prebuildCreditNoteUBL(creditNote, senderAddress, recipientAddress);
  return builder.build(ublCreditNote);
}

export function prebuildCreditNoteUBL(creditNote: CreditNote, senderAddress: string, recipientAddress: string) {
  const totals = calculateTotals(creditNote);
  const vat = creditNote.vat || calculateVat(creditNote);
  const lines = creditNote.lines.map((line) => ({
    ...line,
    netAmount: line.netAmount || calculateLineAmount(line),
  }));

  const extractedTotals = extractTotals(totals);

  const sender = parsePeppolAddress(senderAddress);
  const recipient = parsePeppolAddress(recipientAddress);
  return {
    CreditNote: {
      "@_xmlns": "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
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
      "cbc:ID": creditNote.creditNoteNumber,
      "cbc:IssueDate": creditNote.issueDate,
      "cbc:CreditNoteTypeCode": "381",
      ...(creditNote.note && { "cbc:Note": creditNote.note }),
      "cbc:DocumentCurrencyCode": "EUR",
      ...(creditNote.buyerReference && {
        "cbc:BuyerReference": creditNote.buyerReference,
      }),
      ...(creditNote.purchaseOrderReference && {
        "cac:OrderReference": {
          "cbc:ID": creditNote.purchaseOrderReference,
        },
      }),
      ...(!creditNote.buyerReference &&
        !creditNote.purchaseOrderReference && {
        "cbc:BuyerReference": creditNote.creditNoteNumber,
      }),
      ...(creditNote.despatchReference && {
        "cac:DespatchDocumentReference": {
          "cbc:ID": creditNote.despatchReference,
        },
      }),
      ...(creditNote.invoiceReferences && {
        "cac:BillingReference": creditNote.invoiceReferences.map((reference) => ({
          "cac:InvoiceDocumentReference": {
            "cbc:ID": reference.id,
            ...(reference.issueDate && { "cbc:IssueDate": reference.issueDate }),
          }
        })),
      }),
      ...(creditNote.attachments && {
        "cac:AdditionalDocumentReference": creditNote.attachments.map(
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
            "cbc:Name": creditNote.seller.name,
          },
          "cac:PostalAddress": {
            "cbc:StreetName": creditNote.seller.street,
            ...(creditNote.seller.street2 && {
              "cbc:AdditionalStreetName": creditNote.seller.street2,
            }),
            "cbc:CityName": creditNote.seller.city,
            "cbc:PostalZone": creditNote.seller.postalZone,
            "cac:Country": {
              "cbc:IdentificationCode": creditNote.seller.country,
            },
          },
          ...(creditNote.seller.vatNumber && {
            "cac:PartyTaxScheme": {
              "cbc:CompanyID": creditNote.seller.vatNumber,
              "cac:TaxScheme": {
                "cbc:ID": "VAT",
              },
            },
          }),
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": creditNote.seller.name,
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
            "cbc:Name": creditNote.buyer.name,
          },
          "cac:PostalAddress": {
            "cbc:StreetName": creditNote.buyer.street,
            ...(creditNote.buyer.street2 && {
              "cbc:AdditionalStreetName": creditNote.buyer.street2,
            }),
            "cbc:CityName": creditNote.buyer.city,
            "cbc:PostalZone": creditNote.buyer.postalZone,
            "cac:Country": {
              "cbc:IdentificationCode": creditNote.buyer.country,
            },
          },
          ...(creditNote.buyer.vatNumber && {
            "cac:PartyTaxScheme": {
              "cbc:CompanyID": creditNote.buyer.vatNumber,
              "cac:TaxScheme": {
                "cbc:ID": "VAT",
              },
            },
          }),
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": creditNote.buyer.name,
          },
        },
      },
      ...(creditNote.delivery && {
        "cac:Delivery": {
          ...(creditNote.delivery.date && { "cbc:ActualDeliveryDate": creditNote.delivery.date }),
          ...(creditNote.delivery.location && {
            "cac:DeliveryLocation": {
              ...(creditNote.delivery.locationIdentifier && { "cbc:ID": {
                "@_schemeID": creditNote.delivery.locationIdentifier.scheme,
                "#text": creditNote.delivery.locationIdentifier.identifier,
              }}),
              ...(creditNote.delivery.location && { "cac:Address": {
                ...(creditNote.delivery.location.street && { "cbc:StreetName": creditNote.delivery.location.street }),
                ...(creditNote.delivery.location.street2 && { "cbc:AdditionalStreetName": creditNote.delivery.location.street2 }),
                ...(creditNote.delivery.location.city && { "cbc:CityName": creditNote.delivery.location.city }),
                ...(creditNote.delivery.location.postalZone && { "cbc:PostalZone": creditNote.delivery.location.postalZone }),
                "cac:Country": {
                  "cbc:IdentificationCode": creditNote.delivery.location.country,
                },
              }}),
            },
          }),
          ...(creditNote.delivery.recipientName && {
            "cac:DeliveryParty": {
              "cac:PartyName": {
                "cbc:Name": creditNote.delivery.recipientName,
              },
            },
          }),
        },
      }),
      ...(creditNote.paymentMeans && {
        "cac:PaymentMeans": creditNote.paymentMeans.map((payment) => ({
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
      ...(creditNote.paymentTerms && {
        "cac:PaymentTerms": {
          "cbc:Note": creditNote.paymentTerms.note,
        },
      }),
      ...((creditNote.discounts || creditNote.surcharges) && {
        "cac:AllowanceCharge": [
          ...(creditNote.discounts && creditNote.discounts.map((discount) => ({
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
          ...(creditNote.surcharges && creditNote.surcharges.map((surcharge) => ({
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
      "cac:CreditNoteLine": lines.map((item, index) => ({
        "cbc:ID": (index + 1).toString(),
        "cbc:CreditedQuantity": {
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