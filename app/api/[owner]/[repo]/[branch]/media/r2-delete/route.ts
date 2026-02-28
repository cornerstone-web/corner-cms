import { getAuth } from "@/lib/auth";
import { generateDeleteToken } from "@/lib/utils/r2-token";

/**
 * Delete a file from R2 via corner-media.
 *
 * POST /api/[owner]/[repo]/[branch]/media/r2-delete
 *
 * Body: { url: string }  — the full R2 public URL to delete
 * Returns: { status: "success" | "error", message?: string }
 *
 * Requires authentication.
 */
export async function POST(
  request: Request,
  { params }: { params: { owner: string; repo: string; branch: string } }
) {
  try {
    const { session } = await getAuth();
    if (!session) return new Response(null, { status: 401 });

    const body = await request.json() as { url?: string };
    const url = body?.url;
    if (!url || typeof url !== 'string') {
      return Response.json({ status: 'error', message: 'Missing url' }, { status: 400 });
    }

    const secret = process.env.CORNER_MEDIA_SECRET;
    const cornerMediaUrl = process.env.CORNER_MEDIA_URL;
    const r2PublicUrl = process.env.R2_PUBLIC_URL;

    if (!secret || !cornerMediaUrl || !r2PublicUrl) {
      return Response.json({ status: 'error', message: 'Media not configured' }, { status: 503 });
    }

    // Extract the r2Key by stripping the public URL base
    const base = r2PublicUrl.endsWith('/') ? r2PublicUrl : r2PublicUrl + '/';
    if (!url.startsWith(base)) {
      return Response.json({ status: 'error', message: 'URL does not belong to this R2 bucket' }, { status: 400 });
    }
    const r2Key = url.slice(base.length);

    const { token, expiry } = await generateDeleteToken(r2Key, secret);
    const deleteUrl = `${cornerMediaUrl}/file?key=${encodeURIComponent(r2Key)}&exp=${expiry}&token=${token}`;

    const res = await fetch(deleteUrl, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? `corner-media responded ${res.status}`);
    }

    return Response.json({ status: 'success', message: `Deleted ${r2Key}` });
  } catch (error: any) {
    console.error(error);
    return Response.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
