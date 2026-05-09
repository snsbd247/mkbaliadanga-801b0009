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
 * Run:
 *   node scripts/i18n-scan.mjs            # informative report
 *   node scripts/i18n-scan.mjs --ci       # fail when counts exceed baseline
 *   node scripts/i18n-scan.mjs --update   # rewrite baseline
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/pages", "src/components"];
const SKIP = [/i18n\//, /__tests__/, /\/test\//, /integrations\//, /bnNumber\.ts$/, /bnReceipts\.ts$/, /components\/ui\//];
const BN = /[\u0980-\u09FF]{2,}/;
const BASELINE = "scripts/i18n-scan-baseline.json";
const args = new Set(process.argv.slice(2));

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

// Lines we ignore even if they contain Bangla/English literals.
//   - JS/TS line comments and JSDoc/block-comment bodies
//   - Bilingual seed/data fields like  name_bn: "..."  / label_bn: "..."
//   - Sample CSV/template rows ([ "...", "..." ])
//   - Lines guarded by  lang === "bn" / "en"  ternaries (already i18n-aware)
//   - Lines INSIDE a local i18n block:  bn: { ... }  /  en: { ... }
//   - SMS template defaults:  tpl_<name>(_en)?: "..."
const isCommentLine = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);
const isSeedDataField = (l) => /\b(name_bn|label_bn|title_bn|desc_bn|company_name_bn|name_en|label_en|title_en)\s*:/.test(l);
const isLangGuarded = (l) => /lang\s*===\s*["'](bn|en)["']|case\s+["'](bn|en)["']|\?\s*["'][^"']*[\u0980-\u09FF]|\w+\(\s*["'][^"']*["']\s*,\s*["'][^"']*[\u0980-\u09FF]/.test(l);
const isSampleArrayRow = (l) => /^\s*\[\s*"/.test(l) && /,\s*"/.test(l);
const isTemplateDefault = (l) => /^\s*tpl_[a-z_]+(_en)?\s*:\s*["'`]/.test(l);
const isI18nBlockOpen = (l) => /^\s*(en|bn)\s*:\s*\{\s*$/.test(l);

const files = ROOTS.flatMap(r => walk(r));
const findings = [];
for (const file of files) {
  if (SKIP.some(re => re.test(file))) continue;
  const src = readFileSync(file, "utf8");
  const usesT = /from ["']@\/i18n\/LanguageProvider["']/.test(src);

  // Capture i18n-ignore lines BEFORE stripping comments (so block comments still mark the line).
  const rawLines = src.split("\n");
  const ignoreSet = new Set(rawLines.map((l, i) => /i18n-ignore/.test(l) ? i : -1).filter(i => i >= 0));
  // Strip block comments before line-by-line scan
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  let inI18nBlock = false;
  let i18nBraceDepth = 0;
  stripped.split("\n").forEach((line, i) => {
    if (ignoreSet.has(i)) return;
    // Track i18n dict block (bn: { ... }  or  en: { ... })
    if (!inI18nBlock && isI18nBlockOpen(line)) {
      inI18nBlock = true;
      i18nBraceDepth = 1;
      return;
    }
    if (inI18nBlock) {
      // count braces to find the closing brace of this block
      for (const ch of line) {
        if (ch === "{") i18nBraceDepth++;
        else if (ch === "}") i18nBraceDepth--;
      }
      if (i18nBraceDepth <= 0) inI18nBlock = false;
      return;
    }
    if (isCommentLine(line) || isSeedDataField(line) || isLangGuarded(line) || isSampleArrayRow(line) || isTemplateDefault(line)) return;
    if (/i18n-ignore/.test(line)) return;
    if (BN.test(line) && !/\bt\(|\btx\(/.test(line)) {
      findings.push({ file, line: i + 1, kind: "bn", text: line.trim().slice(0, 140) });
    }
    const m = line.match(/>([A-Z][A-Za-z][A-Za-z ,.'!?-]{6,60})</);
    if (m && !usesT && !/import|from |\/\//.test(line)) {
      findings.push({ file, line: i + 1, kind: "en", text: m[1] });
    }
  });
}

const counts = findings.reduce((m, f) => ((m[f.file] = (m[f.file] || 0) + 1), m), {});

if (args.has("--update")) {
  writeFileSync(BASELINE, JSON.stringify({ generatedAt: new Date().toISOString(), counts }, null, 2));
  console.log(`Baseline updated: ${Object.keys(counts).length} files, ${findings.length} findings.`);
  process.exit(0);
}

if (findings.length === 0) {
  console.log("✓ i18n scan clean — no obvious hardcoded UI strings.");
  process.exit(0);
}
console.log(`⚠ ${findings.length} hardcoded UI string(s) found across ${Object.keys(counts).length} file(s).`);

if (args.has("--ci")) {
  if (!existsSync(BASELINE)) {
    console.error(`✗ Baseline ${BASELINE} missing. Run 'npm run i18n:scan:update' to create it.`);
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(BASELINE, "utf8")).counts || {};
  const regressions = [];
  for (const [file, n] of Object.entries(counts)) {
    const prev = base[file] ?? 0;
    if (n > prev) regressions.push({ file, prev, now: n });
  }
  if (regressions.length) {
    console.error("\n✗ Regression — new hardcoded strings vs baseline:");
    for (const r of regressions) console.error(`  ${r.file}: ${r.prev} → ${r.now}`);
    console.error("\nReplace the new literals with t() keys, or run 'npm run i18n:scan:update' if intentional.");
    process.exit(1);
  }
  console.log("✓ No regressions vs baseline.");
  process.exit(0);
}

const byFile = findings.reduce((m, f) => ((m[f.file] ??= []).push(f), m), {});
for (const [file, list] of Object.entries(byFile)) {
  console.log(`\n  ${file}  (${list.length})`);
  for (const f of list.slice(0, 8)) console.log(`    L${f.line}  [${f.kind}]  ${f.text}`);
  if (list.length > 8) console.log(`    … +${list.length - 8} more`);
}
process.exit(0);
