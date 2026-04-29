import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import {
  sitesTable,
  siteSubscriptionsTable,
  userSiteRolesTable,
  usersTable,
} from "@/db/schema";

/**
 * Creates a Stripe Checkout Session for a site's annual subscription.
 *
 * POST /api/billing/create-checkout-session
 * Body: { siteId: string }
 *
 * Auth: super admin, OR the site admin for the given siteId.
 * Returns: { url: string }
 */
export async function POST(request: Request) {
  const { user } = await getAuth();
  if (!user) return new Response(null, { status: 401 });

  let body: { siteId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const siteId = body.siteId;
  if (!siteId) {
    return Response.json({ error: "Missing siteId" }, { status: 400 });
  }

  const isAuthorized =
    user.isSuperAdmin ||
    (user.siteAssignment?.siteId === siteId && user.siteAssignment.isAdmin);
  if (!isAuthorized) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const priceId = process.env.STRIPE_ANNUAL_PRICE_ID;
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!priceId || !appBaseUrl) {
    return Response.json(
      { error: "Billing is not configured" },
      { status: 500 },
    );
  }

  const site = await db.query.sitesTable.findFirst({
    where: and(eq(sitesTable.id, siteId), isNull(sitesTable.deletedAt)),
    columns: { id: true, displayName: true },
  });
  if (!site) {
    return Response.json({ error: "Site not found" }, { status: 404 });
  }

  // Reuse an existing Stripe customer for the site if one exists, otherwise
  // create a new one keyed to the primary site admin's email.
  const existingSub = await db.query.siteSubscriptionsTable.findFirst({
    where: eq(siteSubscriptionsTable.siteId, siteId),
    columns: { id: true, stripeCustomerId: true },
  });

  let stripeCustomerId = existingSub?.stripeCustomerId;

  if (!stripeCustomerId) {
    const [admin] = await db
      .select({ email: usersTable.email, name: usersTable.name })
      .from(userSiteRolesTable)
      .innerJoin(usersTable, eq(userSiteRolesTable.userId, usersTable.id))
      .where(
        and(
          eq(userSiteRolesTable.siteId, siteId),
          eq(userSiteRolesTable.isAdmin, true),
          isNull(userSiteRolesTable.deletedAt),
          isNull(usersTable.deletedAt),
        ),
      )
      .limit(1);

    const customer = await stripe.customers.create({
      email: admin?.email,
      name: site.displayName,
      metadata: { siteId: site.id },
    });
    stripeCustomerId = customer.id;

    await db.insert(siteSubscriptionsTable).values({
      siteId: site.id,
      stripeCustomerId,
      status: "incomplete",
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { siteId: site.id },
    subscription_data: { metadata: { siteId: site.id } },
    success_url: `${appBaseUrl}/`,
    cancel_url: `${appBaseUrl}/`,
  });

  if (!session.url) {
    return Response.json(
      { error: "Failed to create checkout session" },
      { status: 502 },
    );
  }

  return Response.json({ url: session.url });
}
