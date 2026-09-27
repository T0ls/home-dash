"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/service-icon";
import { resetHome, saveHome } from "@/app/customize/actions";
import { cn } from "@/lib/utils";
import type { BookmarkGroup, Service, ServiceGroup } from "@/lib/config";

type Props = {
  groups: ServiceGroup[];
  bookmarks: BookmarkGroup[];
  initial: { services?: string[]; bookmarks?: string[] };
};

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function useLayout(allIds: string[], initial?: string[]) {
  const startSelected = useMemo(() => initial ?? allIds, [allIds, initial]);
  const startOrder = useMemo(() => {
    if (!initial) return allIds;
    const picked = new Set(initial);
    return [...initial, ...allIds.filter((id) => !picked.has(id))];
  }, [allIds, initial]);

  const [order, setOrder] = useState(startOrder);
  const [selected, setSelected] = useState(() => new Set(startSelected));

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

  const reorder = (activeId: string, overId: string) => {
    setOrder((prev) => {
      const from = prev.indexOf(activeId);
      const to = prev.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return prev;
      return arrayMove(prev, from, to);
    });
  };

  const sorted = (ids: string[]) =>
    [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const dirty =
    selected.size !== startSelected.length ||
    [...selected].some((id) => !startSelected.includes(id)) ||
    !sameOrder(
      order.filter((id) => selected.has(id)),
      startSelected,
    );

  return { order, selected, toggle, setMany, reorder, sorted, dirty, value: order.filter((id) => selected.has(id)) };
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
  const all = count === ids.length && ids.length > 0;
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h3 className="text-xs font-semibold tracking-widest text-white/40 uppercase">
        {name}
        <span className="ml-2 font-normal tracking-normal text-white/30 normal-case">
          {count}/{ids.length}
        </span>
      </h3>
      <button type="button" onClick={() => onSetAll(!all)} className="text-xs text-sky-400 transition hover:text-sky-300">
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

function ServiceCard({
  service,
  on,
  dragging,
  handleProps,
  style,
  setNodeRef,
  onToggle,
}: {
  service: Service;
  on: boolean;
  dragging?: boolean;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
  style?: React.CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  onToggle?: () => void;
}) {
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-2xl border p-3.5 transition-[box-shadow,border-color,background-color,opacity,transform] duration-200",
        on
          ? "border-sky-400/40 bg-sky-500/[0.08]"
          : "border-white/10 bg-white/[0.02] opacity-60",
        dragging && "z-50 scale-[1.03] border-sky-300/60 bg-zinc-900/95 opacity-100 shadow-2xl shadow-sky-500/20 ring-1 ring-sky-400/30",
      )}
    >
      <button
        type="button"
        className="touch-none rounded-md p-1 text-white/30 transition hover:bg-white/10 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none cursor-grab active:cursor-grabbing"
        aria-label={`Drag ${service.name}`}
        {...handleProps}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
      >
        <ServiceIcon icon={service.icon} name={service.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-white">{service.name}</div>
          {service.description && <p className="truncate text-sm text-white/50">{service.description}</p>}
        </div>
        <Tick on={on} />
      </button>
    </div>
  );
}

function SortableService({
  service,
  on,
  onToggle,
}: {
  service: Service;
  on: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  return (
    <ServiceCard
      service={service}
      on={on}
      dragging={isDragging}
      setNodeRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 220ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: isDragging ? 0.35 : undefined,
      }}
      handleProps={{ ...attributes, ...listeners }}
      onToggle={onToggle}
    />
  );
}

export function CustomizeForm({ groups, bookmarks, initial }: Props) {
  const router = useRouter();
  const byId = useMemo(() => {
    const map = new Map<string, Service>();
    for (const g of groups) for (const s of g.services) map.set(s.id, s);
    return map;
  }, [groups]);
  const serviceIds = useMemo(() => groups.flatMap((g) => g.services.map((s) => s.id)), [groups]);
  const bookmarkIds = useMemo(() => bookmarks.flatMap((g) => g.bookmarks.map((b) => b.id)), [bookmarks]);
  const services = useLayout(serviceIds, initial.services);
  const marks = useLayout(bookmarkIds, initial.bookmarks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = services.dirty || marks.dirty;
  const customized = initial.services !== undefined || initial.bookmarks !== undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);
    if (serviceIds.includes(a) && serviceIds.includes(o)) services.reorder(a, o);
    else if (bookmarkIds.includes(a) && bookmarkIds.includes(o)) marks.reorder(a, o);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveHome({ services: services.value, bookmarks: marks.value });
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

  const activeService = activeId ? byId.get(activeId) : undefined;

  return (
    <div className="pb-28">
      <p className="mb-8 text-sm text-white/45">
        Drag the <GripVertical className="mx-0.5 inline size-3.5 align-text-bottom" /> handle to rearrange. The order is
        saved to your personal home.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {serviceIds.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-lg font-medium text-white">Services</h2>
            <div className="space-y-8">
              {groups.map((group) => {
                const ids = services.sorted(group.services.map((s) => s.id));
                const items = ids.map((id) => byId.get(id)!).filter(Boolean);
                return (
                  <div key={group.name}>
                    <GroupHeader
                      name={group.name}
                      ids={ids}
                      selected={services.selected}
                      onSetAll={(on) => services.setMany(ids, on)}
                    />
                    <SortableContext items={ids} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((service) => (
                          <SortableService
                            key={service.id}
                            service={service}
                            on={services.selected.has(service.id)}
                            onToggle={() => services.toggle(service.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
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
                const ids = marks.sorted(group.bookmarks.map((b) => b.id));
                const items = ids
                  .map((id) => group.bookmarks.find((b) => b.id === id))
                  .filter((b): b is NonNullable<typeof b> => Boolean(b));
                return (
                  <div key={group.name}>
                    <GroupHeader
                      name={group.name}
                      ids={ids}
                      selected={marks.selected}
                      onSetAll={(on) => marks.setMany(ids, on)}
                    />
                    <SortableContext items={ids} strategy={rectSortingStrategy}>
                      <div className="flex flex-wrap gap-2">
                        {items.map((b) => {
                          const on = marks.selected.has(b.id);
                          return (
                            <SortableBookmark
                              key={b.id}
                              id={b.id}
                              name={b.name}
                              icon={b.icon}
                              on={on}
                              onToggle={() => marks.toggle(b.id)}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
          {activeService ? (
            <ServiceCard service={activeService} on={services.selected.has(activeService.id)} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

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

function SortableBookmark({
  id,
  name,
  icon,
  on,
  onToggle,
}: {
  id: string;
  name: string;
  icon?: string;
  on: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 220ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: isDragging ? 0.35 : undefined,
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border py-1.5 pr-2 pl-1 text-sm transition duration-200",
        on ? "border-sky-400/40 bg-sky-500/[0.08] text-white" : "border-white/10 bg-white/[0.02] text-white/60 opacity-70",
        isDragging && "scale-105 shadow-lg shadow-sky-500/20",
      )}
    >
      <button
        type="button"
        className="touch-none rounded-full p-0.5 text-white/30 hover:text-white/70 cursor-grab active:cursor-grabbing"
        aria-label={`Drag ${name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} className="inline-flex items-center gap-2">
        <ServiceIcon icon={icon} name={name} className="size-7 rounded-full ring-0" />
        <span>{name}</span>
        <Tick on={on} />
      </button>
    </div>
  );
}
