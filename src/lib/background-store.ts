import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { BACKGROUND_EMPTY_ERROR, BACKGROUND_SIZE_ERROR, MAX_BACKGROUND_BYTES } from "@/lib/background";
import {
  BACKGROUND_KINDS,
  backgroundFileName,
  backgroundPublicUrl,
  classifyBackgroundUpload,
  isSafeUserSlug,
  resolveBackgroundFile,
} from "@/lib/background-image";
import { usersDir } from "@/lib/config";
import { log } from "@/lib/log";
import { ensureUserDir, userDir } from "@/lib/user-home";

export class BackgroundUploadError extends Error {}

const FILE_NAMES = new Set(BACKGROUND_KINDS.map((kind) => backgroundFileName(kind)));

export function backgroundDir(slug: string) {
  if (!isSafeUserSlug(slug)) throw new BackgroundUploadError("Invalid user folder");
  const root = path.resolve(usersDir());
  const dir = path.resolve(userDir(slug));
  if (dir !== path.resolve(root, slug) || path.dirname(dir) !== root) {
    throw new BackgroundUploadError("Invalid user folder");
  }
  return dir;
}

function tempBackgroundPath(dir: string) {
  const file = path.resolve(dir, `.background-${process.pid}-${Date.now()}.tmp`);
  if (path.dirname(file) !== dir) throw new BackgroundUploadError("Invalid background path");
  return file;
}

export async function saveUserBackground(slug: string, input: unknown) {
  if (!(input instanceof Blob) || input.size === 0) throw new BackgroundUploadError(BACKGROUND_EMPTY_ERROR);
  if (input.size > MAX_BACKGROUND_BYTES) throw new BackgroundUploadError(BACKGROUND_SIZE_ERROR);

  const dir = backgroundDir(slug);
  const bytes = Buffer.from(await input.arrayBuffer());
  const classified = classifyBackgroundUpload(bytes);
  if (!classified.ok) throw new BackgroundUploadError(classified.error);

  await ensureUserDir(slug);
  const dest = resolveBackgroundFile(dir, classified.kind);
  const tmp = tempBackgroundPath(dir);
  try {
    await fs.writeFile(/*turbopackIgnore: true*/ tmp, bytes, { flag: "wx" });
    await fs.rename(/*turbopackIgnore: true*/ tmp, dest);
    for (const name of FILE_NAMES) {
      if (name === path.basename(dest)) continue;
      await fs.rm(/*turbopackIgnore: true*/ path.join(dir, name), { force: true });
    }
  } catch (err) {
    await fs.rm(/*turbopackIgnore: true*/ tmp, { force: true }).catch(() => {});
    throw err;
  }

  const stat = await fs.stat(/*turbopackIgnore: true*/ dest);
  log.info("users", `${slug} uploaded background image (${classified.kind}, ${bytes.length} bytes)`, false);
  return { image: backgroundPublicUrl(stat.mtimeMs) };
}

export async function deleteUserBackground(slug: string) {
  const dir = backgroundDir(slug);
  for (const name of FILE_NAMES) {
    await fs.rm(/*turbopackIgnore: true*/ path.join(dir, name), { force: true });
  }
}

export async function readUserBackground(slug: string) {
  const dir = backgroundDir(slug);
  let newest: { file: string; mtimeMs: number } | null = null;
  for (const name of FILE_NAMES) {
    const file = path.join(dir, name);
    try {
      const stat = await fs.lstat(/*turbopackIgnore: true*/ file);
      if (!stat.isFile()) continue;
      if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { file, mtimeMs: stat.mtimeMs };
    } catch {
      continue;
    }
  }
  if (!newest) return null;

  let handle: fs.FileHandle;
  try {
    handle = await fs.open(
      /*turbopackIgnore: true*/ newest.file,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ELOOP") return null;
    throw err;
  }
  try {
    const bytes = Buffer.from(await handle.readFile());
    const classified = classifyBackgroundUpload(bytes);
    if (!classified.ok || backgroundFileName(classified.kind) !== path.basename(newest.file)) return null;
    return { bytes, kind: classified.kind };
  } finally {
    await handle.close();
  }
}
