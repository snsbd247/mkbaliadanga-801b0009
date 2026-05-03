import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

let mockResult: { data: any; error: any } = { data: [], error: null };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const api: any = {
        select: () => api,
        eq: () => api,
        order: () => api,
        limit: () => Promise.resolve(mockResult),
      };
      return api;
    },
  },
}));

import { VoterHistoryDialog } from "../VoterHistoryDialog";

describe("VoterHistoryDialog", () => {
  it("renders loading then a friendly RLS error when SELECT is denied", async () => {
    mockResult = { data: null, error: { message: "permission denied for table voter_audit_logs" } };
    render(<VoterHistoryDialog farmerId="f1" open onOpenChange={() => {}} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/don't have permission/i)
    );
  });

  it("shows empty state when no rows are returned", async () => {
    mockResult = { data: [], error: null };
    render(<VoterHistoryDialog farmerId="f1" open onOpenChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/no history yet/i)).toBeInTheDocument());
  });

  it("renders rows when data is returned", async () => {
    mockResult = {
      data: [
        {
          id: "a1",
          created_at: new Date("2026-01-01T12:00:00Z").toISOString(),
          voter_number_old: null,
          voter_number_new: "V-001",
          is_voter_old: false,
          is_voter_new: true,
          changed_by: "abcdef1234567890",
        },
      ],
      error: null,
    };
    render(<VoterHistoryDialog farmerId="f1" open onOpenChange={() => {}} />);
    await waitFor(() => expect(screen.getByText("V-001", { exact: false })).toBeInTheDocument());
  });
});
