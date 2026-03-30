"use client";

import { useState, useEffect } from "react";
import { useConfig } from "@/contexts/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, Copy, Check, AlertCircle, Loader2 } from "lucide-react";

interface DomainData {
  customDomain: string | null;
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

export function DomainSettings() {
  const { config } = useConfig();
  const owner = config?.owner;
  const repo = config?.repo;
  const branch = config?.branch;

  const [loadingData, setLoadingData] = useState(true);
  const [data, setData] = useState<DomainData>({
    customDomain: null,
    cfPagesProjectName: null,
    rootStatus: null,
    wwwStatus: null,
  });

  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner || !repo || !branch) return;
    fetch(`/api/${owner}/${repo}/${encodeURIComponent(branch)}/custom-domain`)
      .then(r => r.json())
      .then((d: DomainData) => {
        setData(d);
        setDomain(d.customDomain ?? "");
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setLoadingData(false));
  }, [owner, repo, branch]);

  const { customDomain: savedDomain, cfPagesProjectName } = data;
  const pagesDomain = cfPagesProjectName ? `${cfPagesProjectName}.pages.dev` : null;

  const normalizedInput = domain.trim().replace(/^www\./i, "").toLowerCase();
  const isDirty = normalizedInput !== (savedDomain ?? "");
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
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save domain.");
        return;
      }
      setData(prev => ({
        ...prev,
        customDomain: json.customDomain,
        rootStatus: "pending",
        wwwStatus: "pending",
      }));
      setDomain(json.customDomain);
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
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Failed to remove domain.");
        return;
      }
      setData(prev => ({ ...prev, customDomain: null, rootStatus: null, wwwStatus: null }));
      setDomain("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
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
          <StatusBadge status={data.rootStatus} />
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

          <div className="space-y-3">
            {[
              { name: "@", label: "(root)" },
              { name: "www", label: null },
            ].map(({ name, label }) => (
              <div key={name} className="rounded-md border bg-muted/30 px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">CNAME</span>
                  <span>·</span>
                  <span className="font-mono font-medium text-foreground">{name}</span>
                  {label && <span>{label}</span>}
                </div>
                <div className="flex items-center gap-1 font-mono text-sm break-all">
                  {pagesDomain}
                  <CopyButton value={pagesDomain} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Once added, DNS changes can take up to 48 hours to propagate. Your domain status will
              update to <span className="font-medium text-green-700">Active</span> automatically
              once Cloudflare verifies the records.
            </p>
            {data.rootStatus !== "active" && (
              <p className="flex items-start gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                If your DNS provider doesn&apos;t support CNAME flattening for root domains, use an{" "}
                <span className="font-mono font-medium text-foreground">ALIAS</span> or{" "}
                <span className="font-mono font-medium text-foreground">ANAME</span> record type for
                the root entry.
              </p>
            )}
          </div>

          <div className="rounded-md bg-muted px-4 py-3 text-sm space-y-2">
            <p className="font-medium">Status</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground break-all">{savedDomain}</span>
              <StatusBadge status={data.rootStatus} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground break-all">www.{savedDomain}</span>
              <StatusBadge status={data.wwwStatus} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
