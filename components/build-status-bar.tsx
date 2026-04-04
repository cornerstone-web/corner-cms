"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useBuildStatus } from "@/hooks/use-build-status";
import { useUser } from "@/contexts/user-context";
import { sendSupportMessage } from "@/lib/actions/support";

const MAX_RETRY_ATTEMPTS = 3;

export function BuildStatusBar({ churchId }: { churchId?: string }) {
  const { user } = useUser();
  const { buildStatus, consecutiveFailures, triggerRebuildWatch, retryPayload } =
    useBuildStatus(churchId);

  const [retrying, setRetrying] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportError, setSupportError] = useState(false);

  if (buildStatus !== "building" && buildStatus !== "failure") return null;

  async function handleRetry() {
    if (!retryPayload) return;
    setRetrying(true);
    try {
      const res = await fetch("/api/setup/retry-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retryPayload),
      });
      if (res.ok) {
        triggerRebuildWatch();
      }
    } finally {
      setRetrying(false);
    }
  }

  async function handleSendSupport() {
    if (!supportMessage.trim()) return;
    setSupportSending(true);
    setSupportError(false);
    const result = await sendSupportMessage({
      message: supportMessage.trim(),
      fromEmail: user?.email ?? undefined,
      fromName: user?.name ?? undefined,
      churchName: user?.churchAssignment?.displayName ?? undefined,
    });
    setSupportSending(false);
    if (result.ok) {
      toast.success("Message sent. We'll be in touch soon.");
      setSupportOpen(false);
      setSupportMessage("");
    } else {
      setSupportError(true);
    }
  }

  // Building state
  if (buildStatus === "building") {
    return (
      <div className="border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 shrink-0">
        <div className="flex items-center gap-2 px-4 md:px-6 h-10 text-sm">
          <Loader2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 animate-spin" />
          <span className="text-amber-800 dark:text-amber-200 font-medium">
            Building your site — this usually takes 2–3 minutes.
          </span>
          <div className="ml-auto w-24 bg-amber-200 dark:bg-amber-800 rounded-full h-1 overflow-hidden">
            <div className="h-full bg-amber-500 dark:bg-amber-400 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  // Failure state
  const canRetry = consecutiveFailures < MAX_RETRY_ATTEMPTS;

  return (
    <>
      <div className="border-b border-destructive/30 bg-destructive/5 shrink-0">
        <div className="flex items-center gap-2 px-4 md:px-6 h-10 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-destructive font-medium">
            Last build failed.
          </span>
          <div className="ml-auto">
            {canRetry ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleRetry}
                disabled={retrying || !retryPayload}
              >
                {retrying ? (
                  <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Retrying…</>
                ) : (
                  <><RefreshCw className="h-3 w-3 mr-1.5" />Retry build</>
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setSupportOpen(true)}
              >
                Contact support →
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Textarea
              placeholder="Describe the issue…"
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            {supportError && (
              <p className="text-sm text-destructive">
                Failed to send. Please try again.
              </p>
            )}
            <div className="flex justify-end">
              <Button
                onClick={handleSendSupport}
                disabled={supportSending || !supportMessage.trim()}
              >
                {supportSending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                ) : (
                  "Send message"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
