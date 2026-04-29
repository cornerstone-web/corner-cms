"use client";

import { useState, useEffect } from "react";
import { Control } from "react-hook-form";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { useConfig } from "@/contexts/config-context";
import { useUser } from "@/contexts/user-context";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { SiteConfigFormValues } from "../schema";

interface FeaturesSectionProps {
  control: Control<SiteConfigFormValues>;
  onSaveAndReload: () => Promise<void>;
}

interface BlockUsage {
  page: string;
  title: string;
  blockType: string;
}

const allFeatureLabels: Record<string, string> = {
  articles: "Articles",
  bulletins: "Bulletins",
  events: "Events",
  ministries: "Ministries",
  series: "Series",
  sermons: "Sermons",
  staff: "Staff",
};

const churchOnlyFeatures = new Set(["bulletins", "sermons", "series"]);

export function FeaturesSection({ control, onSaveAndReload }: FeaturesSectionProps) {
  const { config } = useConfig();
  const { user } = useUser();
  const isOrg = user?.siteAssignment?.siteType === "organization";
  const featureLabels = isOrg
    ? Object.fromEntries(Object.entries(allFeatureLabels).filter(([k]) => !churchOnlyFeatures.has(k)))
    : allFeatureLabels;
  const featureKeys = Object.keys(featureLabels) as Array<keyof typeof featureLabels>;

  const [usageData, setUsageData] = useState<Record<string, BlockUsage[]>>({});
  const [usageLoading, setUsageLoading] = useState(true);
  const [pendingToggle, setPendingToggle] = useState<{
    key: string;
    newValue: boolean;
    apply: () => void;
  } | null>(null);

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
    setPendingToggle({ key, newValue, apply: () => fieldOnChange(newValue) });
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

      <AlertDialog
        open={!!pendingToggle}
        onOpenChange={(open) => { if (!open) setPendingToggle(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggle?.newValue ? "Enable" : "Disable"}{" "}
              {pendingToggle ? featureLabels[pendingToggle.key] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will save your settings and reload the page for the change to
              take effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingToggle) {
                  pendingToggle.apply();
                  onSaveAndReload();
                }
              }}
            >
              Save & reload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
