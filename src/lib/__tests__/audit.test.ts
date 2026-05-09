import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { logAudit } from "../audit";

describe("logAudit", () => {
  beforeEach(() => {
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("inserts into system_audit_logs with current user_id", async () => {
    await logAudit({
      module: "irrigation_payment",
      action_type: "create",
      reference_id: "inv-1",
      office_id: "office-1",
      new_data: { amount: 500 },
    });
    expect(fromMock).toHaveBeenCalledWith("system_audit_logs");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload.user_id).toBe("user-1");
    expect(payload.module).toBe("irrigation_payment");
    expect(payload.action_type).toBe("create");
    expect(payload.reference_id).toBe("inv-1");
  });

  it("never throws when insert fails", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(
      logAudit({ module: "sms", action_type: "fail" }),
    ).resolves.toBeUndefined();
  });
});
