import { ShieldX } from "lucide-react";

interface NoAccessScreenProps {
  adminEmails: string[];
}

export function NoAccessScreen({ adminEmails }: NoAccessScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8 text-center space-y-6">
        <div className="flex justify-center">
          <ShieldX className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">No access</h1>
          <p className="text-sm text-muted-foreground">
            Your account doesn&apos;t have access to any content on this site.
          </p>
        </div>
        {adminEmails.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
            {adminEmails.length === 1 ? (
              <p>
                Contact your admin:{" "}
                <a
                  href={`mailto:${adminEmails[0]}`}
                  className="font-medium underline underline-offset-2"
                >
                  {adminEmails[0]}
                </a>
              </p>
            ) : (
              <>
                <p className="font-medium">Contact one of your admins:</p>
                <ul className="space-y-1">
                  {adminEmails.map(email => (
                    <li key={email}>
                      <a
                        href={`mailto:${email}`}
                        className="underline underline-offset-2 text-muted-foreground hover:text-foreground"
                      >
                        {email}
                      </a>
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
