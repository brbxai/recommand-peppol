ALTER TABLE "peppol_transfer_events" DROP CONSTRAINT "peppol_transfer_events_company_id_peppol_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" DROP CONSTRAINT "peppol_transmitted_documents_company_id_peppol_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_webhooks" DROP CONSTRAINT "peppol_webhooks_company_id_peppol_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD CONSTRAINT "peppol_transmitted_documents_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_webhooks" ADD CONSTRAINT "peppol_webhooks_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE cascade ON UPDATE no action;