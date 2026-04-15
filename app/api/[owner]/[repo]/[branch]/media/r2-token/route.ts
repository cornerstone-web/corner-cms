import { randomUUID } from 'crypto';
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";

import { generateUploadToken } from "@/lib/utils/r2-token";
import { handleRouteError } from "@/lib/utils/apiError";
import { isAdminUser } from "@/lib/utils/access-control";

/**
 * Generate a short-lived HMAC upload token for corner-media.
 *
 * POST /api/[owner]/[repo]/[branch]/media/r2-token
 *
 * Body: { filename: string; category: "video" | "audio" }
 * Returns: { uploadUrl: string, publicUrl: string }
 *
 * Requires authentication.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const { owner, repo } = params;

    const ghToken = await getToken(user, owner, repo);
    if (!ghToken) throw new Error("Token not found");


    const body = await request.json() as { filename?: string; category?: string };
    const filename = body?.filename;
    const category = body?.category;

    if (!filename || typeof filename !== 'string') {
      return Response.json({ status: 'error', message: 'Missing filename' }, { status: 400 });
    }
    if (!category || !['video', 'audio'].includes(category)) {
      return Response.json({ status: 'error', message: 'Missing or invalid category (must be "video" or "audio")' }, { status: 400 });
    }

    if (!isAdminUser(user) && !(user.churchAssignment?.scopes ?? []).includes(`media:${category}`)) {
      return new Response(null, { status: 403 });
    }

    // Sanitize filename — no path traversal, no special characters
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uuid = randomUUID();
    const r2Key = `${owner}/${repo}/${category}/${uuid}-${safeName}`;

    const secret = process.env.CORNER_MEDIA_SECRET;
    const cornerMediaUrl = process.env.CORNER_MEDIA_URL;
    const r2PublicUrl = process.env.R2_PUBLIC_URL;

    if (!secret || !cornerMediaUrl || !r2PublicUrl) {
      return Response.json({ status: 'error', message: 'Media upload not configured' }, { status: 503 });
    }

    const { token, expiry } = await generateUploadToken(r2Key, secret);

    const uploadUrl = `${cornerMediaUrl}/upload?key=${encodeURIComponent(r2Key)}&exp=${expiry}&token=${token}`;
    const publicUrl = `${r2PublicUrl}/${r2Key}`;

    return Response.json({ uploadUrl, publicUrl });
  } catch (error) {
    return handleRouteError(error);
  }
}
