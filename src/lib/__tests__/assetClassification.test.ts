import { describe, it, expect } from "vitest";
import { assetTypeLabel, statusLabel, statusVariant } from "@/pages/assets/AssetItems";

const tx = (en: string, bn: string) => `${en}|${bn}`;

describe("assetTypeLabel", () => {
  it("renders all asset types bilingually", () => {
    expect(assetTypeLabel("inventory", tx)).toBe("Inventory|ইনভেন্টরি");
    expect(assetTypeLabel("fixed_asset", tx)).toBe("Fixed Asset|স্থায়ী এসেট");
    expect(assetTypeLabel("consumable", tx)).toBe("Consumable|ভোগ্য");
  });
});

describe("statusLabel — extended lifecycle", () => {
  it("supports new statuses", () => {
    expect(statusLabel("in_use" as any, tx)).toBe("In Use|ব্যবহৃত");
    expect(statusLabel("scrapped" as any, tx)).toBe("Scrapped|স্ক্র্যাপড");
    expect(statusLabel("lost" as any, tx)).toBe("Lost|হারানো");
  });
  it("keeps existing statuses working", () => {
    expect(statusLabel("in_stock" as any, tx)).toBe("In Stock|স্টকে");
    expect(statusLabel("disposed" as any, tx)).toBe("Disposed|নিষ্পত্তি");
  });
});

describe("statusVariant — destructive set", () => {
  it("treats scrapped/lost as destructive", () => {
    expect(statusVariant("scrapped" as any)).toBe("destructive");
    expect(statusVariant("lost" as any)).toBe("destructive");
    expect(statusVariant("damaged" as any)).toBe("destructive");
  });
  it("keeps purchased/in_stock as secondary", () => {
    expect(statusVariant("in_stock" as any)).toBe("secondary");
    expect(statusVariant("purchased" as any)).toBe("secondary");
  });
});
