import { useEffect, useState } from "react";
import type { ReceiptLang, ReceiptOptions } from "@/lib/bnReceipts";
import { useBranding } from "@/lib/branding";
import { supabase } from "@/integrations/supabase/client";

const KEY = "receipt:options:v1";

export type OrgBlockLayout = "one-line" | "two-line";
export type OrgBlockSize = "sm" | "md" | "lg";

export interface ReceiptUserOptions {
  lang: ReceiptLang;
  marginsMm: number;
  paper: "a4" | "letter";
  orientation: "p" | "l";
  orgLayout: OrgBlockLayout;
  orgSize: OrgBlockSize;
  showVerifyUrl: boolean;
}

/** Defaults tuned to match the original demo template spacing. */
export const DEMO_DEFAULTS: ReceiptUserOptions = {
  lang: "bn",
  marginsMm: 10,
  paper: "a4",
  orientation: "p",
  orgLayout: "two-line",
  orgSize: "sm",
  showVerifyUrl: false,
};

function read(): ReceiptUserOptions {
  if (typeof localStorage === "undefined") return DEMO_DEFAULTS;
  try { return { ...DEMO_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEMO_DEFAULTS; }
}

function write(v: ReceiptUserOptions) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* */ }
}

const subs = new Set<(v: ReceiptUserOptions) => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getReceiptOptions(): ReceiptUserOptions { return read(); }

export function setReceiptOptions(v: Partial<ReceiptUserOptions>) {
  const next = { ...read(), ...v };
  write(next);
  subs.forEach((fn) => fn(next));
  // Debounced cloud sync to profile
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void persistToProfile(next); }, 500);
}

export function resetReceiptOptionsToDemo() {
  setReceiptOptions(DEMO_DEFAULTS);
}

async function persistToProfile(v: ReceiptUserOptions) {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("profiles").update({ receipt_options: v as any }).eq("id", u.user.id);
  } catch { /* ignore network errors */ }
}

/** Pulls receipt options from the user profile and merges into local store on app start. */
export async function hydrateReceiptOptionsFromProfile() {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("profiles").select("receipt_options").eq("id", u.user.id).maybeSingle();
    const remote = (data as any)?.receipt_options;
    if (remote && typeof remote === "object") {
      const merged = { ...DEMO_DEFAULTS, ...read(), ...remote } as ReceiptUserOptions;
      write(merged);
      subs.forEach((fn) => fn(merged));
    }
  } catch { /* ignore */ }
}

export function useReceiptOptions() {
  const [v, setV] = useState<ReceiptUserOptions>(() => read());
  useEffect(() => { const fn = (n: ReceiptUserOptions) => setV(n); subs.add(fn); return () => { subs.delete(fn); }; }, []);
  return v;
}

/** Convert user options + branding into the args used by bnReceipts. */
export function useReceiptRenderArgs(): {
  options: ReceiptOptions;
  org: { name?: string | null; name_bn?: string | null; address?: string | null; mobile?: string | null; email?: string | null; registration_no?: string | null };
  signatureUrl: string | null;
} {
  const opts = useReceiptOptions();
  const brand = useBranding();
  return {
    options: {
      lang: opts.lang,
      paper: opts.paper,
      orientation: opts.orientation,
      margins: { t: opts.marginsMm, r: opts.marginsMm, b: opts.marginsMm, l: opts.marginsMm },
      orgLayout: opts.orgLayout,
      orgSize: opts.orgSize,
      showVerifyUrl: opts.showVerifyUrl,
    },
    org: {
      name: brand.company_name,
      name_bn: brand.company_name_bn ?? null,
      address: (brand as any).address ?? null,
      mobile: (brand as any).mobile ?? null,
      email: (brand as any).email ?? null,
      registration_no: (brand as any).registration_no ?? null,
    },
    signatureUrl: (brand as any).editor_signature_url ?? null,
  };
}
