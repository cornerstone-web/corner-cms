"use client";

import { Control } from "react-hook-form";
import { HelpCircle } from "lucide-react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { SiteConfigFormValues } from "../schema";

interface IntegrationsSectionProps {
  control: Control<SiteConfigFormValues>;
}

export function IntegrationsSection({ control }: IntegrationsSectionProps) {
  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="integrations.youtubeApiKey"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-1.5">
              <FormLabel>YouTube API Key</FormLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p>
                    Used for YouTube Live stream detection in the Video Embed
                    block. To create one: Go to the{" "}
                    <strong>Google Cloud Console</strong> &rarr; Create or select
                    a project &rarr; Enable the{" "}
                    <strong>YouTube Data API v3</strong> &rarr; Go to{" "}
                    <strong>Credentials</strong> &rarr; Create an API key.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <FormControl>
              <Input
                type="text"
                placeholder="AIzaSy..."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
