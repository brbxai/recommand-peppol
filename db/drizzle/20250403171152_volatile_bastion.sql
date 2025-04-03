CREATE TABLE "peppol_participant_business_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"name" text NOT NULL,
	"country_code" "peppol_valid_country_codes" NOT NULL,
	"geographical_information" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peppol_participant_service_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"document_type_schema" text NOT NULL,
	"document_type_code" text NOT NULL,
	"document_process_id_schema" text NOT NULL,
	"document_process_id_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peppol_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"peppol_identifier_eas" text NOT NULL,
	"peppol_identifier_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_participant_business_cards" ADD CONSTRAINT "peppol_participant_business_cards_participant_id_peppol_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."peppol_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_participant_service_metadata" ADD CONSTRAINT "peppol_participant_service_metadata_participant_id_peppol_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."peppol_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_participants" ADD CONSTRAINT "peppol_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;