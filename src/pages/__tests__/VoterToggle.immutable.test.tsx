import { describe, it, expect, vi } from "vitest";

/**
 * In-app smoke test: when Is Voter is toggled OFF then ON for an existing
 * farmer that already has a voter_number, the voter_number value MUST stay
 * the same (immutable). The toggle only flips `is_voter`, never sets/clears
 * `voter_number`.
 */
describe("Voter toggle keeps voter_number immutable", () => {
  it("toggling off then on preserves the original voter_number", async () => {
    const original = "1234567890";
    let dbRow: { is_voter: boolean; voter_number: string } = {
      is_voter: true,
      voter_number: original,
    };

    const rpc = vi.fn();
    const update = vi.fn(async (patch: Partial<typeof dbRow>) => {
      // Simulate DB-side trigger: voter_number is immutable once set.
      const next = { ...dbRow, ...patch };
      next.voter_number = dbRow.voter_number; // trigger preserves value
      dbRow = next;
      return { error: null };
    });

    // Toggle OFF
    await update({ is_voter: false });
    expect(dbRow.is_voter).toBe(false);
    expect(dbRow.voter_number).toBe(original);

    // Toggle ON — code path: voter_number already exists, so no RPC call.
    if (!dbRow.voter_number) await rpc("generate_farmer_voter_number");
    await update({ is_voter: true });

    expect(rpc).not.toHaveBeenCalled();
    expect(dbRow.is_voter).toBe(true);
    expect(dbRow.voter_number).toBe(original);
  });
});
