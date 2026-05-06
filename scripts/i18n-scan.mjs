#!/usr/bin/env node
/**
 * Hardcoded-string scanner for the app.
 *
 * Heuristics:
 *  - Bangla letter run (\u0980-\u09FF) outside src/i18n, src/lib/bnNumber.ts,
 *    src/lib/bnReceipts.ts (PDF receipt template — intentionally Bangla-only).
 *  - JSX text that looks like an English UI sentence (>= 2 words, capitalised),
 *    when the file does not import useLang.
 *
 * Run:  node scripts/i18n-scan.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/pages", "src/components"];
const SKIP = [/i18n\//, /__tests__/, /\/test\//, /integrations\//, /bnNumber\.ts$/, /bnReceipts\.ts$/];
const BN = /[\u0980-\u09FF]{2,}/;

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap(r => walk(r));
const findings = [];
for (const file of files) {
  if (SKIP.some(re => re.test(file))) continue;
  const src = readFileSync(file, "utf8");
  const usesT = /from ["']@\/i18n\/LanguageProvider["']/.test(src);
  src.split("\n").forEach((line, i) => {
    if (BN.test(line) && !/lang ===|"bn"|case "bn"|t\(/.test(line)) {
      findings.push({ file, line: i + 1, kind: "bn", text: line.trim().slice(0, 140) });
    }
    // English JSX text heuristic
    const m = line.match(/>([A-Z][A-Za-z][A-Za-z ,.'!?-]{6,60})</);
    if (m && !usesT && !/import|from |\/\//.test(line)) {
      findings.push({ file, line: i + 1, kind: "en", text: m[1] });
    }
  });
}

if (findings.length === 0) {
  console.log("✓ i18n scan clean — no obvious hardcoded UI strings.");
  process.exit(0);
}
console.log(`⚠ ${findings.length} hardcoded UI string(s) found:\n`);
const byFile = findings.reduce((m, f) => ((m[f.file] ??= []).push(f), m), {});
for (const [file, list] of Object.entries(byFile)) {
  console.log(`  ${file}`);
  for (const f of list) console.log(`    L${f.line}  [${f.kind}]  ${f.text}`);
}
process.exit(0);
