"use client";

import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressFields {
  street: string;
  city: string;
  state: string;
  zip: string;
}

function parseUrlToAddress(url: string): AddressFields {
  try {
    const urlObj = new URL(url);
    const q = urlObj.searchParams.get("q");
    if (!q) return { street: "", city: "", state: "", zip: "" };

    const decoded = decodeURIComponent(q);
    const parts = decoded.split(", ");

    if (parts.length >= 4) {
      return {
        zip: parts[parts.length - 1],
        state: parts[parts.length - 2],
        city: parts[parts.length - 3],
        street: parts.slice(0, parts.length - 3).join(", "),
      };
    } else if (parts.length === 3) {
      return { street: parts[0], city: parts[1], state: parts[2], zip: "" };
    } else if (parts.length === 2) {
      return { street: parts[0], city: parts[1], state: "", zip: "" };
    } else {
      return { street: decoded, city: "", state: "", zip: "" };
    }
  } catch {
    return { street: "", city: "", state: "", zip: "" };
  }
}

function generateUrl(fields: AddressFields): string {
  const parts = [fields.street, fields.city, fields.state, fields.zip].filter(Boolean);
  if (parts.length === 0) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(parts.join(", "))}&output=embed`;
}

const EditComponent = forwardRef((props: any, _ref: any) => {
  const { value = "", onChange } = props;

  const [fields, setFields] = useState<AddressFields>(() => parseUrlToAddress(value));

  // Re-parse if value changes externally (e.g. form reset)
  useEffect(() => {
    setFields(parseUrlToAddress(value));
  }, [value]);

  const handleChange = (field: keyof AddressFields, fieldValue: string) => {
    const next = { ...fields, [field]: fieldValue };
    setFields(next);
    onChange?.(generateUrl(next));
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Street</Label>
        <Input
          value={fields.street}
          onChange={(e) => handleChange("street", e.target.value)}
          placeholder="123 Main St"
          className="text-base"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">City</Label>
          <Input
            value={fields.city}
            onChange={(e) => handleChange("city", e.target.value)}
            placeholder="Springfield"
            className="text-base"
          />
        </div>
        <div className="w-20">
          <Label className="text-xs text-muted-foreground mb-1 block">State</Label>
          <Input
            value={fields.state}
            onChange={(e) => handleChange("state", e.target.value)}
            placeholder="IL"
            className="text-base"
          />
        </div>
        <div className="w-24">
          <Label className="text-xs text-muted-foreground mb-1 block">Zip</Label>
          <Input
            value={fields.zip}
            onChange={(e) => handleChange("zip", e.target.value)}
            placeholder="62701"
            className="text-base"
          />
        </div>
      </div>
    </div>
  );
});

EditComponent.displayName = "MapAddressEditComponent";

export { EditComponent };
