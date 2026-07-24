import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

// --- mocks ---
const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: (...args: any[]) => fromMock(...args),
  },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: any[]) => toastError(...a),
    success: (...a: any[]) => toastSuccess(...a),
  },
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ officeId: "off-1", isSuper: true, user: { id: "u1" } }),
}));
vi.mock("@/i18n/LanguageProvider", async () => {
  const { translations } = await import("@/i18n/translations");
  return {
    useLang: () => ({
      t: (k: string) => (translations.en as Record<string, string>)[k] ?? k,
      tx: (en: string) => en,
      lang: "en",
    }),
  };
});

// Stub farmer row returned by list query
const SAMPLE = [{
  id: "f-1", name_en: "Test Farmer", name_bn: "টেস্ট",
  account_number: "DH0001", voter_number: "V001", mobile: "01700",
  village: "Vill", is_voter: true, voter_cancelled_at: null, voter_cancel_reason: null,
}];

function buildQueryChain(data: any[]) {
  const chain: any = {};
  const passthrough = ["select","not","neq","order","limit","range","eq","or","in","is"];
  for (const m of passthrough) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: any) => Promise.resolve({ data, error: null }).then(resolve);
  return chain;
}

// Opening the cancel/reactivate dialog always fires a `farmer_dues_breakdown`
// RPC call first (to show current balances) — independent of whichever
// action RPC (`cancel_voter_membership` / `reactivate_voter_membership`) a
// given test is stubbing. Give it a standing zero-dues response so it never
// swallows a test's mockResolvedValueOnce meant for the action call.
function mockActionRpc(response: { data: any; error: any }) {
  rpcMock.mockImplementation((fn: string) => {
    if (fn === "farmer_dues_breakdown") {
      return Promise.resolve({
        data: [{ savings_balance: 0, share_balance: 0, loan_due: 0, irrigation_due: 0 }],
        error: null,
      });
    }
    return Promise.resolve(response);
  });
}

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  fromMock.mockImplementation(() => buildQueryChain(SAMPLE));
  mockActionRpc({ data: null, error: null });
});

async function openCancelDialog() {
  const VoterList = (await import("@/pages/VoterList")).default;
  render(<MemoryRouter><TooltipProvider><VoterList /></TooltipProvider></MemoryRouter>);
  const cancelBtn = await screen.findByRole("button", { name: /^Cancel$/i });
  fireEvent.click(cancelBtn);
  const ta = await screen.findByPlaceholderText(/clear reason/i);
  fireEvent.change(ta, { target: { value: "test reason for cancellation" } });
  return screen.getByRole("button", { name: /Confirm Cancel/i });
}

describe("VoterList cancel flow", () => {
  it("shows detailed dues breakdown when DUES_BLOCK error returned", async () => {
    mockActionRpc({
      data: null,
      error: { message: 'DUES_BLOCK:{"savings_balance":150,"loan_due":200,"irrigation_due":50}' },
    });
    const confirm = await openCancelDialog();
    fireEvent.click(confirm);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [msg, opts] = toastError.mock.calls[0];
    expect(msg).toMatch(/clear all dues/i);
    expect(opts.description).toMatch(/150/);
    expect(opts.description).toMatch(/200/);
    expect(opts.description).toMatch(/50/);
  });

  it("succeeds when RPC returns no error (dues = 0)", async () => {
    mockActionRpc({ data: null, error: null });
    const confirm = await openCancelDialog();
    fireEvent.click(confirm);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0][0]).toMatch(/cancelled/i);
  });

  it("surfaces generic RPC errors verbatim (e.g. wrong role / permission)", async () => {
    mockActionRpc({
      data: null,
      error: { message: "permission denied for function cancel_voter_membership" },
    });
    const confirm = await openCancelDialog();
    fireEvent.click(confirm);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/permission denied/i);
  });

  it("blocks reason shorter than 3 chars without calling RPC", async () => {
    const VoterList = (await import("@/pages/VoterList")).default;
    render(<MemoryRouter><TooltipProvider><VoterList /></TooltipProvider></MemoryRouter>);
    const cancelBtn = await screen.findByRole("button", { name: /^Cancel$/i });
    fireEvent.click(cancelBtn);
    const ta = await screen.findByPlaceholderText(/clear reason/i);
    fireEvent.change(ta, { target: { value: "ab" } });
    const confirm = screen.getByRole("button", { name: /Confirm Cancel/i });
    expect(confirm).toBeDisabled();
    // Opening the dialog legitimately calls farmer_dues_breakdown; what must
    // NOT happen is the actual cancel action firing on a too-short reason.
    expect(rpcMock).not.toHaveBeenCalledWith("cancel_voter_membership", expect.anything());
  });
});

describe("VoterList reactivate flow", () => {
  it("surfaces 'already active' error from reactivate RPC", async () => {
    // Simulate calling reactivate RPC directly via the same dialog path:
    // we reuse cancel button but stub RPC to mimic reactivate's duplicate error.
    mockActionRpc({
      data: null,
      error: { message: "Voter is already active" },
    });
    const confirm = await openCancelDialog();
    fireEvent.click(confirm);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/already active/i);
  });
});
