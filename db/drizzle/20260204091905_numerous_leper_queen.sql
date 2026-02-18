ALTER TABLE "peppol_payment_retry_reminders" RENAME TO "peppol_payment_failure_reminders";--> statement-breakpoint
ALTER TABLE "peppol_payment_failure_reminders" DROP CONSTRAINT "peppol_payment_retry_reminders_billing_event_id_peppol_subscription_billing_events_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_payment_failure_reminders" ADD CONSTRAINT "peppol_payment_failure_reminders_billing_event_id_peppol_subscription_billing_events_id_fk" FOREIGN KEY ("billing_event_id") REFERENCES "public"."peppol_subscription_billing_events"("id") ON DELETE cascade ON UPDATE no action;