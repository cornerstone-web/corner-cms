import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default async function LockedOutPage() {
  const session = await auth0.getSession();
  const email = session?.user?.email as string | undefined;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Access not set up</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {email ? (
              <>
                <span className="font-medium text-foreground">{email}</span> is not
                associated with any site in this system.
              </>
            ) : (
              "Your account is not associated with any site in this system."
            )}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Please contact your site administrator to request access, or reach
            out to the Cornerstone team for help.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <a href="https://cornerstoneweb.dev" target="_blank" rel="noopener noreferrer">
              Go to cornerstoneweb.dev
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/auth/logout">Sign out</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
