CREATE TABLE "peppol_subscription_billing_event_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_billing_event_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"subscription_start_date" timestamp with time zone NOT NULL,
	"subscription_end_date" timestamp with time zone NOT NULL,
	"subscription_last_billed_at" timestamp with time zone NOT NULL,
	"plan_id" text,
	"included_monthly_documents" numeric NOT NULL,
	"base_price" numeric NOT NULL,
	"incoming_document_overage_price" numeric NOT NULL,
	"outgoing_document_overage_price" numeric NOT NULL,
	"used_qty" numeric NOT NULL,
	"used_qty_incoming" numeric NOT NULL,
	"used_qty_outgoing" numeric NOT NULL,
	"included_qty" numeric NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"total_amount_excl" numeric NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" DROP CONSTRAINT "peppol_subscription_billing_events_subscription_id_peppol_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_event_lines" ADD CONSTRAINT "peppol_subscription_billing_event_lines_subscription_billing_event_id_peppol_subscription_billing_events_id_fk" FOREIGN KEY ("subscription_billing_event_id") REFERENCES "public"."peppol_subscription_billing_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" DROP COLUMN "subscription_id";--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" DROP COLUMN "billing_config";