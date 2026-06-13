// deploy/supabase/functions/main/index.ts
// Edge runtime bootstrap router. Dispatches /functions/v1/<name> to the matching
// function directory copied from the repo's supabase/functions.
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const name = url.pathname.replace(/^\/+/, "").split("/")[0];
  if (!name || name === "main") {
    return new Response(JSON.stringify({ ok: true, runtime: "edge" }), {
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const mod = await import(`../${name}/index.ts`);
    if (typeof mod.default === "function") return await mod.default(req);
    return new Response("Function has no default export", { status: 500 });
  } catch (_e) {
    return new Response(JSON.stringify({ error: `Function '${name}' not found` }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
});
