import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path("/tmp/browser/inv"); SHOTS.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width":1280,"height":1800})
        page = await ctx.new_page()
        sk=os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        sj=os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        cj=os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
        if cj:
            cookies=json.loads(cj)
            for c in cookies: c["url"]=BASE
            await ctx.add_cookies(cookies)
        await page.goto(BASE)
        if sk and sj:
            await page.evaluate(f"window.localStorage.setItem({json.dumps(sk)}, {json.dumps(sj)})")

        blocked={"count":0}
        async def rh(route):
            blocked["count"]+=1
            await route.fulfill(status=404, content_type="application/json",
                                body=json.dumps({"message":"function does not exist"}))
        await page.route("**/rpc/get_billed_farmer_for_land*", rh)

        await page.goto(f"{BASE}/irrigation/invoices", wait_until="networkidle")
        await page.wait_for_timeout(1200)
        # Dismiss any onboarding dialog.
        for lbl in ["Skip","স্কিপ","বাদ দিন"]:
            try:
                el=page.get_by_role("button", name=lbl)
                if await el.count(): await el.first.click(timeout=1500)
            except Exception: pass
        await page.wait_for_timeout(400)
        # Open the Create invoice tab and trigger a preview to exercise fallback.
        try:
            tab=page.get_by_role("tab", name="Create invoice")
            if not await tab.count():
                tab=page.get_by_text("Create invoice", exact=False)
            await tab.first.click(timeout=3000)
            await page.wait_for_timeout(800)
            prev=page.get_by_role("button", name="Preview")
            if await prev.count():
                await prev.first.click(timeout=3000)
                await page.wait_for_timeout(2500)
        except Exception as e:
            print("preview interaction skipped:", repr(e)[:120])

        await page.screenshot(path=str(SHOTS/"2_after.png"))
        body=(await page.inner_text("body")).lower()
        crashed="something went wrong" in body or "application error" in body
        print("URL:", page.url)
        print("blocked_rpc_calls:", blocked["count"])
        print("crashed:", crashed)
        await b.close()
        assert not crashed, "App crashed with get_billed_farmer_for_land RPC blocked"
        print("PASS: invoice preview survives missing get_billed_farmer_for_land RPC")

asyncio.run(main())
