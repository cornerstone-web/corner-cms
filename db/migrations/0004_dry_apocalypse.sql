-- Add wizard tracking: wizardStartedAt column + church_wizard_steps table

--> statement-breakpoint
ALTER TABLE "churches" ADD COLUMN "wizard_started_at" timestamp;
--> statement-breakpoint
CREATE TABLE "church_wizard_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "church_wizard_steps" ADD CONSTRAINT "church_wizard_steps_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "church_wizard_steps_church_step_idx" ON "church_wizard_steps" USING btree ("church_id","step_key");
--> statement-breakpoint
CREATE INDEX "church_wizard_steps_church_id_idx" ON "church_wizard_steps" USING btree ("church_id");
