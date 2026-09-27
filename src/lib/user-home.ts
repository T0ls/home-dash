import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { usersDir, type BookmarkGroup, type ServiceGroup } from "@/lib/config";
import { log } from "@/lib/log";

export { userSlug } from "@/lib/users";

export type UserHome = {
  /** ids ("Group/Name") of the services to show; undefined = show everything */
  services?: string[];
  bookmarks?: string[];
  updatedAt?: string;
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

export async function readUserHome(slug: string): Promise<UserHome> {
  try {
    const raw = YAML.parse(await fs.readFile(/*turbopackIgnore: true*/ path.join(userDir(slug), HOME_FILE), "utf8"));
    if (typeof raw !== "object" || raw === null) return {};
    return {
      services: strList(raw.services),
      bookmarks: strList(raw.bookmarks),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    };
  } catch {
    return {};
  }
}

export async function writeUserHome(slug: string, home: UserHome) {
  await ensureUserDir(slug);
  const body = YAML.stringify({
    services: home.services ?? [],
    bookmarks: home.bookmarks ?? [],
    updatedAt: new Date().toISOString(),
  });
  const header =
    "# Personal home layout. Managed from the dashboard (user menu → Customize home).\n" +
    '# Entries reference services/bookmarks from the general config as "Group/Name".\n';
  const file = path.join(userDir(slug), HOME_FILE);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(/*turbopackIgnore: true*/ tmp, header + body);
  await fs.rename(/*turbopackIgnore: true*/ tmp, file);
  log.info(
    "users",
    `${slug} saved personal home: ${home.services?.length ?? 0} services, ${home.bookmarks?.length ?? 0} bookmarks`,
    false,
  );
}

export async function deleteUserHome(slug: string) {
  await fs.rm(/*turbopackIgnore: true*/ path.join(userDir(slug), HOME_FILE), { force: true });
  log.info("users", `${slug} reset personal home to default`, false);
}

export function applyUserHome(groups: ServiceGroup[], bookmarks: BookmarkGroup[], home: UserHome) {
  const keep = <T extends { id: string }>(items: T[], ids?: string[]) => {
    if (!ids) return items;
    const order = new Map(ids.map((id, i) => [id, i]));
    return items.filter((i) => order.has(i.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  };
  return {
    groups: groups
      .map((g) => ({ ...g, services: keep(g.services, home.services) }))
      .filter((g) => g.services.length > 0),
    bookmarks: bookmarks
      .map((g) => ({ ...g, bookmarks: keep(g.bookmarks, home.bookmarks) }))
      .filter((g) => g.bookmarks.length > 0),
  };
}
