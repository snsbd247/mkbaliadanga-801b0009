import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ---
const channelInstances: any[] = [];
const removed: any[] = [];

function makeChannel(name: string) {
  const ch: any = {
    name,
    _subscribed: false,
    on: vi.fn(function (this: any) { 
      if (this._subscribed) {
        throw new Error(`cannot add postgres_changes callbacks for ${name} after subscribe()`);
      }
      return this; 
    }),
    subscribe: vi.fn(function (this: any, cb?: any) {
      this._subscribed = true;
      cb?.("SUBSCRIBED");
      return this;
    }),
  };
  channelInstances.push(ch);
  return ch;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn((name: string) => makeChannel(name)),
    removeChannel: vi.fn((ch: any) => { removed.push(ch); return Promise.resolve(); }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

vi.mock("@/lib/format", () => ({ fmtDate: (d: any) => String(d) }));

import { NotificationBell } from "../NotificationBell";

describe("NotificationBell - StrictMode double-mount", () => {
  beforeEach(() => {
    channelInstances.length = 0;
    removed.length = 0;
  });

  it("renders without crashing under StrictMode (no blank screen)", async () => {
    render(
      <StrictMode>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </StrictMode>
    );

    // Bell button should be present (not blank screen)
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("creates unique channel names for each mount (no collision)", async () => {
    render(
      <StrictMode>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </StrictMode>
    );

    await waitFor(() => expect(channelInstances.length).toBeGreaterThanOrEqual(1));
    const names = channelInstances.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    names.forEach((n) => expect(n).toContain("notifications-bell-user-123-"));
  });

  it("registers .on() before .subscribe() on every channel", async () => {
    render(
      <StrictMode>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </StrictMode>
    );

    await waitFor(() => expect(channelInstances.length).toBeGreaterThanOrEqual(1));
    for (const ch of channelInstances) {
      if (ch.subscribe.mock.calls.length > 0) {
        const onOrder = ch.on.mock.invocationCallOrder[0];
        const subOrder = ch.subscribe.mock.invocationCallOrder[0];
        expect(onOrder).toBeLessThan(subOrder);
      }
    }
  });
});
