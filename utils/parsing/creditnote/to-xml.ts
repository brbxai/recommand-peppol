import { XMLBuilder } from "fast-xml-parser";
import type { CreditNote } from "./schemas";
import {
  calculateLineAmount,
  calculateTotals,
  calculateVat,
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
  const totals = creditNote.totals || calculateTotals(creditNote);
  const vat = creditNote.vat || calculateVat(creditNote);
  const lines = creditNote.lines.map((line) => ({
    ...line,
    netAmount: line.netAmount || calculateLineAmount(line),
  }));

  const sender = parsePeppolAddress(senderAddress);
  const recipient = parsePeppolAddress(recipientAddress);
  const ublCreditNote = {
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
      ...(creditNote.attachments && {
        "cac:AdditionalDocumentReference": creditNote.attachments.map(
          (attachment) => ({
            "cbc:ID": attachment.id,
            "cbc:DocumentDescription": attachment.description,
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
          "cac:PartyTaxScheme": {
            "cbc:CompanyID": creditNote.seller.vatNumber,
            "cac:TaxScheme": {
              "cbc:ID": "VAT",
            },
          },
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
          "cac:PartyTaxScheme": {
            "cbc:CompanyID": creditNote.buyer.vatNumber,
            "cac:TaxScheme": {
              "cbc:ID": "VAT",
            },
          },
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": creditNote.buyer.name,
          },
        },
      },
      ...(creditNote.paymentMeans && {
        "cac:PaymentMeans": creditNote.paymentMeans.map((payment) => ({
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
      }),
      ...(creditNote.paymentTerms && {
        "cac:PaymentTerms": {
          "cbc:Note": creditNote.paymentTerms.note,
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

  return builder.build(ublCreditNote);
}
