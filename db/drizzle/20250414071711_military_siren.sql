CREATE TABLE "peppol_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"company_id" text,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_webhooks" ADD CONSTRAINT "peppol_webhooks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_webhooks" ADD CONSTRAINT "peppol_webhooks_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE no action ON UPDATE no action;