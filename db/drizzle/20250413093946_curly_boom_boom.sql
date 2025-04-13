CREATE TABLE "peppol_transmitted_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"company_id" text NOT NULL,
	"direction" "peppol_transfer_event_direction" NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"doc_type_id" text NOT NULL,
	"process_id" text NOT NULL,
	"country_c1" "peppol_valid_country_codes" NOT NULL,
	"body" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_transfer_events" ADD COLUMN "company_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD CONSTRAINT "peppol_transmitted_documents_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD CONSTRAINT "peppol_transmitted_documents_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_transfer_events" ADD CONSTRAINT "peppol_transfer_events_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE no action ON UPDATE no action;