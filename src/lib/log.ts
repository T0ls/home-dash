type Level = "INFO" | "WARN" | "ERROR";

// Shared via globalThis: instrumentation and route bundles load separate copies of this module.
const g = globalThis as typeof globalThis & { __homedashLogRecent?: Map<string, number> };
const recent = (g.__homedashLogRecent ??= new Map<string, number>());
const DEDUPE_MS = 5 * 60_000;

function stamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function write(level: Level, tag: string, message: string, dedupe: boolean) {
  const line = `${stamp()} ${level.padEnd(5)} [${tag}] ${message}`;
  if (dedupe) {
    const key = `${level}|${tag}|${message}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_MS) return;
    recent.set(key, now);
    if (recent.size > 500) recent.clear();
  }
  (level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log)(line);
}

/** One-line, human-readable logs for `docker compose logs`. Repeated identical lines are throttled. */
export const log = {
  info: (tag: string, message: string, dedupe = true) => write("INFO", tag, message, dedupe),
  warn: (tag: string, message: string, dedupe = true) => write("WARN", tag, message, dedupe),
  error: (tag: string, message: string, dedupe = true) => write("ERROR", tag, message, dedupe),
};
