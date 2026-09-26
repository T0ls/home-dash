"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs } from "@base-ui/react/tabs";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackgroundSettings } from "@/components/background-settings";
import { ServiceIcon } from "@/components/service-icon";
import { YourBookmarks } from "@/components/your-bookmarks";
import { resetHome, saveHome } from "@/app/customize/actions";
import { sameBackground, type UserBackground } from "@/lib/background";
import { parseUserBookmarkInput, sameUserBookmarks, type UserBookmark } from "@/lib/user-bookmarks";
import { cn } from "@/lib/utils";
import type { Service, ServiceGroup } from "@/lib/config";

type Props = {
  groups: ServiceGroup[];
  showBookmarks?: boolean;
  initial: {
    orderServices: string[];
    orderGroups: string[];
    selectedServices: string[];
    customBookmarks: UserBookmark[];
    background: UserBackground;
    customized: boolean;
  };
};

type SectionId = "services" | "bookmarks" | "background";

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function useOrder(catalog: string[], start: string[]) {
  const [baseline] = useState(() => {
    const preferred = start.filter((name) => catalog.includes(name));
    return [...preferred, ...catalog.filter((name) => !preferred.includes(name))];
  });
  const [order, setOrder] = useState(baseline);
  const reorder = (active: string, over: string) => {
    setOrder((prev) => {
      const from = prev.indexOf(active);
      const to = prev.indexOf(over);
      if (from < 0 || to < 0 || from === to) return prev;
      return arrayMove(prev, from, to);
    });
  };
  return { order, reorder, dirty: !sameOrder(order, baseline) };
}

function sectionId(name: string) {
  return `section:${name}`;
}

