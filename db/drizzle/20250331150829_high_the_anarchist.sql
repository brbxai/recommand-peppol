ALTER TABLE "peppol_subscription_billing_events" ALTER COLUMN "billing_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ALTER COLUMN "billing_period_start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ALTER COLUMN "billing_period_end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "peppol_subscriptions" ALTER COLUMN "start_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "peppol_subscriptions" ALTER COLUMN "end_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "peppol_subscriptions" ALTER COLUMN "last_billed_at" SET DATA TYPE timestamp with time zone;