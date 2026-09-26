"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import { uploadBackground } from "@/app/customize/actions";
import {
  BACKGROUND_SIZE_ERROR,
  MAX_BACKGROUND_BYTES,
  backgroundLayerStyle,
  type UserBackground,
} from "@/lib/background";

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-base text-white outline-none placeholder:text-white/35 focus-visible:border-sky-400/50 focus-visible:ring-3 focus-visible:ring-sky-400/30";

export function BackgroundSettings({
  value,
  onChange,
  onError,
  onBusyChange,
}: {
  value: UserBackground;
  onChange: (next: UserBackground) => void;
  onError: (message: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const preview = backgroundLayerStyle(value);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  const fail = (message: string) => {
    setUploadError(message);
    onError(message);
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError(null);
    onError(null);
    if (file.size > MAX_BACKGROUND_BYTES) {
      fail(BACKGROUND_SIZE_ERROR);
      return;
    }
    onBusyChange(true);
    startUpload(async () => {
      try {
        const body = new FormData();
        body.set("file", file);
        const res = await uploadBackground(body);
        if (!res.ok) {
          fail(res.error);
          return;
        }
        setUploadError(null);
        onError(null);
        onChange({ ...value, image: res.image });
      } catch (err) {
        const raw = err instanceof Error ? err.message : "";
        fail(/body exceeded|413/i.test(raw) ? BACKGROUND_SIZE_ERROR : "Could not upload the image. Try again.");
      } finally {
        onBusyChange(false);
      }
    });
  };

  return (
    <section aria-labelledby="background-heading">
      <h2 id="background-heading" className="text-lg font-medium text-white">
        Background
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-white/50">
        Upload an image or paste a URL. Blur 0-40, opacity 0-1. Leave the URL empty for the dark page.
      </p>

      <div className="relative mt-5 h-40 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 sm:h-48">
        {preview && (
          <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={preview} />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,rgba(56,189,248,0.15),transparent),radial-gradient(ellipse_60%_40%_at_90%_10%,rgba(168,85,247,0.12),transparent)]"
        />
        <p className="relative px-4 py-4 text-sm text-white/70">
          {value.image ? "Preview." : "No image. The page stays dark."}
        </p>
      </div>

      <div className="mt-5 grid max-w-xl gap-5">
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-xs font-medium text-white/50">
              Image URL
              <input
                value={value.image ?? ""}
                onChange={(event) => {
                  setUploadError(null);
                  onError(null);
                  onChange({ ...value, image: event.target.value.trim() ? event.target.value : undefined });
                }}
                placeholder="https://images.example.com/photo.jpg"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className={`${fieldClass} mt-1`}
              />
            </label>
            <label
              className={`inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/15 ${uploading ? "pointer-events-none opacity-50" : ""}`}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif,.png,.jpg,.jpeg,.webp,.gif,.avif"
                className="sr-only"
                disabled={uploading}
                aria-label="Upload background image"
                onChange={onFile}
              />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-white/40">png, jpeg, webp, gif, or avif. 8 MB max.</p>
          {uploadError && (
            <p role="alert" className="mt-2 text-sm text-rose-300">
              {uploadError}
            </p>
          )}
        </div>

        <label className="block text-xs font-medium text-white/50">
          <span className="flex items-baseline justify-between gap-3">
            Blur
            <span className="font-normal text-white/70 tabular-nums">{Math.round(value.blur)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={value.blur}
            onChange={(event) => onChange({ ...value, blur: Number(event.target.value) })}
            aria-valuemin={0}
            aria-valuemax={40}
            aria-valuenow={Math.round(value.blur)}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-400"
          />
        </label>

        <label className="block text-xs font-medium text-white/50">
          <span className="flex items-baseline justify-between gap-3">
            Opacity
            <span className="font-normal text-white/70 tabular-nums">{value.opacity.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={value.opacity}
            onChange={(event) =>
              onChange({ ...value, opacity: Math.round(Number(event.target.value) * 100) / 100 })
            }
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={value.opacity}
            aria-valuetext={value.opacity.toFixed(2)}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-400"
          />
        </label>

        {value.image && (
          <button
            type="button"
            onClick={() => onChange({ ...value, image: undefined })}
            className="w-fit text-sm text-sky-400 transition hover:text-sky-300"
          >
            Remove image
          </button>
        )}
      </div>
    </section>
  );
}
