import { Server } from "@recommand/lib/api";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { invoiceToUBL } from "@peppol/utils/parsing/invoice/to-xml";
import {
  sendDocumentSchema,
  SendDocumentType,
} from "utils/parsing/send-document";
import type { Invoice } from "@peppol/utils/parsing/invoice/schemas";
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
import { addMonths } from "date-fns";
import type { CreditNote } from "@peppol/utils/parsing/creditnote/schemas";
import { creditNoteToUBL } from "@peppol/utils/parsing/creditnote/to-xml";

const server = new Server();

server.post(
  "/:companyId/sendDocument",
  requireCompanyAccess(),
  requireValidSubscription(),
  describeRoute({
    operationId: "sendDocument",
    description: "Send a document to a customer",
    summary: "Send Document",
    tags: ["Sending"],
    responses: {
      ...describeSuccessResponse("Successfully sent document"),
      ...describeErrorResponse(400, "Invalid document data provided"),
    },
  }),
  zValidator("json", sendDocumentSchema),
  async (c) => {
    try {
      const jsonBody = c.req.valid("json");
      const document = jsonBody.document;

      let xmlDocument: string | null = null;
      let type: "invoice" | "creditNote" | "unknown" = "unknown";
      let parsedDocument: Invoice | CreditNote | null = null;
      let doctypeId: string =
        "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1";

      // Get senderId, countryC1 from company
      const company = c.var.company;
      const senderAddress = "0208:" + company.enterpriseNumber;
      const countryC1 = company.country;

      // Parse recipient
      let recipientAddress = jsonBody.recipient;
      if (!recipientAddress.includes(":")) {
        const numberOnlyRecipient = recipientAddress.replace(/[^0-9]/g, "");
        recipientAddress = "0208:" + numberOnlyRecipient;
      }

      if (jsonBody.documentType === SendDocumentType.INVOICE) {
        const invoice = document as Invoice;
        if (!invoice.seller) {
          invoice.seller = {
            vatNumber: c.var.company.vatNumber ?? "",
            name: c.var.company.name,
            street: c.var.company.address,
            city: c.var.company.city,
            postalZone: c.var.company.postalCode,
            country: c.var.company.country,
          };
        }
        if (!invoice.issueDate) {
          invoice.issueDate = new Date().toISOString();
        }
        if (!invoice.dueDate) {
          invoice.dueDate = addMonths(
            new Date(invoice.issueDate),
            1
          ).toISOString();
        }
        const ublInvoice = invoiceToUBL(invoice, senderAddress, recipientAddress);
        xmlDocument = ublInvoice;
        type = "invoice";
        parsedDocument = invoice;
      } else if (jsonBody.documentType === SendDocumentType.CREDIT_NOTE) {
        const creditNote = document as CreditNote;
        if (!creditNote.seller) {
          creditNote.seller = {
            vatNumber: c.var.company.vatNumber ?? "",
            name: c.var.company.name,
            street: c.var.company.address,
            city: c.var.company.city,
            postalZone: c.var.company.postalCode,
            country: c.var.company.country,
          };
        }
        if (!creditNote.issueDate) {
          creditNote.issueDate = new Date().toISOString();
        }
        const ublCreditNote = creditNoteToUBL(creditNote, senderAddress, recipientAddress);
        xmlDocument = ublCreditNote;
        type = "creditNote";
        parsedDocument = creditNote;
      } else if (jsonBody.documentType === SendDocumentType.XML) {
        xmlDocument = document as string;
        if (jsonBody.doctypeId) {
          doctypeId = jsonBody.doctypeId;
        }
      } else {
        return c.json(actionFailure("Invalid document type provided."));
      }

      if (!xmlDocument) {
        return c.json(actionFailure("Document could not be parsed."));
      }

      // const response = await sendAs4({
      //   senderId: senderAddress,
      //   receiverId: recipientAddress,
      //   docTypeId: doctypeId,
      //   processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
      //   countryC1: countryC1,
      //   body: xmlDocument,
      // });

      // const jsonResponse = await response.json();
      // if (!response.ok || !jsonResponse.overallSuccess) {
      //   return c.json(
      //     actionFailure("Failed to send document over Peppol network.")
      //   );
      // }

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
          type,
          parsed: parsedDocument,
        })
        .returning({ id: transmittedDocuments.id })
        .then((rows) => rows[0]);

      // Create a new transferEvent for billing
      await db.insert(transferEvents).values({
        teamId: c.var.team.id,
        companyId: company.id,
        direction: "outgoing",
        transmittedDocumentId: transmittedDocument.id,
      });

      return c.json(actionSuccess());
    } catch (error) {
      return c.json(
        actionFailure(
          error instanceof Error ? error.message : "Failed to send document"
        )
      );
    }
  }
);

export default server;
