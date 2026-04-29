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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { SiteConfigFormValues } from "../schema";

interface IntegrationsSectionProps {
  control: Control<SiteConfigFormValues>;
}

function TooltipLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <FormLabel>{label}</FormLabel>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-sm">
          <p>{tip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function IntegrationsSection({ control }: IntegrationsSectionProps) {
  return (
    <div className="space-y-8">
      {/* YouTube */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">YouTube</h3>
        <FormField
          control={control}
          name="integrations.youtube.apiKey"
          render={({ field }) => (
            <FormItem>
              <TooltipLabel
                label="API Key"
                tip="Used for YouTube Live stream detection. Enable the YouTube Data API v3 in Google Cloud Console, then create an API key under Credentials."
              />
              <FormControl>
                <Input placeholder="AIzaSy..." {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="integrations.youtube.channelId"
          render={({ field }) => (
            <FormItem>
              <TooltipLabel
                label="Channel ID"
                tip="Your YouTube channel ID (starts with UC…). Used by the Video Embed block when showing a live stream. Find it in YouTube Studio → Settings → Channel → Advanced settings."
              />
              <FormControl>
                <Input placeholder="UCxxxxxxxxxxxxxxxxxxxxxxxx" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Giving */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Giving</h3>
        <FormField
          control={control}
          name="integrations.giving.url"
          render={({ field }) => (
            <FormItem>
              <TooltipLabel
                label="Giving URL"
                tip="Link to your online giving platform (e.g. Pushpay, Tithe.ly, Venmo). Used as the default URL in Giving blocks and the navigation CTA."
              />
              <FormControl>
                <Input placeholder="https://pushpay.com/g/yourchurch" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="integrations.giving.iframe"
          render={({ field }) => (
            <FormItem>
              <TooltipLabel
                label="Giving Embed Code"
                tip="Paste the full iframe embed code from your giving platform. Used as the default embed in Giving blocks when embed mode is selected."
              />
              <FormControl>
                <Textarea
                  placeholder={'<iframe src="https://..." />'}
                  rows={4}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
