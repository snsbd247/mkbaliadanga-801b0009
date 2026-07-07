import { describe, it, expect } from "vitest";
import { serialSaveUnconfirmedToast } from "@/lib/receiptSerial";

describe("serialSaveUnconfirmedToast (null serial from RPC/edge)", () => {
  it("renders the bilingual title", () => {
    const { title } = serialSaveUnconfirmedToast(4641, null);
    expect(title).toContain("ক্রমিক নম্বর ডাটাবেসে সংরক্ষণ নিশ্চিত করা যায়নি");
    expect(title).toContain("Could not confirm the serial number was saved");
  });

  it("shows — for a null/undefined server value in both languages", () => {
    const { description } = serialSaveUnconfirmedToast(4641, null);
    // Bangla side
    expect(description).toContain("প্রত্যাশিত 4641");
    expect(description).toContain("সার্ভার থেকে পাওয়া গেছে —");
    // English side
    expect(description).toContain("Expected 4641");
    expect(description).toContain("server returned —");
  });

  it("shows the concrete mismatched value when the server returned a number", () => {
    const { description } = serialSaveUnconfirmedToast(4641, 4600);
    expect(description).toContain("সার্ভার থেকে পাওয়া গেছে 4600");
    expect(description).toContain("server returned 4600");
    expect(description).not.toContain("—");
  });
});
