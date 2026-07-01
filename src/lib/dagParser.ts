// Dag number parsing/validation helper shared by LandsImport.
//
// Rules:
//  - A slash (e.g. "1/330") is part of a SINGLE valid dag — never split, never warned.
//  - Comma (,) and semicolon (;) separate MULTIPLE dags.
//  - A JSON array (e.g. ["1/330","2/40"]) is accepted as multiple dags.
//  - A pipe (|) is unsupported and only produces a warning (row still imports).
//  - Leading/trailing whitespace is always trimmed; rows are never skipped by default.

export type DagSeparator = "none" | "comma" | "semicolon" | "json" | "pipe";

export type DagAnalysis = {
  raw: string;
  numbers: string[];
  separator: DagSeparator;
  blocked: boolean; // dag_no never blocks a row
  warned: boolean;
  warnMsg: string | null;
};

/** Parse a dag_no cell into an array of individual dag numbers. */
export function parseDagNumbers(input: unknown): string[] {
  const str = input == null ? "" : String(input).trim();
  if (!str) return [];
  if (/^\s*\[.*\]\s*$/.test(str)) {
    try {
      return (JSON.parse(str) as unknown[]).map((s) => String(s).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  return str
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Analyze a dag_no cell for the import preview/error panel. */
export function analyzeDagNo(input: unknown): DagAnalysis {
  const raw = input == null ? "" : String(input).trim();
  const numbers = parseDagNumbers(raw);

  let separator: DagSeparator = "none";
  if (/^\s*\[.*\]\s*$/.test(raw)) separator = "json";
  else if (/\|/.test(raw)) separator = "pipe";
  else if (/;/.test(raw)) separator = "semicolon";
  else if (/,/.test(raw)) separator = "comma";

  const isPipe = separator === "pipe";
  return {
    raw,
    numbers,
    separator,
    blocked: false,
    warned: isPipe,
    warnMsg: isPipe
      ? `dag_no: একাধিক দাগ কমা (,) বা সেমিকোলন (;) দিয়ে দিন — পাওয়া গেছে "${raw}"`
      : null,
  };
}
