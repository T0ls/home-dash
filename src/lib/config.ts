import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { parseUsers, type UserConfig } from "@/lib/users";
import { log } from "@/lib/log";

export type Service = {
  /** "Group/Name", stable across requests; used for status checks and per-user selections */
  id: string;
  name: string;
  href?: string;
  description?: string;
  icon?: string;
  ping?: string;
  target: "_blank" | "_self";
  /** If set, only these usernames/displayNames may see the service. Empty/absent = everyone. */
  users?: string[];
  /** If set, only members of these Authelia groups may see the service. */
  groups?: string[];
};

export type ServiceGroup = {
  name: string;
  services: Service[];
};

export type Bookmark = {
  id: string;
  name: string;
  href: string;
  icon?: string;
  target: "_blank" | "_self";
  users?: string[];
  groups?: string[];
};

export type BookmarkGroup = {
  name: string;
  bookmarks: Bookmark[];
};

export type AuthSettings = {
  enabled: boolean;
  headers: { user: string; name: string; email: string; groups: string };
  logoutUrl?: string;
  accountUrl?: string;
};

export type Settings = {
  title: string;
  subtitle?: string;
  columns: number;
  target: "_blank" | "_self";
  statusCheck: boolean;
  statusInterval: number;
  showClock: boolean;
  backgroundImage?: string;
  backgroundBlur: number;
  backgroundOpacity: number;
  auth: AuthSettings;
};

export type Dashboard = {
  settings: Settings;
  groups: ServiceGroup[];
  bookmarks: BookmarkGroup[];
  users: UserConfig[];
  configDir: string;
};

export class ConfigError extends Error {
  constructor(
    message: string,
    public file: string,
  ) {
    super(message);
  }
}

const DEFAULT_SETTINGS: Settings = {
  title: "Homepage",
  subtitle: "Your services, one click away.",
  columns: 4,
  target: "_blank",
  statusCheck: true,
  statusInterval: 60,
  showClock: true,
  backgroundBlur: 0,
  backgroundOpacity: 0.35,
  auth: {
    enabled: true,
    headers: { user: "remote-user", name: "remote-name", email: "remote-email", groups: "remote-groups" },
  },
};

export function dataDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data"));
}

export function configDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.CONFIG_DIR ?? path.join(/*turbopackIgnore: true*/ dataDir(), "config"));
}

export function usersDir() {
  return path.join(dataDir(), "users");
}

function defaultsDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DEFAULTS_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "config"));
}

