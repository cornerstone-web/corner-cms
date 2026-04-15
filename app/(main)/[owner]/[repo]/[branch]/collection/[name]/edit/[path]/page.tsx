"use client";

import { useMemo, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useConfig } from "@/contexts/config-context";
import { useUser } from "@/contexts/user-context";
import { hasScope } from "@/lib/utils/access-control";
import { getSchemaByName } from "@/lib/schema";
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
  const { config } = useConfig();
  const { user } = useUser();
  const router = useRouter();

  const name = decodeURIComponent(params.name);
  const filePath = decodeURIComponent(params.path);
  const slug = filePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";

  const canAccess = !user || hasScope(user, `entry:${name}:${slug}`);

  useEffect(() => {
    if (user && !canAccess) {
      router.replace(
        `/${params.owner}/${params.repo}/${encodeURIComponent(params.branch)}/collection/${encodeURIComponent(name)}`
      );
    }
  }, [user, canAccess, router, params.owner, params.repo, params.branch, name]);

  if (!config) throw new Error(`Configuration not found.`);

  const schema = useMemo(() => getSchemaByName(config.object, name), [config, name]);
  if (!schema) throw new Error(`Schema not found for ${name}.`);

  if (!canAccess) return null;

  return (
    <EntryEditor name={name} path={filePath}/>
  );
}