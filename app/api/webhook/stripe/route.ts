import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { sitesTable, siteSubscriptionsTable } from "@/db/schema";

/**
 * Stripe webhook handler. Syncs subscription state into site_subscriptions and
 * updates sites.status when billing lifecycle events require it.
 *
 * Lifecycle rules:
 * - checkout.session.completed does NOT change sites.status. A new site stays
 *   "provisioning" until the wizard completes (launchSite).
 * - invoice.payment_failed / subscription.deleted pause an active site.
 * - invoice.payment_succeeded un-pauses a paused site.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook not configured", { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const siteId = session.metadata?.siteId;
        if (!siteId || typeof session.subscription !== "string") break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await upsertSubscriptionFromStripe(siteId, subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const siteId = await siteIdFromSubscription(subscription);
        if (!siteId) break;

        await upsertSubscriptionFromStripe(siteId, subscription);

        // Pause active sites when the subscription is fully canceled.
        if (event.type === "customer.subscription.deleted") {
          await pauseIfActive(siteId);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const siteId = await siteIdFromInvoice(invoice);
        if (!siteId) break;

        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscriptionFromStripe(siteId, subscription);
        }
        await resumeIfPaused(siteId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const siteId = await siteIdFromInvoice(invoice);
        if (!siteId) break;

        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscriptionFromStripe(siteId, subscription);
        }
        await pauseIfActive(siteId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, err);
    return new Response("Handler error", { status: 500 });
  }

  return Response.json({ received: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function siteIdFromSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.siteId) return subscription.metadata.siteId;

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  const existing = await db.query.siteSubscriptionsTable.findFirst({
    where: eq(siteSubscriptionsTable.stripeCustomerId, customerId),
    columns: { siteId: true },
  });
  return existing?.siteId ?? null;
}

async function siteIdFromInvoice(invoice: Stripe.Invoice): Promise<string | null> {
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;
  if (!customerId) return null;

  const existing = await db.query.siteSubscriptionsTable.findFirst({
    where: eq(siteSubscriptionsTable.stripeCustomerId, customerId),
    columns: { siteId: true },
  });
  return existing?.siteId ?? null;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

async function upsertSubscriptionFromStripe(
  siteId: string,
  subscription: Stripe.Subscription,
) {
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  const periodEndSeconds = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const periodEnd = typeof periodEndSeconds === "number"
    ? new Date(periodEndSeconds * 1000)
    : null;

  const existing = await db.query.siteSubscriptionsTable.findFirst({
    where: eq(siteSubscriptionsTable.siteId, siteId),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(siteSubscriptionsTable)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: subscription.status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(siteSubscriptionsTable.id, existing.id));
  } else {
    await db.insert(siteSubscriptionsTable).values({
      siteId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: subscription.status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }
}

// Only flip active → paused. Provisioning sites aren't paused — they simply
// lose wizard access until payment completes (see the provisioning gate).
async function pauseIfActive(siteId: string) {
  const site = await db.query.sitesTable.findFirst({
    where: eq(sitesTable.id, siteId),
    columns: { status: true },
  });
  if (site?.status === "active") {
    await db
      .update(sitesTable)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(sitesTable.id, siteId));
  }
}

// Only flip paused → active. Provisioning sites stay in provisioning until
// the wizard completes.
async function resumeIfPaused(siteId: string) {
  const site = await db.query.sitesTable.findFirst({
    where: eq(sitesTable.id, siteId),
    columns: { status: true },
  });
  if (site?.status === "paused") {
    await db
      .update(sitesTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(sitesTable.id, siteId));
  }
}
