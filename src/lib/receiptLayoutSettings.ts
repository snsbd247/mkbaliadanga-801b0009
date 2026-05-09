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
  /** Vertical padding (px) applied to each receipt row. 2-12. */
  rowSpacingPx: number;
}

export const DEFAULT_RECEIPT_LAYOUT: ReceiptLayoutSettings = {
  dagSeparator: "comma",
  mouzaLabelBn: "",
  mouzaLabelEn: "",
  dagLabelBn: "",
  dagLabelEn: "",
  rowSpacingPx: 4,
};

const STORAGE_KEY = "receipt_layout_settings_v1";

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
    const sp = Number(merged.rowSpacingPx);
    merged.rowSpacingPx = Number.isFinite(sp) ? Math.max(2, Math.min(12, Math.round(sp))) : 4;
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
