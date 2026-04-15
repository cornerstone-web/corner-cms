ALTER TABLE "user_church_roles" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "user_church_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"church_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_church_scopes" ADD CONSTRAINT "user_church_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_church_scopes" ADD CONSTRAINT "user_church_scopes_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_church_scopes_unique" ON "user_church_scopes" USING btree ("user_id","church_id","scope");--> statement-breakpoint
UPDATE "user_church_roles" SET "is_admin" = true WHERE "role" = 'church_admin';--> statement-breakpoint
ALTER TABLE "user_church_roles" DROP COLUMN "role";--> statement-breakpoint
DROP TYPE "public"."church_role";
