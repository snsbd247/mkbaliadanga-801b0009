// Admin-configurable layout for irrigation receipts (multi-dag rendering,
// custom row labels, row spacing). Persisted in localStorage so the same
// preferences apply across PDF/HTML and Excel exports without affecting
// other modules (savings/loan receipts, lands/voter exports, etc.).

export type DagSeparator = "comma" | "newline" | "semicolon";
export type PaperSize = "a4" | "a5";
export type PaperOrientation = "p" | "l";

export interface ReceiptLayoutSettings {
  dagSeparator: DagSeparator;
  /** Override label for "মৌজা / জমির পরিমান" row. Empty = use default. */
  mouzaLabelBn: string;
  mouzaLabelEn: string;
  /** Override label for "দাগ নং" row. Empty = use default. */
  dagLabelBn: string;
  dagLabelEn: string;
  /** Vertical padding (px) applied to each receipt row. 2-12.
   *  Per-module so changing irrigation never affects savings/loan. */
  rowSpacingPx: number;          // irrigation (kept for backward compat)
  savingsRowSpacingPx: number;   // savings receipts only
  loanRowSpacingPx: number;      // loan receipts only
  /** Per-module label overrides (savings/loan). Empty = use built-in defaults. */
  savingsDescLabelBn: string;
  savingsDescLabelEn: string;
  savingsBalanceLabelBn: string;
  savingsBalanceLabelEn: string;
  loanDescLabelBn: string;
  loanDescLabelEn: string;
  loanOutstandingLabelBn: string;
  loanOutstandingLabelEn: string;
  /** Global default paper size for receipt PDFs (payment / loan / irrigation / combined). */
  defaultPaperSize: PaperSize;
  /** Global default page orientation for receipt PDFs. */
  defaultOrientation: PaperOrientation;
  /** Diagonal watermark text printed behind receipt content (e.g. "MK BALIADANGA"). Empty = none. */
  watermarkText: string;
  /** Master on/off — overrides watermarkText. */
  watermarkEnabled: boolean;
  /** Irrigation receipt page padding (mm-ish px) — left/right/top. 24-72. */
  irrigationPagePaddingPx: number;
  /** Irrigation receipt page BOTTOM padding (px). Adjust per printer. 12-96. */
  irrigationBottomPaddingPx: number;
  /** Extra bottom padding (px) applied to the holding/patwari last row. 0-48. */
  holdingBottomPaddingPx: number;
  /** When true, receipt is scaled to fit a single page (width + height) so the
   *  preview and downloaded PDF stay aligned across printer drivers. */
  fitToPage: boolean;
}

export const DEFAULT_RECEIPT_LAYOUT: ReceiptLayoutSettings = {
  dagSeparator: "comma",
  mouzaLabelBn: "",
  mouzaLabelEn: "",
  dagLabelBn: "",
  dagLabelEn: "",
  rowSpacingPx: 4,
  savingsRowSpacingPx: 4,
  loanRowSpacingPx: 4,
  savingsDescLabelBn: "",
  savingsDescLabelEn: "",
  savingsBalanceLabelBn: "",
  savingsBalanceLabelEn: "",
  loanDescLabelBn: "",
  loanDescLabelEn: "",
  loanOutstandingLabelBn: "",
  loanOutstandingLabelEn: "",
  defaultPaperSize: "a5",
  defaultOrientation: "p",
  watermarkText: "",
  watermarkEnabled: false,
  irrigationPagePaddingPx: 48,
  irrigationBottomPaddingPx: 42,
  holdingBottomPaddingPx: 12,
  fitToPage: true,
};

/** Default labels — single source of truth shared by HTML/PDF/Excel. */
export const DEFAULT_LABELS = {
  bn: {
    mouza: "মৌজা / জমির পরিমান:", dag: "দাগ নং:",
    savingsDesc: "বিবরণ:", savingsBalance: "বর্তমান স্থিতি:",
    loanDesc: "ঋণের বিবরণ:", loanOutstanding: "অবশিষ্ট ঋণ:",
  },
  en: {
    mouza: "Mouza / Land size:", dag: "Dag no:",
    savingsDesc: "Description:", savingsBalance: "Current balance:",
    loanDesc: "Loan description:", loanOutstanding: "Loan outstanding:",
  },
} as const;

const STORAGE_KEY = "receipt_layout_settings_v1";

function clampSpacing(v: any, fallback = 4): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(2, Math.min(12, Math.round(n))) : fallback;
}

