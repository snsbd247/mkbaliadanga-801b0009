import { describe, it, expect } from "vitest";
import { nextRetryAt } from "../retryQueue";

describe("nextRetryAt", () => {
  const base = new Date("2026-01-01T00:00:00Z");
  it("first retry → +1 minute", () => {
    expect(nextRetryAt(0, base).toISOString()).toBe("2026-01-01T00:01:00.000Z");
  });
  it("second retry → +5 minutes", () => {
    expect(nextRetryAt(1, base).toISOString()).toBe("2026-01-01T00:05:00.000Z");
  });
  it("third retry → +15 minutes", () => {
    expect(nextRetryAt(2, base).toISOString()).toBe("2026-01-01T00:15:00.000Z");
  });
  it("fourth retry → +1 hour", () => {
    expect(nextRetryAt(3, base).toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });
  it("clamps beyond schedule", () => {
    expect(nextRetryAt(99, base).toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });
});
