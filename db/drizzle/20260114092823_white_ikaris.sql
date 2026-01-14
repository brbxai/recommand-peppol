ALTER TABLE "peppol_transmitted_documents" ALTER COLUMN "receiver_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ALTER COLUMN "doc_type_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ALTER COLUMN "process_id" DROP NOT NULL;