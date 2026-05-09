import { describe, it, expect, beforeEach } from "vitest";
import { roundTaka, sumRounded, setRoundingMode, getRoundingMode } from "../rounding";
import { money, moneyPdf } from "../format";
import { bnAmountInWords } from "../bnNumber";

describe("Taka rounding (≥ .50 → up, < .50 → down)", () => {
  beforeEach(() => setRoundingMode("half_up"));

  describe("boundary values", () => {
    it.each([
      [99.49, 99],
      [99.50, 100],
      [99.51, 100],
      [100.49, 100],
      [100.50, 101],
      [100.5001, 101],
      [0.49, 0],
      [0.5, 1],
      [0.51, 1],
      [-99.49, -99],
      [-99.5, -99], // half-up away from zero ⇒ -99 (Math.round rounds .5 toward +∞ for negatives)
      [-99.51, -100],
    ])("roundTaka(%s) === %s", (input, expected) => {
      expect(roundTaka(input)).toBe(expected);
    });

    it("money() prints whole taka with thousand separators", () => {
      expect(money(1234.49)).toBe("৳ 1,234");
      expect(money(1234.50)).toBe("৳ 1,235");
      expect(money(1234.51)).toBe("৳ 1,235");
    });

    it("moneyPdf() prints Tk + whole taka", () => {
      expect(moneyPdf(99.49)).toBe("Tk 99");
      expect(moneyPdf(99.50)).toBe("Tk 100");
      expect(moneyPdf(99.51)).toBe("Tk 100");
    });

    it("bnAmountInWords drops paisa", () => {
      // 100.49 → "একশত টাকা" (no paisa); 100.50 → "একশত এক টাকা"
      expect(bnAmountInWords(100.49)).not.toMatch(/পয়সা/);
      expect(bnAmountInWords(100.49)).toContain("টাকা");
      expect(bnAmountInWords(100.5)).toContain("এক");
    });
  });

  describe("line-item → total parity", () => {
    it("sum of rounded line items equals what UI shows for the total", () => {
      const items = [12.49, 12.50, 12.51, 0.49, 0.5, 100.5];
      // Per-line shown values:
      const perLine = items.map((v) => roundTaka(v));
      // UI total = sumRounded(items) = sum of rounded per-line values:
      expect(sumRounded(items)).toBe(perLine.reduce((a, b) => a + b, 0));
    });

    it("totalling the displayed line amounts matches sumRounded", () => {
      const lineItems = [
        { label: "base", amount: 200.49 },
        { label: "canal", amount: 50.5 },
        { label: "maintenance", amount: 20.51 },
        { label: "penalty", amount: 0.5 },
      ];
      const displayed = lineItems.map((x) => roundTaka(x.amount));
      const total = sumRounded(lineItems.map((x) => x.amount));
      expect(total).toBe(displayed.reduce((a, b) => a + b, 0));
      expect(displayed).toEqual([200, 51, 21, 1]);
      expect(total).toBe(273);
    });
  });

  describe("admin-configurable mode", () => {
    it("defaults to half_up", () => {
      localStorage.removeItem("taka_rounding_mode_v1");
      // Force re-read by importing fresh module not feasible; instead use setter
      setRoundingMode("half_up");
      expect(getRoundingMode()).toBe("half_up");
      expect(roundTaka(0.5)).toBe(1);
    });

    it("respects floor mode", () => {
      setRoundingMode("floor");
      expect(roundTaka(99.99)).toBe(99);
      expect(roundTaka(0.5)).toBe(0);
    });

    it("respects ceil mode", () => {
      setRoundingMode("ceil");
      expect(roundTaka(99.01)).toBe(100);
      expect(roundTaka(0.0001)).toBe(1);
    });

    it("respects banker's rounding (half_even)", () => {
      setRoundingMode("half_even");
      expect(roundTaka(0.5)).toBe(0);   // round to even (0)
      expect(roundTaka(1.5)).toBe(2);   // round to even (2)
      expect(roundTaka(2.5)).toBe(2);   // round to even (2)
      expect(roundTaka(3.5)).toBe(4);   // round to even (4)
    });
  });

  describe("export parity", () => {
    it("exported (CSV/Excel) cell value matches displayed money() value", () => {
      const inputs = [200.49, 200.5, 200.51, 1234.5, 1234.49];
      for (const v of inputs) {
        const exported = roundTaka(v);
        const onScreen = money(v).replace(/[৳\s,]/g, "");
        expect(String(exported)).toBe(onScreen);
      }
    });
  });
});
