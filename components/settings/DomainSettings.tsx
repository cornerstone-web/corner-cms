"use client";

import { useState } from "react";
import { useConfig } from "@/contexts/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, Copy, Check, AlertCircle, Loader2 } from "lucide-react";

interface DomainSettingsProps {
  initialDomain: string | null;
  cfPagesProjectName: string | null;
  rootStatus: string | null;
  wwwStatus: string | null;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "active") {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
  }
  return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-1.5 text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function DomainSettings({
  initialDomain,
  cfPagesProjectName,
  rootStatus: initialRootStatus,
  wwwStatus: initialWwwStatus,
}: DomainSettingsProps) {
  const { config } = useConfig();
  const owner = config?.owner;
  const repo = config?.repo;
  const branch = config?.branch;

  const [domain, setDomain] = useState(initialDomain ?? "");
  const [savedDomain, setSavedDomain] = useState(initialDomain);
  const [rootStatus, setRootStatus] = useState(initialRootStatus);
  const [wwwStatus, setWwwStatus] = useState(initialWwwStatus);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pagesDomain = cfPagesProjectName ? `${cfPagesProjectName}.pages.dev` : null;

  const isDirty = domain.trim().replace(/^www\./i, "").toLowerCase() !== (savedDomain ?? "");
  const showInstructions = savedDomain && pagesDomain;

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/${owner}/${repo}/${encodeURIComponent(branch!)}/custom-domain`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save domain.");
        return;
      }
      setSavedDomain(data.customDomain);
      setDomain(data.customDomain);
      setRootStatus("pending");
      setWwwStatus("pending");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/${owner}/${repo}/${encodeURIComponent(branch!)}/custom-domain`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to remove domain.");
        return;
      }
      setSavedDomain(null);
      setDomain("");
      setRootStatus(null);
      setWwwStatus(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8 p-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Custom Domain
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Serve your site from your own domain instead of the default{" "}
          {pagesDomain ? (
            <span className="font-mono">{pagesDomain}</span>
          ) : (
            "pages.dev URL"
          )}
          .
        </p>
      </div>

      {/* Current status */}
      {savedDomain && (
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3 bg-muted/40">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-mono text-sm font-medium">{savedDomain}</span>
          <StatusBadge status={rootStatus} />
        </div>
      )}

      {/* Input */}
      <div className="space-y-3">
        <label className="text-sm font-medium" htmlFor="custom-domain-input">
          Domain
        </label>
        <div className="flex gap-2">
          <Input
            id="custom-domain-input"
            type="text"
            placeholder="mychurch.org"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            className="font-mono"
          />
          <Button
            onClick={handleSave}
            disabled={saving || !domain.trim() || !isDirty}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
          {savedDomain && (
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Enter your root domain only (e.g. <span className="font-mono">mychurch.org</span>). Both{" "}
          <span className="font-mono">mychurch.org</span> and{" "}
          <span className="font-mono">www.mychurch.org</span> will be configured automatically.
        </p>
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {/* DNS Instructions */}
      {showInstructions && (
        <div className="rounded-lg border space-y-4 p-5">
          <div>
            <h3 className="font-semibold text-sm">Configure your DNS</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add these records at your DNS provider (GoDaddy, Namecheap, Cloudflare, Squarespace, etc.):
            </p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-2 font-medium pr-4">Type</th>
                <th className="pb-2 font-medium pr-4">Name</th>
                <th className="pb-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b">
                <td className="py-2.5 pr-4 text-muted-foreground font-sans">CNAME</td>
                <td className="py-2.5 pr-4">
                  <span className="flex items-center">
                    @ <span className="font-sans text-xs text-muted-foreground ml-1">(root)</span>
                  </span>
                </td>
                <td className="py-2.5">
                  <span className="flex items-center">
                    {pagesDomain}
                    <CopyButton value={pagesDomain} />
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-muted-foreground font-sans">CNAME</td>
                <td className="py-2.5 pr-4">www</td>
                <td className="py-2.5">
                  <span className="flex items-center">
                    {pagesDomain}
                    <CopyButton value={pagesDomain} />
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Once added, DNS changes can take up to 48 hours to propagate. Your domain status will
              update to <span className="font-medium text-green-700">Active</span> automatically
              once Cloudflare verifies the records.
            </p>
            {rootStatus !== "active" && (
              <p className="flex items-start gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                If your DNS provider doesn&apos;t support CNAME flattening for root domains, use an{" "}
                <span className="font-mono font-medium text-foreground">ALIAS</span> or{" "}
                <span className="font-mono font-medium text-foreground">ANAME</span> record type for
                the root entry.
              </p>
            )}
          </div>

          <div className="rounded-md bg-muted px-4 py-3 text-sm">
            <p className="font-medium mb-0.5">Status</p>
            <div className="flex gap-6 mt-1">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-mono">{savedDomain}</span>
                <StatusBadge status={rootStatus} />
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-mono">www.{savedDomain}</span>
                <StatusBadge status={wwwStatus} />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
