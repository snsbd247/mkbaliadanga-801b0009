/**
 * Lazy loader for the Noto Sans Bengali font. Registers it with jsPDF VFS
 * exactly once per process so PDF reports can render real Bangla glyphs
 * (instead of falling back to transliteration like "Pristha"/"Mudrito").
 *
 * Usage:
 *   await ensureBanglaFont(doc);
 *   if (lang === "bn") doc.setFont("NotoSansBengali", "normal");
 */
import type jsPDF from "jspdf";

const FONT_URL = "/fonts/NotoSansBengali-Regular.ttf";
const FONT_VFS_NAME = "NotoSansBengali-Regular.ttf";
const FONT_FAMILY = "NotoSansBengali";

let cachedBase64: string | null = null;
let inflight: Promise<string> | null = null;
const registered = new WeakSet<object>();

async function fetchFontBase64(): Promise<string> {
  if (cachedBase64) return cachedBase64;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`Failed to load Bangla font (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 1024) throw new Error("Bangla font payload too small");
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    cachedBase64 = btoa(bin);
    return cachedBase64;
  })();
  return inflight;
}

/** Register the font on the given jsPDF instance. Returns true on success. */
export async function ensureBanglaFont(doc: jsPDF): Promise<boolean> {
  if (registered.has(doc)) return true;
  try {
    const b64 = await fetchFontBase64();
    (doc as any).addFileToVFS(FONT_VFS_NAME, b64);
    (doc as any).addFont(FONT_VFS_NAME, FONT_FAMILY, "normal");
    registered.add(doc);
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[pdf] Bangla font unavailable, falling back to default:", e);
    return false;
  }
}

export const BANGLA_FONT = FONT_FAMILY;
