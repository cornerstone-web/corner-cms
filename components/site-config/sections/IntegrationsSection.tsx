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
                <TooltipContent side="right" className="max-w-sm">
                  <p>
                    Used for YouTube Live stream detection. To create a key, follow{" "}
                    <a
                      href="https://support.google.com/googleapi/answer/6158862"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      Google&apos;s API key guide
                    </a>
                    : Enable the YouTube Data API v3 in Google Cloud Console,
                    then create an API key under Credentials.
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
