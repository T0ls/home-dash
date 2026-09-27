import { headers } from "next/headers";
import { configDir, loadDashboard, usersDir } from "@/lib/config";
import { getCurrentUser } from "@/lib/users";

// Diagnostics for the Authelia → nginx → dashboard chain. It only echoes back
// the caller's own request headers, so it exposes nothing they didn't send.
export async function GET() {
  const h = await headers();
  const { settings, users } = await loadDashboard();
  const { auth } = settings;
  const user = await getCurrentUser(auth, users);

  const expected = Object.fromEntries(Object.values(auth.headers).map((header) => [header, h.get(header)]));
  const forwarded = ["host", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip"];

  const hint = !auth.enabled
    ? "auth.enabled is false in settings.yaml."
    : !h.get(auth.headers.name) && !h.get(auth.headers.user)
      ? "No Authelia identity headers reached the container. Open the dashboard through nginx (not ip:port) and make sure the location block sets proxy_set_header for them."
      : !user?.known
        ? `Headers received, but "${h.get(auth.headers.name) ?? h.get(auth.headers.user)}" does not match any displayName/username in users.yaml.`
        : "OK: user recognized.";

  return Response.json(
    {
      hint,
      user,
      expectedHeaders: expected,
      proxyHeaders: Object.fromEntries(forwarded.map((k) => [k, h.get(k)])),
      configuredUsers: users.map((u) => ({ displayName: u.displayName, username: u.username })),
      paths: { config: configDir(), users: usersDir() },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
