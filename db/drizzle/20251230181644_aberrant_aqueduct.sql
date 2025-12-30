ALTER TABLE "peppol_billing_profiles" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "peppol_billing_profiles" ADD COLUMN "billing_peppol_address" text;--> statement-breakpoint
ALTER TABLE "peppol_billing_profiles" ADD COLUMN "is_manually_billed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "vat_category" text NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "vat_percentage" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "used_qty_incoming" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "used_qty_outgoing" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "invoice_id" text;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "invoice_reference" serial NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" DROP COLUMN "overage_qty";--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD CONSTRAINT "peppol_subscription_billing_events_invoice_id_unique" UNIQUE("invoice_id");--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD CONSTRAINT "peppol_subscription_billing_events_invoice_reference_unique" UNIQUE("invoice_reference");