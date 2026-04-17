-- Rename enum type
ALTER TYPE "public"."church_status" RENAME TO "site_status";--> statement-breakpoint
-- Rename tables
ALTER TABLE "churches" RENAME TO "sites";--> statement-breakpoint
ALTER TABLE "user_church_roles" RENAME TO "user_site_roles";--> statement-breakpoint
ALTER TABLE "user_church_scopes" RENAME TO "user_site_scopes";--> statement-breakpoint
ALTER TABLE "church_wizard_steps" RENAME TO "site_wizard_steps";--> statement-breakpoint
-- Rename church_id columns to site_id
ALTER TABLE "user_site_roles" RENAME COLUMN "church_id" TO "site_id";--> statement-breakpoint
ALTER TABLE "user_site_scopes" RENAME COLUMN "church_id" TO "site_id";--> statement-breakpoint
ALTER TABLE "site_wizard_steps" RENAME COLUMN "church_id" TO "site_id";--> statement-breakpoint
-- Drop old indexes
DROP INDEX IF EXISTS "idx_churches_slug";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_churches_github_repo_name";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_church_roles_user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_church_roles_church_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_church_roles_user_church";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_church_scopes_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "church_wizard_steps_church_step_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "church_wizard_steps_church_id_idx";--> statement-breakpoint
-- Create new indexes
CREATE UNIQUE INDEX "idx_sites_slug" ON "sites" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sites_github_repo_name" ON "sites" ("github_repo_name");--> statement-breakpoint
CREATE INDEX "idx_user_site_roles_user_id" ON "user_site_roles" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_site_roles_site_id" ON "user_site_roles" ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_site_roles_user_site" ON "user_site_roles" ("user_id", "site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_site_scopes_unique" ON "user_site_scopes" ("user_id", "site_id", "scope");--> statement-breakpoint
CREATE UNIQUE INDEX "site_wizard_steps_site_step_idx" ON "site_wizard_steps" ("site_id", "step_key");--> statement-breakpoint
CREATE INDEX "site_wizard_steps_site_id_idx" ON "site_wizard_steps" ("site_id");
