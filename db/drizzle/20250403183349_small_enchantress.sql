ALTER TABLE "peppol_companies" ADD COLUMN "enterprise_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_companies" ADD CONSTRAINT "peppol_companies_enterprise_number_unique" UNIQUE("enterprise_number");--> statement-breakpoint
ALTER TABLE "peppol_companies" ADD CONSTRAINT "peppol_companies_vat_number_unique" UNIQUE("vat_number");