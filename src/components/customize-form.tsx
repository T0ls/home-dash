"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/service-icon";
import { resetHome, saveHome } from "@/app/customize/actions";
import { cn } from "@/lib/utils";
import type { BookmarkGroup, ServiceGroup } from "@/lib/config";

type Props = {
  groups: ServiceGroup[];
  bookmarks: BookmarkGroup[];
  initial: { services?: string[]; bookmarks?: string[] };
};

function useSelection(allIds: string[], initial?: string[]) {
  const start = useMemo(() => new Set(initial ?? allIds), [allIds, initial]);
  const [selected, setSelected] = useState<Set<string>>(start);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const dirty = selected.size !== start.size || [...selected].some((id) => !start.has(id));
  return { selected, toggle, setMany, dirty };
}

function GroupHeader({
  name,
  ids,
  selected,
  onSetAll,
}: {
  name: string;
  ids: string[];
  selected: Set<string>;
  onSetAll: (on: boolean) => void;
}) {
  const count = ids.filter((id) => selected.has(id)).length;
  const all = count === ids.length;
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h3 className="text-xs font-semibold tracking-widest text-white/40 uppercase">
        {name}
        <span className="ml-2 font-normal tracking-normal text-white/30 normal-case">
          {count}/{ids.length}
        </span>
      </h3>
      <button
        type="button"
        onClick={() => onSetAll(!all)}
        className="text-xs text-sky-400 transition hover:text-sky-300"
      >
        {all ? "Deselect all" : "Select all"}
      </button>
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border transition",
        on ? "border-sky-400 bg-sky-500 text-white" : "border-white/20 bg-transparent text-transparent",
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}

export function CustomizeForm({ groups, bookmarks, initial }: Props) {
  const router = useRouter();
  const serviceIds = useMemo(() => groups.flatMap((g) => g.services.map((s) => s.id)), [groups]);
  const bookmarkIds = useMemo(() => bookmarks.flatMap((g) => g.bookmarks.map((b) => b.id)), [bookmarks]);
  const services = useSelection(serviceIds, initial.services);
  const marks = useSelection(bookmarkIds, initial.bookmarks);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = services.dirty || marks.dirty;
  const customized = initial.services !== undefined || initial.bookmarks !== undefined;

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveHome({ services: [...services.selected], bookmarks: [...marks.selected] });
      if (!res.ok) return setError(res.error);
      router.push("/");
      router.refresh();
    });

  const reset = () =>
    startTransition(async () => {
      setError(null);
      const res = await resetHome();
      if (!res.ok) return setError(res.error);
      router.push("/");
      router.refresh();
    });

  if (serviceIds.length === 0 && bookmarkIds.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-8 text-white/60">
        There are no services in the general config yet. Ask the admin to add some to services.yaml.
      </div>
    );
  }

  return (
    <div className="pb-28">
      {serviceIds.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 text-lg font-medium text-white">Services</h2>
          <div className="space-y-8">
            {groups.map((group) => {
              const ids = group.services.map((s) => s.id);
              return (
                <div key={group.name}>
                  <GroupHeader
                    name={group.name}
                    ids={ids}
                    selected={services.selected}
                    onSetAll={(on) => services.setMany(ids, on)}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.services.map((service) => {
                      const on = services.selected.has(service.id);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => services.toggle(service.id)}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none",
                            on
                              ? "border-sky-400/40 bg-sky-500/[0.08] hover:bg-sky-500/[0.12]"
                              : "border-white/10 bg-white/[0.02] opacity-60 hover:opacity-100",
                          )}
                        >
                          <ServiceIcon icon={service.icon} name={service.name} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-white">{service.name}</div>
                            {service.description && (
                              <p className="truncate text-sm text-white/50">{service.description}</p>
                            )}
                          </div>
                          <Tick on={on} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {bookmarkIds.length > 0 && (
        <section>
          <h2 className="mb-5 text-lg font-medium text-white">Bookmarks</h2>
          <div className="space-y-6">
            {bookmarks.map((group) => {
              const ids = group.bookmarks.map((b) => b.id);
              return (
                <div key={group.name}>
                  <GroupHeader
                    name={group.name}
                    ids={ids}
                    selected={marks.selected}
                    onSetAll={(on) => marks.setMany(ids, on)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {group.bookmarks.map((b) => {
                      const on = marks.selected.has(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => marks.toggle(b.id)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border py-1.5 pr-2 pl-1.5 text-sm transition focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none",
                            on
                              ? "border-sky-400/40 bg-sky-500/[0.08] text-white"
                              : "border-white/10 bg-white/[0.02] text-white/60 opacity-70 hover:opacity-100",
                          )}
                        >
                          <ServiceIcon icon={b.icon} name={b.name} className="size-7 rounded-full ring-0" />
                          <span>{b.name}</span>
                          <Tick on={on} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="text-sm text-white/60">
            {error ? (
              <span className="text-rose-300">{error}</span>
            ) : (
              <>
                <span className="text-white">{services.selected.size}</span> of {serviceIds.length} services
                {bookmarkIds.length > 0 && (
                  <>
                    {" · "}
                    <span className="text-white">{marks.selected.size}</span> of {bookmarkIds.length} bookmarks
                  </>
                )}
                {dirty && <span className="ml-2 text-amber-300">· Unsaved changes</span>}
              </>
            )}
          </div>
          <div className="flex gap-2">
            {customized && (
              <Button variant="ghost" onClick={reset} disabled={pending} className="text-white/70">
                <RotateCcw />
                Reset to default
              </Button>
            )}
            <Button onClick={save} disabled={pending || (!dirty && customized)} className="min-w-32">
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
