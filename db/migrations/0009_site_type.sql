CREATE TYPE "public"."site_type" AS ENUM('church', 'organization');--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "site_type" "site_type" NOT NULL DEFAULT 'church';
