CREATE TABLE "peppol_provider_delivery_failures" (
	"ap_transaction_id" text PRIMARY KEY NOT NULL,
	"access_point_provider" "peppol_access_point_provider" NOT NULL,
	"use_test_network" boolean DEFAULT false NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"transaction_status" text,
	"error_code" text,
	"error_message" text,
	"error_category" text,
	"doc_instance_id" text,
	"payload" jsonb NOT NULL,
	"transmitted_document_id" text,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attached_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "peppol_provider_delivery_failures" ADD CONSTRAINT "peppol_provider_delivery_failures_transmitted_document_id_peppol_transmitted_documents_id_fk" FOREIGN KEY ("transmitted_document_id") REFERENCES "public"."peppol_transmitted_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "peppol_provider_delivery_failures_document_idx" ON "peppol_provider_delivery_failures" USING btree ("transmitted_document_id") WHERE "peppol_provider_delivery_failures"."transmitted_document_id" is not null;