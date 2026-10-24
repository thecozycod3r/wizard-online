"""Lobby stays where you scrolled it while the table updates (players join, host changes settings).

    python3 shared/test/vscroll.py [base_url]

For every game, on a small phone (iPhone SE, WebKit) and a short desktop window (Chrome): the host scrolls the lobby
page down, then two players join and a setting changes. The page must not jump back to the top.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/").rstrip("/") + "/"
HOOK = {"wizard": "__wiz", "lodestone": "__lode", "marvels": "__mar", "avalon": "__ava", "incan": "__inc", "unoflip": "__uno", "nomercy": "__uno", "nimmt": "__nim", "skullking": "__sk", "kingscup": "__kc", "ridebus": "__rb", "coup": "__coup", "spyfall": "__spy", "codenames": "__cn"}
results = []

def check(name, ok, detail=""):
    results.append(ok); print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

with sync_playwright() as pw:
    brs = {"webkit": pw.webkit.launch(), "chromium": pw.chromium.launch(channel="chrome")}
    for dev, eng in [("iPhone SE", "webkit"), ("Desktop", "chromium")]:
        opts = {"viewport": {"width": 1280, "height": 620}} if dev == "Desktop" else pw.devices[dev]
        for g, h in HOOK.items():
            J = f"window.{h}"
            c = brs[eng].new_context(**opts); host = c.new_page()
            host.goto(BASE + g + "/"); host.fill("#nm", "Dhruv"); host.click("text=Start a game"); host.wait_for_selector("#link")
            link = host.inner_text("#link"); host.wait_for_timeout(600)
            room = host.evaluate("() => { const p = document.querySelector('.page'); if (!p) return 0; p.scrollTop = 99999; return p.scrollTop; }")
            if room < 40: print(f"     {dev} {g}: lobby fits without scrolling ({room}px)"); c.close(); continue
            host.wait_for_timeout(400)
            guests = []
            for n in ["Anya", "Henry"]:
                gc = brs[eng].new_context(**opts); gp = gc.new_page(); gp.goto(link); gp.fill("#nm", n); gp.click("text=Join game"); guests.append(gc)
            host.wait_for_selector("text=Players · 3/", timeout=20000)
            host.evaluate(f"() => {J}.room.settings({{ timer: 60 }})"); host.wait_for_timeout(1500)
            after = host.evaluate("() => document.querySelector('.page')?.scrollTop || 0")
            check(f"{dev} {g}: lobby stays scrolled through joins + a setting change", abs(after - room) < 30, f"{room} → {after}")
            # the host taps a setting button down the page, like a real host would
            btn = host.locator('[data-act="timer"][data-v="30"], [data-k="timer"][data-v="30"], [data-act="timer"]').last
            before = host.evaluate("() => document.querySelector('.page')?.scrollTop || 0")
            if btn.count() and before > 40:
                btn.click(); host.wait_for_timeout(1500)
                after = host.evaluate("() => document.querySelector('.page')?.scrollTop || 0")
                check(f"{dev} {g}: host taps a setting and the page stays put", abs(after - before) < 60, f"{before} → {after}")
            for gc in guests: gc.close()
            c.close()
    for b in brs.values(): b.close()
print(f"\nvscroll: {sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
