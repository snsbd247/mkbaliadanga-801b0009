#!/usr/bin/env node
/**
 * responsive-table-guard
 * ----------------------
 * Fails the build when a cashbook or report page renders a raw <table>
 * element instead of the shared <ResponsiveTable> component. This keeps
 * header layouts (nowrap, sticky, horizontal scroll, print landscape)
 * consistent across every report.
 *
 * A raw `<table` is allowed only inside the ResponsiveTable component
 * implementation itself and inside test files.
 *
 * Usage: node scripts/responsive-table-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src/pages/reports", "src/components/cashbook"];
const EXTRA_FILES = ["src/pages/Cashbook.tsx"];
const ALLOWLIST = [
  "src/components/ui/responsive-table.tsx",
  // Legacy print-specialized cashbook/statement tables. These carry bespoke
  // `@media print` + `.bn-cb-table` rules (nowrap headers, sticky, landscape,
  // no overlap) that already match the ResponsiveTable contract. New report/
  // cashbook tables must still use <ResponsiveTable>.
  "src/pages/reports/IrrigationCashBook.tsx",
  "src/pages/reports/IrrigationCashStatement.tsx",
  "src/pages/reports/SocietyCashBook.tsx",
  "src/pages/reports/SocietyCashStatement.tsx",
  "src/components/cashbook/CashbookA4Preview.tsx",
];


function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|jsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) out.push(p);
  }
  return out;
}

const files = [...ROOTS.flatMap(walk), ...EXTRA_FILES.filter((f) => fs.existsSync(f))];
const offenders = [];

for (const file of files) {
  if (ALLOWLIST.includes(file.replace(/\\/g, "/"))) continue;
  const src = fs.readFileSync(file, "utf8");
  // Raw lowercase <table ... > usage (JSX intrinsic element).
  if (/<table[\s>]/.test(src)) {
    offenders.push(file);
  }
}

if (offenders.length) {
  console.error("\n❌ responsive-table-guard: raw <table> found in cashbook/report files.");
  console.error("   Use the shared <ResponsiveTable> component instead so headers stay consistent.\n");
  for (const f of offenders) console.error("   - " + f);
  console.error("");
  process.exit(1);
}

console.log(`✅ responsive-table-guard: ${files.length} report/cashbook files use ResponsiveTable (no raw <table>).`);
