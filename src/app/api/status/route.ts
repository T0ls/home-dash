import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { loadDashboard } from "@/lib/config";

export type StatusResult = {
  up: boolean;
  /** True when the reply is Authelia's portal, not the application. */
  authPortal?: boolean;
  status?: number;
  latency?: number;
  error?: string;
};

const BODY_LIMIT = 8192;

function isAutheliaPortal(body: string) {
  return /SPDX-FileCopyrightText:[^\n]{0,40}Authelia/i.test(body);
}

// GET (not HEAD): Authelia's deny portal answers 200 with an HTML page, so the
// status code alone cannot tell a missing host from a live service.
function probe(url: string, timeoutMs = 8000): Promise<StatusResult> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      resolve({ up: false, error: "Invalid URL" });
      return;
    }
    const client = target.protocol === "https:" ? https : target.protocol === "http:" ? http : null;
    if (!client) {
      resolve({ up: false, error: "Unsupported protocol" });
      return;
    }

    const start = performance.now();
    let settled = false;
    const done = (result: StatusResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const req = client.request(
      target,
      {
        method: "GET",
        timeout: timeoutMs,
        rejectUnauthorized: false,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; HomepageStatus/1.0)",
          accept: "*/*",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const chunks: Buffer[] = [];
        let received = 0;
        const encoding = String(res.headers["content-encoding"] ?? "");

        const finish = () => {
          if (settled) return;
          const latency = Math.round(performance.now() - start);
          let body = Buffer.concat(chunks);
          try {
            if (encoding.includes("gzip")) body = zlib.gunzipSync(body);
            else if (encoding.includes("deflate")) body = zlib.inflateSync(body);
          } catch {
            // Keep the raw bytes; the portal check will simply miss.
          }
          const text = body.toString("utf8");
          if (isAutheliaPortal(text)) {
            done({ up: false, authPortal: true, status, latency });
          } else {
            done({
              up: status > 0 && status < 500,
              status,
              latency,
            });
          }
          res.destroy();
        };

        res.on("data", (chunk: Buffer) => {
          if (received < BODY_LIMIT) chunks.push(chunk);
          received += chunk.length;
          if (received >= BODY_LIMIT && !encoding.includes("gzip") && !encoding.includes("deflate")) finish();
        });
        res.on("end", finish);
        res.on("error", (err) => done({ up: false, error: err.message }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("Timeout")));
    req.on("error", (err) => done({ up: false, error: err.message }));
    req.end();
  });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const { groups } = await loadDashboard();
  const service = groups.flatMap((g) => g.services).find((s) => s.id === id);
  if (!service?.ping) {
    return Response.json({ error: "Service not found or status check disabled" }, { status: 404 });
  }
  return Response.json(await probe(service.ping), { headers: { "cache-control": "no-store" } });
}
