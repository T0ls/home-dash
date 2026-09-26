import type { Metadata } from "next";
import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { ConfigError, loadDashboard } from "@/lib/config";

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
    return <Dashboard settings={result.settings} groups={result.groups} />;
  }
  const file = result instanceof ConfigError ? result.file : undefined;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
        <h1 className="text-lg font-semibold text-rose-200">
          Errore nella configurazione{file ? ` (${file})` : ""}
        </h1>
        <p className="mt-2 text-sm text-rose-100/80">
          Correggi il file e ricarica la pagina. Dettagli dell&apos;errore:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs whitespace-pre-wrap text-rose-100">
          {result.message}
        </pre>
      </div>
    </main>
  );
}
