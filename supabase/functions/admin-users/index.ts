import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateBody {
  action: "create";
  username: string;
  email: string;
  password: string;
  full_name?: string;
  role: "developer" | "super_admin" | "admin" | "committee" | "staff";
  office_id?: string | null;
}
interface DeleteBody { action: "delete"; user_id: string; }
interface ResetBody  { action: "reset_password"; user_id: string; password: string; }

type Body = CreateBody | DeleteBody | ResetBody;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is super_admin via their JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing auth" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: who, error: whoErr } = await userClient.auth.getUser();
    if (whoErr || !who?.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", who.user.id);
    const myRoles = (roles ?? []).map((r: any) => r.role);
    const isDeveloper = myRoles.includes("developer");
    const isSuper = isDeveloper || myRoles.includes("super_admin");
    if (!isSuper) return json({ error: "Forbidden — super admin only" }, 403);

    const body = (await req.json()) as Body;

    if (body.action === "create") {
      const { username, email, password, full_name, role, office_id } = body;
      if (!username || !email || !password || !role) return json({ error: "Missing fields" }, 400);
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) return json({ error: "Invalid username (3–30 chars, letters/digits/._-)" }, 400);
      if ((role === "developer" || role === "super_admin") && !isDeveloper) {
        return json({ error: "Only developers can create developer or super admin accounts" }, 403);
      }

      // Check username uniqueness
      const { data: existing } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
      if (existing) return json({ error: "Username already taken" }, 409);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: full_name ?? "", username },
      });
      if (cErr || !created.user) return json({ error: cErr?.message ?? "Create failed" }, 400);

      await admin.from("profiles").update({ username, full_name: full_name ?? "", office_id: office_id ?? null }).eq("id", created.user.id);
      // handle_new_user inserts staff role; replace with requested role
      await admin.from("user_roles").delete().eq("user_id", created.user.id);
      await admin.from("user_roles").insert({ user_id: created.user.id, role });

      return json({ ok: true, user_id: created.user.id });
    }

    if (body.action === "delete") {
      if (body.user_id === who.user.id) return json({ error: "You cannot delete yourself" }, 400);
      // Prevent non-developers from deleting developer accounts
      if (!isDeveloper) {
        const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", body.user_id);
        if ((targetRoles ?? []).some((r: any) => r.role === "developer")) {
          return json({ error: "Only developers can delete developer accounts" }, 403);
        }
      }
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === "reset_password") {
      if (!body.password || body.password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
