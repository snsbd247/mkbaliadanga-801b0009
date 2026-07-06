# End-to-end tests (Playwright)

## invoice_preview_fallback.py

Confirms the irrigation invoice flow keeps working when the
`get_billed_farmer_for_land` RPC is unavailable and the table-based fallback
kicks in. The test:

1. Restores the injected Supabase session into `localStorage` / cookies.
2. Routes every `**/rpc/get_billed_farmer_for_land*` request to a `404`
   ("function does not exist") to simulate the missing RPC.
3. Loads `/irrigation/invoices`, dismisses onboarding, opens **Create invoice**
   and triggers a preview.
4. Asserts the app never crashes to an error boundary — the fallback path
   resolves billing without the RPC.

### Run

```bash
# Dev server must be running on http://localhost:8080
python3 e2e/invoice_preview_fallback.py
```

Requires Playwright (Chromium) and a valid `LOVABLE_BROWSER_SUPABASE_*` session
in the environment. See also the fast unit-level coverage in
`src/lib/__tests__/irrigationInvoiceFallback.test.ts`.
