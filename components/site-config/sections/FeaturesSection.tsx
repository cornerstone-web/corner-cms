"use client";

import { useState, useEffect } from "react";
import { Control, useWatch, useFormContext } from "react-hook-form";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { useConfig } from "@/contexts/config-context";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import type { SiteConfigFormValues } from "../schema";

interface FeaturesSectionProps {
  control: Control<SiteConfigFormValues>;
}

interface BlockUsage {
  page: string;
  title: string;
  blockType: string;
}

const featureLabels: Record<string, string> = {
  articles: "Articles",
  events: "Events",
  ministries: "Ministries",
  series: "Series",
  sermons: "Sermons",
  staff: "Staff",
};

const featureKeys = Object.keys(featureLabels) as Array<
  keyof typeof featureLabels
>;

export function FeaturesSection({ control }: FeaturesSectionProps) {
  const { config } = useConfig();
  const { setValue } = useFormContext<SiteConfigFormValues>();

  const [usageData, setUsageData] = useState<Record<string, BlockUsage[]>>({});
  const [usageLoading, setUsageLoading] = useState(true);

  // Watch all feature values so we can intercept toggles
  const featuresValues = useWatch({ control, name: "features" });

  // Fetch collection usage on mount
  useEffect(() => {
    if (!config) return;

    fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/site-config/collection-usage`
    )
      .then((r) => r.json())
      .then((result) => {
        if (result.status === "success") {
          setUsageData(result.data);
        }
      })
      .catch(() => {})
      .finally(() => setUsageLoading(false));
  }, [config]);

  /**
   * Intercept toggle changes: if turning OFF a collection that has usages,
   * revert to true and show a toast.
   */
  function handleToggle(
    key: string,
    newValue: boolean,
    fieldOnChange: (value: boolean) => void
  ) {
    if (!newValue && usageData[key]?.length > 0) {
      // Prevent disable — collection is in use
      const usages = usageData[key];
      const usageList = usages
        .map((u) => `${u.title} (${u.blockType})`)
        .join(", ");
      toast.error(
        `Cannot disable ${featureLabels[key]} — used by: ${usageList}`
      );
      return;
    }
    fieldOnChange(newValue);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium">Content Collections</h3>
        <p className="text-sm text-muted-foreground">
          Toggle which content collections are available in the CMS.
        </p>
      </div>

      {usageLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader className="h-4 w-4 animate-spin" />
          Checking collection usage...
        </div>
      )}

      <div className="space-y-2">
        {featureKeys.map((key) => (
          <FormField
            key={key}
            control={control}
            name={`features.${key}` as any}
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <FormLabel className="text-base">
                  {featureLabels[key]}
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value as boolean}
                    onCheckedChange={(val) =>
                      handleToggle(key, val, field.onChange)
                    }
                    disabled={usageLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        ))}
      </div>
    </div>
  );
}
