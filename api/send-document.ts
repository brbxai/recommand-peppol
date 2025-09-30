import { Server } from "@recommand/lib/api";
import { describeRoute } from "hono-openapi";
import { zodValidator } from "@recommand/lib/zod-validator";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { invoiceToUBL } from "@peppol/utils/parsing/invoice/to-xml";
import {
  sendDocumentSchema,
  SendDocumentType,
} from "utils/parsing/send-document";
import {
  sendInvoiceSchema,
  type Invoice,
} from "@peppol/utils/parsing/invoice/schemas";
import { sendAs4 } from "@peppol/data/phase4-ap/client";
import { db } from "@recommand/db";
import { transferEvents, transmittedDocuments } from "@peppol/db/schema";
import {
  requireCompanyAccess,
  requireValidSubscription,
} from "@peppol/utils/auth-middleware";
import {
  describeErrorResponse,
  describeSuccessResponse,
} from "@peppol/utils/api-docs";
import { addMonths, formatISO } from "date-fns";
import {
  sendCreditNoteSchema,
  type CreditNote,
} from "@peppol/utils/parsing/creditnote/schemas";
import { creditNoteToUBL } from "@peppol/utils/parsing/creditnote/to-xml";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { simulateSendAs4 } from "@peppol/data/playground/simulate-ap";
import { getSendingCompanyIdentifier } from "@peppol/data/company-identifiers";
import { parseDocument } from "@peppol/utils/parsing/parse-document";
import { sendDocumentEmail } from "@peppol/data/email/send-email";

const server = new Server();

