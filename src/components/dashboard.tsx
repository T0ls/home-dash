"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, SlidersHorizontal, X } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceIcon } from "@/components/service-icon";
import { StatusDot } from "@/components/status-dot";
import { UserMenu, type ClientUser } from "@/components/user-menu";
import { cn } from "@/lib/utils";
import type { BookmarkGroup, ServiceGroup, Settings } from "@/lib/config";

const GRID_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  if (!now) return <div className="h-12" />;
  const hour = now.getHours();
  const greeting =
    hour < 6 ? "Good night" : hour < 13 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="text-left sm:text-right">
      <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-white">
        {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
      </div>
      <div className="text-sm text-white/50">
        {greeting} · {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </div>
  );
}

export function Dashboard({
  settings,
  groups,
  bookmarks,
  user,
  canCustomize = false,
  customized = false,
}: {
  settings: Settings;
  groups: ServiceGroup[];
  bookmarks: BookmarkGroup[];
  user: ClientUser | null;
  canCustomize?: boolean;
  customized?: boolean;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement instanceof HTMLInputElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let order = 0;
    return groups
      .map((group) => ({
        ...group,
        services: group.services
          .map((service) => ({ ...service, order: order++ }))
          .filter(
            (s) =>
              !q ||
              group.name.toLowerCase().includes(q) ||
              s.name.toLowerCase().includes(q) ||
              s.description?.toLowerCase().includes(q) ||
              s.href?.toLowerCase().includes(q),
          ),
      }))
      .filter((group) => group.services.length > 0);
  }, [groups, query]);

  const filteredBookmarks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks
      .map((group) => ({
        ...group,
        bookmarks: group.bookmarks.filter(
          (b) =>
            group.name.toLowerCase().includes(q) ||
            b.name.toLowerCase().includes(q) ||
            b.href.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.bookmarks.length > 0);
  }, [bookmarks, query]);

  const firstMatch = filtered[0]?.services.find((s) => s.href) ?? filteredBookmarks[0]?.bookmarks[0];
  const total = groups.reduce((n, g) => n + g.services.length, 0);
  const bookmarkTotal = bookmarks.reduce((n, g) => n + g.bookmarks.length, 0);

  return (
    <TooltipProvider>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <span className="truncate text-sm font-medium tracking-wide text-white/60">{settings.title}</span>
          {settings.auth.enabled && (
            <UserMenu
              user={user}
              accountUrl={settings.auth.accountUrl}
              logoutUrl={settings.auth.logoutUrl}
              canCustomize={canCustomize}
            />
          )}
        </div>

        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {user ? (
                <>
                  Welcome, <span className="text-sky-300">{user.displayName.split(/\s+/)[0]}</span>
                </>
              ) : (
                settings.title
              )}
            </h1>
            {settings.subtitle && <p className="mt-1.5 text-white/50">{settings.subtitle}</p>}
          </div>
          {settings.showClock && <Clock />}
        </header>

        {(total > 0 || bookmarkTotal > 0) && (
          <form
            className="relative mb-8"
            onSubmit={(e) => {
              e.preventDefault();
              if (query && firstMatch?.href) window.open(firstMatch.href, firstMatch.target);
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/40" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={`Search ${total + bookmarkTotal} links…`}
              aria-label="Search services and bookmarks"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pr-12 pl-11 text-base text-white outline-none placeholder:text-white/40 focus-visible:border-sky-400/50 focus-visible:ring-3 focus-visible:ring-sky-400/30"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 font-mono text-xs text-white/40 sm:block">
                /
              </kbd>
            )}
          </form>
        )}

        {filteredBookmarks.length > 0 && (
          <div className="mb-10 space-y-4">
            {filteredBookmarks.map((group) => (
              <section key={group.name} aria-label={group.name}>
                <h2 className="mb-2 text-xs font-semibold tracking-widest text-white/40 uppercase">{group.name}</h2>
                <div className="flex flex-wrap gap-2">
                  {group.bookmarks.map((b) => (
                    <a
                      key={b.name}
                      href={b.href}
                      target={b.target}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pr-3.5 pl-1.5 text-sm text-white/90 transition hover:border-white/25 hover:bg-white/[0.09]"
                    >
                      <ServiceIcon icon={b.icon} name={b.name} className="size-7 rounded-full ring-0" />
                      <span>{b.name}</span>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {total === 0 && bookmarkTotal === 0 ? (
          customized ? <EmptyHome /> : <EmptyConfig />
        ) : filtered.length === 0 && filteredBookmarks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
            <p className="text-white/70">No results for “{query}”.</p>
            <button onClick={() => setQuery("")} className="mt-2 text-sm text-sky-400 hover:underline">
              Show all
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {filtered.map((group) => (
              <section key={group.name} aria-labelledby={`group-${group.name}`}>
                <h2
                  id={`group-${group.name}`}
                  className="mb-3 text-xs font-semibold tracking-widest text-white/40 uppercase"
                >
                  {group.name}
                </h2>
                <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", GRID_COLS[settings.columns])}>
                  {group.services.map((service) => {
                    const content = (
                      <>
                        <ServiceIcon icon={service.icon} name={service.name} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-white">{service.name}</span>
                            {service.href && (
                              <ArrowUpRight className="size-3.5 shrink-0 text-white/30 opacity-0 transition group-hover:opacity-100" />
                            )}
                          </div>
                          {service.description && (
                            <p className="truncate text-sm text-white/50">{service.description}</p>
                          )}
                        </div>
                        {service.ping && (
                          <StatusDot id={service.id} order={service.order} interval={settings.statusInterval} />
                        )}
                      </>
                    );
                    const cls =
                      "group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur transition";
                    return service.href ? (
                      <a
                        key={service.id}
                        href={service.href}
                        target={service.target}
                        rel="noopener noreferrer"
                        className={cn(
                          cls,
                          "hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none",
                        )}
                      >
                        {content}
                      </a>
                    ) : (
                      <div key={service.id} className={cn(cls, "opacity-70")}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </TooltipProvider>
  );
}

function EmptyHome() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center sm:p-12">
      <h2 className="text-lg font-medium text-white">Your home is empty</h2>
      <p className="mx-auto mt-2 max-w-md text-white/60">
        You haven&apos;t picked any services yet. Choose the ones you use to see them here.
      </p>
      <Link
        href="/customize"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
      >
        <SlidersHorizontal className="size-4" />
        Customize home
      </Link>
    </div>
  );
}

function EmptyConfig() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-8 sm:p-12">
      <h2 className="text-lg font-medium text-white">No services configured</h2>
      <p className="mt-2 max-w-xl text-white/60">
        Add your services in <code className="text-sky-300">services.yaml</code> and bookmarks in{" "}
        <code className="text-sky-300">bookmarks.yaml</code>, then refresh the page.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-xl bg-black/40 p-4 text-sm text-white/80">
        {`- Media:
    - Jellyfin:
        href: http://192.168.1.10:8096
        description: Movies and TV shows
        icon: jellyfin`}
      </pre>
    </div>
  );
}
