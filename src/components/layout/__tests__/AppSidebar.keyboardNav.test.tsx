import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { SidebarProvider, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar";
import { MemoryRouter } from "react-router-dom";

// Verifies keyboard-focus styles are present on collapsible parent triggers
// and submenu buttons so keyboard navigation has visible focus rings.
describe("Sidebar keyboard navigation & focus states", () => {
  it("collapsible parent trigger and submenu button include focus-visible ring classes", () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarProvider>
          <SidebarMenu>
            <Collapsible defaultOpen>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    className="group/parent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1"
                  >
                    Parent
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        className="focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1"
                      >
                        Child
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarProvider>
      </MemoryRouter>,
    );

    const parent = container.querySelector('[data-sidebar="menu-button"]') as HTMLElement;
    const child = container.querySelector('[data-sidebar="menu-sub-button"]') as HTMLElement;

    expect(parent).toBeTruthy();
    expect(child).toBeTruthy();

    // Parent must be focusable (button) and expose focus ring classes
    expect(parent.tagName).toBe("BUTTON");
    expect(parent.className).toMatch(/focus-visible:ring-2/);
    expect(parent.className).toMatch(/focus-visible:ring-sidebar-ring/);

    // Submenu link/button gets matching focus styling
    expect(child.className).toMatch(/focus-visible:ring-2/);
    expect(child.className).toMatch(/focus-visible:ring-sidebar-ring/);

    // Programmatic keyboard focus works
    parent.focus();
    expect(document.activeElement).toBe(parent);
  });
});
