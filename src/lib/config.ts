import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";

export type Service = {
  name: string;
  href?: string;
  description?: string;
  icon?: string;
  ping?: string;
  target: "_blank" | "_self";
};

export type ServiceGroup = {
  name: string;
  services: Service[];
};

export type Settings = {
  title: string;
  subtitle?: string;
  columns: number;
  target: "_blank" | "_self";
  statusCheck: boolean;
  statusInterval: number;
  showClock: boolean;
};

export type Dashboard = {
  settings: Settings;
  groups: ServiceGroup[];
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
  subtitle: "I tuoi servizi, a portata di clic.",
  columns: 4,
  target: "_blank",
  statusCheck: true,
  statusInterval: 60,
  showClock: true,
};

export function configDir() {
  return path.resolve(process.env.CONFIG_DIR ?? path.join(process.cwd(), "config"));
}

function defaultsDir() {
  return path.resolve(process.env.DEFAULTS_DIR ?? path.join(process.cwd(), "config"));
}

async function readYaml(file: string): Promise<unknown> {
  const full = path.join(configDir(), file);
  let raw: string;
  try {
    raw = await fs.readFile(full, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    // First start with an empty mounted volume: seed it with the bundled examples.
    const fallback = path.join(defaultsDir(), file);
    if (fallback === full) return null;
    try {
      raw = await fs.readFile(fallback, "utf8");
    } catch {
      return null;
    }
    await fs.mkdir(configDir(), { recursive: true }).catch(() => {});
    await fs.writeFile(full, raw).catch(() => {});
  }
  try {
    return YAML.parse(raw);
  } catch (err) {
    throw new ConfigError((err as Error).message, file);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// Accepts both a list of single-key maps (homepage style) and a plain map.
function entries(v: unknown): [string, unknown][] {
  if (Array.isArray(v)) return v.filter(isRecord).flatMap((item) => Object.entries(item));
  if (isRecord(v)) return Object.entries(v);
  return [];
}

function parseSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  const columns = Number(raw.columns);
  const interval = Number(raw.statusInterval);
  return {
    title: str(raw.title) ?? DEFAULT_SETTINGS.title,
    subtitle: raw.subtitle === null ? undefined : (str(raw.subtitle) ?? DEFAULT_SETTINGS.subtitle),
    columns: Number.isFinite(columns) ? Math.min(6, Math.max(1, Math.round(columns))) : DEFAULT_SETTINGS.columns,
    target: raw.target === "_self" ? "_self" : "_blank",
    statusCheck: raw.statusCheck === undefined ? DEFAULT_SETTINGS.statusCheck : Boolean(raw.statusCheck),
    statusInterval: Number.isFinite(interval) && interval >= 5 ? interval : DEFAULT_SETTINGS.statusInterval,
    showClock: raw.showClock === undefined ? DEFAULT_SETTINGS.showClock : Boolean(raw.showClock),
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
        name,
        href,
        description: str(v.description),
        icon: str(v.icon),
        ping,
        target: v.target === "_self" ? "_self" : v.target === "_blank" ? "_blank" : settings.target,
      };
    }),
  }));
}

export async function loadDashboard(): Promise<Dashboard> {
  const settings = parseSettings(await readYaml("settings.yaml"));
  const groups = parseServices(await readYaml("services.yaml"), settings);
  return { settings, groups, configDir: configDir() };
}
