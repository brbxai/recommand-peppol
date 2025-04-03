CREATE TABLE "peppol_companies" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"country" "peppol_valid_country_codes" NOT NULL,
	"vat_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_participants" ADD COLUMN "company_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_companies" ADD CONSTRAINT "peppol_companies_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_participants" ADD CONSTRAINT "peppol_participants_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_participants" DROP COLUMN "name";