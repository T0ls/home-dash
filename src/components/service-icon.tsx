"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const EMOJI = /\p{Extended_Pictographic}/u;

function resolve(icon: string): string | null {
  if (/^(https?:)?\/\//.test(icon) || icon.startsWith("/")) return icon;
  if (icon.startsWith("si-")) return `https://cdn.simpleicons.org/${icon.slice(3)}/white`;
  const name = icon.replace(/\.(png|svg|webp)$/, "");
  return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${name}.svg`;
}

function initials(name: string) {
  const parts = name.split(/[\s\-_.]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export function ServiceIcon({ icon, name, className }: { icon?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const base = cn(
    "flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10",
    className,
  );

  if (icon && EMOJI.test(icon) && !/^[\w-]+$/.test(icon)) {
    return <div className={cn(base, "text-2xl")}>{icon}</div>;
  }

  const src = icon ? resolve(icon) : null;
  if (!src || failed) {
    return <div className={cn(base, "text-sm font-semibold text-white/70")}>{initials(name)}</div>;
  }

  return (
    <div className={base}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-[65%] object-contain" loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}
