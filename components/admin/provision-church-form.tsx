"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { provisionChurch, type ProvisionState } from "@/lib/actions/provision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";

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
        "Provision Church"
      )}
    </Button>
  );
}

export function ProvisionChurchForm() {
  const router = useRouter();
  const [state, formAction] = useFormState(provisionChurch, initialState);
  const slugRef = useRef<HTMLInputElement>(null);
  const slugManuallyEdited = useRef(false);

  useEffect(() => {
    if (state.status === "success") {
      router.push("/");
    }
  }, [state, router]);

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
          <h1 className="font-semibold text-lg md:text-2xl tracking-tight">Provision New Church</h1>
        </div>
      </div>

      <form action={formAction} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Church Name</Label>
          <Input
            id="displayName"
            name="displayName"
            placeholder="First Baptist Houston"
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
              placeholder="first-baptist-houston"
              required
              pattern="^[a-z0-9][a-z0-9\-]*[a-z0-9]$"
              onChange={handleSlugChange}
              className="flex-1 px-3 py-2 text-sm bg-background outline-none min-w-0"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Becomes the GitHub repo name and CF Pages project name. Lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <p className="text-sm font-medium">Church Admin Account</p>

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
              placeholder="jane@firstbaptisthouston.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              An Auth0 account will be created and a password-setup link sent to this address.
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
