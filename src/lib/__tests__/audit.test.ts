import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: fromMock,
    },
    __mocks: { insertMock, fromMock },
  };
});

import { logAudit } from "../audit";
import { supabase } from "@/integrations/supabase/client";

const { insertMock, fromMock } = (supabase as any).__proto__ ?? {};
// fallback: pull mocks from the mocked module record
const mod = await import("@/integrations/supabase/client") as any;
const ins = mod.__mocks.insertMock;
const frm = mod.__mocks.fromMock;

describe("logAudit", () => {
  beforeEach(() => {
    ins.mockClear();
    frm.mockClear();
  });

  it("inserts into system_audit_logs with current user_id", async () => {
    await logAudit({
      module: "irrigation_payment",
      action_type: "create",
      reference_id: "inv-1",
      office_id: "office-1",
      new_data: { amount: 500 },
    });
    expect(frm).toHaveBeenCalledWith("system_audit_logs");
    expect(ins).toHaveBeenCalledTimes(1);
    const arr = ins.mock.calls[0][0] as any[];
    const payload = arr[0];
    expect(payload.user_id).toBe("user-1");
    expect(payload.module).toBe("irrigation_payment");
    expect(payload.action_type).toBe("create");
    expect(payload.reference_id).toBe("inv-1");
  });

  it("never throws when insert fails", async () => {
    ins.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(
      logAudit({ module: "sms", action_type: "fail" }),
    ).resolves.toBeUndefined();
  });
});
