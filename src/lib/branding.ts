import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { isLaravelBackend } from "@/lib/backend";
export interface CompanyBranding {
  company_name: string;
  company_name_bn?: string | null;
  logo_url?: string | null;
  email?: string | null;
  mobile?: string | null;
  address?: string | null;
  default_loan_interest?: number | null;
  penalty_type?: "flat" | "percent" | "none" | null;
  penalty_value?: number | null;
  penalty_grace_days?: number | null;
  pdf_footer_text?: string | null;
  pdf_footer_show_address?: boolean | null;
  pdf_footer_show_contact?: boolean | null;
  loan_receipt_header_en?: string | null;
  loan_receipt_header_bn?: string | null;
  loan_receipt_footer_en?: string | null;
  loan_receipt_footer_bn?: string | null;
  loan_receipt_no_format?: string | null;
  registration_no?: string | null;
  editor_signature_url?: string | null;
}

const DEFAULTS: CompanyBranding = {
  company_name: "Smart Irrigation Cooperative",
  company_name_bn: "স্মার্ট সেচ ও সমবায়",
};

function normalizeStorageUrl(url?: string | null): string | null | undefined {
  if (!url || !isLaravelBackend || typeof window === "undefined") return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (!parsed.pathname.startsWith("/storage/")) return url;
    const [, , bucket, ...pathParts] = parsed.pathname.split("/");
    if (!bucket || pathParts.length === 0) return url;
    const safePath = pathParts.map(encodeURIComponent).join("/");
    return `${parsed.origin}/api/storage/public/${encodeURIComponent(bucket)}/${safePath}${parsed.search}`;
  } catch {
    return url;
  }
}

function normalizeBranding(data: CompanyBranding): CompanyBranding {
  return {
    ...data,
    logo_url: normalizeStorageUrl(data.logo_url),
    editor_signature_url: normalizeStorageUrl(data.editor_signature_url),
  };
}

let cached: CompanyBranding | null = null;
const subs = new Set<(b: CompanyBranding) => void>();

export async function loadBranding(force = false): Promise<CompanyBranding> {
  if (cached && !force) return cached;
  const { data } = await db.from("company_settings").select("*").eq("id", 1).maybeSingle();
  cached = normalizeBranding(((data as any) ?? DEFAULTS) as CompanyBranding);
  subs.forEach((s) => s(cached!));
  return cached!;
}

export function useBranding(): CompanyBranding {
  const [b, setB] = useState<CompanyBranding>(cached ?? DEFAULTS);
  useEffect(() => {
    loadBranding();
    const fn = (next: CompanyBranding) => setB(next);
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
  return b;
}

export function notifyBrandingChange() { loadBranding(true); }
