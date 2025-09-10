ALTER TABLE "peppol_billing_profiles" DROP CONSTRAINT "peppol_billing_profiles_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_companies" DROP CONSTRAINT "peppol_companies_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_subscription_billing_events" DROP CONSTRAINT "peppol_subscription_billing_events_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_subscriptions" DROP CONSTRAINT "peppol_subscriptions_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_transfer_events" DROP CONSTRAINT "peppol_transfer_events_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" DROP CONSTRAINT "peppol_transmitted_documents_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_webhooks" DROP CONSTRAINT "peppol_webhooks_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_companies" ADD CONSTRAINT "peppol_companies_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_team_extensions" ADD CONSTRAINT "peppol_team_extensions_id_teams_id_fk" FOREIGN KEY ("id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD CONSTRAINT "peppol_transmitted_documents_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_webhooks" ADD CONSTRAINT "peppol_webhooks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;