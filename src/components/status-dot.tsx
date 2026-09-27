"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Status = { up: boolean; status?: number; latency?: number; error?: string };

export function StatusDot({ group, index, interval }: { group: number; index: number; interval: number }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/status?g=${group}&s=${index}`, { cache: "no-store" });
        const data = (await res.json()) as Status;
        if (!cancelled) setStatus(res.ok ? data : { up: false, error: data.error });
      } catch {
        if (!cancelled) setStatus({ up: false, error: "Dashboard unreachable" });
      }
    };
    // Stagger the first check so a full page of services doesn't hammer the network at once.
    const delay = setTimeout(check, (group * 3 + index) * 120);
    const id = setInterval(check, interval * 1000);
    return () => {
      cancelled = true;
      clearTimeout(delay);
      clearInterval(id);
    };
  }, [group, index, interval]);

  const label =
    status === null
      ? "Checking…"
      : status.up
        ? `Online · ${status.latency} ms${status.status ? ` · HTTP ${status.status}` : ""}`
        : `Offline${status.error ? ` · ${status.error}` : status.status ? ` · HTTP ${status.status}` : ""}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className="relative flex size-2.5 shrink-0"
        aria-label={label}
        onClick={(e) => e.preventDefault()}
      >
        {status?.up && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2.5 rounded-full",
            status === null && "animate-pulse bg-zinc-500",
            status?.up === true && "bg-emerald-400",
            status?.up === false && "bg-rose-500",
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
