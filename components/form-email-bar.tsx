"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { useRepo } from "@/contexts/repo-context";

export function FormEmailBar() {
  const { config } = useConfig();
  const { owner, repo } = useRepo();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!config) return;

    const check = async () => {
      try {
        const res = await fetch(
          `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/site-config`
        );
        const result = await res.json();
        if (result.status !== "success") return;

        const formEmail = (result.data?.config?.contact as any)?.formEmail as string | undefined;
        if (!formEmail) {
          setShow(true);
          return;
        }

        const verifyRes = await fetch(
          `/api/setup/check-email-verification?email=${encodeURIComponent(formEmail)}`
        );
        const verifyData = await verifyRes.json();
        setShow(!verifyData.verified);
      } catch {
        // Don't show the bar if we can't check
      }
    };

    check();
  }, [config]);

  if (!show || !config) return null;

  const branch = encodeURIComponent(config.branch);

  return (
    <div className="border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 shrink-0">
      <div className="flex items-center gap-2 px-4 md:px-6 h-10 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-amber-800 dark:text-amber-200">
          No forms on this site will work until an email is verified in{" "}
          <Link
            href={`/${owner}/${repo}/${branch}/settings`}
            className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
          >
            Settings &rsaquo; Contact
          </Link>
        </span>
      </div>
    </div>
  );
}
