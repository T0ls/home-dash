"use server";

import { revalidatePath } from "next/cache";
import { loadDashboard } from "@/lib/config";
import { getCurrentUser } from "@/lib/users";
import { deleteUserHome, filterByAccess, writeUserHome } from "@/lib/user-home";
import { log } from "@/lib/log";

export type SaveResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const dashboard = await loadDashboard();
  const user = await getCurrentUser(dashboard.settings.auth, dashboard.users);
  if (!user?.slug) return { dashboard, user: null, slug: null as string | null };
  return { dashboard, user, slug: user.slug };
}

function mergeOrder(preferred: string[] | undefined, available: string[], shown: string[]) {
  const availableSet = new Set(available);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of preferred ?? [...shown, ...available.filter((x) => !shown.includes(x))]) {
    if (!availableSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of available) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function saveHome(selection: {
  /** Visible services in display order */
  services: string[];
  bookmarks: string[];
  /** Full drag order (visible + hidden) when the form saved */
  orderServices?: string[];
  orderBookmarks?: string[];
  /** All ids the user was allowed to see when the form loaded (used to compute hidden) */
  availableServices: string[];
  availableBookmarks: string[];
}): Promise<SaveResult> {
  try {
    const { dashboard, user, slug } = await requireUser();
    if (!slug || !user) return { ok: false, error: "You need to be signed in and listed in users.yaml." };

    const allowed = filterByAccess(dashboard.groups, dashboard.bookmarks, user);
    const allowedServices = new Set(allowed.groups.flatMap((g) => g.services.map((s) => s.id)));
    const allowedBookmarks = new Set(allowed.bookmarks.flatMap((g) => g.bookmarks.map((b) => b.id)));

    // Only trust ids the user is allowed to see.
    const availableServices = selection.availableServices.filter((id) => allowedServices.has(id));
    const availableBookmarks = selection.availableBookmarks.filter((id) => allowedBookmarks.has(id));
    const shownServices = selection.services.filter((id) => allowedServices.has(id));
    const shownBookmarks = selection.bookmarks.filter((id) => allowedBookmarks.has(id));
    const shownS = new Set(shownServices);
    const shownB = new Set(shownBookmarks);

    await writeUserHome(slug, {
      // Only hide what the user turned off among services they already knew about —
      // anything added later is absent from this list and appears automatically.
      hiddenServices: availableServices.filter((id) => !shownS.has(id)),
      hiddenBookmarks: availableBookmarks.filter((id) => !shownB.has(id)),
      orderServices: mergeOrder(selection.orderServices, availableServices, shownServices),
      orderBookmarks: mergeOrder(selection.orderBookmarks, availableBookmarks, shownBookmarks),
    });
    revalidatePath("/");
    revalidatePath("/customize");
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
    revalidatePath("/customize");
    return { ok: true };
  } catch (err) {
    log.error("users", `reset failed: ${(err as Error).message}`, false);
    return { ok: false, error: `Could not reset: ${(err as Error).message}` };
  }
}
