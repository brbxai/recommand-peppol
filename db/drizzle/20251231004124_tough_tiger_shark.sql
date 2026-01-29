CREATE TABLE "supporting_data_customers" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"vat_number" text,
	"enterprise_number" text,
	"peppol_addresses" text[] DEFAULT '{}',
	"address" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"country" text NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supporting_data_customers" ADD CONSTRAINT "supporting_data_customers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supporting_customers_team_id_idx" ON "supporting_data_customers" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supporting_customers_external_id_unique" ON "supporting_data_customers" USING btree ("team_id","external_id") WHERE "supporting_data_customers"."external_id" is not null;