"use client";

import { forwardRef, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

const EditComponent = forwardRef((props: any, _ref: any) => {
  const { value, onChange } = props;
  const params = useParams();

  const owner = params?.owner as string | undefined;
  const repo = params?.repo as string | undefined;
  const branch = params?.branch as string | undefined;

  const [titles, setTitles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!owner || !repo || !branch) return;
    setIsLoading(true);
    fetch(`/api/${owner}/${repo}/${encodeURIComponent(branch as string)}/series-options`)
      .then((r) => r.json())
      .then((json) => {
        if (json.status === "success") setTitles(json.data?.titles ?? []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [owner, repo, branch]);

  const selectValue = value || NONE;

  return (
    <div className="space-y-1.5">
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === NONE ? "" : v)}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Loading series..." : "No series"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No series</SelectItem>
          {titles.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        New series must be created in the Series collection before they appear here.
      </p>
    </div>
  );
});

EditComponent.displayName = "SeriesSelectEditComponent";

export { EditComponent };
