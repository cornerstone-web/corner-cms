"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import { hasSiteConfigAccess } from "@/lib/utils/access-control";
import { SiteConfigEditor } from "@/components/site-config/SiteConfigEditor";

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams<{ owner: string; repo: string; branch: string }>();

  const canAccess = !user || hasSiteConfigAccess(user);

  useEffect(() => {
    if (user && !canAccess) {
      router.replace(`/${params.owner}/${params.repo}/${encodeURIComponent(params.branch)}`);
    }
  }, [user, canAccess, router, params.owner, params.repo, params.branch]);

  if (!canAccess) return null;

  return <SiteConfigEditor />;
}
