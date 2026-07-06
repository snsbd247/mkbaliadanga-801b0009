// Backend-aware data adapter.
//
// In **supabase** mode (Lovable preview) `db.from(table)` returns the real
// supabase query builder — byte-for-byte identical behaviour, zero risk.
//
// In **laravel** mode (VPS) it returns a compatible builder that translates
// the common subset of supabase queries into REST calls against the Laravel
// generic table gateway (`/api/db/{table}`), which reads/writes MySQL.
//
// Pages can simply swap `import { supabase } from "@/integrations/supabase/client"`
// for `import { db } from "@/lib/db"` and keep their existing query code.

// NOTE: relative path (not the "@/..." alias) so the VPS build's conditional
// alias of "@/integrations/supabase/client" -> laravelClient never rewrites
// this import. The adapter must always hold the REAL client for preview mode.
import { supabase } from "../../integrations/supabase/client";
import { isLaravelBackend } from "@/lib/backend";
import { api } from "@/lib/api/client";

type Filter = { column: string; op: string; value: unknown };
type Order = { column: string; ascending: boolean };

type Result<T = any> = { data: T; error: { message: string } | null; count: number | null };

/**
 * The Laravel/MySQL gateway resolves only ONE level of embeds (e.g.
 * `lands(...)`, `farmers(...)`). Nested embeds inside an embed — like
 * `mouzas(name)` inside `lands(...)` — are not supported and would be forwarded
 * verbatim to MySQL, producing `Unknown column 'mouzas(name)'`.
 *
 * This sanitizer walks the PostgREST-style select string and strips any embed
 * that is nested inside another embed, keeping scalar columns. Top-level embeds
 * are preserved. It is a no-op for plain column lists and `*`.
 */
export function sanitizeEmbedSelect(select: string, depth = 0): string {
  if (!select || select === "*" || !select.includes("(")) return select;
  const parts: string[] = [];
  let buf = "";
  let paren = 0;
  const flush = () => { const t = buf.trim(); if (t) parts.push(t); buf = ""; };
  for (const ch of select) {
    if (ch === "(") paren++;
    else if (ch === ")") paren--;
    if (ch === "," && paren === 0) { flush(); continue; }
    buf += ch;
  }
  flush();

  const kept: string[] = [];
  for (const part of parts) {
    const m = part.match(/^([^(]+)\((.*)\)$/s);
    if (!m) { kept.push(part); continue; } // scalar column
    // `part` is an embed. Drop embeds nested inside another embed (depth > 0).
    if (depth > 0) continue;
    const [, name, inner] = m;
    kept.push(`${name.trim()}(${sanitizeEmbedSelect(inner, depth + 1)})`);
  }
  return kept.join(",");
}



class LaravelQueryBuilder<T = any> implements PromiseLike<Result<T>> {
  private table: string;
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectCols = "*";
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private _limit?: number;
  private _offset?: number;
  private _single = false;
  private _maybeSingle = false;
  private _count = false;
  private payload: unknown = null;
  private _returnRows = true; // whether to fetch rows back after mutation

  constructor(table: string) {
    this.table = table;
  }

  // ── terminal/projection ──
  select(cols = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    this.selectCols = sanitizeEmbedSelect(cols || "*");
    if (opts?.count) this._count = true;
    if (this.op === "insert" || this.op === "update" || this.op === "delete") {
      this._returnRows = true;
    }
    return this;
  }

  insert(values: unknown) {
    this.op = "insert";
    this.payload = values;
    this._returnRows = false;
    return this;
  }

  update(values: unknown) {
    this.op = "update";
    this.payload = values;
    this._returnRows = false;
    return this;
  }

  upsert(values: unknown) {
    // Best-effort: treat as insert. Conflict handling is rare in this app.
    return this.insert(values);
  }

  delete() {
    this.op = "delete";
    this._returnRows = false;
    return this;
  }

  // ── filters ──
  private addFilter(column: string, op: string, value: unknown) {
    this.filters.push({ column, op, value });
    return this;
  }
  eq(c: string, v: unknown) { return this.addFilter(c, "eq", v); }
  neq(c: string, v: unknown) { return this.addFilter(c, "neq", v); }
  gt(c: string, v: unknown) { return this.addFilter(c, "gt", v); }
  gte(c: string, v: unknown) { return this.addFilter(c, "gte", v); }
  lt(c: string, v: unknown) { return this.addFilter(c, "lt", v); }
  lte(c: string, v: unknown) { return this.addFilter(c, "lte", v); }
  like(c: string, v: unknown) { return this.addFilter(c, "like", v); }
  ilike(c: string, v: unknown) { return this.addFilter(c, "ilike", v); }
  in(c: string, v: unknown[]) { return this.addFilter(c, "in", v); }
  is(c: string, v: unknown) { return this.addFilter(c, "is", v); }
  not(c: string, op: string, v: unknown) { return this.addFilter(c, `not.${op}`, v); }
  or(expr: string) { return this.addFilter("__or", "or", expr); }
  match(obj: Record<string, unknown>) {
    Object.entries(obj).forEach(([c, v]) => this.addFilter(c, "eq", v));
    return this;
  }

  // ── modifiers ──
  order(column: string, opts?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) { this._limit = n; return this; }
  range(from: number, to: number) {
    this._offset = from;
    this._limit = to - from + 1;
    return this;
  }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  // ── execution ──
  private async run(): Promise<Result<T>> {
    try {
      if (this.op === "insert") {
        const { data } = await api.post(`/db/${this.table}`, this.payload);
        const rows = Array.isArray(data) ? data : [data];
        return this.shape(rows);
      }
      if (this.op === "update") {
        const { data } = await api.patch(`/db/${this.table}`, {
          values: this.payload,
          filters: this.filters,
        });
        return this.shape(Array.isArray(data) ? data : [data]);
      }
      if (this.op === "delete") {
        await api.delete(`/db/${this.table}`, { data: { filters: this.filters } });
        return { data: null as any, error: null, count: null };
      }
      // select
      const body = {
        select: this.selectCols,
        filters: this.filters,
        order: this.orders,
        limit: this._limit,
        offset: this._offset,
        single: false,
        count: this._count && !this._returnRowsForCount(),
      };
      if (this._count) {
        const { data } = await api.post(`/db/${this.table}/query`, { ...body, count: true });
        return { data: [] as any, error: null, count: data?.count ?? 0 };
      }
      const { data } = await api.post(`/db/${this.table}/query`, body);
      const rows = Array.isArray(data) ? data : data == null ? [] : [data];
      return this.shape(rows);
    } catch (e: any) {
      return { data: null as any, error: { message: e?.message || "Request failed" }, count: null };
    }
  }

  private _returnRowsForCount() { return false; }

  private shape(rows: any[]): Result<T> {
    if (this._single || this._maybeSingle) {
      const one = rows[0] ?? null;
      if (this._single && one === null) {
        return { data: null as any, error: { message: "No rows found" }, count: null };
      }
      return { data: one as any, error: null, count: rows.length };
    }
    return { data: rows as any, error: null, count: rows.length };
  }

  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

type RpcResult<T = any> = { data: T | null; error: { message: string } | null };

export interface RpcContract {
  available: string[];
  required: string[];
  missing: string[];
  ok: boolean;
  message: string;
}

/**
 * Validate the backend RPC contract. Only meaningful in Laravel/VPS mode; in
 * Supabase mode all RPCs are assumed present (functions are deployed centrally).
 * Never throws — returns { ok:false, missing } so callers can surface a clear
 * user error instead of failing mid-flow.
 */
export async function checkRpcContract(): Promise<RpcContract> {
  if (!isLaravelBackend) {
    return { available: [], required: [], missing: [], ok: true, message: "Supabase RPCs assumed available." };
  }
  try {
    const { data } = await api.get(`/rpc/_contract`);
    return {
      available: data?.available ?? [],
      required: data?.required ?? [],
      missing: data?.missing ?? [],
      ok: !!data?.ok,
      message: data?.message ?? "",
    };
  } catch (e: any) {
    // 409 (missing RPCs) surfaces as an axios error with a response body.
    const body = e?.response?.data;
    if (body && typeof body === "object") {
      return {
        available: body.available ?? [],
        required: body.required ?? [],
        missing: body.missing ?? [],
        ok: !!body.ok,
        message: body.message ?? "Missing required RPCs.",
      };
    }
    return {
      available: [],
      required: [],
      missing: [],
      ok: false,
      message: e?.message || "RPC contract endpoint unreachable.",
    };
  }
}



async function laravelRpc<T = any>(name: string, params?: Record<string, unknown>): Promise<RpcResult<T>> {
  try {
    const { data } = await api.post(`/rpc/${name}`, params ?? {});
    // Laravel returns the raw value; supabase callers expect it under `data`.
    return { data: (data?.result ?? data) as T, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e?.message || "RPC failed" } };
  }
}

async function laravelInvoke<T = any>(name: string, opts?: { body?: unknown }): Promise<RpcResult<T>> {
  try {
    const { data } = await api.post(`/fn/${name}`, opts?.body ?? {});
    return { data: data as T, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e?.message || "Function failed" } };
  }
}

