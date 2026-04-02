ALTER TYPE "public"."verification_status" ADD VALUE 'error';--> statement-breakpoint
ALTER TABLE "company_verification_log" ADD COLUMN "error_message" text;