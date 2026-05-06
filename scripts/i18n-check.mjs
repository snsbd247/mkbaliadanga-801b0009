#!/usr/bin/env node
/**
 * CI gate: fail when missing translation keys are detected.
 *
 * Strategy: load src/i18n/translations.ts as text, parse the en/bn key sets,
 * and assert every key present in `en` has a non-empty value in `bn` (and vice versa).
 * Exits with code 1 on mismatch — wire into CI via `node scripts/i18n-check.mjs`.
 */
import { readFileSync } from "node:fs";

const src = readFileSync("src/i18n/translations.ts", "utf8");

function extractBlock(name) {
  // Match "  en: { ... },\n  bn: { ... }" objects.
  const re = new RegExp(`\\b${name}\\s*:\\s*\\{`, "g");
  const m = re.exec(src);
  if (!m) throw new Error(`Block ${name} not found`);
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return src.slice(m.index + m[0].length, i - 1);
}

function keys(block) {
  const out = new Map();
  // crude scan: lines like `  someKey: "value",`
  const re = /^\s*([A-Za-z_][\w]*)\s*:\s*"((?:[^"\\]|\\.)*)"/gm;
  let m;
  while ((m = re.exec(block))) out.set(m[1], m[2]);
  return out;
}

const enBlock = extractBlock("en");
const bnBlock = extractBlock("bn");
const en = keys(enBlock);
const bn = keys(bnBlock);

const missingInBn = [...en.keys()].filter(k => !bn.has(k) || bn.get(k) === "");
const missingInEn = [...bn.keys()].filter(k => !en.has(k) || en.get(k) === "");

if (!missingInBn.length && !missingInEn.length) {
  console.log(`✓ i18n parity OK — ${en.size} keys, both languages complete.`);
  process.exit(0);
}

if (missingInBn.length) {
  console.error(`✗ ${missingInBn.length} key(s) missing/empty in BN:`);
  missingInBn.slice(0, 50).forEach(k => console.error("  -", k));
  if (missingInBn.length > 50) console.error(`  …and ${missingInBn.length - 50} more`);
}
if (missingInEn.length) {
  console.error(`✗ ${missingInEn.length} key(s) missing/empty in EN:`);
  missingInEn.slice(0, 50).forEach(k => console.error("  -", k));
}
process.exit(1);
