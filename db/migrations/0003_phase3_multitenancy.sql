-- Phase 3: Multi-tenancy & Super-Admin schema migration
-- Removes Lucia/GitHub-OAuth tables, adds churches/users/user_church_roles

--> statement-breakpoint
-- Create enums
CREATE TYPE "church_status" AS ENUM ('provisioning', 'active', 'suspended');
--> statement-breakpoint
CREATE TYPE "church_role" AS ENUM ('church_admin', 'editor');
--> statement-breakpoint

-- Create churches table
CREATE TABLE "churches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "github_repo_name" text NOT NULL,
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "cf_pages_project_name" text,
  "cf_pages_url" text,
  "custom_domain" text,
  "status" "church_status" NOT NULL DEFAULT 'provisioning',
  "plan" text NOT NULL DEFAULT 'free',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_churches_slug" ON "churches" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_churches_github_repo_name" ON "churches" ("github_repo_name");
--> statement-breakpoint

-- Create users table
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "auth0_id" text NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL DEFAULT '',
  "is_super_admin" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_auth0_id" ON "users" ("auth0_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email");
--> statement-breakpoint

-- Create user_church_roles table
CREATE TABLE "user_church_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "church_id" uuid NOT NULL REFERENCES "churches"("id"),
  "role" "church_role" NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "idx_user_church_roles_user_id" ON "user_church_roles" ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_user_church_roles_church_id" ON "user_church_roles" ("church_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_church_roles_user_church" ON "user_church_roles" ("user_id", "church_id");
--> statement-breakpoint

-- Drop obsolete Lucia/GitHub-OAuth tables
DROP TABLE IF EXISTS "cache_permission";
--> statement-breakpoint
DROP TABLE IF EXISTS "collaborator";
--> statement-breakpoint
DROP TABLE IF EXISTS "email_login_token";
--> statement-breakpoint
DROP TABLE IF EXISTS "github_user_token";
--> statement-breakpoint
DROP TABLE IF EXISTS "session";
--> statement-breakpoint
DROP TABLE IF EXISTS "user";
