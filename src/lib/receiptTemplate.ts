import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TEMPLATE, type ReceiptTemplate } from "@/lib/paymentReceiptPdf";

let cached: ReceiptTemplate | null = null;
const subs = new Set<(t: ReceiptTemplate) => void>();

export async function loadReceiptTemplate(force = false): Promise<ReceiptTemplate> {
  if (cached && !force) return cached;
  const { data } = await supabase.from("receipt_settings").select("*").eq("id", 1).maybeSingle();
  cached = { ...DEFAULT_TEMPLATE, ...((data as any) ?? {}) };
  subs.forEach((s) => s(cached!));
  return cached!;
}

export function useReceiptTemplate(): ReceiptTemplate {
  const [t, setT] = useState<ReceiptTemplate>(cached ?? DEFAULT_TEMPLATE);
  useEffect(() => {
    loadReceiptTemplate();
    const fn = (next: ReceiptTemplate) => setT(next);
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
  return t;
}

export function notifyReceiptTemplateChange() { loadReceiptTemplate(true); }
