import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { handleRouteError } from "@/lib/utils/apiError";
import { getSeriesTitles } from "@/lib/utils/series";

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    const titles = await getSeriesTitles(params.owner, params.repo, params.branch, token);
    return Response.json({ status: "success", data: { titles } });
  } catch (error) {
    return handleRouteError(error);
  }
}
