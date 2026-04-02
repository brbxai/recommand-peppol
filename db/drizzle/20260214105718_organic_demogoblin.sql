ALTER TABLE "public"."company_verification_log" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."company_verification_log" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."verification_status";--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('opened', 'formSubmitted', 'idVerificationRequested', 'verified', 'rejected');--> statement-breakpoint
ALTER TABLE "public"."company_verification_log" ALTER COLUMN "status" SET DATA TYPE "public"."verification_status" USING "status"::"public"."verification_status";--> statement-breakpoint
ALTER TABLE "public"."company_verification_log" ALTER COLUMN "status" SET DEFAULT 'opened';
