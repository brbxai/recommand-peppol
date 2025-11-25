CREATE TABLE "integration_task_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"task" text NOT NULL,
	"success" boolean NOT NULL,
	"message" text NOT NULL,
	"context" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_task_logs" ADD CONSTRAINT "integration_task_logs_integration_id_activated_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."activated_integrations"("id") ON DELETE cascade ON UPDATE no action;