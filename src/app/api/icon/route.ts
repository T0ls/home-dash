import { promises as fs } from "node:fs";
import path from "node:path";
import { loadSettings } from "@/lib/config";
import { resolveIconFile } from "@/lib/icons";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
};

function fileResponse(bytes: Buffer, file: string) {
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=60",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
  if (!name || name.length > 200) return new Response("Missing icon name", { status: 400 });

  let cacheIcons = false;
  try {
    cacheIcons = (await loadSettings()).cacheIcons;
  } catch {
    cacheIcons = false;
  }

  const resolved = await resolveIconFile(name, cacheIcons);
  if (resolved.kind === "redirect") {
    return new Response(null, {
      status: 302,
      headers: { location: resolved.url, "cache-control": "no-store" },
    });
  }
  if (resolved.kind === "missing") return new Response("Icon not found", { status: 404 });

  try {
    const bytes = await fs.readFile(/*turbopackIgnore: true*/ resolved.path);
    return fileResponse(bytes, resolved.path);
  } catch {
    return new Response("Icon not found", { status: 404 });
  }
}
