import {
  billingProfiles,
  subscriptionBillingEvents,
  paymentRetryReminders,
} from "@peppol/db/schema";
import { db } from "@recommand/db";
import { and, eq, isNotNull, gte, inArray, gt } from "drizzle-orm";
import { subDays, format } from "date-fns";
import { getMandate, requestPayment } from "../mollie";
import { getMinimalTeamMembers } from "@core/data/team-members";
import { render } from "@react-email/render";
import { FailedPaymentRetryEmail } from "@peppol/emails/failed-payment-retry";
import { ServerClient } from "postmark";

export type PaymentRetryResult = {
  status: "success" | "failed" | "skipped";
  billingEventId: string;
  invoiceReference: number | null;
  teamId: string;
  companyName: string;
  amountDue: string;
  errorMessage?: string;
  emailSent?: boolean;
};

export async function retryFailedPayments(teamIds?: string[], dryRun: boolean = false): Promise<PaymentRetryResult[]> {
  const results: PaymentRetryResult[] = [];

  const failedPayments = await db
    .select({
      billingEvent: subscriptionBillingEvents,
      billingProfile: billingProfiles,
    })
    .from(subscriptionBillingEvents)
    .innerJoin(billingProfiles, eq(subscriptionBillingEvents.billingProfileId, billingProfiles.id))
    .where(
      and(
        gt(subscriptionBillingEvents.amountDue, "0"),
        inArray(subscriptionBillingEvents.paymentStatus, ["canceled", "expired", "failed"]),
        teamIds && teamIds.length > 0 ? inArray(subscriptionBillingEvents.teamId, teamIds) : undefined,
        eq(billingProfiles.isManuallyBilled, false),
      )
    );

  for (const { billingEvent, billingProfile } of failedPayments) {
    try {
      const sevenDaysAgo = subDays(new Date(), 7);

      const recentReminder = await db
        .select()
        .from(paymentRetryReminders)
        .where(
          and(
            eq(paymentRetryReminders.billingEventId, billingEvent.id),
            gte(paymentRetryReminders.createdAt, sevenDaysAgo)
          )
        )
        .limit(1);

      if (recentReminder.length > 0) {
        console.log(`Skipping reminder for billing event ${billingEvent.id} - reminder sent within last 7 days`);
        results.push({
          status: "skipped",
          billingEventId: billingEvent.id,
          invoiceReference: billingEvent.invoiceReference,
          teamId: billingEvent.teamId,
          companyName: billingProfile.companyName,
          amountDue: billingEvent.amountDue,
          errorMessage: "Reminder sent within last 7 days",
        });
        continue;
      }

      if (!billingProfile.mollieCustomerId) {
        throw new Error("Billing profile has no Mollie customer ID");
      }

      const mandate = await getMandate(billingProfile.mollieCustomerId);
      if (!mandate) {
        throw new Error("Mandate not found");
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would retry payment for billing event ${billingEvent.id} (invoice ${billingEvent.invoiceReference ?? "N/A"})`);
        results.push({
          status: "success",
          billingEventId: billingEvent.id,
          invoiceReference: billingEvent.invoiceReference,
          teamId: billingEvent.teamId,
          companyName: billingProfile.companyName,
          amountDue: billingEvent.amountDue,
          emailSent: false,
        });
        continue;
      }

      try {
        await requestPayment(
          billingProfile.mollieCustomerId,
          mandate.id,
          billingProfile.id,
          billingEvent.id,
          billingEvent.amountDue
        );
        results.push({
          status: "success",
          billingEventId: billingEvent.id,
          invoiceReference: billingEvent.invoiceReference,
          teamId: billingEvent.teamId,
          companyName: billingProfile.companyName,
          amountDue: billingEvent.amountDue,
          emailSent: false,
        });
      } catch (paymentError) {
        let emailRecipients: string[] = [];
        if (billingProfile.billingEmail) {
          emailRecipients = [billingProfile.billingEmail];
        } else {
          const teamMembers = await getMinimalTeamMembers(billingEvent.teamId);
          emailRecipients = teamMembers.map(member => member.user.email);
        }

        if (emailRecipients.length > 0) {
          const emailHtml = await render(
            FailedPaymentRetryEmail({
              companyName: billingProfile.companyName,
              invoiceReference: billingEvent.invoiceReference ?? 0,
              totalAmountIncl: parseFloat(billingEvent.totalAmountIncl),
              billingDate: format(billingEvent.billingDate, "yyyy-MM-dd"),
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
            Subject: `Payment retry failed for invoice ${billingEvent.invoiceReference ?? ""}`,
            HtmlBody: emailHtml,
          });
        }

        await db.insert(paymentRetryReminders).values({
          billingEventId: billingEvent.id,
          emailAddresses: emailRecipients,
        });

        results.push({
          status: "failed",
          billingEventId: billingEvent.id,
          invoiceReference: billingEvent.invoiceReference,
          teamId: billingEvent.teamId,
          companyName: billingProfile.companyName,
          amountDue: billingEvent.amountDue,
          errorMessage: paymentError instanceof Error ? paymentError.message : String(paymentError),
          emailSent: emailRecipients.length > 0,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        status: "failed",
        billingEventId: billingEvent.id,
        invoiceReference: billingEvent.invoiceReference,
        teamId: billingEvent.teamId,
        companyName: billingProfile.companyName,
        amountDue: billingEvent.amountDue,
        errorMessage,
        emailSent: false,
      });
      console.error(`Failed to retry payment for billing event ${billingEvent.id}:`, error);
    }
  }

  return results;
}
