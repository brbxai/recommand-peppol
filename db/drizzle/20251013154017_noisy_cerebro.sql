CREATE TABLE "peppol_company_notification_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"email" text NOT NULL,
	"notify_incoming" boolean DEFAULT false NOT NULL,
	"notify_outgoing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peppol_company_notification_emails" ADD CONSTRAINT "peppol_company_notification_emails_company_id_peppol_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."peppol_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "peppol_company_notification_emails_unique" ON "peppol_company_notification_emails" USING btree ("company_id",lower("email"));