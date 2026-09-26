"use server";

import { revalidatePath } from "next/cache";
import { backgroundFromHome, sanitizeBackgroundInput } from "@/lib/background";
import { BackgroundUploadError, deleteUserBackground, saveUserBackground } from "@/lib/background-store";
import { loadDashboard } from "@/lib/config";
import { getCurrentUser } from "@/lib/users";
import { sanitizeUserBookmarks } from "@/lib/user-bookmarks";
import { deleteUserHome, filterByAccess, readUserHome, writeUserHome } from "@/lib/user-home";
import { log } from "@/lib/log";

export type SaveResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const dashboard = await loadDashboard();
  const user = await getCurrentUser(dashboard.settings.auth, dashboard.users, dashboard.settings.singleUser);
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
  services: string[];
  orderServices?: string[];
  orderGroups?: string[];
  availableServices: string[];
  customBookmarks?: unknown;
  background?: unknown;
}): Promise<SaveResult> {
  try {
    const { dashboard, user, slug } = await requireUser();
    if (!slug || !user) return { ok: false, error: "You need to be signed in and listed in users.yaml." };

    const allowed = filterByAccess(dashboard.groups, [], user);
    const allowedServices = new Set(allowed.groups.flatMap((g) => g.services.map((s) => s.id)));
    const allowedGroups = allowed.groups.map((g) => g.name);

    const availableServices = selection.availableServices.filter((id) => allowedServices.has(id));
    const shownServices = selection.services.filter((id) => allowedServices.has(id));
    const shownS = new Set(shownServices);

    const existing = await readUserHome(slug);
    // Bookmarks hidden in settings are not on the form. Keep the saved list.
    const customBookmarks =
      dashboard.settings.showBookmarks && selection.customBookmarks !== undefined
        ? sanitizeUserBookmarks(selection.customBookmarks)
        : (existing.customBookmarks ?? []);
    const background =
      selection.background !== undefined ? sanitizeBackgroundInput(selection.background) : backgroundFromHome(existing);

    await writeUserHome(slug, {
      // Hidden = turned off among services already on the form.
      // A service added later is not in that list, so it shows up.
      hiddenServices: availableServices.filter((id) => !shownS.has(id)),
      orderServices: mergeOrder(selection.orderServices, availableServices, shownServices),
      orderGroups: mergeOrder(selection.orderGroups, allowedGroups, allowedGroups),
      customBookmarks,
      background,
    });
    revalidatePath("/");
    revalidatePath("/customize");
    return { ok: true };
  } catch (err) {
    log.error("users", `save failed: ${(err as Error).message}`, false);
    return { ok: false, error: `Could not save: ${(err as Error).message}` };
  }
}

export async function uploadBackground(formData: FormData): Promise<
  { ok: true; image: string } | { ok: false; error: string }
> {
  try {
    const { slug } = await requireUser();
    if (!slug) return { ok: false, error: "You need to be signed in and listed in users.yaml." };
    const saved = await saveUserBackground(slug, formData.get("file"));
    return { ok: true, image: saved.image };
  } catch (err) {
    const message =
      err instanceof BackgroundUploadError ? err.message : `Could not save the image: ${(err as Error).message}`;
    log.error("users", `background upload failed: ${message}`, false);
    return { ok: false, error: message };
  }
}

export async function resetHome(): Promise<SaveResult> {
  try {
    const { slug } = await requireUser();
    if (!slug) return { ok: false, error: "You need to be signed in and listed in users.yaml." };
    await deleteUserBackground(slug);
    await deleteUserHome(slug);
    revalidatePath("/");
    revalidatePath("/customize");
    return { ok: true };
  } catch (err) {
    log.error("users", `reset failed: ${(err as Error).message}`, false);
    return { ok: false, error: `Could not reset: ${(err as Error).message}` };
  }
}
