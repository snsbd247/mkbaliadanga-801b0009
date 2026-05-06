#!/usr/bin/env node
/**
 * Unused / under-used translation key detector.
 *
 * Scans every key declared in src/i18n/translations.ts (en block) and reports
 * any key that is never referenced as t("key") or t('key') anywhere under src/.
 *
 *   node scripts/i18n-unused.mjs           # report only (exit 0)
 *   node scripts/i18n-unused.mjs --warn    # warn but pass CI (exit 0)
 *   node scripts/i18n-unused.mjs --fail    # exit 1 if any unused key found
 *   node scripts/i18n-unused.mjs --threshold=20  # fail only above N unused
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const args = process.argv.slice(2);
const FAIL = args.includes("--fail");
const WARN = args.includes("--warn");
const THRESHOLD = (() => {
  const a = args.find(x => x.startsWith("--threshold="));
  return a ? parseInt(a.split("=")[1], 10) : 0;
})();

const tSrc = readFileSync("src/i18n/translations.ts", "utf8");
function extractBlock(name) {
  const re = new RegExp(`\\b${name}\\s*:\\s*\\{`, "g");
  const m = re.exec(tSrc); if (!m) throw new Error(`Block ${name} not found`);
  let i = m.index + m[0].length, depth = 1;
  while (i < tSrc.length && depth > 0) {
    const ch = tSrc[i]; if (ch === "{") depth++; else if (ch === "}") depth--; i++;
  }
  return tSrc.slice(m.index + m[0].length, i - 1);
}
const enBlock = extractBlock("en");
const KEYS = [...enBlock.matchAll(/^\s*([A-Za-z_][\w]*)\s*:/gm)].map(m => m[1]);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f); const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !p.includes("i18n/translations.ts")) out.push(p);
  }
  return out;
}

const files = walk("src");
const used = new Set();
const callRe = /\bt\(\s*["'`]([A-Za-z_][\w]*)["'`]\s*[\),]/g;
// Also treat any string literal that looks like an i18n key referenced as
// `labelKey: "..."`, `key: "..."`, or inside a TYPE_META/SUMMARY map as used.
const refRe = /\b(labelKey|messageKey|titleKey|i18nKey)\s*:\s*["']([A-Za-z_][\w]*)["']/g;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  let m;
  while ((m = callRe.exec(src))) used.add(m[1]);
  while ((m = refRe.exec(src))) used.add(m[2]);
}

const unused = KEYS.filter(k => !used.has(k));
const reportPath = "docs/i18n-unused-report.md";
mkdirSync(dirname(reportPath), { recursive: true });
const md = [
  `# Unused i18n keys`,
  ``,
  `Total keys: **${KEYS.length}** · Referenced: **${KEYS.length - unused.length}** · Unused: **${unused.length}**`,
  ``,
  unused.length ? unused.map(k => `- \`${k}\``).join("\n") : "_None — every key is referenced._",
  ``,
].join("\n");
writeFileSync(reportPath, md);

console.log(`Total: ${KEYS.length}  Used: ${KEYS.length - unused.length}  Unused: ${unused.length}`);
console.log(`Report written to ${reportPath}`);
if (unused.length && unused.length <= 50) {
  console.log("\nFirst unused keys:");
  unused.slice(0, 50).forEach(k => console.log("  -", k));
}

if (FAIL && unused.length > THRESHOLD) {
  console.error(`\n✗ Unused i18n keys (${unused.length}) exceed threshold (${THRESHOLD}).`);
  process.exit(1);
}
if (WARN && unused.length) {
  console.warn(`⚠ ${unused.length} unused translation keys — see ${reportPath}.`);
}
process.exit(0);
