import { describe, it, expect } from "vitest";
import { computeNextSerial } from "@/lib/receiptSerialMath";

describe("computeNextSerial (receipt serial semantics)", () => {
  it("issues the exact serial start the admin set (4641 -> 4641)", () => {
    // Admin sets 4641 as the next receipt number; counter is well below it.
    expect(computeNextSerial(4641, 8)).toBe(4641);
  });

  it("never collides when an active receipt is already ahead of the start", () => {
    expect(computeNextSerial(10, 100)).toBe(101);
  });

  it("ignores phantom counter drift after a payment row is deleted", () => {
    // Scenario: next number is configured 4643, highest active receipt is 4642.
    // The next valid receipt must be 4643, not 4644.
    expect(computeNextSerial(4643, 4642)).toBe(4643);
  });

  it("keeps incrementing sequentially once issuing has started", () => {
    // After issuing 4641, the configured start advances to 4642, then 4643...
    const seen: number[] = [];
    let start = 4641;
    for (let i = 0; i < 3; i++) {
      const next = computeNextSerial(start, 0);
      seen.push(next);
      start = next + 1;
    }
    expect(seen).toEqual([4641, 4642, 4643]);
  });

  it("handles zero / empty start", () => {
    expect(computeNextSerial(0, 0)).toBe(1);
  });
});
