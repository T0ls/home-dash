"use server";

import { revalidatePath } from "next/cache";
import { loadDashboard } from "@/lib/config";
import { getCurrentUser } from "@/lib/users";
import { deleteUserHome, writeUserHome } from "@/lib/user-home";
import { log } from "@/lib/log";

export type SaveResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const dashboard = await loadDashboard();
  const user = await getCurrentUser(dashboard.settings.auth, dashboard.users);
  if (!user?.slug) return { dashboard, slug: null };
  return { dashboard, slug: user.slug };
}

export async function saveHome(selection: { services: string[]; bookmarks: string[] }): Promise<SaveResult> {
  try {
    const { dashboard, slug } = await requireUser();
    if (!slug) return { ok: false, error: "You need to be signed in and listed in users.yaml." };

    const serviceIds = new Set(dashboard.groups.flatMap((g) => g.services.map((s) => s.id)));
    const bookmarkIds = new Set(dashboard.bookmarks.flatMap((g) => g.bookmarks.map((b) => b.id)));

    await writeUserHome(slug, {
      // Keep the order the client sent (from drag-and-drop); drop anything not in the general config.
      services: selection.services.filter((id) => serviceIds.has(id)),
      bookmarks: selection.bookmarks.filter((id) => bookmarkIds.has(id)),
    });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    log.error("users", `save failed: ${(err as Error).message}`, false);
    return { ok: false, error: `Could not save: ${(err as Error).message}` };
  }
}

export async function resetHome(): Promise<SaveResult> {
  try {
    const { slug } = await requireUser();
    if (!slug) return { ok: false, error: "You need to be signed in and listed in users.yaml." };
    await deleteUserHome(slug);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    log.error("users", `reset failed: ${(err as Error).message}`, false);
    return { ok: false, error: `Could not reset: ${(err as Error).message}` };
  }
}
