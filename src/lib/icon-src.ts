const EMOJI = /\p{Extended_Pictographic}/u;
const SLUG = /^[a-z0-9-]+$/;

export function isEmojiIcon(icon: string) {
  return EMOJI.test(icon) && !/^[\w.-]+$/.test(icon);
}

export function cdnIconTarget(icon: string): { url: string; file: string } | null {
  const raw = icon.trim();
  if (raw.startsWith("si-")) {
    const slug = raw
      .slice(3)
      .replace(/\.(svg|png|webp)$/i, "")
      .toLowerCase();
    if (!SLUG.test(slug)) return null;
    return {
      url: `https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/${slug}.svg`,
      file: `si-${slug}.svg`,
    };
  }
  const ext = raw.includes(".") ? raw.slice(raw.lastIndexOf(".")).toLowerCase() : "";
  if (ext && ext !== ".svg" && ext !== ".png" && ext !== ".webp") return null;
  const slug = raw.replace(/\.(svg|png|webp)$/i, "").toLowerCase();
  if (!SLUG.test(slug)) return null;
  return {
    url: `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${slug}.svg`,
    file: `dash-${slug}.svg`,
  };
}

export function iconImageSrc(icon: string | undefined): string | null {
  if (!icon) return null;
  if (isEmojiIcon(icon)) return null;
  if (/^(https?:)?\/\//.test(icon) || icon.startsWith("/")) return icon;
  return `/api/icon?name=${encodeURIComponent(icon)}`;
}
