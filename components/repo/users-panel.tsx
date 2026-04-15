"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  inviteUser,
  updateUserAccess,
  removeUserFromChurch,
  resendInvite,
  type InviteState,
} from "@/lib/actions/users";
import { useConfig } from "@/contexts/config-context";
import type { ConfigCollection } from "@/components/repo/scope-picker";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, Copy, Loader2, Mail, MailX, RefreshCw, Settings2, Trash2, UserPlus } from "lucide-react";
import { ScopePicker } from "@/components/repo/scope-picker";
import { Switch } from "@/components/ui/switch";

type UserRow = {
  userId: string;
  name: string;
  email: string;
  isAdmin: boolean;
  scopes: string[];
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

function scopeSummary(scopes: string[]): string {
  if (scopes.length === 0) return "No access";
  const collectionNames = new Set(
    scopes
      .filter(s => s.startsWith("collection:") || s.startsWith("entry:"))
      .map(s => {
        if (s.startsWith("collection:")) return s.replace("collection:", "");
        return s.split(":")[1]; // entry:{collection}:{slug}
      })
  );
  const config = scopes.filter(s => s.startsWith("site-config:")).length;
  const media = scopes.filter(s => s.startsWith("media:")).length;
  const parts: string[] = [];
  if (collectionNames.size > 0)
    parts.push(`${collectionNames.size} collection${collectionNames.size > 1 ? "s" : ""}`);
  if (config > 0) parts.push(`${config} config section${config > 1 ? "s" : ""}`);
  if (media > 0) parts.push(`${media} media type${media > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "No access";
}

export function UsersPanel({
  churchId,
  owner,
  repo,
  branch,
  initialUsers,
}: {
  churchId: string;
  owner: string;
  repo: string;
  branch: string;
  initialUsers: UserRow[];
}) {
  const router = useRouter();
  const { config } = useConfig();
  const collections: ConfigCollection[] = ((config?.object?.content as any[]) ?? [])
    .filter((item: any) => item.type === "collection")
    .map((item: any) => ({ name: item.name as string, label: (item.label || item.name) as string }));
  const collectionNames = collections.map(c => c.name);
  const [isPending, startTransition] = useTransition();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
  const [inviteScopes, setInviteScopes] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<{
    userId: string;
    inviteUrl: string | null;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editScopes, setEditScopes] = useState<string[]>([]);
  const [editIsAdmin, setEditIsAdmin] = useState(false);

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

  useEffect(() => {
    if (inviteState.status === "success") {
      router.refresh();
      setShowInvite(false);
      setInviteIsAdmin(false);
      setInviteScopes([]);
    }
  }, [inviteState.status, router]);

  function handleRemove(userId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await removeUserFromChurch(churchId, userId);
      if (!result.ok) setActionError(result.error ?? "Remove failed.");
      else router.refresh();
    });
  }

  function openEditAccess(user: UserRow) {
    setEditingUser(user);
    setEditIsAdmin(user.isAdmin);
    setEditScopes(user.scopes);
  }

  function handleSaveAccess() {
    if (!editingUser) return;
    setActionError(null);
    startTransition(async () => {
      const result = await updateUserAccess(
        churchId,
        editingUser.userId,
        editIsAdmin,
        editIsAdmin ? [] : editScopes,
        collectionNames
      );
      if (!result.ok) { setActionError(result.error ?? "Update failed."); return; }
      setEditingUser(null);
      router.refresh();
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
          <input type="hidden" name="isAdmin" value={String(inviteIsAdmin)} />
          <input type="hidden" name="scopes" value={JSON.stringify(inviteScopes)} />
          <input type="hidden" name="collectionNames" value={JSON.stringify(collectionNames)} />
          <p className="text-sm font-medium">Invite a new user</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input id="invite-name" name="name" placeholder="Jane Smith" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" placeholder="jane@church.com" required />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                id="invite-is-admin"
                checked={inviteIsAdmin}
                onCheckedChange={setInviteIsAdmin}
              />
              <Label htmlFor="invite-is-admin" className="cursor-pointer">
                Admin — full access to everything
              </Label>
            </div>

            {!inviteIsAdmin && (
              <div className="rounded-lg border p-4 bg-background">
                <p className="text-xs font-medium text-muted-foreground mb-3">Custom access</p>
                <ScopePicker
                  owner={owner}
                  repo={repo}
                  branch={branch}
                  collections={collections}
                  selectedScopes={inviteScopes}
                  onChange={setInviteScopes}
                />
              </div>
            )}
          </div>

          {inviteState.status === "error" && (
            <p className="text-sm text-destructive">{inviteState.message}</p>
          )}

          {!inviteIsAdmin && inviteScopes.length === 0 && (
            <p className="text-xs text-amber-600">Select at least one scope or enable Admin access.</p>
          )}
          <div className="flex gap-2">
            <InviteSubmitButton />
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

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
                <TableHead>Access</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialUsers.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell className="font-medium">{u.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {u.isAdmin ? (
                      <Badge variant="secondary">Admin</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">{scopeSummary(u.scopes)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        onClick={() => openEditAccess(u)}
                        title="Edit access"
                      >
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
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

      {/* Edit access dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit access — {editingUser?.name || editingUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Switch
                id="edit-is-admin"
                checked={editIsAdmin}
                onCheckedChange={setEditIsAdmin}
                disabled={isPending}
              />
              <Label htmlFor="edit-is-admin" className="cursor-pointer">
                Admin — full access to everything
              </Label>
            </div>
            {!editIsAdmin && (
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Custom access</p>
                <ScopePicker
                  owner={owner}
                  repo={repo}
                  branch={branch}
                  collections={collections}
                  selectedScopes={editScopes}
                  onChange={setEditScopes}
                  disabled={isPending}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSaveAccess} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <Button variant="ghost" size="sm" onClick={() => setResendResult(null)}>Dismiss</Button>
        </div>
      )}
    </div>
  );
}