async function readYaml(file: string): Promise<unknown> {
  const full = path.join(configDir(), file);
  let raw: string;
  try {
    raw = await fs.readFile(/*turbopackIgnore: true*/ full, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    // First start with an empty mounted volume: seed it with the bundled examples.
    const fallback = path.join(/*turbopackIgnore: true*/ defaultsDir(), file);
    if (fallback === full) return null;
    try {
      raw = await fs.readFile(/*turbopackIgnore: true*/ fallback, "utf8");
    } catch {
      return null;
    }
    try {
      await fs.mkdir(/*turbopackIgnore: true*/ configDir(), { recursive: true });
      await fs.writeFile(/*turbopackIgnore: true*/ full, raw);
      log.info("config", `${full} was missing, created it from the example`);
    } catch (err) {
      log.warn("config", `${full} is missing and can't be created (${(err as Error).message}); using the example`);
    }
  }
  try {
    return YAML.parse(raw);
  } catch (err) {
    log.error("config", `${file}: ${(err as Error).message.split("\n")[0]}`);
    throw new ConfigError((err as Error).message, file);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const strList = (v: unknown) =>
  Array.isArray(v) ? v.map(str).filter((x): x is string => Boolean(x)) : undefined;

// Accepts both a list of single-key maps (homepage style) and a plain map.
function entries(v: unknown): [string, unknown][] {
  if (Array.isArray(v)) return v.filter(isRecord).flatMap((item) => Object.entries(item));
  if (isRecord(v)) return Object.entries(v);
  return [];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseAuth(raw: unknown): AuthSettings {
  const d = DEFAULT_SETTINGS.auth;
  if (!isRecord(raw)) return d;
  const h = isRecord(raw.headers) ? raw.headers : {};
  const header = (v: unknown, fallback: string) => (str(v) ?? fallback).toLowerCase();
  return {
    enabled: raw.enabled === undefined ? d.enabled : Boolean(raw.enabled),
    headers: {
      user: header(h.user, d.headers.user),
      name: header(h.name, d.headers.name),
      email: header(h.email, d.headers.email),
      groups: header(h.groups, d.headers.groups),
    },
    logoutUrl: str(raw.logoutUrl),
    accountUrl: str(raw.accountUrl),
  };
}

function parseSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  const columns = Number(raw.columns);
  const interval = Number(raw.statusInterval);
  const blur = Number(raw.backgroundBlur);
  const opacity = Number(raw.backgroundOpacity);
  return {
    title: str(raw.title) ?? DEFAULT_SETTINGS.title,
    subtitle: raw.subtitle === null ? undefined : (str(raw.subtitle) ?? DEFAULT_SETTINGS.subtitle),
    columns: Number.isFinite(columns) ? clamp(Math.round(columns), 1, 6) : DEFAULT_SETTINGS.columns,
    target: raw.target === "_self" ? "_self" : "_blank",
    statusCheck: raw.statusCheck === undefined ? DEFAULT_SETTINGS.statusCheck : Boolean(raw.statusCheck),
    statusInterval: Number.isFinite(interval) && interval >= 5 ? interval : DEFAULT_SETTINGS.statusInterval,
    showClock: raw.showClock === undefined ? DEFAULT_SETTINGS.showClock : Boolean(raw.showClock),
    backgroundImage: str(raw.backgroundImage),
    backgroundBlur: Number.isFinite(blur) ? clamp(blur, 0, 40) : DEFAULT_SETTINGS.backgroundBlur,
    backgroundOpacity: Number.isFinite(opacity) ? clamp(opacity, 0, 1) : DEFAULT_SETTINGS.backgroundOpacity,
    auth: parseAuth(raw.auth),
  };
}

function parseServices(raw: unknown, settings: Settings): ServiceGroup[] {
  return entries(raw).map(([groupName, list]) => ({
    name: groupName,
    services: entries(list).map(([name, value]): Service => {
      const v = isRecord(value) ? value : {};
      const href = str(v.href);
      const ping =
        v.ping === false
          ? undefined
          : (str(v.ping) ?? (settings.statusCheck || v.ping === true ? href : undefined));
      return {
        id: `${groupName}/${name}`,
        name,
        href,
        description: str(v.description),
        icon: str(v.icon),
        ping,
        target: v.target === "_self" ? "_self" : v.target === "_blank" ? "_blank" : settings.target,
        users: strList(v.users),
        groups: strList(v.groups),
      };
    }),
  }));
}

function parseBookmarks(raw: unknown, settings: Settings): BookmarkGroup[] {
  return entries(raw)
    .map(([groupName, list]) => ({
      name: groupName,
      bookmarks: entries(list)
        .map(([name, value]): Bookmark | null => {
          const v = isRecord(value) ? value : {};
          const href = str(v.href);
          if (!href) return null;
          return {
            id: `${groupName}/${name}`,
            name,
            href,
            icon: str(v.icon),
            target: v.target === "_self" ? "_self" : v.target === "_blank" ? "_blank" : settings.target,
            users: strList(v.users),
            groups: strList(v.groups),
          };
        })
        .filter((b): b is Bookmark => b !== null),
    }))
    .filter((g) => g.bookmarks.length > 0);
}

export async function loadDashboard(): Promise<Dashboard> {
  const settings = parseSettings(await readYaml("settings.yaml"));
  const [servicesRaw, bookmarksRaw, usersRaw] = await Promise.all([
    readYaml("services.yaml"),
    readYaml("bookmarks.yaml"),
    readYaml("users.yaml"),
  ]);
  return {
    settings,
    groups: parseServices(servicesRaw, settings),
    bookmarks: parseBookmarks(bookmarksRaw, settings),
    users: parseUsers(usersRaw),
    configDir: configDir(),
  };
}
