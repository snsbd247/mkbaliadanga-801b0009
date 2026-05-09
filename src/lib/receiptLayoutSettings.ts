// Admin-configurable layout for irrigation receipts (multi-dag rendering,
// custom row labels, row spacing). Persisted in localStorage so the same
// preferences apply across PDF/HTML and Excel exports without affecting
// other modules (savings/loan receipts, lands/voter exports, etc.).

export type DagSeparator = "comma" | "newline" | "semicolon";

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
