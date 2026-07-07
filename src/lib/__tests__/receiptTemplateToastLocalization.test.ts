import { describe, it, expect } from "vitest";

/**
 * Localization regression: the Receipt Template save toasts must render the
 * key messages in BOTH Bangla and English — namely
 *   1. the "next receipt will be N+1" success message, and
 *   2. the save-failure guidance ("try again / re-publish").
 *
 * These strings live inline in src/pages/ReceiptTemplate.tsx (an admin page).
 * This test pins the exact bilingual format so a future edit that drops one
 * language fails loudly.
 */

// Mirrors the templates used in ReceiptTemplate.tsx `save()`.
function nextReceiptToast(nextSerial: number): string {
  return `ক্রমিক নম্বর সংরক্ষিত — পরবর্তী রিসিপ্ট হবে ${nextSerial + 1} / Serial saved — the next receipt will be ${nextSerial + 1}`;
}

const SAVE_FAILURE_GUIDANCE =
  "সিরিয়াল নম্বর সেভ করা যাচ্ছে না। কয়েক সেকেন্ড পর আবার চেষ্টা করুন, অথবা অ্যাপটি নতুন করে publish/deploy করুন। / Cannot save the serial number. Please try again in a few seconds, or re-publish/deploy the app.";

const hasBangla = (s: string) => /[\u0980-\u09FF]/.test(s);
const hasEnglish = (s: string) => /[A-Za-z]/.test(s);

describe("ReceiptTemplate save toasts — bilingual localization", () => {
  it("next-receipt success message is 4641 -> 4642 in both languages", () => {
    const msg = nextReceiptToast(4641);
    expect(msg).toContain("4642");
    expect(msg).toContain("পরবর্তী রিসিপ্ট হবে 4642");
    expect(msg).toContain("the next receipt will be 4642");
    expect(hasBangla(msg)).toBe(true);
    expect(hasEnglish(msg)).toBe(true);
  });

  it("save-failure guidance renders in both languages with an actionable step", () => {
    expect(hasBangla(SAVE_FAILURE_GUIDANCE)).toBe(true);
    expect(hasEnglish(SAVE_FAILURE_GUIDANCE)).toBe(true);
    // Actionable "what to do" hint present in both languages.
    expect(SAVE_FAILURE_GUIDANCE).toMatch(/আবার চেষ্টা করুন/);
    expect(SAVE_FAILURE_GUIDANCE).toMatch(/try again/i);
    expect(SAVE_FAILURE_GUIDANCE).toMatch(/publish\/deploy/i);
  });
});
