import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { usersDir, type Bookmark, type BookmarkGroup, type ServiceGroup } from "@/lib/config";
import type { CurrentUser } from "@/lib/users";
import { log } from "@/lib/log";

export { userSlug } from "@/lib/users";

export type UserHome = {
  /** Services the user opted out of. New services not listed here show up automatically. */
  hiddenServices?: string[];
  hiddenBookmarks?: string[];
  /** Preferred order of services (ids). Unknown ids are ignored; missing ones are appended. */
  orderServices?: string[];
  orderBookmarks?: string[];
  /** Section order (group names). Sections not listed here are appended. */
  orderGroups?: string[];
  orderBookmarkGroups?: string[];
  updatedAt?: string;
  /** @deprecated legacy whitelist — migrated on read */
  services?: string[];
  /** @deprecated legacy whitelist — migrated on read */
  bookmarks?: string[];
};

export type ResolvedHome = {
  hiddenServices: string[];
  hiddenBookmarks: string[];
  orderServices: string[];
  orderBookmarks: string[];
  orderGroups: string[];
  orderBookmarkGroups: string[];
  customized: boolean;
};

const HOME_FILE = "home.yaml";

export function userDir(slug: string) {
  const root = usersDir();
  const dir = path.join(root, slug);
  if (path.dirname(dir) !== root) throw new Error("Invalid user folder");
  return dir;
}

export async function ensureUserDir(slug: string) {
  try {
    const created = await fs.mkdir(/*turbopackIgnore: true*/ userDir(slug), { recursive: true });
    if (created) log.info("users", `created folder ${userDir(slug)}`, false);
  } catch (err) {
    log.error("users", `can't create ${userDir(slug)}: ${(err as Error).message}`);
    throw err;
  }
}

const strList = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : undefined;

const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();

type Restricted = { users?: string[]; groups?: string[] };

/** Public (no users/groups) → everyone. Role "admin" sees everything. Otherwise match Authelia username, displayName or groups. */
export function canAccess(item: Restricted, user: CurrentUser | null): boolean {
  if (user?.role && norm(user.role) === "admin") return true;
  const hasUsers = Boolean(item.users?.length);
  const hasGroups = Boolean(item.groups?.length);
  if (!hasUsers && !hasGroups) return true;
  if (!user) return false;
  if (hasUsers) {
    const names = [user.username, user.displayName].filter(Boolean).map((s) => norm(s!));
    if (item.users!.some((u) => names.includes(norm(u)))) return true;
  }
  if (hasGroups) {
    const ug = new Set(user.groups.map(norm));
    if (item.groups!.some((g) => ug.has(norm(g)))) return true;
  }
  return false;
}

export function filterByAccess(
  groups: ServiceGroup[],
  bookmarks: BookmarkGroup[],
  user: CurrentUser | null,
): { groups: ServiceGroup[]; bookmarks: BookmarkGroup[] } {
  return {
    groups: groups
      .map((g) => ({ ...g, services: g.services.filter((s) => canAccess(s, user)) }))
      .filter((g) => g.services.length > 0),
    bookmarks: bookmarks
      .map((g) => ({ ...g, bookmarks: g.bookmarks.filter((b) => canAccess(b, user)) }))
      .filter((g) => g.bookmarks.length > 0),
  };
}

export async function readUserHome(slug: string): Promise<UserHome> {
  try {
    const raw = YAML.parse(await fs.readFile(/*turbopackIgnore: true*/ path.join(userDir(slug), HOME_FILE), "utf8"));
    if (typeof raw !== "object" || raw === null) return {};
    return {
      hiddenServices: strList(raw.hiddenServices),
      hiddenBookmarks: strList(raw.hiddenBookmarks),
      orderServices: strList(raw.orderServices),
      orderBookmarks: strList(raw.orderBookmarks),
      orderGroups: strList(raw.orderGroups),
      orderBookmarkGroups: strList(raw.orderBookmarkGroups),
      services: strList(raw.services),
      bookmarks: strList(raw.bookmarks),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    };
  } catch {
    return {};
  }
}

type NamedGroup = { name: string; ids: string[] };

function orderNames(saved: string[] | undefined, catalog: string[]) {
  const known = new Set(catalog);
  const preferred = (saved ?? []).filter((name) => known.has(name));
  return [...preferred, ...catalog.filter((name) => !preferred.includes(name))];
}

/** When the user never saved a section order, keep the order the home already shows. */
function groupOrderFromItems(groups: NamedGroup[], itemOrder: string[]) {
  const catalog = groups.map((g) => g.name);
  const score = (name: string) => {
    const ids = groups.find((g) => g.name === name)?.ids ?? [];
    let best = Number.MAX_SAFE_INTEGER;
    for (const id of ids) {
      const i = itemOrder.indexOf(id);
      if (i >= 0 && i < best) best = i;
    }
    return best;
  };
  return [...catalog].sort((a, b) => score(a) - score(b) || catalog.indexOf(a) - catalog.indexOf(b));
}

