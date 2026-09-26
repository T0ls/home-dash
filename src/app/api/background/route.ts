import { backgroundContentType } from "@/lib/background-image";
import { readUserBackground } from "@/lib/background-store";
import { loadDashboard } from "@/lib/config";
import { getCurrentUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { settings, users } = await loadDashboard();
    const user = await getCurrentUser(settings.auth, users, settings.singleUser);
    if (!user?.slug) return new Response("Not signed in", { status: 401 });

    const image = await readUserBackground(user.slug);
    if (!image) return new Response("No background image", { status: 404 });

    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "content-type": backgroundContentType(image.kind),
        "content-disposition": `inline; filename="background.${image.kind}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Background unavailable", { status: 500 });
  }
}
