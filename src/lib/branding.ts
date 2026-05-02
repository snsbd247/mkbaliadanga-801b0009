import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

const DEFAULTS: CompanyBranding = {
  company_name: "Smart Irrigation Cooperative",
  company_name_bn: "স্মার্ট সেচ ও সমবায়",
};

let cached: CompanyBranding | null = null;
const subs = new Set<(b: CompanyBranding) => void>();

export async function loadBranding(force = false): Promise<CompanyBranding> {
  if (cached && !force) return cached;
  const { data } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();
  cached = (data as any) ?? DEFAULTS;
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
