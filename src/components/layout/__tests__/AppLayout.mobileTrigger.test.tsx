import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Verifies the mobile sidebar trigger uses the dedicated mobile class
// and remains a button (preserving toggle functionality).
describe("Mobile SidebarTrigger styling", () => {
  it("applies sidebar-trigger-mobile class and stays a button", () => {
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
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toContain("sidebar-trigger-mobile");
    // Desktop class still present so it isn't accidentally dropped
    expect(btn.className).toContain("md:h-9");
  });
});
