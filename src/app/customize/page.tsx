import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { CustomizeForm } from "@/components/customize-form";
import { backgroundFromHome } from "@/lib/background";
import { loadDashboard } from "@/lib/config";
import { getCurrentUser } from "@/lib/users";
import { filterByAccess, readUserHome, resolveHome } from "@/lib/user-home";

export const metadata: Metadata = { title: "Customize home" };

export default async function CustomizePage() {
  await connection();
  const { settings, groups, users } = await loadDashboard();
  const user = await getCurrentUser(settings.auth, users, settings.singleUser);
  const allowed = filterByAccess(groups, [], user);
  const serviceIds = allowed.groups.flatMap((g) => g.services.map((s) => s.id));
  const home = user?.slug ? await readUserHome(user.slug) : null;
  const resolved = home
    ? resolveHome(
        home,
        serviceIds,
        [],
        allowed.groups.map((g) => ({ name: g.name, ids: g.services.map((s) => s.id) })),
        [],
      )
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
              ? `"${user.displayName}" is not in users.yaml. Add that display name, then open this page again.`
              : "No Authelia headers. Open the dashboard through nginx to sign in."}
          </p>
        </div>
      ) : (
        <>
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Customize your home</h1>
            <p className="mt-1.5 text-white/50">
              {settings.showBookmarks
                ? "Services, bookmarks, and background. Only you see this."
                : "Services and background. Only you see this."}
            </p>
          </header>
          <CustomizeForm
            groups={allowed.groups}
            showBookmarks={settings.showBookmarks}
            initial={{
              orderServices: resolved!.orderServices,
              orderGroups: resolved!.orderGroups,
              selectedServices: resolved!.orderServices.filter((id) => !resolved!.hiddenServices.includes(id)),
              customBookmarks: home?.customBookmarks ?? [],
              background: backgroundFromHome(home),
              customized: resolved!.customized,
            }}
          />
        </>
      )}
    </main>
  );
}
