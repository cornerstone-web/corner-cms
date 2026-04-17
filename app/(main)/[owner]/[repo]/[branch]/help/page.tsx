"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, LifeBuoy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/contexts/user-context";
import { useConfig } from "@/contexts/config-context";
import { sendSupportMessage } from "@/lib/actions/support";

export default function HelpPage() {
  const { user } = useUser();
  const { config } = useConfig();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);
    setError(false);
    const result = await sendSupportMessage({
      message: message.trim(),
      fromEmail: user?.email ?? undefined,
      fromName: user?.name ?? undefined,
      siteName: user?.siteAssignment?.displayName ?? config?.repo ?? undefined,
    });
    setSending(false);
    if (result.ok) {
      toast.success("Message sent. We'll be in touch soon.");
      setSent(true);
    } else {
      setError(true);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Help</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Need assistance? Send us a message and we&apos;ll get back to you.
        </p>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="font-medium">Message sent!</p>
            <p className="text-sm text-muted-foreground">We&apos;ll be in touch soon.</p>
            <Button variant="outline" size="sm" onClick={() => { setSent(false); setMessage(""); }}>
              Send another message
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm font-medium">
              <LifeBuoy className="h-4 w-4 text-muted-foreground" />
              Contact Support
            </div>
            <Textarea
              placeholder="Describe what you need help with…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="resize-none"
            />
            {error && (
              <p className="text-sm text-destructive">Failed to send. Please try again.</p>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={sending || !message.trim()}>
                {sending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                ) : (
                  "Send message"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
