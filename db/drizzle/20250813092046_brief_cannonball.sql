CREATE TABLE "peppol_company_document_types" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"doc_type_id" text NOT NULL,
	"process_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peppol_company_identifiers" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"scheme" text NOT NULL,
	"identifier" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_company_document_types" ADD CONSTRAINT "peppol_company_document_types_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_company_identifiers" ADD CONSTRAINT "peppol_company_identifiers_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "peppol_company_document_types_unique" ON "peppol_company_document_types" USING btree ("company_id","doc_type_id","process_id");--> statement-breakpoint
CREATE UNIQUE INDEX "peppol_company_identifiers_unique" ON "peppol_company_identifiers" USING btree ("company_id",lower("scheme"),lower("identifier"));