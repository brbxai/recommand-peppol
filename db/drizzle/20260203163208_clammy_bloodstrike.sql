CREATE TABLE "peppol_payment_retry_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_event_id" text NOT NULL,
	"email_addresses" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_payment_retry_reminders" ADD CONSTRAINT "peppol_payment_retry_reminders_billing_event_id_peppol_subscription_billing_events_id_fk" FOREIGN KEY ("billing_event_id") REFERENCES "public"."peppol_subscription_billing_events"("id") ON DELETE cascade ON UPDATE no action;