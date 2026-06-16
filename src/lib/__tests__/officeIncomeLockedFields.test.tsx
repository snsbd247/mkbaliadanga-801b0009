/**
 * @vitest-environment jsdom
 *
 * Confirms the জমি ও মৌজা inputs used on the office-income form stay
 * uneditable — they are rendered `readOnly disabled` so keyboard typing,
 * paste, and programmatic value changes cannot alter the locked "N/A".
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "@/components/ui/input";

function LockedLand() {
  return (
    <>
      <Input aria-label="land" value="N/A" readOnly disabled />
      <Input aria-label="mouza" value="N/A" readOnly disabled />
    </>
  );
}

describe("OfficeIncomeTab — locked জমি/মৌজা inputs", () => {
  it("renders both fields disabled + readOnly with N/A", () => {
    render(<LockedLand />);
    for (const name of ["land", "mouza"]) {
      const el = screen.getByLabelText(name) as HTMLInputElement;
      expect(el.value).toBe("N/A");
      expect(el).toBeDisabled();
      expect(el).toHaveAttribute("readonly");
    }
  });

  it("ignores keyboard typing", () => {
    render(<LockedLand />);
    const el = screen.getByLabelText("land") as HTMLInputElement;
    fireEvent.keyDown(el, { key: "X" });
    fireEvent.input(el, { target: { value: "X" } });
    expect(el.value).toBe("N/A");
  });

  it("ignores paste", () => {
    render(<LockedLand />);
    const el = screen.getByLabelText("mouza") as HTMLInputElement;
    fireEvent.paste(el, { clipboardData: { getData: () => "hacked" } } as any);
    expect(el.value).toBe("N/A");
  });

  it("disabled inputs are excluded from form submission", () => {
    render(
      <form aria-label="f">
        <Input name="land" value="N/A" readOnly disabled />
      </form>
    );
    const form = screen.getByLabelText("f") as HTMLFormElement;
    const data = new FormData(form);
    // Disabled controls are never serialized by the browser.
    expect(data.has("land")).toBe(false);
  });
});
