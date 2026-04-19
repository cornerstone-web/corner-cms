"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader, Save } from "lucide-react";
import { toast } from "sonner";
import { useConfig } from "@/contexts/config-context";
import { useUser } from "@/contexts/user-context";
import { hasScope } from "@/lib/utils/access-control";
import { useSiteFeaturesContext } from "@/contexts/site-features-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Form } from "@/components/ui/form";
import {
  IFrameWrapper,
  PreviewToolbar,
  ExpandedPreviewModal,
} from "@/components/entry/preview/shared";
import { siteConfigSchema, type SiteConfigFormValues } from "./schema";
import { IdentitySection } from "./sections/IdentitySection";
import { BrandingSection } from "./sections/BrandingSection";
import { ContactSection } from "./sections/ContactSection";
import { ServiceTimesSection } from "./sections/ServiceTimesSection";
import { ThemeSection } from "./sections/ThemeSection";
import { NavigationSection } from "./sections/NavigationSection";
import { FooterSection } from "./sections/FooterSection";
import { IntegrationsSection } from "./sections/IntegrationsSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { DomainSettings } from "@/components/settings/DomainSettings";

const FIELD_TO_TAB: Record<string, string> = {
  name:         "identity",
  description:  "identity",
  theme:        "theme",
  customTheme:  "theme",
  fonts:        "theme",
  navigation:   "navigation",
  footer:       "footer",
  contact:      "contact",
  serviceTimes: "service-times",
  integrations: "integrations",
  features:     "features",
};

const TAB_LABELS: Record<string, string> = {
  identity:        "Identity",
  theme:           "Theme",
  navigation:      "Navigation",
  footer:          "Footer",
  contact:         "Contact",
  "service-times": "Service Times",
  integrations:    "Integrations",
  features:        "Features",
};

// Maps each tab value to the site-config scope(s) that unlock it.
// The identity tab merges identity + branding — visible if either scope is present.
const TAB_SCOPES: Record<string, string[]> = {
  identity:       ["site-config:identity", "site-config:branding"],
  contact:        ["site-config:contact"],
  "service-times":["site-config:service-times"],
  theme:          ["site-config:theme"],
  navigation:     ["site-config:navigation"],
  footer:         ["site-config:footer"],
  integrations:   ["site-config:integrations"],
  features:       ["site-config:features"],
};

