CREATE TYPE "public"."peppol_supported_document_type" AS ENUM('invoice', 'unknown');--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" RENAME COLUMN "body" TO "xml";--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "type" "peppol_supported_document_type" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "parsed" jsonb;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "read_at" timestamp;