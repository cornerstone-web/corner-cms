"use client";

import { useEffect, useRef, useState } from "react";
import { initiateFormEmail, checkFormEmail, removeFormEmail, confirmFormEmail } from "@/lib/actions/form-email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormEmailWidgetProps {
  initialFormEmail?: string;
  onMutated: () => void;
  repoSlug?: string;
}

type Status = "idle" | "checking" | "sending" | "waiting" | "verified" | "removing" | "error";

export function FormEmailWidget({ initialFormEmail, onMutated, repoSlug }: FormEmailWidgetProps) {
  const [email, setEmail] = useState(initialFormEmail ?? "");
  const [status, setStatus] = useState<Status>(initialFormEmail ? "checking" : "idle");
  const [verifiedEmail, setVerifiedEmail] = useState<string | undefined>(
    initialFormEmail || undefined
  );
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount, if an email is pre-populated, check if it's already verified.
  // Uses a fetch route (not a server action) to avoid Next.js router refresh.
  useEffect(() => {
    if (!initialFormEmail) return;
    fetch(`/api/setup/check-email-verification?email=${encodeURIComponent(initialFormEmail)}`)
      .then((r) => r.json())
      .then((data: { verified: boolean }) => {
        if (data.verified) {
          setStatus("verified");
        } else {
          // Not yet verified — resume polling
          setStatus("waiting");
          startPolling(initialFormEmail);
        }
      })
      .catch(() => setStatus("idle"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleSend() {
    if (!email.trim()) {
      setErrorMsg("Please enter an email address.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setErrorMsg(undefined);
    const res = await initiateFormEmail(email.trim(), repoSlug);
    if (!res.ok) {
      setStatus("error");
      setErrorMsg(res.error ?? "Something went wrong.");
      return;
    }
    setVerifiedEmail(res.email);
    if (res.alreadyVerified) {
      await confirmFormEmail(email.trim(), repoSlug);
      onMutated();
      setStatus("verified");
      return;
    }
    onMutated();
    setStatus("waiting");
    startPolling(email.trim());
  }

  function startPolling(target: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const check = await checkFormEmail(target, repoSlug);
      if (check.verified) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        await confirmFormEmail(target, repoSlug);
        setStatus("verified");
      }
    }, 5000);
  }

  async function handleRemove() {
    if (!verifiedEmail) return;
    setStatus("removing");
    const res = await removeFormEmail(verifiedEmail, repoSlug);
    if (!res.ok) {
      setStatus("verified");
      setErrorMsg(res.error ?? "Failed to remove email.");
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setVerifiedEmail(undefined);
    setEmail("");
    setErrorMsg(undefined);
    setStatus("idle");
    onMutated();
  }

  const locked = ["checking", "sending", "waiting", "verified", "removing"].includes(status);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="form-recipient-email">Recipient email</Label>
        <Input
          id="form-recipient-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hello@yourchurch.org"
          disabled={locked}
        />
      </div>

      {status === "checking" && (
        <Button disabled size="sm">Checking…</Button>
      )}

      {status === "idle" && (
        <Button onClick={handleSend} size="sm">
          Send Verification Email
        </Button>
      )}

      {status === "sending" && (
        <Button disabled size="sm">Sending…</Button>
      )}

      {status === "waiting" && (
        <div className="space-y-2">
          <p className="text-sm">
            A verification email was sent to <strong>{verifiedEmail}</strong>. Click the link
            in that email — this page will update automatically.
          </p>
          <p className="text-xs text-muted-foreground">Checking every 5 seconds…</p>
          <Button variant="outline" size="sm" onClick={handleSend}>
            Resend verification email
          </Button>
        </div>
      )}

      {status === "verified" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-green-600">
            ✓ {verifiedEmail} is verified.
          </p>
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-destructive transition-colors"
          >
            Use a different email
          </button>
        </div>
      )}

      {status === "removing" && (
        <Button disabled size="sm">Removing…</Button>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <p className="text-xs text-destructive">{errorMsg}</p>
          <Button variant="outline" size="sm" onClick={handleSend}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
