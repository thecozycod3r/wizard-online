"""Table Night kit games (driver; a game's test/failover.py sets HOOK, MAX and exec()s this): host drops mid-game -> takeover -> host rejoins from a phone -> laptop returns -> game finishes.
    python3 test/failover.py [base_url]
"""
import sys, time
from playwright.sync_api import sync_playwright

from pathlib import Path as _P
SLUG = _P(sys.argv[0]).resolve().parents[1].name
MX = MAX  # noqa: F821
BASE = sys.argv[1] if len(sys.argv) > 1 else f"http://localhost:8765/{SLUG}/"
SH = f"/tmp/{SLUG}-fo-"
PLAN = open(_P(sys.argv[0]).resolve().parent / "e2e.py").read().split('PLAN = """')[1].split('"""')[0]


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
                if a: p.evaluate("a => window.__T.room.act(a)", a["a"]); moved = True
            except Exception: pass
        time.sleep(0.25 if moved else 0.45)


with sync_playwright() as pw:
    cr = pw.chromium.launch(channel="chrome")
    _nc = cr.new_context   # every page gets window.__T = the game's kit object (window[HOOK]), whenever it appears
    def _ctx(**kw):
        c = _nc(**kw); c.add_init_script(f"Object.defineProperty(window, '__T', {{ get() {{ return window['{HOOK}']; }} }})"); return c  # noqa: F821
    cr.new_context = _ctx
    errs = []
    lctx = cr.new_context(viewport={"width": 1280, "height": 800}); laptop = lctx.new_page()
    laptop.on("pageerror", lambda e: errs.append(("laptop", str(e))))
    laptop.goto(BASE); laptop.fill("#nm", "Dhruv"); laptop.evaluate("document.fonts.ready.then(() => 0)"); laptop.click("text=Start a game"); laptop.wait_for_selector("#link")
    link = laptop.inner_text("#link")
    guests = []
    for n in ["Anya", "Henry", "Freya"]:
        g = cr.new_context(**pw.devices["Pixel 7"]).new_page(); g.on("pageerror", lambda e, n=n: errs.append((n, str(e))))
        g.goto(link); g.fill("#nm", n); g.evaluate("document.fonts.ready.then(() => 0)"); g.click("text=Join game"); guests.append(g)
    for g in guests: g.wait_for_selector("text=Waiting for the host to start", timeout=30000)
    laptop.wait_for_selector(f"text=Players · 4/{MX}", timeout=20000)
    laptop.click("text=Start game")
    for g in guests: g.wait_for_selector(".bar", timeout=20000)
    time.sleep(5.5)
    bots([laptop] + guests, lambda: guests[0].evaluate("() => (window.__T.S.view?.seq || 0) >= 14"), 180)
    print("game under way; laptop runs the table:", laptop.evaluate("() => window.__T.room.isHost"))
    lctx.set_offline(True); t = time.time()
    ok = wait(lambda: any(g.evaluate("() => window.__T.room.isHost") for g in guests), 30)
    who = [n for n, g in zip(["Anya", "Henry", "Freya"], guests) if g.evaluate("() => window.__T.room.isHost")]
    print(f"takeover: {ok} after {time.time() - t:.1f}s by {who}")
    # play on while Dhruv is away: "Play for Dhruv" from the new runner when it's his turn
    def step_with_playfor():
        for g in guests:
            if g.evaluate("() => window.__T.room.isHost"):
                g.evaluate("""() => { const { S, room } = window.__T; const w = S.view?.waiting?.[0];
                  if (w && S.online[w] === false) room.playFor(w); }""")
    for _ in range(12):
        bots(guests, lambda: False, 1.5); step_with_playfor()
    guests[0].screenshot(path=SH + "after-takeover.png")
    phone = cr.new_context(**pw.devices["iPhone 13"]).new_page(); phone.on("pageerror", lambda e: errs.append(("phone", str(e))))
    phone.goto(link); phone.fill("#nm", "Dhruv"); phone.evaluate("document.fonts.ready.then(() => 0)"); phone.click("text=Join game")
    phone.wait_for_selector("text=Which player are you?", timeout=20000); phone.screenshot(path=SH + "claim.png")
    phone.locator('li:has-text("Dhruv") [data-act="claim"]').click()
    phone.wait_for_selector(".bar", timeout=20000)
    print("phone took Dhruv's seat:", phone.evaluate("() => window.__T.S.view.players[window.__T.S.view.me].name"))
    lctx.set_offline(False)
    back = wait(lambda: laptop.evaluate("() => !window.__T.room.isHost && window.__T.S.mode === 'claim'"), 40)
    hosts = sum(p.evaluate("() => window.__T.room.isHost") for p in guests + [phone, laptop])
    print("laptop stepped aside:", back, "| devices running the table:", hosts)
    players = [phone] + guests
    bots(players, lambda: all(p.evaluate("() => window.__T.S.view?.phase") == "gameOver" for p in players), 400)
    res = [p.evaluate("() => window.__T.S.view?.phase + ' ' + window.__T.S.view?.result?.rows.map(r => r.pid + ':' + r.points).join(',') + ' ' + window.__T.S.view?.players.map(x => x.name).join(',')") for p in players]
    print("final:", *res, sep="\n  ")
    same = len(set(res)) == 1 and res[0].startswith("gameOver")
    print("all devices agree:", same, "| errors:", errs or "none")
    cr.close()
    sys.exit(0 if ok and back and hosts == 1 and same and not errs else 1)
