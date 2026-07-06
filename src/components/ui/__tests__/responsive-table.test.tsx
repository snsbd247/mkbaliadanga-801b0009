import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ResponsiveTable } from "../responsive-table";

describe("ResponsiveTable", () => {
  it("applies min-width and sticky header classes for scroll + visible labels", () => {
    const { container } = render(
      <ResponsiveTable minWidth={1400} sticky>
        <thead>
          <tr>
            <th>তারিখ</th>
            <th>বিবরণ</th>
            <th>জমা</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2026-07-06</td>
            <td>হাওলাত গ্রহণ</td>
            <td>1000</td>
          </tr>
        </tbody>
      </ResponsiveTable>,
    );

    const wrap = container.querySelector("[data-table-wrap]") as HTMLElement;
    const table = container.querySelector("table") as HTMLTableElement;

    // Horizontal scroll wrapper present
    expect(wrap.className).toContain("overflow-x-auto");
    expect(wrap.className).toContain("rt-scroll");

    // Consistent min column layout enforced
    expect(table.style.minWidth).toBe("1400px");

    // Reusable + sticky header styling applied
    expect(table.className).toContain("rt-table");
    expect(table.className).toContain("rt-sticky");
  });

  it("omits sticky class when sticky is disabled", () => {
    const { container } = render(
      <ResponsiveTable sticky={false}>
        <tbody>
          <tr>
            <td>x</td>
          </tr>
        </tbody>
      </ResponsiveTable>,
    );
    const table = container.querySelector("table") as HTMLTableElement;
    expect(table.className).toContain("rt-table");
    expect(table.className).not.toContain("rt-sticky");
  });
});

import { TABLE_PRESETS } from "../responsive-table";

describe("ResponsiveTable presets & viewport regression", () => {
  const COMMON_VIEWPORTS = [1280, 1440, 1920];

  it("resolves named presets to their minWidth without manual tuning", () => {
    const cases: [keyof typeof TABLE_PRESETS, number][] = [
      ["irrigation", 1600],
      ["savings", 1400],
      ["loan", 1400],
      ["cashbook", 1400],
      ["report", 1200],
    ];
    for (const [preset, expected] of cases) {
      const { container } = render(
        <ResponsiveTable preset={preset}>
          <tbody><tr><td>x</td></tr></tbody>
        </ResponsiveTable>,
      );
      const table = container.querySelector("table") as HTMLTableElement;
      expect(table.style.minWidth).toBe(`${expected}px`);
    }
  });

  it("keeps headers on a single line (nowrap) at common viewport widths", () => {
    for (const width of COMMON_VIEWPORTS) {
      Object.defineProperty(window, "innerWidth", { writable: true, value: width });
      const { container } = render(
        <ResponsiveTable preset="irrigation" sticky>
          <thead><tr><th>বিবরণ</th><th>জমা</th><th>খরচ</th></tr></thead>
          <tbody><tr><td>a</td><td>1</td><td>2</td></tr></tbody>
        </ResponsiveTable>,
      );
      const wrap = container.querySelector("[data-table-wrap]") as HTMLElement;
      const table = container.querySelector("table") as HTMLTableElement;
      // Horizontal scroll wrapper + nowrap header classes guarantee no overlap
      expect(wrap.className).toContain("overflow-x-auto");
      expect(table.className).toContain("rt-table");
      expect(table.className).toContain("rt-sticky");
      // minWidth exceeds every common viewport so columns never collapse/overlap
      expect(parseInt(table.style.minWidth, 10)).toBeGreaterThan(width);
    }
  });
});
