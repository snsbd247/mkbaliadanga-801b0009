#!/usr/bin/env node
/**
 * CI gate: i18n parity check.
 *
 * Compares EN ↔ BN keys in src/i18n/translations.ts.
 * Uses scripts/i18n-baseline.json to allow currently-known gaps; fails on regressions.
 *
 *   node scripts/i18n-check.mjs           # informative + fails on regressions
 *   node scripts/i18n-check.mjs --update  # rewrite baseline (after intentional changes)
 *   node scripts/i18n-check.mjs --strict  # fail on ANY missing key (no baseline)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const src = readFileSync("src/i18n/translations.ts", "utf8");

function extractBlock(name) {
  const re = new RegExp(`\\b${name}\\s*:\\s*\\{`, "g");
  const m = re.exec(src);
  if (!m) throw new Error(`Block ${name} not found`);
  let i = m.index + m[0].length, depth = 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth++; else if (ch === "}") depth--;
    i++;
  }
  return src.slice(m.index + m[0].length, i - 1);
}
function keys(block) {
  const out = new Map();
  const re = /^\s*([A-Za-z_][\w]*)\s*:\s*"((?:[^"\\]|\\.)*)"/gm;
  let m; while ((m = re.exec(block))) out.set(m[1], m[2]);
  return out;
}

const en = keys(extractBlock("en"));
const bn = keys(extractBlock("bn"));
const missingInBn = [...en.keys()].filter(k => !bn.has(k) || bn.get(k) === "");
const missingInEn = [...bn.keys()].filter(k => !en.has(k) || en.get(k) === "");

const baselinePath = "scripts/i18n-baseline.json";
let baseline = { missingInBn: [], missingInEn: [] };
if (existsSync(baselinePath)) baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

if (args.has("--update")) {
  writeFileSync(baselinePath, JSON.stringify({ missingInBn, missingInEn }, null, 2));
  console.log(`Baseline updated: ${missingInBn.length} BN, ${missingInEn.length} EN gaps recorded.`);
  process.exit(0);
}

const baseSetBn = new Set(baseline.missingInBn);
const baseSetEn = new Set(baseline.missingInEn);
const newMissingBn = missingInBn.filter(k => !baseSetBn.has(k));
const newMissingEn = missingInEn.filter(k => !baseSetEn.has(k));

console.log(`Total keys: EN=${en.size} BN=${bn.size}`);
console.log(`Gaps:  BN missing=${missingInBn.length} (baseline ${baselinePath ? baseline.missingInBn.length : 0}), EN missing=${missingInEn.length}`);

if (args.has("--strict") && (missingInBn.length || missingInEn.length)) {
  console.error("✗ Strict mode: missing keys present.");
  process.exit(1);
}

if (newMissingBn.length || newMissingEn.length) {
  console.error("\n✗ Regression — new missing keys vs baseline:");
  if (newMissingBn.length) {
    console.error(`  BN missing (+${newMissingBn.length}):`);
    newMissingBn.slice(0, 30).forEach(k => console.error("    -", k));
  }
  if (newMissingEn.length) {
    console.error(`  EN missing (+${newMissingEn.length}):`);
    newMissingEn.slice(0, 30).forEach(k => console.error("    -", k));
  }
  console.error("\nFix the above keys, or run `node scripts/i18n-check.mjs --update` after intentional edits.");
  process.exit(1);
}

console.log("✓ i18n parity check passed (no regressions).");
process.exit(0);
