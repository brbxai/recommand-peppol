ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "peppol_message_id" text;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "peppol_conversation_id" text;--> statement-breakpoint
ALTER TABLE "peppol_transmitted_documents" ADD COLUMN "received_peppol_signal_message" text;