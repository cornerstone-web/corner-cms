"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import { hasScope } from "@/lib/utils/access-control";
import { EntryEditor } from "@/components/entry/entry-editor";

export default function Page(
  props: {
    params: Promise<{
      owner: string;
      repo: string;
      branch: string;
      name: string;
      path: string;
    }>
  }
) {
  const params = use(props.params);
  const searchParams = useSearchParams();
  const { user } = useUser();
  const router = useRouter();

  const name = decodeURIComponent(params.name);
  const parent = searchParams.get("parent") || undefined;

  // Creating entries requires full collection access, not just entry-level
  const canCreate = !user || hasScope(user, `collection:${name}`);

  useEffect(() => {
    if (user && !canCreate) {
      router.replace(
        `/${params.owner}/${params.repo}/${encodeURIComponent(params.branch)}/collection/${encodeURIComponent(name)}`
      );
    }
  }, [user, canCreate, router, params.owner, params.repo, params.branch, name]);

  if (!canCreate) return null;

  return (
    <EntryEditor name={name} title="Create a new entry" parent={parent}/>
  );
}