ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "sent_over_peppol" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "sent_over_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "email_recipients" text[] DEFAULT '{}';