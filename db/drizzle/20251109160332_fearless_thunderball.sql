ALTER TABLE "supporting_data_suppliers" DROP CONSTRAINT "supporting_data_suppliers_company_id_peppol_companies_id_fk";
--> statement-breakpoint
DROP INDEX "supporting_suppliers_company_id_idx";--> statement-breakpoint
DROP INDEX "supporting_suppliers_external_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "supporting_suppliers_external_id_unique" ON "supporting_data_suppliers" USING btree ("team_id","external_id") WHERE "supporting_data_suppliers"."external_id" is not null;--> statement-breakpoint
ALTER TABLE "supporting_data_suppliers" DROP COLUMN "company_id";