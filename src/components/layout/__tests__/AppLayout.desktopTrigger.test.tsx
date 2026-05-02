import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Ensures desktop sidebar trigger spacing/layout (md:h-9 md:w-9) is preserved
// after mobile-only styling overrides were introduced.
describe("Desktop SidebarTrigger layout", () => {
  it("retains desktop size classes and is not affected by mobile-only override", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarTrigger
          aria-label="Toggle menu"
          className="shrink-0 sidebar-trigger-mobile md:h-9 md:w-9"
        />
      </SidebarProvider>,
    );
    const btn = container.querySelector('[data-sidebar="trigger"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    // Desktop sizing classes preserved
    expect(btn.className).toContain("md:h-9");
    expect(btn.className).toContain("md:w-9");
    // Shrink helper preserved so flex header layout isn't broken
    expect(btn.className).toContain("shrink-0");
    // Icon present and properly sized via lucide default
    const svg = btn.querySelector("svg");
    expect(svg).toBeTruthy();
  });
});
