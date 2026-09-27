export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logStartup } = await import("./lib/startup");
    await logStartup();
  }
}
