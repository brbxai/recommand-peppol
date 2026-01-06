ALTER TABLE "peppol_subscription_billing_event_lines" ADD COLUMN "overage_qty_incoming" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_event_lines" ADD COLUMN "overage_qty_outgoing" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "overage_qty_incoming" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "overage_qty_outgoing" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_event_lines" DROP COLUMN "included_qty";--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" DROP COLUMN "included_qty";