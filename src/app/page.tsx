import type { Metadata } from "next";
import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { backgroundFromHome, backgroundLayerStyle } from "@/lib/background";
import { ConfigError, loadDashboard, type BookmarkGroup } from "@/lib/config";
import { getCurrentUser } from "@/lib/users";
import { toPersonalBookmarkGroup } from "@/lib/user-bookmarks";
import {
  applyUserHome,
  ensureUserDir,
  filterByAccess,
  readUserHome,
  resolveHome,
} from "@/lib/user-home";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  try {
    const { settings } = await loadDashboard();
    return { title: settings.title, description: settings.subtitle };
  } catch {
    return { title: "Homepage" };
  }
}

export default async function Page() {
  await connection();
  const result = await loadDashboard().catch((err: Error) => err);
  if (!(result instanceof Error)) {
    const user = await getCurrentUser(result.settings.auth, result.users, result.settings.singleUser);
    let groups = filterByAccess(result.groups, [], user).groups;
    let bookmarks: BookmarkGroup[] = [];
    let customized = false;
    let backdrop: ReturnType<typeof backgroundLayerStyle> = null;
    if (user?.slug) {
      await ensureUserDir(user.slug).catch(() => {});
      const home = await readUserHome(user.slug);
      const serviceIds = groups.flatMap((g) => g.services.map((s) => s.id));
      const resolved = resolveHome(
        home,
        serviceIds,
        [],
        groups.map((g) => ({ name: g.name, ids: g.services.map((s) => s.id) })),
        [],
      );
      customized = resolved.customized;
      groups = applyUserHome(groups, [], resolved).groups;
      backdrop = backgroundLayerStyle(backgroundFromHome(home));
      if (result.settings.showBookmarks) {
        const personal = toPersonalBookmarkGroup(home.customBookmarks, result.settings.target);
        if (personal) bookmarks = [personal];
      }
    }
    return (
      <>
        {backdrop && (
          <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center" style={backdrop} />
        )}
        <Dashboard
          settings={result.settings}
          groups={groups}
          bookmarks={bookmarks}
          user={user}
          canCustomize={Boolean(user?.slug)}
          customized={customized}
        />
      </>
    );
  }
  const file = result instanceof ConfigError ? result.file : undefined;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
        <h1 className="text-lg font-semibold text-rose-200">
          Configuration error{file ? ` (${file})` : ""}
        </h1>
        <p className="mt-2 text-sm text-rose-100/80">
          Fix the file and reload.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs whitespace-pre-wrap text-rose-100">
          {result.message}
        </pre>
      </div>
    </main>
  );
}
