/**
 * Bangla font registry + user preference + automatic fallback chain.
 *
 * Fonts ship under `public/fonts/` so they are bundled with the app and
 * remain consistent across all devices / PDF viewers (Chrome, Adobe Reader,
 * mobile previewers). PDFs subset-embed the chosen font.
 */

export type BanglaFontId = "noto-sans" | "noto-serif";

export type BanglaFontDef = {
  id: BanglaFontId;
  family: string;          // jsPDF font family name + CSS family
  vfsName: string;         // unique VFS filename
  url: string;             // public asset URL
  labelEn: string;
  labelBn: string;
  description: string;
};

export const BANGLA_FONTS: BanglaFontDef[] = [
  {
    id: "noto-sans",
    family: "NotoSansBengali",
    vfsName: "NotoSansBengali-Regular.ttf",
    url: "/fonts/NotoSansBengali-Regular.ttf",
    labelEn: "Noto Sans Bengali",
    labelBn: "নোটো সান্স বাংলা",
    description: "Modern sans-serif. Best on screen, smaller PDFs.",
  },
  {
    id: "noto-serif",
    family: "NotoSerifBengali",
    vfsName: "NotoSerifBengali-Regular.ttf",
    url: "/fonts/NotoSerifBengali-Regular.ttf",
    labelEn: "Noto Serif Bengali",
    labelBn: "নোটো সেরিফ বাংলা",
    description: "Traditional serif. Best for printed receipts/reports.",
  },
];

/** Fallback order used if the preferred font fails to load. */
export const BANGLA_FONT_FALLBACK: BanglaFontId[] = ["noto-sans", "noto-serif"];

const STORAGE_KEY = "bangla_font_pref_v1";

export function getBanglaFontPref(): BanglaFontId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && BANGLA_FONTS.some((f) => f.id === v)) return v as BanglaFontId;
  } catch { /* ignore */ }
  return "noto-sans";
}

export function setBanglaFontPref(id: BanglaFontId): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent("bangla-font-changed", { detail: id })); } catch { /* ignore */ }
}

export function getBanglaFontDef(id?: BanglaFontId): BanglaFontDef {
  const target = id ?? getBanglaFontPref();
  return BANGLA_FONTS.find((f) => f.id === target) ?? BANGLA_FONTS[0];
}

/** Build the ordered list of fonts to try (preferred first, then fallbacks). */
export function getBanglaFontChain(): BanglaFontDef[] {
  const pref = getBanglaFontPref();
  const order: BanglaFontId[] = [pref, ...BANGLA_FONT_FALLBACK.filter((x) => x !== pref)];
  return order.map((id) => getBanglaFontDef(id));
}
