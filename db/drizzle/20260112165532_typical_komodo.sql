CREATE TYPE "public"."peppol_profile_standing" AS ENUM('pending', 'active', 'grace', 'suspended');--> statement-breakpoint
ALTER TABLE "peppol_billing_profiles" ADD COLUMN "profile_standing" "peppol_profile_standing" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_billing_profiles" ADD COLUMN "grace_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "peppol_billing_profiles" ADD COLUMN "grace_reason" text;--> statement-breakpoint
ALTER TABLE "peppol_billing_profiles" ADD COLUMN "suspended_at" timestamp with time zone;

-- Set all profiles that have a valid payment mandate or are set to manually billed to active
UPDATE "peppol_billing_profiles" SET "profile_standing" = 'active' WHERE "is_mandate_validated" = true OR "is_manually_billed" = true;