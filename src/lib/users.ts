import "server-only";
import { headers } from "next/headers";
import type { AuthSettings } from "@/lib/config";
import { log } from "@/lib/log";

export type UserConfig = {
  displayName: string;
  username?: string;
  email?: string;
  avatar?: string;
  role?: string;
};

export type CurrentUser = {
  displayName: string;
  username?: string;
  email?: string;
  groups: string[];
  avatar?: string;
  role?: string;
  /** false when Authelia sent a user that is not listed in users.yaml */
  known: boolean;
  /** true when the identity comes from DEV_REMOTE_* env vars instead of real headers */
  mock: boolean;
  /** folder name under users/, only for users listed in users.yaml */
  slug?: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function parseUsers(raw: unknown): UserConfig[] {
  const list = isRecord(raw) ? raw.users : raw;
  if (!Array.isArray(list)) return [];
  return list
    .filter(isRecord)
    .map((u) => ({
      displayName: str(u.displayName) ?? str(u.displayname) ?? "",
      username: str(u.username),
      email: str(u.email),
      avatar: str(u.avatar),
      role: str(u.role),
    }))
    .filter((u) => u.displayName);
}

// Node exposes header values as latin1; nginx forwards Authelia's UTF-8 bytes untouched,
// so names like "Niccolò" arrive as "NiccolÃ²" unless re-decoded.
function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/[\u0080-\u00ff]/.test(trimmed)) return trimmed;
  const decoded = Buffer.from(trimmed, "latin1").toString("utf8");
  return decoded.includes("\ufffd") ? trimmed : decoded;
}

/** Folder name for a user: Authelia username when available, otherwise a slug of the display name. */
export function userSlug(user: { username?: string; displayName: string }) {
  const base = (user.username ?? user.displayName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return base || "user";
}

const norm = (s?: string) => s?.normalize("NFC").trim().toLowerCase();

export async function getCurrentUser(auth: AuthSettings, users: UserConfig[]): Promise<CurrentUser | null> {
  if (!auth.enabled) return null;

  const h = await headers();
  let name = decodeHeader(h.get(auth.headers.name));
  let username = decodeHeader(h.get(auth.headers.user));
  let email = decodeHeader(h.get(auth.headers.email));
  let groupsRaw = decodeHeader(h.get(auth.headers.groups));
  let mock = false;

  if (!name && !username && process.env.NODE_ENV !== "production") {
    name = process.env.DEV_REMOTE_NAME;
    username = process.env.DEV_REMOTE_USER;
    email = process.env.DEV_REMOTE_EMAIL;
    groupsRaw = process.env.DEV_REMOTE_GROUPS;
    mock = Boolean(name || username);
  }

  const from = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const via = `host=${h.get("host") ?? "?"} from=${from}`;

  if (!name && !username) {
    log.warn(
      "auth",
      `no identity headers (${auth.headers.name}, ${auth.headers.user}) on ${via} → showing Guest. ` +
        "Open the dashboard through nginx (not ip:port) and check proxy_set_header in its location block.",
    );
    return null;
  }

  const groups = (groupsRaw ?? "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  // Username is unique in Authelia while display names can repeat, so it wins when both are present.
  const byUsername = username ? users.find((u) => u.username && norm(u.username) === norm(username)) : undefined;
  const byName = name
    ? users.filter((u) => norm(u.displayName) === norm(name) && (!username || !u.username))
    : [];
  const match = byUsername ?? (byName.length === 1 ? byName[0] : undefined);
  if (!byUsername && byName.length > 1) {
    log.warn(
      "auth",
      `"${name}" matches ${byName.length} users in users.yaml and no ${auth.headers.user} header was received to tell them apart`,
    );
  }

  const who = `"${name ?? ""}"${username ? ` (user: ${username})` : ""}`;
  if (mock) log.info("auth", `${who} simulated via DEV_REMOTE_* env vars`);
  else if (match) log.info("auth", `${who} recognized as ${match.displayName} [${via}]`);
  else
    log.warn(
      "auth",
      `${who} sent by Authelia but not found in users.yaml (known: ${users.map((u) => u.displayName).join(", ") || "none"}) [${via}]`,
    );

  return {
    slug: match ? userSlug({ username: match.username ?? username, displayName: match.displayName }) : undefined,
    displayName: match?.displayName ?? name ?? username!,
    username: username ?? match?.username,
    email: email ?? match?.email,
    groups,
    avatar: match?.avatar,
    role: match?.role,
    known: Boolean(match),
    mock,
  };
}
