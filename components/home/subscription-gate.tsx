"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Admin = { name: string; email: string };
type Variant = "payment-required" | "subscription-lapsed";

interface SubscriptionGateProps {
  siteId: string;
  siteName: string;
  admins: Admin[];
  variant: Variant;
  /** Whether the current viewer can initiate / manage billing directly. */
  canManageBilling: boolean;
}

const COPY: Record<Variant, { badge: string; heading: string; body: string; cta: string; endpoint: string }> = {
  "payment-required": {
    badge: "Payment required",
    heading: "Activate your subscription",
    body: "To access your site setup, please complete your annual subscription payment.",
    cta: "Pay now",
    endpoint: "/api/billing/create-checkout-session",
  },
  "subscription-lapsed": {
    badge: "Subscription paused",
    heading: "Renew your subscription",
    body: "Your annual subscription has lapsed. Update your billing to restore site access.",
    cta: "Manage billing",
    endpoint: "/api/billing/create-portal-session",
  },
};

export function SubscriptionGate({
  siteId,
  siteName,
  admins,
  variant,
  canManageBilling,
}: SubscriptionGateProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[variant];

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(copy.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8 text-center space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{siteName}</p>
          <Badge variant={variant === "subscription-lapsed" ? "destructive" : "secondary"}>
            {copy.badge}
          </Badge>
        </div>
        <div className="flex justify-center">
          <CreditCard className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{copy.heading}</h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>
        {canManageBilling ? (
          <div className="space-y-2">
            <Button onClick={handleClick} disabled={submitting} className="w-full">
              {submitting ? "Redirecting…" : copy.cta}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : admins.length > 0 ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
            {admins.length === 1 ? (
              <p>
                Contact your admin:{" "}
                <a
                  href={`mailto:${admins[0].email}`}
                  className="font-medium underline underline-offset-2"
                >
                  {admins[0].name}
                </a>{" "}
                <span className="text-muted-foreground">· {admins[0].email}</span>
              </p>
            ) : (
              <>
                <p className="font-medium">Contact one of your admins:</p>
                <ul className="space-y-1">
                  {admins.map((admin) => (
                    <li key={admin.email}>
                      <a
                        href={`mailto:${admin.email}`}
                        className="underline underline-offset-2 text-muted-foreground hover:text-foreground"
                      >
                        {admin.name}
                      </a>
                      <span className="text-muted-foreground"> · {admin.email}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
