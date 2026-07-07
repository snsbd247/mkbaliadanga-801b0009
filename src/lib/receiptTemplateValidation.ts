/**
 * Pure validators for the Receipt Template form (watermark + serial number).
 * Kept framework-free so they can be unit-tested and reused by the page and
 * any automated checks. Messages are bilingual (Bangla / English).
 */

export function validateSerialStart(serialStart: string): string | null {
  const raw = String(serialStart ?? "").trim();
  if (raw === "") return "শুরুর ক্রমিক নম্বর দিতে হবে / Serial start is required";
  if (!/^\d+$/.test(raw)) return "শুধু ধনাত্মক পূর্ণসংখ্যা দেওয়া যাবে / Only positive whole numbers allowed";
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return "ক্রমিক নম্বর ঋণাত্মক হতে পারবে না / Serial cannot be negative";
  if (n > 9000000000) return "ক্রমিক নম্বর অনেক বড় / Serial is too large";
  return null;
}

export function validateWatermark(showWatermark: boolean, watermarkText: string): string | null {
  if (!showWatermark) return null;
  const raw = String(watermarkText ?? "");
  if (raw.trim() === "") return "ওয়াটারমার্ক টেক্সট দিতে হবে / Watermark text is required";
  if (raw.length > 40) return "ওয়াটারমার্ক টেক্সট ৪০ অক্ষরের বেশি হতে পারবে না / Watermark text must be 40 characters or fewer";
  return null;
}
