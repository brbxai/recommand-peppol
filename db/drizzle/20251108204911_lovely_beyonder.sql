CREATE TABLE "peppol_labels" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"color_hex" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supporting_data_supplier_labels" (
	"supporting_data_supplier_id" text NOT NULL,
	"label_id" text NOT NULL,
	CONSTRAINT "supporting_data_supplier_labels_pkey" PRIMARY KEY("supporting_data_supplier_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "supporting_data_suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"company_id" text,
	"external_id" text,
	"name" text NOT NULL,
	"vat_number" text,
	"peppol_addresses" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peppol_transmitted_document_labels" (
	"transmitted_document_id" text NOT NULL,
	"label_id" text NOT NULL,
	CONSTRAINT "peppol_transmitted_document_labels_pkey" PRIMARY KEY("transmitted_document_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "peppol_labels" ADD CONSTRAINT "peppol_labels_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supporting_data_supplier_labels" ADD CONSTRAINT "supporting_data_supplier_labels_supporting_data_supplier_id_supporting_data_suppliers_id_fk" FOREIGN KEY ("supporting_data_supplier_id") REFERENCES "public"."supporting_data_suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supporting_data_supplier_labels" ADD CONSTRAINT "supporting_data_supplier_labels_label_id_peppol_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."peppol_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supporting_data_suppliers" ADD CONSTRAINT "supporting_data_suppliers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supporting_data_suppliers" ADD CONSTRAINT "supporting_data_suppliers_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_document_labels" ADD CONSTRAINT "peppol_transmitted_document_labels_transmitted_document_id_peppol_transmitted_documents_id_fk" FOREIGN KEY ("transmitted_document_id") REFERENCES "public"."peppol_transmitted_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_document_labels" ADD CONSTRAINT "peppol_transmitted_document_labels_label_id_peppol_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."peppol_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "peppol_labels_external_id_unique" ON "peppol_labels" USING btree ("team_id","external_id") WHERE "peppol_labels"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "supporting_suppliers_team_id_idx" ON "supporting_data_suppliers" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "supporting_suppliers_company_id_idx" ON "supporting_data_suppliers" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supporting_suppliers_external_id_unique" ON "supporting_data_suppliers" USING btree ("team_id","company_id","external_id") WHERE "supporting_data_suppliers"."external_id" is not null;