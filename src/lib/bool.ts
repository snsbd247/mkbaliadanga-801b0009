// Shared boolean coercion helper.
//
// Postgres/PostgREST sometimes returns boolean-ish columns (is_voter, enabled,
// active flags) as the numbers 0/1 or the strings "0"/"1"/"true"/"false"
// instead of real booleans. Using such a value directly with `&&` in JSX can
// render an unexpected `0` (e.g. the notorious "00") in the UI.
//
// Always run these values through `toBool()` before conditional rendering.

export function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "" || s === "0" || s === "false" || s === "no" || s === "null" || s === "undefined") return false;
    return true;
  }
  if (v === null || v === undefined) return false;
  // Unexpected type (object, etc.) — warn and fall back to a safe boolean.
  if (typeof console !== "undefined") {
    console.warn("[toBool] unexpected value type for boolean field:", v);
  }
  return Boolean(v);
}
