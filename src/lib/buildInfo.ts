// Build/version info. __APP_BUILD_ID__ is injected by Vite at build time
// (see vite.config.ts `define`). It changes on every production build, so we
// can detect when a browser is running a stale cached bundle.
declare const __APP_BUILD_ID__: string;

export const BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";

/**
 * Fetch the build id currently deployed on the server by reading index.html
 * with a cache-busting query. The live HTML embeds the hashed JS bundle name,
 * which changes on every deploy — so if it differs from what we loaded with,
 * the browser is serving an outdated cached bundle.
 */
export async function fetchDeployedFingerprint(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();
    // The main entry script has a content hash in its filename.
    const match = html.match(/src="([^"]*assets\/[^"]*\.js)"/);
    return match ? match[1] : html.length.toString();
  } catch {
    return null;
  }
}
