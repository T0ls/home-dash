import path from "node:path";
import {
  BACKGROUND_EMPTY_ERROR,
  BACKGROUND_SIZE_ERROR,
  BACKGROUND_TYPE_ERROR,
  MAX_BACKGROUND_BYTES,
} from "@/lib/background";

export const BACKGROUND_KINDS = ["png", "jpg", "webp", "gif", "avif"] as const;
export type BackgroundKind = (typeof BACKGROUND_KINDS)[number];

const KIND_SET = new Set<string>(BACKGROUND_KINDS);

export function isSafeUserSlug(slug: string) {
  if (slug === "." || slug === "..") return false;
  if (slug.includes("/") || slug.includes("\\") || slug.includes("\0")) return false;
  return /^[a-z0-9][a-z0-9._-]{0,80}$/.test(slug);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  let out = "";
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i] ?? 0);
  return out;
}

function isAvif(bytes: Uint8Array) {
  if (bytes.length < 12) return false;
  if (ascii(bytes, 4, 8) !== "ftyp") return false;
  const box = ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  const end = Math.min(bytes.length, box >= 16 ? box : 32, 64);
  for (let i = 8; i + 4 <= end; i += 4) {
    const brand = ascii(bytes, i, i + 4);
    if (brand === "avif" || brand === "avis") return true;
  }
  return false;
}

export function detectBackgroundKind(bytes: Uint8Array): BackgroundKind | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) return "gif";
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "webp";
  if (isAvif(bytes)) return "avif";
  return null;
}

export function classifyBackgroundUpload(bytes: Uint8Array):
  | { ok: true; kind: BackgroundKind }
  | { ok: false; error: string } {
  if (bytes.byteLength === 0) return { ok: false, error: BACKGROUND_EMPTY_ERROR };
  if (bytes.byteLength > MAX_BACKGROUND_BYTES) return { ok: false, error: BACKGROUND_SIZE_ERROR };
  const kind = detectBackgroundKind(bytes);
  if (!kind) return { ok: false, error: BACKGROUND_TYPE_ERROR };
  return { ok: true, kind };
}

export function backgroundContentType(kind: BackgroundKind) {
  if (kind === "jpg") return "image/jpeg";
  return `image/${kind}`;
}

// The name is fixed. The upload's original filename is never used.
export function backgroundFileName(kind: BackgroundKind) {
  if (!KIND_SET.has(kind)) throw new Error("Invalid background path");
  return `background.${kind}`;
}

export function resolveBackgroundFile(userDirectory: string, kind: BackgroundKind) {
  const name = backgroundFileName(kind);
  const dir = path.resolve(userDirectory);
  const file = path.resolve(dir, name);
  if (path.dirname(file) !== dir || path.basename(file) !== name) {
    throw new Error("Invalid background path");
  }
  return file;
}

export function backgroundPublicUrl(version: number) {
  const v = Number.isFinite(version) ? Math.floor(version) : Date.now();
  return `/api/background?v=${v}`;
}
