CREATE TYPE "public"."peppol_payment_status" AS ENUM('none', 'open', 'pending', 'authorized', 'paid', 'canceled', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."peppol_valid_country_codes" AS ENUM('BE');--> statement-breakpoint
CREATE TABLE "peppol_billing_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"mollie_customer_id" text NOT NULL,
	"company_name" text NOT NULL,
	"address" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"country" "peppol_valid_country_codes" NOT NULL,
	"vat_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peppol_subscription_billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"billing_profile_id" text NOT NULL,
	"billing_date" timestamp NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"excl_vat_amount" numeric NOT NULL,
	"vat_amount" numeric NOT NULL,
	"total_amount" numeric NOT NULL,
	"billing_config" jsonb NOT NULL,
	"included_qty" numeric NOT NULL,
	"overage_qty" numeric NOT NULL,
	"payment_status" "peppol_payment_status" DEFAULT 'none' NOT NULL,
	"payment_id" text NOT NULL,
	"paid_amount" numeric,
	"payment_method" text,
	"payment_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peppol_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"plan_id" text,
	"billing_config" jsonb NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"last_billed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_billing_profiles" ADD CONSTRAINT "peppol_billing_profiles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD CONSTRAINT "peppol_subscription_billing_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD CONSTRAINT "peppol_subscription_billing_events_subscription_id_peppol_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."peppol_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD CONSTRAINT "peppol_subscription_billing_events_billing_profile_id_peppol_billing_profiles_id_fk" FOREIGN KEY ("billing_profile_id") REFERENCES "public"."peppol_billing_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_subscriptions" ADD CONSTRAINT "peppol_subscriptions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;