function laravelStorageBucket(bucket: string) {
  const publicStorageUrl = (path: string) => {
    const origin = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
    const safePath = path.split("/").map(encodeURIComponent).join("/");
    return `${origin}/api/storage/public/${encodeURIComponent(bucket)}/${safePath}`;
  };

  return {
    async upload(path: string, file: File | Blob, _opts?: unknown) {
      try {
        const form = new FormData();
        form.append("file", file as Blob);
        form.append("bucket", bucket);
        form.append("path", path);
        const { data } = await api.post(`/storage/upload`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return { data, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e?.message || "Upload failed" } };
      }
    },
    getPublicUrl(path: string) {
      return { data: { publicUrl: publicStorageUrl(path) } };
    },
    async remove(paths: string[]) {
      try {
        await api.post(`/storage/remove`, { bucket, paths });
        return { data: null, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e?.message || "Remove failed" } };
      }
    },
    async createSignedUrl(path: string, _expiresIn: number) {
      return { data: { signedUrl: publicStorageUrl(path) }, error: null };
    },
  };
}

export const db = {
  from(table: string) {
    if (isLaravelBackend) {
      return new LaravelQueryBuilder(table) as any;
    }
    return supabase.from(table as any);
  },
  rpc(name: string, params?: Record<string, unknown>) {
    if (isLaravelBackend) {
      return laravelRpc(name, params) as any;
    }
    return (supabase.rpc as any)(name, params);
  },
  functions: {
    invoke(name: string, opts?: { body?: unknown }) {
      if (isLaravelBackend) {
        return laravelInvoke(name, opts) as any;
      }
      return (supabase.functions.invoke as any)(name, opts);
    },
  },
  storage: {
    from(bucket: string) {
      if (isLaravelBackend) {
        return laravelStorageBucket(bucket) as any;
      }
      return supabase.storage.from(bucket);
    },
  },
};

export type { Result as DbResult };
