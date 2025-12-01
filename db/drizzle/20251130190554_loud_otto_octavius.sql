CREATE TYPE "public"."peppol_validation_result" AS ENUM('valid', 'invalid', 'not_supported', 'error');--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "validation" jsonb;