import { describe, it, expect } from "vitest";
import { isSechStream, assertSechTransfer } from "../cashStreamGuard";

describe("cashStreamGuard", () => {
  it("recognises sech streams", () => {
    expect(isSechStream("sech")).toBe(true);
    expect(isSechStream("sech_small")).toBe(true);
    expect(isSechStream("SECH")).toBe(true);
    expect(isSechStream("saving")).toBe(false);
    expect(isSechStream("other")).toBe(false);
    expect(isSechStream(null)).toBe(false);
    expect(isSechStream(undefined)).toBe(false);
  });

  it("allows a sech account", () => {
    expect(assertSechTransfer({ stream: "sech", bank_name: "Sonali" }).ok).toBe(true);
    expect(assertSechTransfer({ stream: "sech_small" }).ok).toBe(true);
  });

  it("blocks a non-sech account with a Bengali message", () => {
    const r = assertSechTransfer({ stream: "saving", bank_name: "Rupali", account_no: "123" });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("সেচ-স্ট্রিমের নয়");
    expect(r.message).toContain("Rupali");
  });

  it("blocks when no account is selected", () => {
    const r = assertSechTransfer(null);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("নির্বাচন");
  });
});
