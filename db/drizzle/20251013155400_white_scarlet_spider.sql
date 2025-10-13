ALTER TABLE "peppol_company_notification_emails" RENAME TO "peppol_company_notification_email_addresses";--> statement-breakpoint
ALTER TABLE "peppol_company_notification_email_addresses" DROP CONSTRAINT "peppol_company_notification_emails_company_id_peppol_companies_id_fk";
--> statement-breakpoint
DROP INDEX "peppol_company_notification_emails_unique";--> statement-breakpoint
ALTER TABLE "peppol_company_notification_email_addresses" ADD CONSTRAINT "peppol_company_notification_email_addresses_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "peppol_company_notification_email_addresses_unique" ON "peppol_company_notification_email_addresses" USING btree ("company_id",lower("email"));