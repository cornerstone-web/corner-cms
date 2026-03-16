import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";

import { generateListToken } from "@/lib/utils/r2-token";
import { handleRouteError } from "@/lib/utils/apiError";

/**
 * List R2 media files for a specific category.
 *
 * GET /api/[owner]/[repo]/[branch]/media/r2-list?category=video|audio
 *
 * Returns: { status: "success", data: [{ name, url, size, uploadedAt }] }
 */
export async function GET(
  request: Request,
  { params }: { params: { owner: string; repo: string; branch: string } }
) {
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const { owner, repo } = params;

    const ghToken = await getToken(user, owner, repo);
    if (!ghToken) throw new Error("Token not found");

    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    if (!category || !['video', 'audio'].includes(category)) {
      return Response.json(
        { status: 'error', message: 'Missing or invalid category' },
        { status: 400 }
      );
    }

    const secret = process.env.CORNER_MEDIA_SECRET;
    const cornerMediaUrl = process.env.CORNER_MEDIA_URL;
    const r2PublicUrl = process.env.R2_PUBLIC_URL;

    if (!secret || !cornerMediaUrl || !r2PublicUrl) {
      return Response.json(
        { status: 'error', message: 'Media not configured' },
        { status: 503 }
      );
    }

    const prefix = `${owner}/${repo}/${category}`;
    const { token, expiry } = await generateListToken(prefix, secret);

    const listUrl = `${cornerMediaUrl}/list?key=${encodeURIComponent(prefix)}&exp=${expiry}&token=${token}`;
    const res = await fetch(listUrl);

    if (!res.ok) {
      const err = await res.json() as { error?: string };
      return Response.json(
        { status: 'error', message: err.error ?? 'List failed' },
        { status: res.status }
      );
    }

    const { files } = await res.json() as {
      success: boolean;
      files: Array<{ key: string; name: string; publicUrl: string; size: number; uploadedAt: string | null }>;
    };

    // Construct URLs from R2_PUBLIC_URL (pages-cms env) + key — avoids any
    // protocol misconfiguration on the corner-media worker's PUBLIC_URL secret.
    const data = files.map((f) => ({
      name: f.name,
      url: `${r2PublicUrl}/${f.key}`,
      size: f.size,
      uploadedAt: f.uploadedAt,
    }));

    return Response.json({ status: 'success', data });
  } catch (error) {
    return handleRouteError(error);
  }
}
