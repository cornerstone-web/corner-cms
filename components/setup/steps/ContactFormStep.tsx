"use client";

import { useEffect, useRef, useState } from "react";
import { initiateContactFormVerification, checkContactFormVerification } from "@/lib/actions/setup-steps";
import { completeStep } from "@/lib/actions/setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ContactFormStepProps {
  church: { id: string; slug: string };
  onComplete: (stepKey: string) => void;
  initialEmail?: string;
}

type Status = "idle" | "sending" | "waiting" | "verified" | "error";

export default function ContactFormStep({ church, onComplete, initialEmail }: ContactFormStepProps) {
  const [formEmail, setFormEmail] = useState(initialEmail ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [verifiedEmail, setVerifiedEmail] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [completing, setCompleting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleSendVerification() {
    if (!formEmail.trim()) {
      setErrorMsg("Please enter an email address.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setErrorMsg(undefined);
    const res = await initiateContactFormVerification(church.id, church.slug, formEmail.trim());
    if (!res.ok) {
      setStatus("error");
      setErrorMsg(res.error ?? "Something went wrong.");
      return;
    }
    setVerifiedEmail(res.email);
    if (res.alreadyVerified) {
      setStatus("verified");
      return;
    }
    setStatus("waiting");
    startPolling(formEmail.trim());
  }

  function startPolling(email: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const check = await checkContactFormVerification(church.id, church.slug, email);
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

  const locked = status === "sending" || status === "waiting" || status === "verified";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Contact Form</h2>
        <p className="text-muted-foreground text-sm">
          Your site includes a contact form. All messages submitted through the site
          will be delivered to the email address below — verify it to activate the form.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="form-email">Form recipient email</Label>
        <Input
          id="form-email"
          type="email"
          value={formEmail}
          onChange={(e) => setFormEmail(e.target.value)}
          placeholder="hello@yourchurch.org"
          disabled={locked}
        />
      </div>

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
            A verification email was sent to <strong>{verifiedEmail}</strong>. Click the
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
            ✓ {verifiedEmail} is verified. Form submissions will be delivered to this address.
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
