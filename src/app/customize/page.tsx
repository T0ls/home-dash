import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { CustomizeForm } from "@/components/customize-form";
import { loadDashboard } from "@/lib/config";
import { getCurrentUser } from "@/lib/users";
import { filterByAccess, readUserHome, resolveHome } from "@/lib/user-home";

export const metadata: Metadata = { title: "Customize home" };

export default async function CustomizePage() {
  await connection();
  const { settings, groups, bookmarks, users } = await loadDashboard();
  const user = await getCurrentUser(settings.auth, users);
  const allowed = filterByAccess(groups, bookmarks, user);
  const serviceIds = allowed.groups.flatMap((g) => g.services.map((s) => s.id));
  const bookmarkIds = allowed.bookmarks.flatMap((g) => g.bookmarks.map((b) => b.id));
  const resolved = user?.slug
    ? resolveHome(await readUserHome(user.slug), serviceIds, bookmarkIds)
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/60 transition hover:text-white"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>

      {!user?.slug ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 sm:p-12">
          <h1 className="text-xl font-semibold text-white">You can&apos;t customize this home yet</h1>
          <p className="mt-2 max-w-xl text-white/60">
            {user
              ? `"${user.displayName}" is not listed in users.yaml. Ask the admin to add you, then come back here.`
              : "No Authelia identity was received. Open the dashboard through your nginx reverse proxy to sign in."}
          </p>
        </div>
      ) : (
        <>
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Customize your home</h1>
            <p className="mt-1.5 text-white/50">
              Pick and rearrange the services and bookmarks you want to see. Only you will see these changes.
              New services added by the admin appear here automatically.
            </p>
          </header>
          <CustomizeForm
            groups={allowed.groups}
            bookmarks={allowed.bookmarks}
            initial={{
              orderServices: resolved!.orderServices,
              orderBookmarks: resolved!.orderBookmarks,
              selectedServices: resolved!.orderServices.filter((id) => !resolved!.hiddenServices.includes(id)),
              selectedBookmarks: resolved!.orderBookmarks.filter((id) => !resolved!.hiddenBookmarks.includes(id)),
              customized: resolved!.customized,
            }}
          />
        </>
      )}
    </main>
  );
}
