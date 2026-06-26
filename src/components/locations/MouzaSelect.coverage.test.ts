import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Guard test: every editable Mouza field across the app must use <MouzaSelect>,
 * never a raw free-text <Input>. This catches regressions in future edits.
 *
 * Heuristic: if a .tsx file under src renders an <Input> whose surrounding JSX
 * references "mouza" (case-insensitive) by attribute/state, it must also import
 * MouzaSelect. Pure search boxes are allowed (they include a search hint).
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("Mouza field coverage", () => {
  const files = walk(SRC);

  it("finds source files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("does not bind a free-text <Input> to a mouza value/handler", () => {
    const offenders: string[] = [];
    // Capital <Input> (shadcn) whose value/onChange binds to a mouza identifier.
    // Excludes search boxes (value={search}) and label settings (lowercase <input>).
    const inputMouza =
      /<Input\b[^>]*\b(value|onChange)\s*=\s*\{[^}]*mouza/;

    for (const f of files) {
      if (f.endsWith("MouzaSelect.tsx")) continue;
      if (f.includes("test") || f.includes("__tests__")) continue;
      const txt = readFileSync(f, "utf8");
      if (inputMouza.test(txt)) {
        offenders.push(f.replace(process.cwd() + "/", ""));
      }
    }

    expect(
      offenders,
      `These files bind a raw <Input> to a mouza field; use <MouzaSelect> instead:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
