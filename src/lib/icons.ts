import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/config";
import { cdnIconTarget } from "@/lib/icon-src";
import { log } from "@/lib/log";

const LOCAL_EXT = [".svg", ".png", ".webp", ".jpg", ".jpeg", ".gif", ".ico", ".avif"];
const MAX_BYTES = 2_000_000;

const g = globalThis as typeof globalThis & { __homedashIconFetch?: Map<string, Promise<string | null>> };
const inflight = (g.__homedashIconFetch ??= new Map());

export function iconsDir() {
  return path.join(dataDir(), "icons");
}

export function iconCacheDir() {
  return path.join(dataDir(), "cache", "icons");
}

function safeName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("\0")) return null;
  if (trimmed === "." || trimmed === "..") return null;
  if (!/^[\p{L}\p{N}._ -]+$/u.test(trimmed)) return null;
  return trimmed;
}

async function isFile(file: string) {
  try {
    const stat = await fs.stat(/*turbopackIgnore: true*/ file);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function findLocalIcon(name: string) {
  const safe = safeName(name);
  if (!safe) return null;
  const root = iconsDir();
  const exact = path.join(root, safe);
  if (await isFile(exact)) return exact;
  if (path.extname(safe)) return null;
  for (const ext of LOCAL_EXT) {
    const candidate = path.join(root, safe + ext);
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

async function download(url: string, dest: string) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
  if (res.status !== 200) return false;
  const host = new URL(res.url).hostname;
  if (host !== "cdn.jsdelivr.net" && !host.endsWith(".jsdelivr.net")) return false;
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("image/") && !type.includes("svg")) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) return false;
  const head = buf.subarray(0, 64).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return false;
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.tmp`;
  await fs.writeFile(/*turbopackIgnore: true*/ tmp, buf);
  await fs.rename(/*turbopackIgnore: true*/ tmp, dest);
  return true;
}

async function ensureCached(fileName: string, url: string) {
  const dest = path.join(iconCacheDir(), fileName);
  if (await isFile(dest)) return dest;
  const pending = inflight.get(dest);
  if (pending) return pending;
  const job = (async () => {
    try {
      const ok = await download(url, dest);
      if (!ok) return null;
      log.info("icons", `cached ${fileName} from ${url}`);
      return dest;
    } catch (err) {
      log.warn("icons", `could not cache ${fileName}: ${(err as Error).message}`);
      return null;
    } finally {
      inflight.delete(dest);
    }
  })();
  inflight.set(dest, job);
  return job;
}

export async function resolveIconFile(name: string, cacheIcons: boolean) {
  const local = await findLocalIcon(name);
  if (local) return { kind: "file" as const, path: local };
  const cdn = cdnIconTarget(name);
  if (!cdn) return { kind: "missing" as const };
  if (!cacheIcons) return { kind: "redirect" as const, url: cdn.url };
  const cached = await ensureCached(cdn.file, cdn.url);
  if (!cached) return { kind: "missing" as const };
  return { kind: "file" as const, path: cached };
}
