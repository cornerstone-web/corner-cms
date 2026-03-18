"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  inviteUser,
  updateUserRole,
  removeUserFromChurch,
  resendInvite,
  type InviteState,
} from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, Copy, Loader2, Mail, MailX, RefreshCw, Trash2, UserPlus } from "lucide-react";

type UserRow = {
  userId: string;
  name: string;
  email: string;
  role: "church_admin" | "editor";
};

const initialState: InviteState = { status: "idle" };

function InviteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invite"}
    </Button>
  );
}

export function UsersPanel({
  churchId,
  initialUsers,
}: {
  churchId: string;
  initialUsers: UserRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showInvite, setShowInvite] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<{
    userId: string;
    inviteUrl: string | null;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleResend(userId: string) {
    setActionError(null);
    setResendResult(null);
    startTransition(async () => {
      const result = await resendInvite(churchId, userId);
      if (!result.ok) {
        setActionError(result.error ?? "Failed to resend invite.");
      } else {
        setResendResult({ userId, inviteUrl: result.inviteUrl, emailSent: result.emailSent });
      }
    });
  }

  const [inviteState, inviteAction] = useFormState(inviteUser, initialState);

  // Refresh after successful invite
  useEffect(() => {
    if (inviteState.status === "success") {
      router.refresh();
      setShowInvite(false);
    }
  }, [inviteState.status, router]);

  function handleRoleChange(userId: string, role: "church_admin" | "editor") {
    setActionError(null);
    startTransition(async () => {
      const result = await updateUserRole(churchId, userId, role);
      if (!result.ok) setActionError(result.error ?? "Update failed.");
      else router.refresh();
    });
  }

  function handleRemove(userId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await removeUserFromChurch(churchId, userId);
      if (!result.ok) setActionError(result.error ?? "Remove failed.");
      else router.refresh();
    });
  }

  return (
    <div className="max-w-screen-lg mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-lg md:text-2xl tracking-tight">Users</h1>
        <Button size="sm" onClick={() => setShowInvite((v) => !v)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <form
          action={inviteAction}
          className="rounded-lg border p-4 space-y-4 bg-muted/30"
        >
          <input type="hidden" name="churchId" value={churchId} />
          <p className="text-sm font-medium">Invite a new user</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input id="invite-name" name="name" placeholder="Jane Smith" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="jane@church.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              name="role"
              defaultValue="editor"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="editor">Editor</option>
              <option value="church_admin">Church Admin</option>
            </select>
          </div>

          {inviteState.status === "error" && (
            <p className="text-sm text-destructive">{inviteState.message}</p>
          )}

          <div className="flex gap-2">
            <InviteSubmitButton />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowInvite(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      {/* Users table */}
      {initialUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users yet.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialUsers.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell className="font-medium">{u.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Select
                      defaultValue={u.role}
                      onValueChange={(val) =>
                        handleRoleChange(u.userId, val as "church_admin" | "editor")
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="church_admin">Church Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={isPending}
                      onClick={() => handleResend(u.userId)}
                      title="Resend invite"
                    >
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-sm" disabled={isPending}>
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove user?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {u.name || u.email} will lose access to this site. This can be undone by re-inviting them.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemove(u.userId)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Resend invite result */}
      {resendResult && (
        <div className="rounded-lg border p-4 space-y-3">
          {resendResult.emailSent ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Mail className="h-4 w-4 shrink-0" />
              Invite email resent successfully.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <MailX className="h-4 w-4 shrink-0" />
              Email could not be sent. Share this link manually (expires in 7 days).
            </div>
          )}
          {resendResult.inviteUrl && (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={resendResult.inviteUrl}
                className="text-xs font-mono"
                onFocus={e => e.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopy(resendResult.inviteUrl!)}
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setResendResult(null)}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
