import { computeLandAmount } from "@/lib/landMath";
import { getRoundingMode } from "@/lib/rounding";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";

type Props = {
  landSize: number | null | undefined;
  rate: number | null | undefined;
  /** Label for what is being charged, e.g. "Irrigation", "Loan", "Savings". */
  label?: string;
};

const ROUNDING_LABEL: Record<string, { en: string; bn: string }> = {
  half_up: { en: "≥ 0.50 rounds up, < 0.50 rounds down", bn: "০.৫০ বা তার বেশি হলে উপরে, কম হলে নিচে" },
  half_even: { en: "rounds to nearest even (banker's)", bn: "নিকটতম জোড় সংখ্যায় (ব্যাংকার্স)" },
  floor: { en: "always rounds down", bn: "সবসময় নিচে" },
  ceil: { en: "always rounds up", bn: "সবসময় উপরে" },
};

/**
 * Shows how land size × rate becomes a money amount, with the rounding rule.
 * Land area stays exact (3 decimals); only the final taka figure is rounded.
 */
export function LandAmountBreakdown({ landSize, rate, label }: Props) {
  const { tx } = useLang();
  const size = Number(landSize ?? 0);
  const r = Number(rate ?? 0);
  if (!(size > 0) || !(r > 0)) return null;

  const b = computeLandAmount(size, r);
  const mode = getRoundingMode();
  const rule = ROUNDING_LABEL[mode] ?? ROUNDING_LABEL.half_up;

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
      <div className="font-medium">{label ? `${label} — ` : ""}{tx("Calculation breakdown", "হিসাব বিবরণ")}</div>
      <div className="flex justify-between">
        <span>{tx("Land size", "জমির পরিমাণ")}</span>
        <span className="font-mono">{b.landSize} {tx("shatak", "শতক")}</span>
      </div>
      <div className="flex justify-between">
        <span>{tx("Rate / shatak", "দর / শতক")}</span>
        <span className="font-mono">{money(b.rate)}</span>
      </div>
      <div className="flex justify-between border-t pt-1">
        <span>{tx("Exact amount", "প্রকৃত পরিমাণ")} ({b.landSize} × {money(b.rate)})</span>
        <span className="font-mono">{b.raw.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span>
      </div>
      <div className="flex justify-between font-semibold">
        <span>{tx("Payable (rounded)", "প্রদেয় (রাউন্ড)")}</span>
        <span className="font-mono">{money(b.rounded)}</span>
      </div>
      <div className="text-muted-foreground pt-1">
        {tx("Rounding rule", "রাউন্ডিং নিয়ম")}: {tx(rule.en, rule.bn)}
      </div>
    </div>
  );
}