function clampRange(v: any, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

export function getReceiptLayoutSettings(): ReceiptLayoutSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_RECEIPT_LAYOUT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECEIPT_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<ReceiptLayoutSettings>;
    const merged: ReceiptLayoutSettings = { ...DEFAULT_RECEIPT_LAYOUT, ...parsed };
    if (!["comma", "newline", "semicolon"].includes(merged.dagSeparator)) {
      merged.dagSeparator = "comma";
    }
    merged.rowSpacingPx = clampSpacing(merged.rowSpacingPx);
    merged.savingsRowSpacingPx = clampSpacing(
      parsed?.savingsRowSpacingPx ?? DEFAULT_RECEIPT_LAYOUT.savingsRowSpacingPx,
    );
    merged.loanRowSpacingPx = clampSpacing(
      parsed?.loanRowSpacingPx ?? DEFAULT_RECEIPT_LAYOUT.loanRowSpacingPx,
    );
    merged.defaultPaperSize = (parsed?.defaultPaperSize === "a4" ? "a4" : "a5");
    merged.defaultOrientation = (parsed?.defaultOrientation === "l" ? "l" : "p");
    merged.irrigationPagePaddingPx = clampRange(merged.irrigationPagePaddingPx, 24, 72, 48);
    merged.irrigationBottomPaddingPx = clampRange(merged.irrigationBottomPaddingPx, 12, 96, 42);
    merged.holdingBottomPaddingPx = clampRange(merged.holdingBottomPaddingPx, 0, 48, 12);
    merged.fitToPage = parsed?.fitToPage !== undefined ? !!parsed.fitToPage : DEFAULT_RECEIPT_LAYOUT.fitToPage;
    return merged;
  } catch {
    return { ...DEFAULT_RECEIPT_LAYOUT };
  }
}

export function setReceiptLayoutSettings(next: Partial<ReceiptLayoutSettings>): ReceiptLayoutSettings {
  const merged = { ...getReceiptLayoutSettings(), ...next };
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* noop */ }
  }
  return merged;
}

