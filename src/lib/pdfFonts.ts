/**
 * Lazy loader for Bengali fonts in jsPDF. Tries the user's preferred font
 * first; on failure walks the fallback chain (see banglaFonts.ts) so PDFs
 * never render as boxes when one font is unreachable.
 *
 * Usage:
 *   const family = await ensureBanglaFont(doc);
 *   if (lang === "bn" && family) doc.setFont(family, "normal");
 */
import type jsPDF from "jspdf";
import { getBanglaFontChain, type BanglaFontDef } from "./banglaFonts";

const cache = new Map<string, string>();           // url -> base64
const inflight = new Map<string, Promise<string>>();
const registered = new WeakMap<object, Set<string>>(); // doc -> family names

async function fetchFontBase64(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) return cached;
  const existing = inflight.get(url);
  if (existing) return existing;
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Font ${url} → ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 1024) throw new Error(`Font payload too small: ${url}`);
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    cache.set(url, b64);
    return b64;
  })();
  inflight.set(url, p);
  try { return await p; } finally { inflight.delete(url); }
}

async function tryRegister(doc: jsPDF, font: BanglaFontDef): Promise<boolean> {
  try {
    const set = registered.get(doc) ?? new Set<string>();
    if (set.has(font.family)) { registered.set(doc, set); return true; }
    const b64 = await fetchFontBase64(font.url);
    (doc as any).addFileToVFS(font.vfsName, b64);
    (doc as any).addFont(font.vfsName, font.family, "normal");
    set.add(font.family);
    registered.set(doc, set);
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[pdf] Bangla font "${font.family}" failed:`, e);
    return false;
  }
}

/**
 * Register Bangla fonts on the doc, walking the user's preferred chain.
 * Returns the family name to call `doc.setFont(family, "normal")` with,
 * or `null` if every fallback failed (caller should keep the default font).
 */
export async function ensureBanglaFont(doc: jsPDF): Promise<string | null> {
  for (const font of getBanglaFontChain()) {
    if (await tryRegister(doc, font)) return font.family;
  }
  return null;
}

/** Back-compat: legacy default family name. */
export const BANGLA_FONT = "NotoSansBengali";
