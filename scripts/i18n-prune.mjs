#!/usr/bin/env node
/**
 * Remove unused translation keys from src/i18n/translations.ts.
 * Reads docs/i18n-unused-report.md (run `npm run i18n:unused` first).
 * Strips matching `key: "..."` lines from BOTH the en and bn blocks.
 */
import { readFileSync, writeFileSync } from "node:fs";

const report = readFileSync("docs/i18n-unused-report.md", "utf8");
const unused = [...report.matchAll(/^- `([A-Za-z_]\w*)`/gm)].map(m => m[1]);
if (!unused.length) { console.log("No unused keys to remove."); process.exit(0); }

const PROTECT = new Set([
  // Auth / signup paths still required by Auth.tsx even if scanner missed them.
  "signup", "createAccount", "signUpDesc",
]);
const targets = unused.filter(k => !PROTECT.has(k));

const path = "src/i18n/translations.ts";
let src = readFileSync(path, "utf8");
const before = src.length;
let removed = 0;
for (const k of targets) {
  const re = new RegExp(`^[ \\t]*${k}\\s*:\\s*"(?:[^"\\\\]|\\\\.)*",?\\s*\\n`, "gm");
  const next = src.replace(re, () => { removed++; return ""; });
  src = next;
}
writeFileSync(path, src);
console.log(`Removed ${removed} key occurrences (${targets.length} keys × up to 2 blocks). File: ${before} → ${src.length} bytes.`);
