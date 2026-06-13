// deploy/supabase/functions/main/index.ts
// Official Supabase self-host edge-runtime "main" service.
// Routes /functions/v1/<name> to the function in ../<name>/index.ts by spawning
// an isolated user worker. The function files use top-level `Deno.serve(...)`,
// which the edge runtime intercepts per worker — no default export required.
// deno-lint-ignore-file
declare const EdgeRuntime: any;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const name = url.pathname.replace(/^\/+/, "").split("/")[0];

  if (!name || name === "main" || name === "_internal") {
    return new Response(JSON.stringify({ ok: true, runtime: "edge" }), {
      headers: { "content-type": "application/json" },
    });
  }

  const servicePath = `/home/deno/functions/${name}`;

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 256,
      workerTimeoutMs: 300_000,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
    });
    return await worker.fetch(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `boot error for '${name}': ${msg}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
});
