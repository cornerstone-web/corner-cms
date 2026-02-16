"use client";

import { Control } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { SiteConfigFormValues } from "../schema";

interface ExternalLinksSectionProps {
  control: Control<SiteConfigFormValues>;
}

const LINK_FIELDS = [
  { name: "give" as const, label: "Give / Donate", placeholder: "https://pushpay.com/g/..." },
  { name: "youtube" as const, label: "YouTube", placeholder: "https://youtube.com/@..." },
  { name: "podcast" as const, label: "Podcast", placeholder: "https://podcasts.apple.com/..." },
  { name: "instagram" as const, label: "Instagram", placeholder: "https://instagram.com/..." },
  { name: "facebook" as const, label: "Facebook", placeholder: "https://facebook.com/..." },
];

export function ExternalLinksSection({ control }: ExternalLinksSectionProps) {
  return (
    <div className="space-y-4">
      {LINK_FIELDS.map(({ name, label, placeholder }) => (
        <FormField
          key={name}
          control={control}
          name={`external.${name}`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <Input type="url" placeholder={placeholder} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}
