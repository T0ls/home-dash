"use client";

import { useState, type FormEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/service-icon";
import {
  MAX_USER_BOOKMARKS,
  parseUserBookmarkInput,
  type UserBookmark,
} from "@/lib/user-bookmarks";

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white outline-none placeholder:text-white/35 focus-visible:border-sky-400/50 focus-visible:ring-3 focus-visible:ring-sky-400/30";

export function YourBookmarks({
  bookmarks,
  onChange,
}: {
  bookmarks: UserBookmark[];
  onChange: (next: UserBookmark[]) => void;
}) {
  const [name, setName] = useState("");
  const [href, setHref] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (id: string, patch: Partial<UserBookmark>) => {
    onChange(
      bookmarks.map((item) =>
        item.id === id
          ? { ...item, ...patch, icon: patch.icon === "" ? undefined : (patch.icon ?? item.icon) }
          : item,
      ),
    );
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (bookmarks.length >= MAX_USER_BOOKMARKS) {
      setError(`You can add up to ${MAX_USER_BOOKMARKS} bookmarks.`);
      return;
    }
    const parsed = parseUserBookmarkInput({ name, href, icon });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onChange([...bookmarks, { id: crypto.randomUUID(), name: parsed.name, href: parsed.href, icon: parsed.icon }]);
    setName("");
    setHref("");
    setIcon("");
    setError(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = bookmarks.findIndex((item) => item.id === active.id);
    const to = bookmarks.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(bookmarks, from, to));
  };

  return (
    <section aria-labelledby="your-bookmarks-heading">
      <h2 id="your-bookmarks-heading" className="text-lg font-medium text-white">
        Your bookmarks
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-white/50">
        Name and link. Drag to reorder. These stay on your home. Save when you are done.
      </p>

      <form
        onSubmit={add}
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_auto] lg:items-end"
      >
        <label className="block text-xs font-medium text-white/50">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Radio"
            autoComplete="off"
            className={`${fieldClass} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-white/50">
          Link
          <input
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://example.com"
            inputMode="url"
            autoComplete="off"
            className={`${fieldClass} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-white/50">
          Icon <span className="font-normal text-white/35">(optional)</span>
          <input
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            placeholder="⭐ or si-github"
            autoComplete="off"
            className={`${fieldClass} mt-1`}
          />
        </label>
        <Button type="submit" className="h-11 w-full lg:w-auto">
          <Plus />
          Add
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}

      {bookmarks.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-white/45">
          No bookmarks yet. Add one above.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={bookmarks.map((bookmark) => bookmark.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-4 space-y-2">
              {bookmarks.map((bookmark) => (
                <SortableBookmarkRow
                  key={bookmark.id}
                  bookmark={bookmark}
                  onUpdate={(patch) => update(bookmark.id, patch)}
                  onRemove={() => onChange(bookmarks.filter((item) => item.id !== bookmark.id))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function SortableBookmarkRow({
  bookmark,
  onUpdate,
  onRemove,
}: {
  bookmark: UserBookmark;
  onUpdate: (patch: Partial<UserBookmark>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bookmark.id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 220ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: isDragging ? 0.45 : undefined,
      }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_1.3fr_0.8fr_auto] sm:items-end">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="touch-none cursor-grab rounded-md p-1 text-white/30 transition hover:bg-white/10 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none active:cursor-grabbing"
            aria-label={`Reorder ${bookmark.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <ServiceIcon icon={bookmark.icon} name={bookmark.name} className="size-10" />
        </div>
        <label className="block text-xs font-medium text-white/50">
          Name
          <input
            value={bookmark.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            aria-label={`Name for ${bookmark.name}`}
            className={`${fieldClass} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-white/50">
          Link
          <input
            value={bookmark.href}
            onChange={(event) => onUpdate({ href: event.target.value })}
            inputMode="url"
            aria-label={`Link for ${bookmark.name}`}
            className={`${fieldClass} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-white/50">
          Icon
          <input
            value={bookmark.icon ?? ""}
            onChange={(event) => onUpdate({ icon: event.target.value })}
            aria-label={`Icon for ${bookmark.name}`}
            className={`${fieldClass} mt-1`}
          />
        </label>
        <Button type="button" variant="ghost" className="h-11 text-white/80" onClick={onRemove}>
          <Trash2 />
          Remove
        </Button>
      </div>
    </li>
  );
}