function sectionName(id: string, prefix: string) {
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

function useLayout(allIds: string[], startOrder: string[], startSelected: string[]) {
  const [baseline] = useState(() => {
    const preferred = startOrder.filter((id) => allIds.includes(id));
    const order = [...preferred, ...allIds.filter((id) => !preferred.includes(id))];
    const selected = startSelected.filter((id) => allIds.includes(id));
    return { order, selected };
  });
  const [order, setOrder] = useState(baseline.order);
  const [selected, setSelected] = useState(() => new Set(baseline.selected));

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
    selected.size !== baseline.selected.length ||
    [...selected].some((id) => !baseline.selected.includes(id)) ||
    !sameOrder(order, baseline.order);

  return { order, selected, toggle, setMany, reorder, sorted, dirty, value: order.filter((id) => selected.has(id)) };
}

function GroupHeader({
  name,
  ids,
  selected,
  onSetAll,
  handleProps,
}: {
  name: string;
  ids: string[];
  selected: Set<string>;
  onSetAll: (on: boolean) => void;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const count = ids.filter((id) => selected.has(id)).length;
  const all = count === ids.length && ids.length > 0;
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h3 className="flex items-center gap-1 text-xs font-semibold tracking-widest text-white/40 uppercase">
        {handleProps && (
          <button
            type="button"
            className="touch-none -ml-1 cursor-grab rounded-md p-1 text-white/30 transition hover:bg-white/10 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none active:cursor-grabbing"
            aria-label={`Move section ${name}`}
            {...handleProps}
          >
            <GripVertical className="size-4" />
          </button>
        )}
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

function SortableSection({
  id,
  children,
}: {
  id: string;
  children: (handleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 220ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: isDragging ? 0.45 : undefined,
      }}
      className={cn(isDragging && "relative z-10")}
    >
      {children({ ...attributes, ...listeners })}
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

export function CustomizeForm({ groups, showBookmarks = true, initial }: Props) {
  const router = useRouter();
  const byId = useMemo(() => {
    const map = new Map<string, Service>();
    for (const g of groups) for (const s of g.services) map.set(s.id, s);
    return map;
  }, [groups]);
  const serviceIds = useMemo(() => groups.flatMap((g) => g.services.map((s) => s.id)), [groups]);
  const services = useLayout(serviceIds, initial.orderServices, initial.selectedServices);
  const serviceSections = useOrder(
    groups.map((g) => g.name),
    initial.orderGroups,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customBookmarks, setCustomBookmarks] = useState(initial.customBookmarks);
  const [background, setBackground] = useState(initial.background);
  const [uploading, setUploading] = useState(false);
  const [section, setSection] = useState<SectionId>("services");
  const customDirty = !sameUserBookmarks(customBookmarks, initial.customBookmarks);
  const backgroundDirty = !sameBackground(background, initial.background);
  const dirty = services.dirty || serviceSections.dirty || customDirty || backgroundDirty;
  const customized = initial.customized;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groupOf = (id: string) => groups.find((g) => g.services.some((s) => s.id === id))?.name;

  const collide: CollisionDetection = (args) => {
    const id = String(args.active.id);
    const kind = id.startsWith("section:") ? "section" : "item";
    const containers = args.droppableContainers.filter((container) => {
      const cid = String(container.id);
      if (kind === "section") return cid.startsWith("section:");
      if (cid.startsWith("section:")) return false;
      return serviceIds.includes(id) && serviceIds.includes(cid) && groupOf(id) === groupOf(cid);
    });
    return closestCenter({ ...args, droppableContainers: containers });
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);
    const section = sectionName(a, "section:");
    const overSection = sectionName(o, "section:");
    if (section && overSection) serviceSections.reorder(section, overSection);
    else if (serviceIds.includes(a) && serviceIds.includes(o) && groupOf(a) === groupOf(o)) services.reorder(a, o);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const parsedBookmarks: UserBookmark[] = [];
      if (showBookmarks) {
        for (const bookmark of customBookmarks) {
          const parsed = parseUserBookmarkInput({
            name: bookmark.name,
            href: bookmark.href,
            icon: bookmark.icon ?? "",
          });
        if (!parsed.ok) {
          setSection("bookmarks");
          setError(parsed.error);
          return;
        }
          parsedBookmarks.push({ id: bookmark.id, name: parsed.name, href: parsed.href, icon: parsed.icon });
        }
      }
      const res = await saveHome({
        services: services.value,
        orderServices: services.order,
        orderGroups: serviceSections.order,
        availableServices: serviceIds,
        ...(showBookmarks ? { customBookmarks: parsedBookmarks } : {}),
        background: {
          backgroundImage: background.image ?? "",
          backgroundBlur: background.blur,
          backgroundOpacity: background.opacity,
        },
      });
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

  const activeService = activeId ? byId.get(activeId) : undefined;

  const sections: { id: SectionId; label: string }[] = [
    { id: "services", label: "Services" },
    ...(showBookmarks ? [{ id: "bookmarks" as const, label: "Bookmarks" }] : []),
    { id: "background", label: "Background" },
  ];

  return (
    <div className="pb-28">
      <Tabs.Root
        value={section}
        onValueChange={(value) => {
          if (value === "services" || value === "bookmarks" || value === "background") setSection(value);
        }}
        className="min-w-0"
      >
        <Tabs.List
          aria-label="Customize sections"
          className={cn(
            "sticky top-0 z-30 mb-6 grid gap-1 rounded-2xl border border-white/10 bg-zinc-950/95 p-1 backdrop-blur",
            showBookmarks ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {sections.map((item) => (
            <Tabs.Tab
              key={item.id}
              value={item.id}
              className="rounded-xl px-2 py-2.5 text-sm font-medium text-white/55 transition hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none aria-selected:bg-sky-500 aria-selected:text-white data-active:bg-sky-500 data-active:text-white"
            >
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="services" className="outline-none">
      {serviceIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-white/60">
          There are no services in the general config yet. Ask the admin to add some to services.yaml.
        </div>
      ) : (
        <>
      <p className="mb-8 text-sm text-white/45">
        Drag a section to move the group, or a service to move it inside the group. A service added later shows up
        here on its own.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={collide}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <section>
            <h2 className="mb-5 text-lg font-medium text-white">Services</h2>
            <SortableContext items={serviceSections.order.map(sectionId)} strategy={verticalListSortingStrategy}>
            <div className="space-y-8">
              {serviceSections.order.map((name) => {
                const group = groups.find((g) => g.name === name);
                if (!group) return null;
                const ids = services.sorted(group.services.map((s) => s.id));
                const items = ids.map((id) => byId.get(id)!).filter(Boolean);
                return (
                  <SortableSection key={group.name} id={sectionId(group.name)}>
                    {(handleProps) => (
                      <>
                        <GroupHeader
                          name={group.name}
                          ids={ids}
                          selected={services.selected}
                          onSetAll={(on) => services.setMany(ids, on)}
                          handleProps={serviceSections.order.length > 1 ? handleProps : undefined}
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
                      </>
                    )}
                  </SortableSection>
                );
              })}
            </div>
            </SortableContext>
          </section>

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
          {activeService ? (
            <ServiceCard service={activeService} on={services.selected.has(activeService.id)} dragging />
          ) : activeId?.startsWith("section:") ? (
            <div className="rounded-xl border border-sky-300/60 bg-zinc-900/95 px-4 py-3 text-xs font-semibold tracking-widest text-white uppercase shadow-2xl shadow-sky-500/20">
              {activeId.slice("section:".length)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
        </>
      )}
        </Tabs.Panel>

        {showBookmarks && (
          <Tabs.Panel value="bookmarks" className="outline-none">
            <YourBookmarks bookmarks={customBookmarks} onChange={setCustomBookmarks} />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="background" className="outline-none">
          <BackgroundSettings
            value={background}
            onChange={setBackground}
            onError={setError}
            onBusyChange={setUploading}
          />
        </Tabs.Panel>
      </Tabs.Root>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="text-sm text-white/60">
            {error ? (
              <span className="text-rose-300">{error}</span>
            ) : (
              <>
                <span className="text-white">{services.selected.size}</span> of {serviceIds.length} services
                {showBookmarks && (
                  <>
                    {" · "}
                    <span className="text-white">{customBookmarks.length}</span>{" "}
                    {customBookmarks.length === 1 ? "bookmark" : "bookmarks"}
                  </>
                )}
                {background.image && (
                  <>
                    {" · "}
                    background
                  </>
                )}
                {dirty && <span className="ml-2 text-amber-300">· Unsaved changes</span>}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={reset} disabled={pending || uploading} className="text-white/70">
              <RotateCcw />
              Reset to default
            </Button>
            <Button onClick={save} disabled={pending || uploading || (!dirty && customized)} className="min-w-32">
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
