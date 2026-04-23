-- Rename the existing "suspended" enum value to "paused" to better reflect
-- the tenant lifecycle (billing-lapsed sites, not disciplinary suspension).
ALTER TYPE "public"."site_status" RENAME VALUE 'suspended' TO 'paused';--> statement-breakpoint

-- The `plan` column was never used beyond its default "free" and is superseded
-- by the new site_subscriptions table.
ALTER TABLE "sites" DROP COLUMN "plan";--> statement-breakpoint

CREATE TABLE "site_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "stripe_subscription_id" text,
  "stripe_price_id" text,
  "status" text NOT NULL DEFAULT 'incomplete',
  "current_period_end" timestamp,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "site_subscriptions" ADD CONSTRAINT "site_subscriptions_site_id_sites_id_fk"
  FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "idx_site_subscriptions_site_id" ON "site_subscriptions" ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_site_subscriptions_customer" ON "site_subscriptions" ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_site_subscriptions_subscription" ON "site_subscriptions" ("stripe_subscription_id");
