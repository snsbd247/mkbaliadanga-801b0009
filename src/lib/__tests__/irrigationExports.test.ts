import { describe, it, expect } from "vitest";
import { exportInvoicesCSV, IRR_BN } from "../irrigationExports";

describe("irrigation invoice exports", () => {
  it("exposes all required Bengali column labels", () => {
    expect(IRR_BN.invoiceNo).toBe("ইনভয়েস নং");
    expect(IRR_BN.isManual).toBe("ম্যানুয়াল রেট");
    expect(IRR_BN.manualReason).toBe("ম্যানুয়াল কারণ");
    expect(IRR_BN.recalculated).toBe("পুনঃগণনা");
  });

  it("CSV builder is callable without throwing on empty input", () => {
    // Stub out browser APIs used inside exportInvoicesCSV.
    const origURL = (globalThis as any).URL;
    const origDoc = (globalThis as any).document;
    (globalThis as any).URL = { createObjectURL: () => "blob:x", revokeObjectURL: () => {} };
    (globalThis as any).document = { createElement: () => ({ click: () => {} }) };
    expect(() => exportInvoicesCSV([])).not.toThrow();
    (globalThis as any).URL = origURL;
    (globalThis as any).document = origDoc;
  });
});
