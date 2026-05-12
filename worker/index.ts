export interface Env {
  ASSETS: Fetcher;
  // DB?: D1Database; // D1 লাগলে enable করো
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Optional: API routes
    if (url.pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ ok: true, path: url.pathname }),
        { headers: { "content-type": "application/json" } },
      );
    }

    // সব static + SPA fallback ASSETS handle করবে
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
