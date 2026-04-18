import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BillingPlaceholderProps {
  siteName: string;
  admins: { name: string; email: string }[];
}

export function BillingPlaceholder({ siteName, admins }: BillingPlaceholderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8 text-center space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{siteName}</p>
          <Badge variant="destructive">Suspended</Badge>
        </div>
        <div className="flex justify-center">
          <CreditCard className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Your site is currently suspended. Billing management is coming soon — contact support to reactivate your site.
          </p>
        </div>
        {admins.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
            {admins.length === 1 ? (
              <p>
                Contact your admin:{" "}
                <a
                  href={`mailto:${admins[0].email}`}
                  className="font-medium underline underline-offset-2"
                >
                  {admins[0].name}
                </a>
                {" "}<span className="text-muted-foreground">· {admins[0].email}</span>
              </p>
            ) : (
              <>
                <p className="font-medium">Contact one of your admins:</p>
                <ul className="space-y-1">
                  {admins.map(admin => (
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
        )}
      </div>
    </div>
  );
}
