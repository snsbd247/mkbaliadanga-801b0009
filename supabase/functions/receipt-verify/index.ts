// Public receipt verification — no auth required.
// Returns minimal receipt details for a given verify_token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function maskMobile(m?: string | null) {
  if (!m) return null;
  return m.length <= 4 ? "***" : m.slice(0, 3) + "****" + m.slice(-3);
}

function isReceiptToken(token: string) {
  return /^[a-f0-9]{16,64}$/i.test(token);
}

function isLegacySavingsToken(token: string) {
  return /^sav-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
}

function isLegacyLoanToken(token: string) {
  return /^loan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
}

// --- Ad-hoc in-memory rate limiting (per edge instance) ---
// Per IP: max 30 requests / 60s window AND brute-force lockout
// after 10 failed (404/400) attempts in 5 minutes.
type Bucket = { hits: number[]; fails: number[]; lockedUntil: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const FAIL_WINDOW_MS = 5 * 60_000;
const MAX_FAILS = 10;
const LOCK_MS = 10 * 60_000;

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") || "";
  return xf.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

function getBucket(ip: string): Bucket {
  let b = buckets.get(ip);
  if (!b) { b = { hits: [], fails: [], lockedUntil: 0 }; buckets.set(ip, b); }
  return b;
}

function checkLimit(ip: string): { ok: true } | { ok: false; reason: string; retryAfter: number } {
  const now = Date.now();
  const b = getBucket(ip);
  if (b.lockedUntil > now) {
    return { ok: false, reason: "Too many failed attempts. Try later.", retryAfter: Math.ceil((b.lockedUntil - now) / 1000) };
  }
  b.hits = b.hits.filter((t) => now - t < WINDOW_MS);
  if (b.hits.length >= MAX_PER_WINDOW) {
    return { ok: false, reason: "Rate limit exceeded. Slow down.", retryAfter: 60 };
  }
  b.hits.push(now);
  return { ok: true };
}

function recordFail(ip: string) {
  const now = Date.now();
  const b = getBucket(ip);
  b.fails = b.fails.filter((t) => now - t < FAIL_WINDOW_MS);
  b.fails.push(now);
  if (b.fails.length >= MAX_FAILS) {
    b.lockedUntil = now + LOCK_MS;
    b.fails = [];
  }
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) {
    if (b.lockedUntil < now && b.hits.length === 0 && b.fails.length === 0) buckets.delete(ip);
  }
}, 60_000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = clientIp(req);
  const limit = checkLimit(ip);
  if (!limit.ok) {
    return new Response(JSON.stringify({ ok: false, error: limit.reason }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(limit.retryAfter) },
    });
  }

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token") ?? "";
    if (!token && (req.method === "POST")) {
      const b = await req.json().catch(() => ({}));
      token = String(b?.token ?? "");
    }
    token = token.trim();
    if (!isReceiptToken(token) && !isLegacySavingsToken(token) && !isLegacyLoanToken(token)) {
      recordFail(ip);
      return new Response(JSON.stringify({ ok: false, error: "Invalid token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isLegacySavingsToken(token) || isLegacyLoanToken(token)) {
      const isSavings = token.startsWith("sav-");
      const id = token.replace(/^sav-|^loan-/i, "");
      const { data: row } = isSavings
        ? await admin.from("savings_transactions").select("id,farmer_id,office_id,receipt_no,amount,type,status,note,txn_date,created_at,deleted_at").eq("id", id).maybeSingle()
        : await admin.from("loans").select("id,farmer_id,office_id,principal,total_payable,status,note,issued_on,created_at,deleted_at").eq("id", id).maybeSingle();

      if (!row || row.deleted_at) {
        recordFail(ip);
        return new Response(JSON.stringify({
          ok: false,
          error: row?.deleted_at ? "Receipt voided" : "Receipt not found",
          voided: !!row?.deleted_at,
          voided_at: row?.deleted_at ?? null,
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const [{ data: f }, { data: o }, { data: c }] = await Promise.all([
        admin.from("farmers").select("name_en, name_bn, farmer_code, member_no, mobile, village").eq("id", row.farmer_id).maybeSingle(),
        row.office_id ? admin.from("offices").select("name").eq("id", row.office_id).maybeSingle() : Promise.resolve({ data: null }),
        admin.from("company_settings").select("company_name, company_name_bn").eq("id", 1).maybeSingle(),
      ]);

      return new Response(JSON.stringify({
        ok: true,
        receipt: {
          receipt_no: isSavings ? (row.receipt_no ?? `SAV-${String(row.id).slice(0, 8)}`) : `LOAN-${String(row.id).slice(0, 8)}`,
          kind: isSavings ? "savings" : "loan",
          amount: Number(isSavings ? row.amount : row.principal),
          method: null,
          note: isSavings ? (row.note ?? row.type) : (row.note ?? `Total payable: ${Number(row.total_payable || 0)}`),
          date: isSavings ? (row.txn_date ?? row.created_at) : (row.issued_on ?? row.created_at),
          status: row.status,
        },
        farmer: f ? {
          name: f.name_bn || f.name_en,
          member_no: f.member_no ?? f.farmer_code ?? null,
          village: f.village ?? null,
          mobile_masked: maskMobile(f.mobile),
        } : null,
        office: o?.name ?? null,
        company: { name: c?.company_name ?? null, name_bn: c?.company_name_bn ?? null },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: p } = await admin
      .from("payments")
      .select("id, kind, amount, method, note, created_at, status, receipt_no, deleted_at, farmer_id, office_id")
      .eq("verify_token", token)
      .maybeSingle();

    if (!p || p.deleted_at) {
      recordFail(ip);
      // Surface void/cancel info even after soft-delete
      const voided = p && p.deleted_at;
      return new Response(JSON.stringify({
        ok: false,
        error: voided ? "Receipt voided" : "Receipt not found",
        voided: !!voided,
        voided_at: voided ? p.deleted_at : null,
      }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: f }, { data: o }, { data: c }] = await Promise.all([
      admin.from("farmers").select("name_en, name_bn, farmer_code, member_no, mobile, village").eq("id", p.farmer_id).maybeSingle(),
      p.office_id
        ? admin.from("offices").select("name").eq("id", p.office_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("company_settings").select("company_name, company_name_bn").eq("id", 1).maybeSingle(),
    ]);

    return new Response(JSON.stringify({
      ok: true,
      receipt: {
        receipt_no: p.receipt_no,
        kind: p.kind,
        amount: Number(p.amount),
        method: p.method,
        note: p.note,
        date: p.created_at,
        status: p.status, // pending | approved | rejected
      },
      farmer: f ? {
        name: f.name_bn || f.name_en,
        member_no: f.member_no ?? f.farmer_code ?? null,
        village: f.village ?? null,
        mobile_masked: maskMobile(f.mobile),
      } : null,
      office: o?.name ?? null,
      company: {
        name: c?.company_name ?? null,
        name_bn: c?.company_name_bn ?? null,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("receipt-verify error", e);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
