"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Status = { up: boolean; authPortal?: boolean; status?: number; latency?: number; error?: string };

type ScanContextValue = {
  nonce: number;
  scanning: boolean;
  dotCount: number;
  requestScan: () => void;
  register: () => () => void;
  markDone: (nonce: number) => void;
};

const ScanContext = createContext<ScanContextValue | null>(null);

export function StatusScanProvider({ children }: { children: React.ReactNode }) {
  const [nonce, setNonce] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [dotCount, setDotCount] = useState(0);
  const dots = useRef(0);
  const finished = useRef(0);
  const activeNonce = useRef(0);

  const register = useCallback(() => {
    dots.current += 1;
    setDotCount(dots.current);
    return () => {
      dots.current = Math.max(0, dots.current - 1);
      setDotCount(dots.current);
    };
  }, []);

  const markDone = useCallback((doneFor: number) => {
    if (doneFor !== activeNonce.current) return;
    finished.current += 1;
    if (finished.current >= dots.current) setScanning(false);
  }, []);

  const requestScan = useCallback(() => {
    if (dots.current === 0) return;
    const next = activeNonce.current + 1;
    activeNonce.current = next;
    finished.current = 0;
    setScanning(true);
    setNonce(next);
  }, []);

  const value = useMemo(
    () => ({ nonce, scanning, dotCount, requestScan, register, markDone }),
    [nonce, scanning, dotCount, requestScan, register, markDone],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function ScanStatusButton() {
  const scan = useContext(ScanContext);
  if (!scan) return null;
  return (
    <button
      type="button"
      onClick={scan.requestScan}
      disabled={scan.scanning || scan.dotCount === 0}
      aria-label="Check status"
      className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-60"
    >
      <RefreshCw className={cn("size-4", scan.scanning && "animate-spin")} />
      <span className="hidden sm:inline">{scan.scanning ? "Checking…" : "Check status"}</span>
    </button>
  );
}

export function StatusDot({ id, order, interval }: { id: string; order: number; interval: number }) {
  const scan = useContext(ScanContext);
  const [status, setStatus] = useState<Status | null>(null);
  const [seenNonce, setSeenNonce] = useState(0);
  const seq = useRef(0);
  const manualNonce = scan?.nonce ?? 0;
  const shown: Status | null = manualNonce > seenNonce ? null : status;
  const register = scan?.register;
  const epoch = useRef({ n: 0 }).current;

  useEffect(() => {
    if (!register) return;
    return register();
  }, [register]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const mine = ++seq.current;
      try {
        const res = await fetch(`/api/status?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = (await res.json()) as Status;
        if (!cancelled && seq.current === mine) setStatus(res.ok ? data : { up: false, error: data.error });
      } catch {
        if (!cancelled && seq.current === mine) setStatus({ up: false, error: "Dashboard unreachable" });
      }
    };
    // Stagger the first check so a full page of services doesn't hammer the network at once.
    const delay = setTimeout(check, order * 120);
    const timer = setInterval(check, interval * 1000);
    return () => {
      cancelled = true;
      clearTimeout(delay);
      clearInterval(timer);
    };
  }, [id, order, interval]);

  const markDone = scan?.markDone;
  useEffect(() => {
    if (!markDone || manualNonce === 0) return;
    let cancelled = false;
    let settled = false;
    const nonce = manualNonce;
    const mineAttempt = ++epoch.n;
    const finish = () => {
      if (settled) return;
      settled = true;
      markDone(nonce);
    };
    const mine = ++seq.current;
    const delay = setTimeout(async () => {
      try {
        const res = await fetch(`/api/status?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = (await res.json()) as Status;
        if (!cancelled && seq.current === mine) {
          setStatus(res.ok ? data : { up: false, error: data.error });
        }
      } catch {
        if (!cancelled && seq.current === mine) {
          setStatus({ up: false, error: "Dashboard unreachable" });
        }
      } finally {
        if (!cancelled) setSeenNonce(nonce);
        finish();
      }
    }, order * 40);
    return () => {
      cancelled = true;
      clearTimeout(delay);
      // A strict-mode remount, or a newer scan, bumps attempt before this runs.
      queueMicrotask(() => {
        if (epoch.n === mineAttempt) finish();
      });
    };
    // epoch.n is a generation counter shared with the cleanup; it must not retrigger the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualNonce, markDone, id, order]);

  const label =
    shown === null
      ? "Checking…"
      : shown.authPortal
        ? `Authelia portal · service not checked${shown.status ? ` · HTTP ${shown.status}` : ""}`
        : shown.up
          ? `Online · ${shown.latency} ms${shown.status ? ` · HTTP ${shown.status}` : ""}`
          : `Offline${shown.error ? ` · ${shown.error}` : shown.status ? ` · HTTP ${shown.status}` : ""}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className="relative flex size-2.5 shrink-0"
        aria-label={label}
        onClick={(e) => e.preventDefault()}
      >
        {shown?.up && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2.5 rounded-full",
            shown === null && "animate-pulse bg-zinc-500",
            shown?.authPortal && "bg-amber-400",
            shown?.up === true && "bg-emerald-400",
            shown?.up === false && !shown.authPortal && "bg-rose-500",
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
