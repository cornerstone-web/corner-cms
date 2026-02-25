"use client";

import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

const EditComponent = forwardRef((props: any, ref: any) => {
  const { value = "", onChange, ...rest } = props;

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#374151"}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-9 w-10 cursor-pointer rounded border border-input bg-transparent p-1"
      />
      <Input
        {...rest}
        ref={ref}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="#374151"
        className="font-mono text-base"
      />
    </div>
  );
});

export { EditComponent };
