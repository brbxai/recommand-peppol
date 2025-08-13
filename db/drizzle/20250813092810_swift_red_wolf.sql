ALTER TABLE "peppol_company_document_types" DROP CONSTRAINT "peppol_company_document_types_company_id_peppol_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_company_identifiers" DROP CONSTRAINT "peppol_company_identifiers_company_id_peppol_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_company_document_types" ADD CONSTRAINT "peppol_company_document_types_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_company_identifiers" ADD CONSTRAINT "peppol_company_identifiers_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE cascade ON UPDATE no action;