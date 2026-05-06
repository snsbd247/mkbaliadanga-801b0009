import { useEffect, useState } from "react";
import type { ReceiptLang, ReceiptOptions } from "@/lib/bnReceipts";
import { useBranding } from "@/lib/branding";

const KEY = "receipt:options:v1";

export interface ReceiptUserOptions {
  lang: ReceiptLang;
  marginsMm: number;          // uniform margin
  paper: "a4" | "letter";
  orientation: "p" | "l";
}

const DEFAULTS: ReceiptUserOptions = { lang: "bn", marginsMm: 10, paper: "a4", orientation: "p" };

function read(): ReceiptUserOptions {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULTS; }
}

const subs = new Set<(v: ReceiptUserOptions) => void>();

export function getReceiptOptions(): ReceiptUserOptions { return read(); }
export function setReceiptOptions(v: Partial<ReceiptUserOptions>) {
  const next = { ...read(), ...v };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* */ }
  subs.forEach((fn) => fn(next));
}

export function useReceiptOptions() {
  const [v, setV] = useState<ReceiptUserOptions>(() => read());
  useEffect(() => { const fn = (n: ReceiptUserOptions) => setV(n); subs.add(fn); return () => { subs.delete(fn); }; }, []);
  return v;
}

/** Convert user options + branding into the args used by bnReceipts. */
export function useReceiptRenderArgs(): { options: ReceiptOptions; org: { name?: string | null; name_bn?: string | null; address?: string | null; mobile?: string | null; email?: string | null; registration_no?: string | null } } {
  const opts = useReceiptOptions();
  const brand = useBranding();
  return {
    options: {
      lang: opts.lang,
      paper: opts.paper,
      orientation: opts.orientation,
      margins: { t: opts.marginsMm, r: opts.marginsMm, b: opts.marginsMm, l: opts.marginsMm },
    },
    org: {
      name: brand.company_name,
      name_bn: brand.company_name_bn ?? null,
      address: (brand as any).address ?? null,
      mobile: (brand as any).mobile ?? null,
      email: (brand as any).email ?? null,
      registration_no: (brand as any).registration_no ?? null,
    },
  };
}
