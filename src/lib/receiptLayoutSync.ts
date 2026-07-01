// Per-user (and thereby per-office, since a profile belongs to one office)
// persistence for receipt layout settings. Mirrors receiptOptions.ts so the
// chosen paper size, margins and padding stay consistent across sessions and
// devices. localStorage keeps them instant; the profile row is the durable copy.

import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import {
  getReceiptLayoutSettings,
  setReceiptLayoutSettings,
  type ReceiptLayoutSettings,
} from "@/lib/receiptLayoutSettings";

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced push of the current layout settings to the user's profile. */
export function scheduleReceiptLayoutPersist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void persistReceiptLayoutToProfile(); }, 600);
}

export async function persistReceiptLayoutToProfile(
  settings?: ReceiptLayoutSettings,
): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await db
      .from("profiles")
      .update({ receipt_layout: (settings ?? getReceiptLayoutSettings()) as any })
      .eq("id", u.user.id);
  } catch { /* ignore network errors — localStorage still holds the value */ }
}

/** On login, merge the saved profile layout into the local store. */
export async function hydrateReceiptLayoutFromProfile(): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await db
      .from("profiles")
      .select("receipt_layout")
      .eq("id", u.user.id)
      .maybeSingle();
    const remote = (data as any)?.receipt_layout;
    if (remote && typeof remote === "object") {
      setReceiptLayoutSettings(remote as Partial<ReceiptLayoutSettings>);
    }
  } catch { /* ignore */ }
}
