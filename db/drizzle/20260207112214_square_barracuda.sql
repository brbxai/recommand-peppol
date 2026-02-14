CREATE TYPE "public"."verification_requirements" AS ENUM('strict', 'trusted', 'lax');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('opened', 'requested', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "company_verification_log" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"status" "verification_status" DEFAULT 'opened' NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"enterprise_number" text,
	"verification_proof_reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_data_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"enterprise_number" text NOT NULL,
	"country" "peppol_valid_country_codes" NOT NULL,
	"name" text NOT NULL,
	"begin_date" date NOT NULL,
	"street" text NOT NULL,
	"number" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"juridical_form_code" text NOT NULL,
	"juridical_form_description" text NOT NULL,
	"juridical_form_begin_date" date NOT NULL,
	"denomination_code" text NOT NULL,
	"denomination_description" text NOT NULL,
	"denomination_begin_date" date NOT NULL,
	"representatives" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_companies" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_companies" ADD COLUMN "verification_proof_reference" text;--> statement-breakpoint
ALTER TABLE "peppol_team_extensions" ADD COLUMN "verification_requirements" "verification_requirements" DEFAULT 'lax' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_verification_log" ADD CONSTRAINT "company_verification_log_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enterprise_data_cache_unique" ON "enterprise_data_cache" USING btree ("enterprise_number","country");