/** Convert on-disk home (including legacy whitelist) into hidden + order for the available ids. */
export function resolveHome(
  home: UserHome,
  serviceIds: string[],
  bookmarkIds: string[],
  serviceGroups: NamedGroup[] = [],
  bookmarkGroups: NamedGroup[] = [],
): ResolvedHome {
  const customized =
    home.updatedAt !== undefined ||
    home.hiddenServices !== undefined ||
    home.hiddenBookmarks !== undefined ||
    home.orderServices !== undefined ||
    home.orderBookmarks !== undefined ||
    home.orderGroups !== undefined ||
    home.orderBookmarkGroups !== undefined ||
    home.services !== undefined ||
    home.bookmarks !== undefined;

  const availableS = new Set(serviceIds);
  const availableB = new Set(bookmarkIds);

  let hiddenServices: string[];
  let orderServices: string[];
  if (home.hiddenServices !== undefined || home.orderServices !== undefined) {
    hiddenServices = (home.hiddenServices ?? []).filter((id) => availableS.has(id));
    const preferred = (home.orderServices ?? []).filter((id) => availableS.has(id));
    orderServices = [...preferred, ...serviceIds.filter((id) => !preferred.includes(id))];
  } else if (home.services !== undefined) {
    // Legacy: services was a whitelist of what to show.
    const shown = home.services.filter((id) => availableS.has(id));
    hiddenServices = serviceIds.filter((id) => !shown.includes(id));
    orderServices = [...shown, ...serviceIds.filter((id) => !shown.includes(id))];
  } else {
    hiddenServices = [];
    orderServices = serviceIds;
  }

  let hiddenBookmarks: string[];
  let orderBookmarks: string[];
  if (home.hiddenBookmarks !== undefined || home.orderBookmarks !== undefined) {
    hiddenBookmarks = (home.hiddenBookmarks ?? []).filter((id) => availableB.has(id));
    const preferred = (home.orderBookmarks ?? []).filter((id) => availableB.has(id));
    orderBookmarks = [...preferred, ...bookmarkIds.filter((id) => !preferred.includes(id))];
  } else if (home.bookmarks !== undefined) {
    const shown = home.bookmarks.filter((id) => availableB.has(id));
    hiddenBookmarks = bookmarkIds.filter((id) => !shown.includes(id));
    orderBookmarks = [...shown, ...bookmarkIds.filter((id) => !shown.includes(id))];
  } else {
    hiddenBookmarks = [];
    orderBookmarks = bookmarkIds;
  }

  const orderGroups =
    home.orderGroups !== undefined
      ? orderNames(home.orderGroups, serviceGroups.map((g) => g.name))
      : groupOrderFromItems(serviceGroups, orderServices);
  // Bookmark sections stayed in catalog order before this field existed.
  const orderBookmarkGroups =
    home.orderBookmarkGroups !== undefined
      ? orderNames(home.orderBookmarkGroups, bookmarkGroups.map((g) => g.name))
      : bookmarkGroups.map((g) => g.name);

  return {
    hiddenServices,
    hiddenBookmarks,
    orderServices,
    orderBookmarks,
    orderGroups,
    orderBookmarkGroups,
    customized,
  };
}

export async function writeUserHome(
  slug: string,
  home: {
    hiddenServices: string[];
    hiddenBookmarks: string[];
    orderServices: string[];
    orderBookmarks: string[];
    orderGroups: string[];
    orderBookmarkGroups: string[];
  },
) {
  await ensureUserDir(slug);
  const body = YAML.stringify({
    hiddenServices: home.hiddenServices,
    hiddenBookmarks: home.hiddenBookmarks,
    orderServices: home.orderServices,
    orderBookmarks: home.orderBookmarks,
    orderGroups: home.orderGroups,
    orderBookmarkGroups: home.orderBookmarkGroups,
    updatedAt: new Date().toISOString(),
  });
  const header =
    "# Personal home layout. Managed from the dashboard (user menu → Customize home).\n" +
    "# hidden*: services/bookmarks you turned off (new ones not listed here appear automatically).\n" +
    "# orderServices / orderBookmarks: item order as Group/Name.\n" +
    "# orderGroups / orderBookmarkGroups: section order. New sections are appended.\n";
  const file = path.join(userDir(slug), HOME_FILE);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(/*turbopackIgnore: true*/ tmp, header + body);
  await fs.rename(/*turbopackIgnore: true*/ tmp, file);
  log.info(
    "users",
    `${slug} saved personal home: ${home.orderServices.length - home.hiddenServices.length} services visible, ` +
      `${home.hiddenServices.length} hidden`,
    false,
  );
}

export async function deleteUserHome(slug: string) {
  await fs.rm(/*turbopackIgnore: true*/ path.join(userDir(slug), HOME_FILE), { force: true });
  log.info("users", `${slug} reset personal home to default`, false);
}

function applyOrder<T extends { id: string }>(items: T[], order: string[], hidden: Set<string>) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: T[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item && !hidden.has(id)) {
      out.push(item);
      byId.delete(id);
    }
  }
  for (const item of byId.values()) {
    if (!hidden.has(item.id)) out.push(item);
  }
  return out;
}

export function applyUserHome(
  groups: ServiceGroup[],
  bookmarks: BookmarkGroup[],
  resolved: ResolvedHome,
): { groups: ServiceGroup[]; bookmarks: BookmarkGroup[] } {
  const hiddenS = new Set(resolved.hiddenServices);
  const hiddenB = new Set(resolved.hiddenBookmarks);

  const nextGroups = groups
    .map((g) => ({
      ...g,
      services: applyOrder(g.services, resolved.orderServices, hiddenS),
    }))
    .filter((g) => g.services.length > 0);

  const nextBookmarks = bookmarks
    .map((g) => ({
      ...g,
      bookmarks: applyOrder(g.bookmarks as Bookmark[], resolved.orderBookmarks, hiddenB),
    }))
    .filter((g) => g.bookmarks.length > 0);

  return {
    groups: bySavedOrder(nextGroups, resolved.orderGroups),
    bookmarks: bySavedOrder(nextBookmarks, resolved.orderBookmarkGroups),
  };
}

function bySavedOrder<T extends { name: string }>(items: T[], order: string[]) {
  const rank = new Map(order.map((name, index) => [name, index]));
  return [...items].sort((a, b) => {
    const ia = rank.has(a.name) ? rank.get(a.name)! : order.length;
    const ib = rank.has(b.name) ? rank.get(b.name)! : order.length;
    return ia - ib;
  });
}
