import { describe, it, expect } from "vitest";

/**
 * Pure-logic mirror of the `log_voter_change` Postgres trigger.
 * Confirms an audit row is produced when voter_number / is_voter actually change,
 * and skipped otherwise.
 */
interface FarmerRow { id: string; account_number: string | null; voter_number: string | null; is_voter: boolean; office_id: string | null }
interface AuditRow {
  farmer_id: string; account_number: string | null;
  voter_number_old: string | null; voter_number_new: string | null;
  is_voter_old: boolean; is_voter_new: boolean;
  changed_by: string | null; office_id: string | null;
}

function logVoterChange(oldRow: FarmerRow, newRow: FarmerRow, actorId: string | null): AuditRow | null {
  const voterChanged = oldRow.voter_number !== newRow.voter_number;
  const flagChanged = oldRow.is_voter !== newRow.is_voter;
  if (!voterChanged && !flagChanged) return null;
  return {
    farmer_id: newRow.id,
    account_number: newRow.account_number,
    voter_number_old: oldRow.voter_number,
    voter_number_new: newRow.voter_number,
    is_voter_old: oldRow.is_voter,
    is_voter_new: newRow.is_voter,
    changed_by: actorId,
    office_id: newRow.office_id,
  };
}

describe("voter audit trigger (logic mirror)", () => {
  const base: FarmerRow = { id: "f1", account_number: "ACC-1", voter_number: null, is_voter: false, office_id: "o1" };

  it("logs first-time voter assignment with old=null new=value", () => {
    const audit = logVoterChange(base, { ...base, is_voter: true, voter_number: "00001" }, "user-1");
    expect(audit).not.toBeNull();
    expect(audit!.voter_number_old).toBeNull();
    expect(audit!.voter_number_new).toBe("00001");
    expect(audit!.is_voter_old).toBe(false);
    expect(audit!.is_voter_new).toBe(true);
    expect(audit!.changed_by).toBe("user-1");
    expect(audit!.office_id).toBe("o1");
  });

  it("logs is_voter toggle off without dropping voter_number history", () => {
    const old = { ...base, is_voter: true, voter_number: "00001" };
    const audit = logVoterChange(old, { ...old, is_voter: false }, "user-2");
    expect(audit).not.toBeNull();
    expect(audit!.voter_number_old).toBe("00001");
    expect(audit!.voter_number_new).toBe("00001");
    expect(audit!.is_voter_old).toBe(true);
    expect(audit!.is_voter_new).toBe(false);
  });

  it("does NOT log when neither voter_number nor is_voter changes", () => {
    const old = { ...base, is_voter: true, voter_number: "00001" };
    const audit = logVoterChange(old, { ...old, account_number: "ACC-1" }, "user-1");
    expect(audit).toBeNull();
  });
});