const _sendDocument = server.post(
  "/:companyId/sendDocument",
  requireCompanyAccess(),
  requireValidSubscription(),
  describeRoute({
    operationId: "sendDocument",
    description: "Send a document to a customer",
    summary: "Send Document",
    tags: ["Sending"],
    responses: {
      ...describeSuccessResponse("Successfully sent document", {
        sentOverPeppol: {
          type: "boolean",
          description: "Whether the document was sent over Peppol",
        },
        sentOverEmail: {
          type: "boolean",
          description: "Whether the document was sent over email",
        },
        emailRecipients: {
          type: "array",
          description: "The email addresses that the document was sent to",
        },
        teamId: {
          type: "string",
          description: "The ID of the team that sent the document",
        },
        companyId: {
          type: "string",
          description: "The ID of the company that sent the document",
        },
        id: {
          type: "string",
          description: "The ID of the transmitted document",
        },
      }),
      ...describeErrorResponse(400, "Invalid document data provided"),
    },
  }),
  zodValidator("json", sendDocumentSchema),
  async (c) => {
    try {
      const jsonBody = c.req.valid("json");
      const document = jsonBody.document;
      const isPlayground = c.get("team").isPlayground;

      let xmlDocument: string | null = null;
      let type: "invoice" | "creditNote" | "unknown" = "unknown";
      let parsedDocument: Invoice | CreditNote | null = null;
      let doctypeId: string =
        "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1";

      // Get senderId, countryC1 from company
      const company = c.var.company;
      const senderIdentifier = await getSendingCompanyIdentifier(company.id);
      const senderAddress = `${senderIdentifier.scheme}:${senderIdentifier.identifier}`;
      const countryC1 = company.country;

      // Parse recipient
      let recipientAddress = jsonBody.recipient;
      if (!recipientAddress.includes(":")) {
        const numberOnlyRecipient = recipientAddress.replace(/[^0-9]/g, "");
        recipientAddress = "0208:" + numberOnlyRecipient;
      }

      if (jsonBody.documentType === SendDocumentType.INVOICE) {
        const invoice = document as Invoice;

        // Check the invoice corresponds to the required zod schema
        const parsedInvoice = sendInvoiceSchema.safeParse(invoice);
        if (!parsedInvoice.success) {
          return c.json(
            actionFailure(
              "Invalid invoice data provided. The document you provided does not correspond to the required json object as laid out by our api reference. If unsure, don't hesitate to contact support@recommand.eu"
            )
          );
        }

        if (!invoice.seller) {
          invoice.seller = {
            vatNumber: c.var.company.vatNumber,
            name: c.var.company.name,
            street: c.var.company.address,
            city: c.var.company.city,
            postalZone: c.var.company.postalCode,
            country: c.var.company.country,
          };
        }
        if (!invoice.issueDate) {
          invoice.issueDate = formatISO(new Date(), { representation: "date" });
        }
        if (!invoice.dueDate) {
          invoice.dueDate = formatISO(
            addMonths(new Date(invoice.issueDate), 1),
            { representation: "date" }
          );
        }
        const ublInvoice = invoiceToUBL(
          invoice,
          senderAddress,
          recipientAddress
        );
        xmlDocument = ublInvoice;
        type = "invoice";
        parsedDocument = invoice;
      } else if (jsonBody.documentType === SendDocumentType.CREDIT_NOTE) {
        const creditNote = document as CreditNote;

        // Check the credit note corresponds to the required zod schema
        const parsedCreditNote = sendCreditNoteSchema.safeParse(creditNote);
        if (!parsedCreditNote.success) {
          return c.json(
            actionFailure(
              "Invalid credit note data provided. The document you provided does not correspond to the required json object as laid out by our api reference. If unsure, don't hesitate to contact support@recommand.eu"
            )
          );
        }

        if (!creditNote.seller) {
          creditNote.seller = {
            vatNumber: c.var.company.vatNumber,
            name: c.var.company.name,
            street: c.var.company.address,
            city: c.var.company.city,
            postalZone: c.var.company.postalCode,
            country: c.var.company.country,
          };
        }
        if (!creditNote.issueDate) {
          creditNote.issueDate = formatISO(new Date(), {
            representation: "date",
          });
        }
        const ublCreditNote = creditNoteToUBL(
          creditNote,
          senderAddress,
          recipientAddress
        );
        xmlDocument = ublCreditNote;
        type = "creditNote";
        doctypeId =
          "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1";
        parsedDocument = creditNote;
      } else if (jsonBody.documentType === SendDocumentType.XML) {
        xmlDocument = document as string;
        if (jsonBody.doctypeId) {
          doctypeId = jsonBody.doctypeId;
        }

        const parsed = parseDocument(
          doctypeId,
          xmlDocument,
          company,
          senderAddress
        );
        parsedDocument = parsed.parsedDocument;
        type = parsed.type;
      } else {
        return c.json(actionFailure("Invalid document type provided."));
      }

      if (!xmlDocument) {
        return c.json(actionFailure("Document could not be parsed."));
      }

      let sentPeppol = false;
      let sentEmailRecipients: string[] = [];
      let additionalPeppolFailureContext = "";
      let additionalEmailFailureContext = "";

      if (isPlayground) {
        await simulateSendAs4({
          senderId: senderAddress,
          receiverId: recipientAddress,
          docTypeId: doctypeId,
          processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
          countryC1: countryC1,
          body: xmlDocument,
          playgroundTeamId: c.var.team.id, // Must be the same as the sender team: we don't support cross-team sending
        });
        sentPeppol = true;
      } else {
        const response = await sendAs4({
          senderId: senderAddress,
          receiverId: recipientAddress,
          docTypeId: doctypeId,
          processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
          countryC1: countryC1,
          body: xmlDocument,
        });
        const jsonResponse = await response.json();
        if (!response.ok || !jsonResponse.overallSuccess) {
          sendSystemAlert(
            "Document Sending Failed",
            `Failed to send document over Peppol network. Response: \`\`\`\n${JSON.stringify(jsonResponse, null, 2)}\n\`\`\``,
            "error"
          );
          try {
            // Extract sendingException.message from jsonResponse
            const sendingException = jsonResponse.sendingException;
            additionalPeppolFailureContext = sendingException.message;
          } catch (error) {
            additionalPeppolFailureContext =
              "No additional context available, please contact support@recommand.eu if you could use our help.";
          }

          // If send over email is disabled, return an error
          if (!jsonBody.email) {
            return c.json(
              actionFailure(
                `Failed to send document over Peppol network. ${additionalPeppolFailureContext}`
              )
            );
          }
        } else {
          sentPeppol = true;
        }
      }

      // If send over email is enabled, send the email
      if (jsonBody.email && (jsonBody.email.when === "always" || !sentPeppol)) {
        for (const recipient of jsonBody.email.to) {
          try {
            await sendDocumentEmail({
              to: recipient,
              subject: jsonBody.email.subject,
              htmlBody: jsonBody.email.htmlBody,
              xmlDocument: xmlDocument,
              type,
              parsedDocument: parsedDocument,
            });
            sentEmailRecipients.push(recipient);
          } catch (error) {
            console.error("Failed to send email:", error);
            additionalEmailFailureContext =
              error instanceof Error
                ? error.message
                : "No additional context available, please contact support@recommand.eu if you could use our help.";
          }
        }
      }

      if (!sentPeppol && sentEmailRecipients.length === 0) {
        sendSystemAlert(
          "Document Sending Failed",
          `Failed to send document over Peppol network and email. ${additionalPeppolFailureContext} ${additionalEmailFailureContext}`,
          "error"
        );
        return c.json(
          actionFailure(
            `Failed to send document over Peppol network and email. ${additionalPeppolFailureContext} ${additionalEmailFailureContext}`
          )
        );
      }

      // Create a new transmittedDocument
      const transmittedDocument = await db
        .insert(transmittedDocuments)
        .values({
          teamId: c.var.team.id,
          companyId: company.id,
          direction: "outgoing",
          senderId: senderAddress,
          receiverId: recipientAddress,
          docTypeId: doctypeId,
          processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
          countryC1: countryC1,
          xml: xmlDocument,

          sentOverPeppol: sentPeppol,
          sentOverEmail: sentEmailRecipients.length > 0,
          emailRecipients: sentEmailRecipients,

          type,
          parsed: parsedDocument,
        })
        .returning({ id: transmittedDocuments.id })
        .then((rows) => rows[0]);

      // Create a new transferEvent for billing
      if (!isPlayground) {
        const te: (typeof transferEvents.$inferInsert)[] = [];
        if (sentPeppol) {
          te.push({
            teamId: c.var.team.id,
            companyId: company.id,
            direction: "outgoing",
            type: "peppol",
            transmittedDocumentId: transmittedDocument.id,
          });
        }
        for (const _ of sentEmailRecipients) {
          te.push({
            teamId: c.var.team.id,
            companyId: company.id,
            direction: "outgoing",
            type: "email",
            transmittedDocumentId: transmittedDocument.id,
          });
        }
        await db.insert(transferEvents).values(te);
      }

      return c.json(
        actionSuccess({
          teamId: c.var.team.id,
          companyId: company.id,
          id: transmittedDocument.id,
          sentOverPeppol: sentPeppol,
          sentOverEmail: sentEmailRecipients.length > 0,
          emailRecipients: sentEmailRecipients,
          ...(additionalPeppolFailureContext
            ? { additionalPeppolFailureContext }
            : {}),
          ...(additionalEmailFailureContext
            ? { additionalEmailFailureContext }
            : {}),
        })
      );
    } catch (error) {
      console.error(error);

      sendSystemAlert(
        "Document Sending Failed",
        `Failed to send document over Peppol network. Error: \`\`\`\n${error}\n\`\`\``,
        "error"
      );

      return c.json(
        actionFailure(
          error instanceof Error ? error.message : "Failed to send document"
        )
      );
    }
  }
);

export type SendDocument = typeof _sendDocument;

export default server;
