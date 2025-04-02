CREATE TYPE "public"."peppol_transfer_event_direction" AS ENUM('incoming', 'outgoing');--> statement-breakpoint
CREATE TABLE "peppol_transfer_events" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"direction" "peppol_transfer_event_direction" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" RENAME COLUMN "excl_vat_amount" TO "total_amount_excl";--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" RENAME COLUMN "total_amount" TO "total_amount_incl";--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ALTER COLUMN "payment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "used_qty" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" ADD COLUMN "amount_due" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_transfer_events" ADD CONSTRAINT "peppol_transfer_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;