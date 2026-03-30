"use client";

import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

function parseUrlToAddress(url: string): string {
  try {
    const urlObj = new URL(url);

    // Our generated format: ?q=...&output=embed
    const q = urlObj.searchParams.get("q");
    if (q) return decodeURIComponent(q);

    // Google Maps native embed format: ?pb=...
    const pb = urlObj.searchParams.get("pb");
    if (pb) {
      for (const part of pb.split("!")) {
        if (part.startsWith("2s")) {
          const decoded = decodeURIComponent(part.slice(2));
          // Skip hex place IDs (e.g. 0x8644ca99...)
          if (!decoded.startsWith("0x")) return decoded;
        }
      }
    }

    return "";
  } catch {
    return "";
  }
}

function generateUrl(address: string): string {
  if (!address.trim()) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed`;
}

const EditComponent = forwardRef((props: any, ref: any) => {
  const { value = "", onChange, ...rest } = props;

  const [address, setAddress] = useState(() => parseUrlToAddress(value));

  useEffect(() => {
    setAddress(parseUrlToAddress(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setAddress(next);
    onChange?.(generateUrl(next));
  };

  return (
    <Input
      {...rest}
      ref={ref}
      value={address}
      onChange={handleChange}
      placeholder="123 Main St, Springfield, IL 62701"
      className="text-base"
    />
  );
});

EditComponent.displayName = "MapAddressEditComponent";

export { EditComponent };
