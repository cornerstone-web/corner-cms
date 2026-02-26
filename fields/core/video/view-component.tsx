"use client";

import { Film } from "lucide-react";

const ViewComponent = ({ value }: { value: string | null }) => {
  if (!value) return <span className="text-muted-foreground text-sm">—</span>;
  const filename = value.split("/").pop() ?? value;
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Film className="size-4 text-muted-foreground shrink-0" />
      <span className="truncate max-w-[160px]">{filename}</span>
    </div>
  );
};

export { ViewComponent };
