import { useEffect, useState } from "react";
import { db } from "@/lib/db";
export interface CardSettings {
  template_id: string;
  accent_color: string;
  header_text: string;
  header_text_bn: string;
  show_photo: boolean;
  show_account_number: boolean;
  show_voter_number: boolean;
  show_issue_date: boolean;
  show_qr: boolean;
  photo_size_mm: number;
  font_scale: number;
  header_height_mm: number;
  logo_size_mm: number;
  custom_text: string;
  custom_text_bn: string;
}

export const DEFAULT_CARD_SETTINGS: CardSettings = {
  template_id: "classic",
  accent_color: "#107a57",
  header_text: "",
  header_text_bn: "",
  show_photo: true,
  show_account_number: true,
  show_voter_number: true,
  show_issue_date: true,
  show_qr: true,
  photo_size_mm: 18,
  font_scale: 1,
  header_height_mm: 8,
  logo_size_mm: 6,
  custom_text: "",
  custom_text_bn: "",
};

let cached: CardSettings | null = null;
const subs = new Set<(s: CardSettings) => void>();

export async function loadCardSettings(force = false): Promise<CardSettings> {
  if (cached && !force) return cached;
  const { data } = await db.from("card_settings").select("*").eq("id", 1).maybeSingle();
  cached = { ...DEFAULT_CARD_SETTINGS, ...((data as any) ?? {}) };
  subs.forEach((s) => s(cached!));
  return cached!;
}

export function notifyCardSettingsChange() { loadCardSettings(true); }

export function useCardSettings(): CardSettings {
  const [s, setS] = useState<CardSettings>(cached ?? DEFAULT_CARD_SETTINGS);
  useEffect(() => {
    loadCardSettings();
    const fn = (next: CardSettings) => setS(next);
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
  return s;
}
