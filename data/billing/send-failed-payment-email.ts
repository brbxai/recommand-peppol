import { paymentFailureReminders } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { format, subDays } from "date-fns";
import { getMinimalTeamMembers } from "@core/data/team-members";
import { render } from "@react-email/render";
import { FailedPaymentEmail } from "@peppol/emails/failed-payment";
import { ServerClient } from "postmark";
import { and, eq, gte } from "drizzle-orm";

export type FailedPaymentEmailParams = {
  billingEventId: string;
  teamId: string;
  companyName: string;
  billingEmail: string | null;
  invoiceReference: number | null;
  totalAmountIncl: string;
  billingDate: Date;
};

export async function sendFailedPaymentEmail({
  billingEventId,
  teamId,
  companyName,
  billingEmail,
  invoiceReference,
  totalAmountIncl,
  billingDate,
}: FailedPaymentEmailParams): Promise<{ emailSent: boolean; emailRecipients: string[] }> {

  // Check if the billing event has a payment failure reminder within the last 7 days
  const sevenDaysAgo = subDays(new Date(), 7);
  const recentReminder = await db
    .select()
    .from(paymentFailureReminders)
    .where(
      and(eq(paymentFailureReminders.billingEventId, billingEventId), gte(paymentFailureReminders.createdAt, sevenDaysAgo))
    )
    .limit(1);

  if (recentReminder.length > 0) {
    console.log(`Skipping reminder for billing event ${billingEventId} - reminder sent within last 7 days`);
    return { emailSent: false, emailRecipients: [] };
  }

  let emailRecipients: string[] = [];
  if (billingEmail) {
    emailRecipients = [billingEmail];
  } else {
    const teamMembers = await getMinimalTeamMembers(teamId);
    emailRecipients = teamMembers.map(member => member.user.email);
  }

  if (emailRecipients.length > 0) {
    const emailHtml = await render(
      FailedPaymentEmail({
        companyName,
        invoiceReference: invoiceReference ?? 0,
        totalAmountIncl: parseFloat(totalAmountIncl),
        billingDate: format(billingDate, "yyyy-MM-dd"),
      })
    );

    if (!process.env.POSTMARK_API_KEY) {
      throw new Error("POSTMARK_API_KEY is not set");
    }

    const postmarkClient = new ServerClient(process.env.POSTMARK_API_KEY);

    await postmarkClient.sendEmail({
      From: "billing@recommand.eu",
      To: emailRecipients.join(", "),
      Cc: "billing@recommand.eu",
      Subject: `Payment failed for invoice ${invoiceReference ?? ""}`,
      HtmlBody: emailHtml,
    });
  }

  await db.insert(paymentFailureReminders).values({
    billingEventId,
    emailAddresses: emailRecipients,
  });

  return { emailSent: emailRecipients.length > 0, emailRecipients };
}