/** Reset all receipt layout settings to defaults. */
export function resetReceiptLayoutSettings(): ReceiptLayoutSettings {
  if (typeof localStorage !== "undefined") {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
  return { ...DEFAULT_RECEIPT_LAYOUT };
}

/** Per-module row spacing — guarantees changes are isolated. */
export function getRowSpacingForKind(kind: "irrigation" | "savings" | "loan"): number {
  const s = getReceiptLayoutSettings();
  if (kind === "savings") return s.savingsRowSpacingPx;
  if (kind === "loan") return s.loanRowSpacingPx;
  return s.rowSpacingPx;
}

/** Return the literal joiner string for the active/passed separator. */
export function dagSeparatorString(sep?: DagSeparator): string {
  const s = sep ?? getReceiptLayoutSettings().dagSeparator;
  switch (s) {
    case "newline": return "\n";
    case "semicolon": return "; ";
    case "comma":
    default: return ", ";
  }
}

/** HTML-safe joiner — converts "\n" to <br/> for HTML rendering. */
export function dagSeparatorHtml(sep?: DagSeparator): string {
  const s = sep ?? getReceiptLayoutSettings().dagSeparator;
  if (s === "newline") return "<br/>";
  if (s === "semicolon") return "; ";
  return ", ";
}

/** Resolve the irrigation mouza/dag labels for the given language —
 *  used by HTML, PDF and Excel renderers so they always match. */
export function getIrrigationLabels(lang: "bn" | "en"): { mouza: string; dag: string } {
  const s = getReceiptLayoutSettings();
  if (lang === "en") {
    return {
      mouza: (s.mouzaLabelEn || "").trim() || DEFAULT_LABELS.en.mouza,
      dag: (s.dagLabelEn || "").trim() || DEFAULT_LABELS.en.dag,
    };
  }
  return {
    mouza: (s.mouzaLabelBn || "").trim() || DEFAULT_LABELS.bn.mouza,
    dag: (s.dagLabelBn || "").trim() || DEFAULT_LABELS.bn.dag,
  };
}

/** Resolve savings labels (per-module override → default). */
export function getSavingsLabels(lang: "bn" | "en"): { desc: string; balance: string } {
  const s = getReceiptLayoutSettings();
  if (lang === "en") return {
    desc: (s.savingsDescLabelEn || "").trim() || DEFAULT_LABELS.en.savingsDesc,
    balance: (s.savingsBalanceLabelEn || "").trim() || DEFAULT_LABELS.en.savingsBalance,
  };
  return {
    desc: (s.savingsDescLabelBn || "").trim() || DEFAULT_LABELS.bn.savingsDesc,
    balance: (s.savingsBalanceLabelBn || "").trim() || DEFAULT_LABELS.bn.savingsBalance,
  };
}

/** Resolve loan labels (per-module override → default). */
export function getLoanLabels(lang: "bn" | "en"): { desc: string; outstanding: string } {
  const s = getReceiptLayoutSettings();
  if (lang === "en") return {
    desc: (s.loanDescLabelEn || "").trim() || DEFAULT_LABELS.en.loanDesc,
    outstanding: (s.loanOutstandingLabelEn || "").trim() || DEFAULT_LABELS.en.loanOutstanding,
  };
  return {
    desc: (s.loanDescLabelBn || "").trim() || DEFAULT_LABELS.bn.loanDesc,
    outstanding: (s.loanOutstandingLabelBn || "").trim() || DEFAULT_LABELS.bn.loanOutstanding,
  };
}

/** Global default paper size for receipt PDFs (A4 or A5). */
export function getDefaultPaperSize(): PaperSize {
  return getReceiptLayoutSettings().defaultPaperSize;
}

/** Global default page orientation for receipt PDFs (portrait or landscape). */
export function getDefaultOrientation(): PaperOrientation {
  return getReceiptLayoutSettings().defaultOrientation;
}

/** One-click presets for common printer paper sizes. Each applies paper size,
 *  orientation and irrigation paddings tuned for that stock. */
export interface ReceiptPaperPreset {
  id: string;
  labelEn: string;
  labelBn: string;
  settings: Partial<ReceiptLayoutSettings>;
}

export const RECEIPT_PAPER_PRESETS: ReceiptPaperPreset[] = [
  {
    id: "a5-landscape",
    labelEn: "A5 Landscape (default)",
    labelBn: "A5 ল্যান্ডস্কেপ (ডিফল্ট)",
    settings: {
      defaultPaperSize: "a5", defaultOrientation: "l",
      irrigationPagePaddingPx: 48, irrigationBottomPaddingPx: 42, holdingBottomPaddingPx: 12,
    },
  },
  {
    id: "a4-portrait",
    labelEn: "A4 Portrait (laser/inkjet)",
    labelBn: "A4 পোর্ট্রেট (লেজার/ইঙ্কজেট)",
    settings: {
      defaultPaperSize: "a4", defaultOrientation: "p",
      irrigationPagePaddingPx: 56, irrigationBottomPaddingPx: 48, holdingBottomPaddingPx: 16,
    },
  },
  {
    id: "a4-landscape",
    labelEn: "A4 Landscape (wide)",
    labelBn: "A4 ল্যান্ডস্কেপ (চওড়া)",
    settings: {
      defaultPaperSize: "a4", defaultOrientation: "l",
      irrigationPagePaddingPx: 48, irrigationBottomPaddingPx: 42, holdingBottomPaddingPx: 12,
    },
  },
  {
    id: "compact-thermal",
    labelEn: "Compact / Dot-matrix (tight)",
    labelBn: "কমপ্যাক্ট / ডট-ম্যাট্রিক্স (আঁটসাঁট)",
    settings: {
      defaultPaperSize: "a5", defaultOrientation: "l",
      irrigationPagePaddingPx: 24, irrigationBottomPaddingPx: 12, holdingBottomPaddingPx: 0,
    },
  },
];

/** Apply a named preset and persist it. Returns the merged settings. */
export function applyReceiptPreset(id: string): ReceiptLayoutSettings {
  const preset = RECEIPT_PAPER_PRESETS.find((p) => p.id === id);
  if (!preset) return getReceiptLayoutSettings();
  return setReceiptLayoutSettings(preset.settings);
}

/** Best-effort match of the current settings to a known preset id (or ""). */
export function detectActiveReceiptPreset(s?: ReceiptLayoutSettings): string {
  const cur = s ?? getReceiptLayoutSettings();
  const match = RECEIPT_PAPER_PRESETS.find((p) =>
    Object.entries(p.settings).every(([k, v]) => (cur as any)[k] === v),
  );
  return match?.id ?? "";
}

/** Configurable irrigation receipt paddings (px) for printer alignment. */
export function getIrrigationReceiptPadding(): {
  page: number;
  bottom: number;
  holdingBottom: number;
} {
  const s = getReceiptLayoutSettings();
  return {
    page: s.irrigationPagePaddingPx,
    bottom: s.irrigationBottomPaddingPx,
    holdingBottom: s.holdingBottomPaddingPx,
  };
}

/** Whether receipts should be scaled to fit a single page (preview + PDF). */
export function getReceiptFitToPage(): boolean {
  return getReceiptLayoutSettings().fitToPage;
}
