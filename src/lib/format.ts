export const money = (n: number | null | undefined) =>
  "৳ " + (Number(n ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB");
};
