export type UserBackground = {
  image?: string;
  blur: number;
  opacity: number;
};

export const DEFAULT_BACKGROUND_BLUR = 0;
export const DEFAULT_BACKGROUND_OPACITY = 0.35;
export const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024;
export const BACKGROUND_TYPE_ERROR = "Use a png, jpeg, webp, gif, or avif image.";
export const BACKGROUND_SIZE_ERROR = "This image is larger than 8 MB.";
export const BACKGROUND_EMPTY_ERROR = "Choose an image file.";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function imageValue(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function clamped(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

export function backgroundFromRecord(raw: Record<string, unknown> | null | undefined): UserBackground {
  return {
    image: imageValue(raw?.backgroundImage),
    blur: clamped(raw?.backgroundBlur, 0, 40, DEFAULT_BACKGROUND_BLUR),
    opacity: clamped(raw?.backgroundOpacity, 0, 1, DEFAULT_BACKGROUND_OPACITY),
  };
}

export function backgroundFromHome(
  home: { backgroundImage?: string; backgroundBlur?: number; backgroundOpacity?: number } | null | undefined,
): UserBackground {
  return {
    image: home?.backgroundImage,
    blur: home?.backgroundBlur ?? DEFAULT_BACKGROUND_BLUR,
    opacity: home?.backgroundOpacity ?? DEFAULT_BACKGROUND_OPACITY,
  };
}

export function sanitizeBackgroundInput(raw: unknown): UserBackground {
  const rec = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return backgroundFromRecord(rec);
}

export function sameBackground(a: UserBackground, b: UserBackground) {
  return (a.image ?? "") === (b.image ?? "") && a.blur === b.blur && a.opacity === b.opacity;
}

export function backgroundYamlFields(bg: UserBackground): Record<string, string | number> {
  if (bg.image) {
    return {
      backgroundImage: bg.image,
      backgroundBlur: bg.blur,
      backgroundOpacity: bg.opacity,
    };
  }
  const fields: Record<string, number> = {};
  if (bg.blur !== DEFAULT_BACKGROUND_BLUR) fields.backgroundBlur = bg.blur;
  if (bg.opacity !== DEFAULT_BACKGROUND_OPACITY) fields.backgroundOpacity = bg.opacity;
  return fields;
}

// No image returns null. Do not substitute another image.
export function backgroundLayerStyle(bg: UserBackground): {
  backgroundImage: string;
  filter?: string;
  opacity: number;
  transform?: string;
} | null {
  if (!bg.image) return null;
  return {
    // JSON.stringify keeps a quote in the URL inside css url().
    backgroundImage: `url(${JSON.stringify(bg.image)})`,
    filter: bg.blur ? `blur(${bg.blur}px)` : undefined,
    opacity: bg.opacity,
    transform: bg.blur ? "scale(1.05)" : undefined,
  };
}
