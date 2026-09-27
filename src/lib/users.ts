import "server-only";
import { headers } from "next/headers";
import type { AuthSettings } from "@/lib/config";

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

  if (!name && !username) return null;

  const groups = (groupsRaw ?? "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  const match =
    users.find((u) => name && norm(u.displayName) === norm(name)) ??
    users.find((u) => username && u.username && norm(u.username) === norm(username));

  return {
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
