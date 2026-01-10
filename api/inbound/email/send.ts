import { Server } from "@recommand/lib/api";
import { describeRoute } from "hono-openapi";
import { actionSuccess, actionFailure } from "@recommand/lib/utils";
import { sendEmail } from "@core/lib/email";
import { sendSystemAlert } from "@peppol/utils/system-notifications/telegram";
import { sendDocumentFromEmail } from "@peppol/data/email/send-document-from-email";
import { requirePostmarkWebhookAuth } from "@peppol/utils/auth-middleware";
import { EmailToPeppolError } from "@peppol/emails/email-to-peppol-error";

const server = new Server();

interface PostmarkInboundEmail {
  FromFull: {
    Email: string;
    Name: string;
  };
  To: string;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
  Attachments: Array<{
    Name: string;
    Content: string;
    ContentType: string;
    ContentLength: number;
  }>;
  MessageID: string;
  Date: string;
}

server.post("/inbound/email/send", requirePostmarkWebhookAuth(), describeRoute({ hide: true }), async (c) => {
  try {
    const inbound: PostmarkInboundEmail = await c.req.json();
    const toEmail = inbound.To.toLowerCase();
    const fromEmail = inbound.FromFull.Email;

    const xmlAttachment = inbound.Attachments.find(
      (a) =>
        a.ContentType === "application/xml" ||
        a.ContentType === "text/xml" ||
        a.Name.toLowerCase().endsWith(".xml")
    );

    if (!xmlAttachment) {
      await sendEmail({
        to: fromEmail,
        subject: "Error: No XML attachment found",
        email: EmailToPeppolError({
          error: "No XML attachment found",
          hasXmlAttachment: false,
        }),
      });
      return c.json(actionSuccess({ error: "No XML attachment" }));
    }

    const xmlContent = Buffer.from(xmlAttachment.Content, "base64").toString(
      "utf-8"
    );

    const result = await sendDocumentFromEmail({
      toEmail,
      fromEmail,
      xmlContent,
    });

    if (result.success) {
      return c.json(
        actionSuccess({
          documentId: result.documentId,
          company: result.company,
          type: result.type,
          recipient: result.recipient,
        })
      );
    } else {
      return c.json(
        actionSuccess({
          error: result.error,
          company: result.company,
          details: result.details,
        })
      );
    }
  } catch (error) {
    console.error("Email webhook error:", error);
    sendSystemAlert(
      "Email to Peppol Processing Failed",
      `Failed to process email. Error: \`\`\`\n${error}\n\`\`\``,
      "error"
    );

    return c.json(
      actionFailure(
        error instanceof Error ? error.message : "Failed to process email"
      ),
      500
    );
  }
});

export default server;