export function SiteConfigEditor() {
  const { config } = useConfig();
  const { user } = useUser();
  const { previewUrl } = useSiteFeaturesContext();
  const allowedTabs: string[] = !user
    ? [...Object.keys(TAB_SCOPES), "domain"]
    : [
        ...Object.keys(TAB_SCOPES).filter(tab =>
          TAB_SCOPES[tab].some(scope => hasScope(user, scope))
        ),
        ...(hasScope(user, "site-config:domain") ? ["domain"] : []),
      ];
  const defaultTab = allowedTabs[0] ?? "identity";

  function canSeeTab(tab: string) {
    return allowedTabs.includes(tab);
  }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sha, setSha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialFormEmail, setInitialFormEmail] = useState<string>("");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const previewOrigin = previewUrl ? new URL(previewUrl).origin : null;

  const form = useForm<SiteConfigFormValues>({
    resolver: zodResolver(siteConfigSchema),
    defaultValues: {},
    reValidateMode: "onSubmit",
  });

  const fetchConfig = useCallback(async () => {
    if (!config) return;
    try {
      const response = await fetch(
        `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/site-config`
      );
      const result = await response.json();
      if (result.status === "error") throw new Error(result.message);

      setSha(result.data.sha);
      // Extract formEmail before Zod strips it (it's not in siteConfigSchema)
      const rawFormEmail = (result.data.config?.contact as any)?.formEmail as string | undefined;
      setInitialFormEmail(rawFormEmail ?? "");
      form.reset(result.data.config);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [config, form]);

  // Fetch site config on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Watch all form values for live preview updates
  const watchedValues = useWatch({ control: form.control });

  // Debounced postMessage to preview iframe
  const lastSentRef = useRef<string>("");
  useEffect(() => {
    if (!isLoaded || !iframeRef.current?.contentWindow) return;

    const serialized = JSON.stringify(watchedValues);
    if (serialized === lastSentRef.current) return;
    lastSentRef.current = serialized;

    iframeRef.current.contentWindow.postMessage(
      { type: "UPDATE_SITE_CONFIG", config: watchedValues },
      previewOrigin!
    );
  }, [watchedValues, isLoaded, previewOrigin]);

  const handleSave = useCallback(async (values: SiteConfigFormValues): Promise<boolean> => {
    if (!config || !sha) return false;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/site-config`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: values, sha }),
        }
      );

      const result = await response.json();
      if (result.status === "error") throw new Error(result.message);

      setSha(result.data.sha);
      form.reset(values);
      toast.success("Site config saved successfully.");
      window.dispatchEvent(new CustomEvent("cornerstone:filesaved"));
      return true;
    } catch (err: any) {
      toast.error(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [config, sha, form]);

  const saveAndReload = useCallback(async () => {
    const success = await handleSave(form.getValues());
    if (success) window.location.reload();
  }, [form, handleSave]);

  const handleValidationError = useCallback((errors: Record<string, any>) => {
    const tabs = [...new Set(
      Object.keys(errors).map(k => FIELD_TO_TAB[k]).filter(Boolean)
    )];
    const labels = tabs.map(t => TAB_LABELS[t] ?? t).join(", ");
    toast.error(`Fix validation errors on: ${labels || "the form"}`);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    lastSentRef.current = "";
    setTimeout(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: "UPDATE_SITE_CONFIG", config: form.getValues() },
          previewOrigin!
        );
      }
    }, 300);
  }, [form, previewOrigin]);

  useEffect(() => {
    setIsLoaded(false);
  }, [isExpanded]);

  const handleReload = useCallback(() => {
    setIsLoaded(false);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleOpenNewTab = useCallback(() => {
    if (previewUrl) window.open(`${previewUrl}/preview/site-config`, "_blank");
  }, [previewUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const iframeUrl = previewUrl ? `${previewUrl}/preview/site-config` : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">Settings</h1>
        <div className="flex items-center gap-2">
          {iframeUrl && (
            <PreviewToolbar
              onReload={handleReload}
              onOpenNewTab={handleOpenNewTab}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
              isExpanded={isExpanded}
              isLoaded={isLoaded}
            />
          )}
          <Button
            onClick={form.handleSubmit(handleSave, handleValidationError)}
            disabled={saving || !form.formState.isDirty}
            size="sm"
          >
            {saving ? (
              <Loader className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Content: Form + Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Form panel */}
        <div className="w-full lg:w-1/2 overflow-y-auto p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave, handleValidationError)} className="space-y-6">
              <Tabs defaultValue={defaultTab}>
                <TabsList className="w-full flex flex-wrap h-auto gap-1">
                  {canSeeTab("identity")      && <TabsTrigger value="identity">Identity</TabsTrigger>}
                  {canSeeTab("contact")       && <TabsTrigger value="contact">Contact</TabsTrigger>}
                  {canSeeTab("service-times") && <TabsTrigger value="service-times">Service Times</TabsTrigger>}
                  {canSeeTab("theme")         && <TabsTrigger value="theme">Theme</TabsTrigger>}
                  {canSeeTab("navigation")    && <TabsTrigger value="navigation">Navigation</TabsTrigger>}
                  {canSeeTab("footer")        && <TabsTrigger value="footer">Footer</TabsTrigger>}
                  {canSeeTab("integrations")  && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
                  {canSeeTab("features")      && <TabsTrigger value="features">Features</TabsTrigger>}
                  {canSeeTab("domain")        && <TabsTrigger value="domain">Domain</TabsTrigger>}
                </TabsList>

                {canSeeTab("identity") && (
                  <TabsContent value="identity" className="mt-6">
                    <div className="space-y-8">
                      <IdentitySection control={form.control} />
                      <div>
                        <h3 className="text-sm font-medium mb-4">Branding</h3>
                        <BrandingSection />
                      </div>
                    </div>
                  </TabsContent>
                )}
                {canSeeTab("contact") && (
                  <TabsContent value="contact" className="mt-6">
                    <ContactSection
                      control={form.control}
                      initialFormEmail={initialFormEmail}
                      onFormEmailMutated={fetchConfig}
                      repoSlug={config?.repo}
                    />
                  </TabsContent>
                )}
                {canSeeTab("service-times") && (
                  <TabsContent value="service-times" className="mt-6">
                    <ServiceTimesSection control={form.control} />
                  </TabsContent>
                )}
                {canSeeTab("theme") && (
                  <TabsContent value="theme" className="mt-6">
                    <ThemeSection control={form.control} />
                  </TabsContent>
                )}
                {canSeeTab("navigation") && (
                  <TabsContent value="navigation" className="mt-6">
                    <NavigationSection control={form.control} />
                  </TabsContent>
                )}
                {canSeeTab("footer") && (
                  <TabsContent value="footer" className="mt-6">
                    <FooterSection control={form.control} />
                  </TabsContent>
                )}
                {canSeeTab("integrations") && (
                  <TabsContent value="integrations" className="mt-6">
                    <IntegrationsSection control={form.control} />
                  </TabsContent>
                )}
                {canSeeTab("features") && (
                  <TabsContent value="features" className="mt-6">
                    <FeaturesSection control={form.control} onSaveAndReload={saveAndReload} />
                  </TabsContent>
                )}
                {canSeeTab("domain") && (
                  <TabsContent value="domain" className="mt-6">
                    <DomainSettings />
                  </TabsContent>
                )}
              </Tabs>
            </form>
          </Form>
        </div>

        {/* Preview panel */}
        {iframeUrl && (
          <div className="hidden lg:flex flex-col w-1/2 border-l bg-muted/30">
            <div className="flex-1 p-4">
              <div className="h-full rounded-lg overflow-hidden border bg-white">
                {isExpanded ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Preview is expanded
                  </div>
                ) : (
                  <IFrameWrapper
                    url={iframeUrl}
                    title="Site Config Preview"
                    onLoad={handleLoad}
                    isLoaded={isLoaded}
                    iframeRef={iframeRef}
                    refreshKey={refreshKey}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expanded preview modal */}
      {isExpanded && (
        <ExpandedPreviewModal
          headerContent={
            <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
              <span className="text-sm font-medium">Site Config Preview</span>
              <PreviewToolbar
                onReload={handleReload}
                onOpenNewTab={handleOpenNewTab}
                onToggleExpand={() => setIsExpanded(false)}
                isExpanded={true}
                isLoaded={isLoaded}
              />
            </div>
          }
          iframeContent={
            iframeUrl ? (
              <IFrameWrapper
                url={iframeUrl}
                title="Site Config Preview"
                onLoad={handleLoad}
                isLoaded={isLoaded}
                iframeRef={iframeRef}
                refreshKey={refreshKey}
              />
            ) : null
          }
          onClose={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}
