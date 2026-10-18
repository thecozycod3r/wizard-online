"""Incan Gold: host drops mid-game -> takeover -> host rejoins from a phone -> laptop returns -> game finishes.
    python3 test/failover.py [base_url]
"""
import sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/incan/"
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/lfo-"
PLAN = open(__file__.replace("failover.py", "e2e.py")).read().split('PLAN = """')[1].split('"""')[0]


def wait(pred, secs):
    t = time.time()
    while time.time() - t < secs:
        try:
            if pred(): return True
        except Exception: pass
        time.sleep(0.3)
    return False


def bots(pages, until, secs):
    t = time.time()
    while time.time() - t < secs and not until():
        moved = False
        for p in pages:
            try:
                a = p.evaluate(PLAN)
                if a: a.pop("from", None); p.evaluate("a => window.__inc.room.act(a)", a); moved = True
            except Exception: pass
        time.sleep(0.25 if moved else 0.45)


with sync_playwright() as pw:
    cr = pw.chromium.launch(channel="chrome")
    errs = []
    lctx = cr.new_context(viewport={"width": 1280, "height": 800}); laptop = lctx.new_page()
    laptop.on("pageerror", lambda e: errs.append(("laptop", str(e))))
    laptop.goto(BASE); laptop.fill("#nm", "Dhruv"); laptop.click("text=Start a game"); laptop.wait_for_selector("#link")
    link = laptop.inner_text("#link")
    guests = []
    for n in ["Anya", "Henry", "Freya"]:
        g = cr.new_context(**pw.devices["Pixel 7"]).new_page(); g.on("pageerror", lambda e, n=n: errs.append((n, str(e))))
        g.goto(link); g.fill("#nm", n); g.click("text=Join game"); guests.append(g)
    for g in guests: g.wait_for_selector("text=Waiting for the host to start", timeout=30000)
    laptop.wait_for_selector("text=Players · 4/8", timeout=20000)
    laptop.click("text=Start game")
    for g in guests: g.wait_for_selector(".bar", timeout=20000)
    time.sleep(5.5)
    bots([laptop] + guests, lambda: guests[0].evaluate("() => (window.__inc.S.view?.round || 0) >= 2"), 180)
    print("temple 2 reached; laptop runs the table:", laptop.evaluate("() => window.__inc.room.isHost"))
    lctx.set_offline(True); t = time.time()
    ok = wait(lambda: any(g.evaluate("() => window.__inc.room.isHost") for g in guests), 30)
    who = [n for n, g in zip(["Anya", "Henry", "Freya"], guests) if g.evaluate("() => window.__inc.room.isHost")]
    print(f"takeover: {ok} after {time.time() - t:.1f}s by {who}")
    # play on while Dhruv is away: "Play for Dhruv" from the new runner when it's his turn
    def step_with_playfor():
        for g in guests:
            if g.evaluate("() => window.__inc.room.isHost"):
                g.evaluate("""() => { const { S, room } = window.__inc; const w = S.view?.waiting?.[0];
                  if (w && S.online[w] === false) room.playFor(w); }""")
    for _ in range(12):
        bots(guests, lambda: False, 1.5); step_with_playfor()
    guests[0].screenshot(path=SH + "after-takeover.png")
    phone = cr.new_context(**pw.devices["iPhone 13"]).new_page(); phone.on("pageerror", lambda e: errs.append(("phone", str(e))))
    phone.goto(link); phone.fill("#nm", "Dhruv"); phone.click("text=Join game")
    phone.wait_for_selector("text=Which player are you?", timeout=20000); phone.screenshot(path=SH + "claim.png")
    phone.locator('li:has-text("Dhruv") [data-act="claim"]').click()
    phone.wait_for_selector(".bar", timeout=20000)
    print("phone took Dhruv's seat:", phone.evaluate("() => window.__inc.S.view.players[window.__inc.S.view.me].name"))
    lctx.set_offline(False)
    back = wait(lambda: laptop.evaluate("() => !window.__inc.room.isHost && window.__inc.S.mode === 'claim'"), 40)
    hosts = sum(p.evaluate("() => window.__inc.room.isHost") for p in guests + [phone, laptop])
    print("laptop stepped aside:", back, "| devices running the table:", hosts)
    players = [phone] + guests
    bots(players, lambda: all(p.evaluate("() => window.__inc.S.view?.phase") == "gameOver" for p in players), 400)
    res = [p.evaluate("() => window.__inc.S.view?.phase + ' ' + window.__inc.S.view?.result?.rows.map(r => r.pid + ':' + r.points + '/' + r.artifacts).join(',') + ' ' + window.__inc.S.view?.players.map(x => x.name).join(',')") for p in players]
    print("final:", *res, sep="\n  ")
    same = len(set(res)) == 1 and res[0].startswith("gameOver")
    print("all devices agree:", same, "| errors:", errs or "none")
    cr.close()
    sys.exit(0 if ok and back and hosts == 1 and same and not errs else 1)
