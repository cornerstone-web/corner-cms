"use client";

import { useEffect, useRef, useState } from "react";
import { initiateContactFormVerification, checkContactFormVerification } from "@/lib/actions/setup-steps";
import { completeStep } from "@/lib/actions/setup";
import { Button } from "@/components/ui/button";

interface ContactFormStepProps {
  church: { id: string; slug: string };
  onComplete: (stepKey: string) => void;
}

type Status = "idle" | "sending" | "waiting" | "verified" | "error";

export default function ContactFormStep({ church, onComplete }: ContactFormStepProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [completing, setCompleting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleSendVerification() {
    setStatus("sending");
    setErrorMsg(undefined);
    const res = await initiateContactFormVerification(church.id, church.slug);
    if (!res.ok) {
      setStatus("error");
      setErrorMsg(res.error ?? "Something went wrong.");
      return;
    }
    setEmail(res.email);
    if (res.alreadyVerified) {
      setStatus("verified");
      return;
    }
    setStatus("waiting");
    startPolling();
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const check = await checkContactFormVerification(church.id, church.slug);
      if (check.verified) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setStatus("verified");
      }
    }, 5000);
  }

  async function handleComplete() {
    setCompleting(true);
    await completeStep(church.id, "contact-form");
    onComplete("contact-form");
  }

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground">
        Your site includes a contact form on the Contact page. Before we can route
        form submissions to your inbox, Cloudflare needs to verify that you own the
        email address.
      </p>

      {status === "idle" && (
        <Button onClick={handleSendVerification}>
          Send Verification Email
        </Button>
      )}

      {status === "sending" && (
        <Button disabled>Sending…</Button>
      )}

      {status === "waiting" && (
        <div className="space-y-3">
          <p className="text-sm">
            A verification email was sent to <strong>{email}</strong>. Click the
            link in that email, then wait — this page will update automatically.
          </p>
          <p className="text-xs text-muted-foreground">Checking every 5 seconds…</p>
          <Button variant="outline" onClick={handleSendVerification} className="text-xs">
            Resend verification email
          </Button>
        </div>
      )}

      {status === "verified" && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-green-600">
            ✓ {email} is verified. Form submissions will be delivered to this address.
          </p>
          <Button onClick={handleComplete} disabled={completing}>
            {completing ? "Saving…" : "Continue →"}
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{errorMsg}</p>
          <Button variant="outline" onClick={handleSendVerification}>Try Again</Button>
        </div>
      )}
    </div>
  );
}
