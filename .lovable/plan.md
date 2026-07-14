# Plan: Session ends on browser close (not on tab close)

## Goal
- Closing the **browser** → session ends → next visit shows login.
- Closing a **tab** or opening a **new tab** → session stays alive.
- Language preference should NOT auto-revert to Bengali on fresh visit.
- No impact to any existing module (Irrigation, Savings, Loan, Cashbook, Reports, Farmer Portal, etc.).

## Approach (technical)

Browsers don't fire a reliable "browser closed" event. The standard, safe pattern is:

1. **Store auth token in `sessionStorage`** (dies when the last tab of that browser process is closed) instead of `localStorage`.
2. **Share `sessionStorage` across tabs** using the well-known "sessionStorage handoff" trick:
   - On tab load: if `sessionStorage` is empty, broadcast `REQUEST_SESSION` via `BroadcastChannel` (fallback: `localStorage` event ping).
   - Any already-open tab responds with its session snapshot → new tab writes it into its own `sessionStorage`.
   - Result: new tabs inherit the session; when the LAST tab closes, no tab can respond → next fresh visit has no session → login screen.
3. **Keep the Supabase JS client's `persistSession` behavior intact** by providing a custom `storage` adapter that reads/writes via this shared-session layer (already the correct extension point — no schema or RLS change).
4. **Laravel token (`mkb_api_token`)** and **farmer portal token (`farmer_portal_token`)**: migrate to the same shared-session storage helper.
5. **Language (`lang`)**: keep in `localStorage` (user preference is device-level, not session-level). Fix `FarmerPortalLogin` which force-sets `bn` on every mount — only set default when no preference is stored, so refreshes after logout don't flip English users to Bangla.

## Files to change

```text
src/lib/sharedSessionStorage.ts        (new) - sessionStorage + BroadcastChannel handoff
src/integrations/supabase/client.ts    - use shared storage as `auth.storage`
src/lib/laravel-auth.ts                - token via shared storage
src/lib/api/client.ts                  - token via shared storage (if applicable)
src/pages/FarmerPortalLogin.tsx        - stop forcing lang=bn on mount
src/i18n/LanguageProvider.tsx          - verify default only when unset
```

Note: `src/integrations/supabase/client.ts` is marked auto-generated but the `storage:` option is the sanctioned override point; only that one line changes.

## Safety / no-regression checklist
- Supabase's `onAuthStateChange`, refresh-token flow, RLS, and all queries continue to work — only the *storage backend* changes.
- Farmer portal, Laravel-mode VPS, and Lovable Cloud all use the same helper → consistent behavior.
- No DB migration, no RPC change, no permission change → zero risk to Irrigation / Savings / Loan / Cashbook / Reports / Payments modules.
- Existing logged-in users get logged out **once** after deploy (storage key moves from `localStorage` to `sessionStorage`) — expected and acceptable.

## Verification
1. Login → open several tabs → all stay logged in.
2. Close individual tabs → remaining tabs stay logged in.
3. Close the **entire browser** → reopen → visit site → login page appears. ✅
4. Toggle language to English → logout → visit again → language stays English. ✅
5. Smoke-test one page from each major module to confirm no regression.

Shall I proceed with this plan?
