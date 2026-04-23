import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { siteSubscriptionsTable } from "@/db/schema";

/**
 * Creates a Stripe Customer Portal session so a subscriber can manage billing.
 *
 * POST /api/billing/create-portal-session
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

  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) {
    return Response.json(
      { error: "Billing is not configured" },
      { status: 500 },
    );
  }

  const sub = await db.query.siteSubscriptionsTable.findFirst({
    where: eq(siteSubscriptionsTable.siteId, siteId),
    columns: { stripeCustomerId: true },
  });
  if (!sub) {
    return Response.json(
      { error: "No subscription found for this site" },
      { status: 404 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appBaseUrl}/`,
  });

  return Response.json({ url: session.url });
}
