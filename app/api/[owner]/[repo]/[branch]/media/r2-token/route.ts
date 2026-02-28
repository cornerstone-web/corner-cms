import { randomUUID } from 'crypto';
import { getAuth } from "@/lib/auth";
import { generateUploadToken } from "@/lib/utils/r2-token";

/**
 * Generate a short-lived HMAC upload token for corner-media.
 *
 * POST /api/[owner]/[repo]/[branch]/media/r2-token
 *
 * Body: { filename: string }
 * Returns: { uploadUrl: string, publicUrl: string }
 *
 * Requires authentication.
 */
export async function POST(
  request: Request,
  { params }: { params: { owner: string; repo: string; branch: string } }
) {
  try {
    const { user, session } = await getAuth();
    if (!session) return new Response(null, { status: 401 });

    const { owner, repo } = params;

    const body = await request.json() as { filename?: string };
    const filename = body?.filename;
    if (!filename || typeof filename !== 'string') {
      return Response.json({ status: 'error', message: 'Missing filename' }, { status: 400 });
    }

    // Sanitize filename — no path traversal, no special characters
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uuid = randomUUID();
    const r2Key = `${owner}/${repo}/${uuid}-${safeName}`;

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
  } catch (error: any) {
    console.error(error);
    return Response.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
