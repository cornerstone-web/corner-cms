"use client";

import { Film } from "lucide-react";
import { getFileName } from "@/lib/utils/file";

const ViewComponent = ({ value }: { value: string | null }) => {
  if (!value) return null;
  const filename = getFileName(value);
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Film className="size-4 text-muted-foreground shrink-0" />
      <span className="truncate max-w-[160px]">{filename}</span>
    </div>
  );
};

export { ViewComponent };
