export type UserBookmark = {
  id: string;
  name: string;
  href: string;
  icon?: string;
};

export const MAX_USER_BOOKMARKS = 40;

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000 || /[\s]/.test(trimmed)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) return null;
  const withScheme = /^https?:/i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanIcon(raw: string): string | undefined | null {
  const icon = raw.trim();
  if (!icon) return undefined;
  if (icon.length > 300 || /[\r\n]/.test(icon)) return null;
  if ((/^(https?:)?\/\//.test(icon) || icon.startsWith("/")) && !/^https?:\/\//i.test(icon)) return null;
  return icon;
}

export function parseUserBookmarkInput(input: {
  name: string;
  href: string;
  icon: string;
}): { ok: true; name: string; href: string; icon?: string } | { ok: false; error: string } {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Enter a name." };
  if (name.length > 80) return { ok: false, error: "Use a shorter name (80 characters max)." };
  const href = normalizeHref(input.href);
  if (!href) return { ok: false, error: "Enter a link, like https://example.com." };
  const icon = cleanIcon(input.icon);
  if (icon === null) return { ok: false, error: "Use an emoji, an icon name, or an https image for the icon." };
  return { ok: true, name, href, icon };
}

export function sanitizeUserBookmarks(raw: unknown): UserBookmark[] {
  if (!Array.isArray(raw)) return [];
  const out: UserBookmark[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_USER_BOOKMARKS) break;
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim().replace(/\s+/g, " ") : "";
    const href = typeof record.href === "string" ? normalizeHref(record.href) : null;
    const icon = typeof record.icon === "string" ? cleanIcon(record.icon) : undefined;
    if (!ID_RE.test(id) || seen.has(id) || !name || name.length > 80 || !href || icon === null) continue;
    seen.add(id);
    out.push({ id, name, href, icon });
  }
  return out;
}

export function sameUserBookmarks(a: UserBookmark[], b: UserBookmark[]) {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index];
      return (
        item.id === other.id &&
        item.name === other.name &&
        item.href === other.href &&
        (item.icon ?? "") === (other.icon ?? "")
      );
    })
  );
}

export function toPersonalBookmarkGroup(
  items: UserBookmark[] | undefined,
  target: "_blank" | "_self",
): { name: string; bookmarks: { id: string; name: string; href: string; icon?: string; target: "_blank" | "_self" }[] } | null {
  if (!items?.length) return null;
  return {
    name: "Your bookmarks",
    bookmarks: items.map((item) => ({
      id: item.id,
      name: item.name,
      href: item.href,
      icon: item.icon,
      target,
    })),
  };
}
