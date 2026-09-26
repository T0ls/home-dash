"use client";

import { useState } from "react";
import { iconImageSrc, isEmojiIcon } from "@/lib/icon-src";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.split(/[\s\-_.]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export function ServiceIcon({ icon, name, className }: { icon?: string; name: string; className?: string }) {
  const src = icon ? iconImageSrc(icon) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const base = cn(
    "flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10",
    className,
  );

  if (icon && isEmojiIcon(icon)) {
    return <div className={cn(base, "text-2xl")}>{icon}</div>;
  }

  if (!src || failedSrc === src) {
    return <div className={cn(base, "text-sm font-semibold text-white/70")}>{initials(name)}</div>;
  }

  return (
    <div className={base}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={cn("size-[65%] object-contain", icon?.startsWith("si-") && "brightness-0 invert")}
        loading="lazy"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
