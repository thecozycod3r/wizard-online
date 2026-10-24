"""Host drops mid-game -> another player takes over -> host rejoins from a phone -> laptop comes back.

    python3 test/failover.py [base_url]
"""
import random, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/wizard/"
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/fo-"
CHOOSE = open(__file__.replace("failover.py", "e2e.py")).read().split('CHOOSE = """')[1].split('"""')[0]


def wait(pred, secs, step=0.3):
    t = time.time()
    while time.time() - t < secs:
        if pred(): return True
        time.sleep(step)
    return False


def main():
    with sync_playwright() as pw:
        cr = pw.chromium.launch(channel="chrome")
        laptop_ctx = cr.new_context(viewport={"width": 1280, "height": 800})
        laptop = laptop_ctx.new_page()
        errs = []
        laptop.on("pageerror", lambda e: errs.append(("laptop", str(e))))
        laptop.goto(BASE); laptop.fill("#nm", "Dhruv"); laptop.evaluate("document.fonts.ready.then(() => 0)"); laptop.click("text=Start a game"); laptop.wait_for_selector("#link")
        link = laptop.inner_text("#link")
        guests = []
        for n in ["Anya", "Henry", "Freya"]:
            g = cr.new_context(**pw.devices["Pixel 7"]).new_page()
            g.on("pageerror", lambda e, n=n: errs.append((n, str(e))))
            g.goto(link); g.fill("#nm", n); g.evaluate("document.fonts.ready.then(() => 0)"); g.click("text=Join game"); guests.append(g)
        for g in guests: g.wait_for_selector("text=Waiting for the host to start", timeout=30000)
        laptop.wait_for_selector("text=Players · 4/8", timeout=20000)
        laptop.select_option("#rounds", "5"); laptop.click("text=Start game")
        for g in guests: g.wait_for_selector(".bar", timeout=20000)
        time.sleep(6)  # let the welcome animation pass

        def bots(pages, until, secs):
            t = time.time()
            while time.time() - t < secs and not until():
                moved = False
                for p in pages:
                    try:
                        a = p.evaluate(CHOOSE)
                        if a: p.evaluate("a => window.__wiz.act(a)", a); moved = True
                    except Exception: pass
                time.sleep(0.2 if moved else 0.4)

        # 1) play into round 2 with everyone online
        bots([laptop] + guests, lambda: guests[0].evaluate("() => (window.__wiz.S.view?.round || 0) >= 2"), 120)
        print("round 2 reached; laptop is host:", laptop.evaluate("() => !!window.__wiz.H"))

        # 2) laptop loses internet
        laptop_ctx.set_offline(True); t_drop = time.time()
        ok = wait(lambda: any(g.evaluate("() => !!window.__wiz.H") for g in guests), 30)
        new_host = next((i for i, g in enumerate(guests) if g.evaluate("() => !!window.__wiz.H")), None)
        print(f"takeover: {ok} after {time.time() - t_drop:.1f}s by {['Anya', 'Henry', 'Freya'][new_host] if new_host is not None else '-'}")
        guests[0].screenshot(path=SH + "after-takeover.png")

        # 3) Dhruv opens the link on his phone and claims his seat
        phone = cr.new_context(**pw.devices["Pixel 7"]).new_page()
        phone.on("pageerror", lambda e: errs.append(("phone", str(e))))
        phone.goto(link); phone.fill("#nm", "Dhruv"); phone.evaluate("document.fonts.ready.then(() => 0)"); phone.click("text=Join game")
        phone.wait_for_selector("text=Which player are you?", timeout=20000)
        phone.screenshot(path=SH + "claim.png")
        phone.locator('li:has-text("Dhruv") [data-act="claim"]').click()
        phone.wait_for_selector(".bar", timeout=20000)
        print("phone took Dhruv's seat:", phone.evaluate("() => window.__wiz.S.view.players[window.__wiz.S.view.me].name"))

        # 4) laptop comes back online
        laptop_ctx.set_offline(False)
        back = wait(lambda: laptop.evaluate("() => !window.__wiz.H && window.__wiz.S.mode === 'claim'"), 40)
        hosts = sum(p.evaluate("() => !!window.__wiz.H") for p in guests + [phone, laptop])
        print("laptop stepped aside:", back, "| devices running the table:", hosts)
        laptop.screenshot(path=SH + "laptop-back.png")

        # 5) finish the game from phone + guests
        players = [phone] + guests
        bots(players, lambda: all(p.evaluate("() => window.__wiz.S.view?.phase") == "gameOver" for p in players), 300)
        res = [p.evaluate("() => window.__wiz.S.view?.phase + ' ' + window.__wiz.S.view?.players.map(x => x.name + ':' + x.total).join(',')") for p in players]
        print("final:", *res, sep="\n  ")
        same = len({r for r in res}) == 1 and res[0].startswith("gameOver")
        print("all devices agree:", same, "| errors:", errs or "none")
        cr.close()
        sys.exit(0 if (ok and back and hosts == 1 and same and not errs) else 1)


main()
