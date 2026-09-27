"use client";

import { ExternalLink, LogOut, ShieldAlert, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ClientUser = {
  displayName: string;
  username?: string;
  email?: string;
  groups: string[];
  avatar?: string;
  role?: string;
  known: boolean;
  mock: boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 px-1.5 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right text-foreground">{value}</span>
    </div>
  );
}

export function UserMenu({
  user,
  accountUrl,
  logoutUrl,
}: {
  user: ClientUser | null;
  accountUrl?: string;
  logoutUrl?: string;
}) {
  const name = user?.displayName ?? "Guest";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pr-3.5 pl-1 text-sm text-white/90 transition outline-none hover:border-white/20 hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-sky-400 data-popup-open:border-white/20 data-popup-open:bg-white/[0.08]"
        aria-label={`Account for ${name}`}
      >
        <Avatar className="size-8">
          {user?.avatar && <AvatarImage src={user.avatar} alt="" />}
          <AvatarFallback className={cn("text-xs font-semibold", user ? "bg-sky-500/20 text-sky-200" : "bg-white/10")}>
            {user ? initials(user.displayName) : <UserRound className="size-4" />}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-40 truncate sm:inline">{name}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-1.5">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-1.5 py-2">
              <Avatar size="lg" className="size-11">
                {user.avatar && <AvatarImage src={user.avatar} alt="" />}
                <AvatarFallback className="bg-sky-500/20 text-sm font-semibold text-sky-200">
                  {initials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{user.displayName}</div>
                {user.email && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
              </div>
            </div>

            {!user.known && (
              <div className="mx-1.5 mb-1.5 flex gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-200">
                <ShieldAlert className="mt-px size-3.5 shrink-0" />
                <span>
                  User not listed in <code>users.yaml</code>. Add them with this displayName to complete
                  the profile.
                </span>
              </div>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <Row label="Username" value={user.username} />
              <Row label="Role" value={user.role} />
              <Row label="Groups" value={user.groups.length ? user.groups.join(", ") : undefined} />
              <Row label="Signed in via" value={user.mock ? "Simulated (dev)" : "Authelia"} />
            </DropdownMenuGroup>

            {(accountUrl || logoutUrl) && <DropdownMenuSeparator />}
            {accountUrl && (
              <DropdownMenuItem render={<a href={accountUrl} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink />
                Manage account
              </DropdownMenuItem>
            )}
            {logoutUrl && (
              <DropdownMenuItem variant="destructive" render={<a href={logoutUrl} />}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            )}
          </>
        ) : (
          <div className="space-y-1.5 px-1.5 py-2 text-sm">
            <div className="font-medium text-foreground">Not identified</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              No Authelia headers were received. Open the dashboard through your nginx reverse proxy to be
              identified.
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
