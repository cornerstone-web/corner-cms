"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRef, useState } from "react";
import Link from "next/link";
import { provisionChurch, type ProvisionState } from "@/lib/actions/provision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Loader2,
  Mail,
  MailX,
} from "lucide-react";

const initialState: ProvisionState = { status: "idle" };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Provisioning…
        </>
      ) : (
        "Provision Site"
      )}
    </Button>
  );
}

export function ProvisionChurchForm() {
  const [state, formAction] = useFormState(provisionChurch, initialState);
  const [copied, setCopied] = useState(false);
  const slugRef = useRef<HTMLInputElement>(null);
  const slugManuallyEdited = useRef(false);

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (state.status === "success") {
    return (
      <div className="max-w-screen-sm mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-semibold text-lg md:text-2xl tracking-tight">
            Account Created!
          </h1>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Mail className="h-4 w-4 shrink-0" />
            An invite email has been sent to {state.adminEmail}. They&apos;ll
            complete their site setup when they log in for the first time.
          </div>

          {!state.emailSent && (
            <div className="flex items-start gap-2 text-sm text-amber-600">
              <MailX className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Note: The invite email failed to send. Please share this
                information with them manually.
              </span>
            </div>
          )}

          {state.adminInviteUrl && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">
                Admin invite link (expires in 7 days)
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={state.adminInviteUrl}
                  className="text-xs font-mono"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(state.adminInviteUrl!)}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <Button asChild>
          <Link href="/">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  function handleDisplayNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugManuallyEdited.current && slugRef.current) {
      slugRef.current.value = slugify(e.target.value);
    }
  }

  function handleSlugChange() {
    slugManuallyEdited.current = true;
  }

  return (
    <div className="max-w-screen-sm mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-semibold text-lg md:text-2xl tracking-tight">
            Provision New Site
          </h1>
        </div>
      </div>

      <form action={formAction} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Site Name</Label>
          <Input
            id="displayName"
            name="displayName"
            placeholder="Main Street Church of Christ"
            required
            onChange={handleDisplayNameChange}
          />
          <p className="text-xs text-muted-foreground">
            The public display name shown in the CMS.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">Repo Slug</Label>
          <div className="flex items-center rounded-md border ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden">
            <span className="px-3 py-2 text-sm text-muted-foreground bg-muted border-r select-none shrink-0">
              cornerstone-web/
            </span>
            <input
              id="slug"
              name="slug"
              ref={slugRef}
              placeholder="main-street-coc"
              required
              pattern="^[a-z0-9][a-z0-9\-]*[a-z0-9]$"
              onChange={handleSlugChange}
              className="flex-1 px-3 py-2 text-sm bg-background outline-none min-w-0"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Becomes the GitHub repo name and CF Pages project name. Lowercase
            letters, numbers, and hyphens only.
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <p className="text-sm font-medium">Site Admin Account</p>

          <div className="space-y-1.5">
            <Label htmlFor="adminName">Full Name</Label>
            <Input
              id="adminName"
              name="adminName"
              placeholder="Jane Smith"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adminEmail">Email</Label>
            <Input
              id="adminEmail"
              name="adminEmail"
              type="email"
              placeholder="jane@mainstreetcoc.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              An Auth0 account will be created and a password-setup link sent to
              this address.
            </p>
          </div>
        </div>

        {state.status === "error" && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}

        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
