import http from "node:http";
import https from "node:https";
import { loadDashboard } from "@/lib/config";

export type StatusResult = { up: boolean; status?: number; latency?: number; error?: string };

// Uses node:http directly so self-signed certificates (common on homelabs) don't count as "down".
function probe(url: string, timeoutMs = 5000): Promise<StatusResult> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      resolve({ up: false, error: "URL non valido" });
      return;
    }
    const client = target.protocol === "https:" ? https : target.protocol === "http:" ? http : null;
    if (!client) {
      resolve({ up: false, error: "Protocollo non supportato" });
      return;
    }
    const start = performance.now();
    const req = client.request(
      target,
      { method: "GET", timeout: timeoutMs, rejectUnauthorized: false, headers: { "user-agent": "homepage-status" } },
      (res) => {
        res.resume();
        const status = res.statusCode ?? 0;
        resolve({ up: status > 0 && status < 500, status, latency: Math.round(performance.now() - start) });
        req.destroy();
      },
    );
    req.on("timeout", () => req.destroy(new Error("Timeout")));
    req.on("error", (err) => resolve({ up: false, error: err.message }));
    req.end();
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const g = Number(params.get("g"));
  const s = Number(params.get("s"));
  const { groups } = await loadDashboard();
  const service = groups[g]?.services[s];
  if (!service?.ping) {
    return Response.json({ error: "Servizio non trovato o senza controllo di stato" }, { status: 404 });
  }
  return Response.json(await probe(service.ping), { headers: { "cache-control": "no-store" } });
}
