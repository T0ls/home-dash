import { promises as fs } from "node:fs";
import { configDir, dataDir, loadDashboard, usersDir } from "@/lib/config";
import { iconCacheDir, iconsDir } from "@/lib/icons";
import { log } from "@/lib/log";

async function writable(dir: string) {
  try {
    await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
    await fs.access(/*turbopackIgnore: true*/ dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function logStartup() {
  const uid = typeof process.getuid === "function" ? process.getuid() : "?";
  log.info("startup", `data folder ${dataDir()} (running as uid ${uid})`, false);

  const fix = `fix on the host with: chown -R ${uid}:${uid} <folder mapped to ${dataDir()}>`;
  if (!(await writable(configDir()))) {
    log.warn("startup", `${configDir()} is not writable, missing config files can't be created; ${fix}`, false);
  }
  if (!(await writable(usersDir()))) {
    log.warn("startup", `${usersDir()} is not writable, personal homes can't be saved; ${fix}`, false);
  }
  if (!(await writable(iconsDir()))) {
    log.warn("startup", `${iconsDir()} is not writable, custom icon files can't be added; ${fix}`, false);
  }

  try {
    const { settings, groups, users } = await loadDashboard();
    const services = groups.reduce((n, g) => n + g.services.length, 0);
    const loaded = `loaded ${configDir()} ("${settings.title}"): ${services} services in ${groups.length} groups`;
    if (settings.singleUser) {
      log.info("config", loaded, false);
    } else {
      log.info("config", `${loaded}, ${users.length} users`, false);
      if (users.length) {
        log.info(
          "config",
          `users: ${users.map((u) => (u.username ? `${u.displayName} (${u.username})` : u.displayName)).join(", ")}`,
          false,
        );
      }
      const seen = new Map<string, number>();
      for (const u of users) {
        const key = u.displayName.trim().toLowerCase();
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      for (const u of users) {
        if ((seen.get(u.displayName.trim().toLowerCase()) ?? 0) > 1 && !u.username) {
          log.warn(
            "config",
            `displayName "${u.displayName}" is shared by more than one user; set username for each`,
            false,
          );
        }
      }
    }
    if (settings.cacheIcons) {
      if (await writable(iconCacheDir())) {
        log.info("config", `icon cache on, files in ${iconCacheDir()}`, false);
      } else {
        log.warn("config", `cacheIcons is on but ${iconCacheDir()} is not writable; ${fix}`, false);
      }
    } else {
      log.info("config", `icon cache off, custom icons from ${iconsDir()}`, false);
    }
    if (settings.singleUser) {
      log.info("auth", `single-user mode, headers ignored, home is ${usersDir()}/local`, false);
    } else if (settings.auth.enabled) {
      const h = settings.auth.headers;
      log.info("auth", `identity headers ${h.name} / ${h.user} / ${h.email} / ${h.groups}`, false);
    } else {
      log.info("auth", "auth.enabled is false, showing Guest", false);
    }
  } catch (err) {
    log.error("config", (err as Error).message, false);
  }
}
