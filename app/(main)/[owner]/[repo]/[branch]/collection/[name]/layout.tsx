import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { hasCollectionAccess } from "@/lib/utils/access-control";

export default async function CollectionLayout({
  children,
  params: paramsPromise,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string; branch: string; name: string }>;
}) {
  const params = await paramsPromise;
  const { user } = await getAuth();
  if (!user) return redirect("/auth/login");

  const name = decodeURIComponent(params.name);

  if (!hasCollectionAccess(user, name)) {
    redirect(`/${params.owner}/${params.repo}/${encodeURIComponent(params.branch)}`);
  }

  return <>{children}</>;
}
