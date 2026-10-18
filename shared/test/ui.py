"""UI sweep of the whole site: hub + every game's landing, lobby, game table and Rules (every tab), on five screen sizes.
Checks: no page errors, no horizontal scroll, no broken images, Rules opens from every screen, every tab has content.

    python3 shared/test/ui.py [base_url]
"""
import sys, time
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/").rstrip("/") + "/"
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/ui-"
GAMES = {"wizard": ("window.__wiz", 3), "lodestone": ("window.__lode", 2), "marvels": ("window.__mar", 3), "avalon": ("window.__ava", 5), "incan": ("window.__inc", 3)}
DEVICES = [("iPhone SE", "webkit"), ("iPhone 13", "webkit"), ("Pixel 7", "chromium"), ("iPad Mini", "webkit"), ("Desktop", "chromium")]
results = []

def check(name, ok, detail=""):
    results.append(ok); print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

PROBE = """() => ({ over: document.documentElement.scrollWidth > innerWidth + 1,
  broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.src).map(i => i.src.split('/').pop()),
  bgBroken: 0 })"""

def sweep(page, label):
    page.wait_for_timeout(900)
    r = page.evaluate(PROBE)
    check(f"{label}: no sideways scroll", not r["over"])
    check(f"{label}: images load", not r["broken"], ", ".join(r["broken"][:4]))

def rules(page, label):
    page.locator('[data-act="rules"], [data-act="guide"]').first.click(); page.wait_for_selector(".sheet .tabs", timeout=5000)
    tabs = page.locator(".tabs button"); n = tabs.count(); empty = []
    for i in range(n):
        tabs.nth(i).click(); page.wait_for_timeout(120)
        if len(page.inner_text(".sheetbody").strip()) < 80: empty.append(tabs.nth(i).inner_text())
    check(f"{label}: Rules opens with {n} tabs, all filled", n >= 3 and not empty, ", ".join(empty))
    over = page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1")
    check(f"{label}: Rules sheet fits", not over)
    page.locator('.sheethead [data-act="close"]').click()

with sync_playwright() as pw:
    brs = {"webkit": pw.webkit.launch(), "chromium": pw.chromium.launch(channel="chrome")}
    for dev, eng in DEVICES:
        opts = {"viewport": {"width": 1440, "height": 900}} if dev == "Desktop" else pw.devices[dev]
        tag = dev.replace(" ", "")
        errs = []
        ctx = brs[eng].new_context(**opts); hub = ctx.new_page(); hub.on("pageerror", lambda e: errs.append(str(e)))
        hub.goto(BASE); sweep(hub, f"{dev} hub")
        check(f"{dev} hub: {len(GAMES)} games listed", hub.locator("a.game").count() == len(GAMES))
        hub.screenshot(path=SH + f"{tag}-hub.png", full_page=True)
        for g, (J, minp) in GAMES.items():
            host = ctx.new_page(); host.on("pageerror", lambda e: errs.append(str(e)))
            host.goto(BASE + g + "/"); sweep(host, f"{dev} {g} landing"); rules(host, f"{dev} {g} landing")
            host.fill("#nm", "Dhruv"); host.click("text=Start a game"); host.wait_for_selector("#link", timeout=20000)
            link = host.inner_text("#link")
            guests = []
            for i in range(minp - 1):
                gc = brs[eng].new_context(**opts); gp = gc.new_page(); gp.on("pageerror", lambda e: errs.append(str(e)))
                gp.goto(link); gp.fill("#nm", ["Anya", "Henry", "Freya", "Omar"][i]); gp.click("text=Join game"); guests.append(gc)
            host.wait_for_selector(f"text=Players · {minp}/", timeout=30000)
            sweep(host, f"{dev} {g} lobby"); rules(host, f"{dev} {g} lobby")
            host.click('[data-act="start"]'); host.wait_for_selector(".bar", timeout=20000)
            host.wait_for_timeout(5600); host.evaluate("() => document.querySelector('.fx-welcome')?.remove()")
            sweep(host, f"{dev} {g} table"); rules(host, f"{dev} {g} table")
            host.screenshot(path=SH + f"{tag}-{g}.png")
            for gc in guests: gc.close()
            host.close()
        check(f"{dev}: no page errors", not errs, "; ".join(errs[:2]))
        ctx.close()
    for b in brs.values(): b.close()
    print(f"\nUI sweep: {sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)
