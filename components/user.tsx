"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useUser } from "@/contexts/user-context";
import { handleSignOut } from "@/lib/actions/auth";
import { getInitialsFromName } from "@/lib/utils/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function User({
  className,
  onClick
}: {
  className?: string,
  onClick?: () => void
}) {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className={cn(className, "rounded-full")}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{getInitialsFromName(user.name || user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent forceMount align="start" className="max-w-[12.5rem]">
        <DropdownMenuLabel>
          {user.name && (
            <div className="text-sm font-medium truncate">{user.name}</div>
          )}
          <div className={cn("truncate", user.name ? "text-xs font-normal text-muted-foreground" : "text-sm font-medium")}>
            {user.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="w-40 text-xs text-muted-foreground font-medium">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" onClick={onClick}>Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" onClick={onClick}>Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" onClick={onClick}>System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={async () => { if (onClick) onClick(); await handleSignOut(); }}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
