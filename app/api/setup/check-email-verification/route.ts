import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

/**
 * Check whether an email address is verified as a CF Email Routing destination.
 *
 * GET /api/setup/check-email-verification?email=<email>
 *
 * Returns: { verified: boolean }
 *
 * Uses a regular route handler (not a server action) so Next.js does not
 * trigger a router refresh on call.
 */
export async function GET(req: NextRequest) {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ verified: false }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ verified: false }, { status: 400 });

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) return NextResponse.json({ verified: false });

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses?per_page=50`,
    { headers: { Authorization: `Bearer ${apiToken}` } },
  );
  if (!res.ok) return NextResponse.json({ verified: false });

  const data = await res.json() as { result?: { email: string; verified: string | null }[] };
  const addr = data.result?.find((a) => a.email === email);
  return NextResponse.json({ verified: !!addr?.verified });
}
