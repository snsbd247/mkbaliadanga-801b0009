import { describe, it, expect } from "vitest";
import { computeNextSerial } from "@/lib/receiptSerialMath";

describe("computeNextSerial (receipt serial semantics)", () => {
  it("issues start+1 after admin sets the serial start (4641 -> 4642)", () => {
    // Admin sets 4641; counter is well below it → next receipt must be 4642.
    expect(computeNextSerial(4641, 8)).toBe(4642);
  });

  it("never goes backwards when counter is already ahead of the start", () => {
    expect(computeNextSerial(10, 100)).toBe(101);
  });

  it("keeps incrementing sequentially once the start is reached", () => {
    let last = computeNextSerial(4641, 8) - 1; // 4641 effectively last
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      const next = computeNextSerial(4641, last);
      seen.push(next);
      last = next;
    }
    expect(seen).toEqual([4642, 4643, 4644]);
  });

  it("handles zero / empty start", () => {
    expect(computeNextSerial(0, 0)).toBe(1);
  });
});
