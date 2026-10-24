"""A phone goes to the background mid-game (screen locks / switches to WhatsApp), then comes back.

    python3 shared/test/resume.py <wizard|lodestone|marvels> [base_url]

The page is frozen (timers stop, like iOS suspending a tab) and cut off the network for 40 s while the others play,
then woken. Two cases: a guest (Henry) and the device running the table (Dhruv). Checks: the woken phone catches up
within a few seconds, nobody's game ever goes backwards, the table isn't split in two, and the game finishes with
every screen agreeing.
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

GAME = sys.argv[1]
BASE = sys.argv[2] if len(sys.argv) > 2 else f"http://localhost:8765/{GAME}/"
J = {"wizard": "window.__wiz", "lodestone": "window.__lode", "marvels": "window.__mar", "avalon": "window.__ava", "incan": "window.__inc", "unoflip": "window.__uno", "nomercy": "window.__uno", "nimmt": "window.__nim", "skullking": "window.__sk", "kingscup": "window.__kc", "ridebus": "window.__rb"}[GAME]
ROOT = Path(__file__).resolve().parents[2]
PLAN = (open(ROOT / "wizard/test/e2e.py").read().split('CHOOSE = """')[1].split('"""')[0] if GAME == "wizard"
        else open(ROOT / f"{GAME}/test/e2e.py").read().split('PLAN = """')[1].split('"""')[0])
# kit games' PLAN returns {a: action, taps: [...]}; these suites want the action itself
if GAME in ("nimmt", "skullking", "kingscup", "ridebus"): PLAN = f"() => {{ const p = ({PLAN})(); return p ? p.a : null; }}"
MAXP = {"marvels": 7, "avalon": 10, "incan": 8, "unoflip": 10, "nomercy": 6, "nimmt": 10, "skullking": 8, "kingscup": 12, "ridebus": 10, "wizard": 8}.get(GAME, 6)
AWAY = 40
import os
QUIET = os.environ.get("QUIET") == "1"   # sleep with no offline / visibility events (the page must notice by itself)
results = []

def check(name, ok, detail=""):
    results.append(ok); print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

# How far the game has got, as each screen sees it (wizard has no seq on the view; use the state's n via the room)
PROGRESS = f"() => {{ const v = {J}.S.view; return v ? (v.seq ?? 0) * 1 : -1; }}"
HOSTING = f"() => !!{J}.S.isHost"

with sync_playwright() as pw:
    cr = pw.chromium.launch(channel="chrome")
    errs = []
    names = ["Dhruv", "Anya", "Henry", "Freya"] + (["Omar"] if GAME == "avalon" else [])
    ctx = {n: cr.new_context(**pw.devices["Pixel 7"]) for n in names}
    pg = {}
    for n in names:
        pg[n] = ctx[n].new_page(); pg[n].on("pageerror", lambda e, n=n: errs.append((n, str(e))))
    cdp = {n: ctx[n].new_cdp_session(pg[n]) for n in names}
    pg["Dhruv"].goto(BASE); pg["Dhruv"].fill("#nm", "Dhruv"); pg["Dhruv"].click("text=Start a game"); pg["Dhruv"].wait_for_selector("#link")
    link = pg["Dhruv"].inner_text("#link")
    for n in names[1:]:
        pg[n].goto(link); pg[n].fill("#nm", n)
        if n == "Henry": time.sleep(8)   # a real person takes a while on the name screen (this once broke joining)
        pg[n].click("text=Join game")
    pg["Dhruv"].wait_for_selector(f"text=Players · {len(names)}/{MAXP}", timeout=30000)
    if GAME == "wizard": pg["Dhruv"].select_option("#rounds", "5")
    pg["Dhruv"].click('[data-act="start"]')
    for n in names: pg[n].wait_for_selector(".bar", timeout=20000)
    time.sleep(5)

    # watch for any screen's game going backwards
    for n in names:
        pg[n].evaluate(f"""() => {{ window.__back = 0; let hi = -1; setInterval(() => {{ const v = {J}.S.view; const s = v ? (v.seq ?? 0) : -1;
            if (s >= 0 && s < hi && v.phase !== 'gameOver') window.__back++; if (s > hi) hi = s; }}, 200); }}""")

    def play(who, secs):
        t = time.time()
        while time.time() - t < secs:
            for n in who:
                try:
                    a = pg[n].evaluate(PLAN)
                    if a: a.pop("from", None); pg[n].evaluate(f"a => {J}.room.act(a)", a)
                except Exception: pass
            time.sleep(0.4)

    def away(n):
        if not QUIET: ctx[n].set_offline(True)
        cdp[n].send("Page.setWebLifecycleState", {"state": "frozen"})
    def back(n):
        cdp[n].send("Page.setWebLifecycleState", {"state": "active"})
        if not QUIET:
            ctx[n].set_offline(False); pg[n].evaluate("() => document.dispatchEvent(new Event('visibilitychange'))")

    def caught_up(n, ref, secs=12):
        t = time.time()
        while time.time() - t < secs:
            if pg[n].evaluate(PROGRESS) >= pg[ref].evaluate(PROGRESS) and pg[n].evaluate(f"() => {J}.S.mode") == "game": return round(time.time() - t, 1)
            play([x for x in names if x != n], 0.5)
        return None

    play(names, 8)
    # 1) a guest goes to the background
    away("Henry"); play(["Dhruv", "Anya", "Freya"], AWAY); back("Henry")
    t = caught_up("Henry", "Anya")
    check("guest back from background catches up", t is not None, f"{t}s")
    hosts = [n for n in names if pg[n].evaluate(HOSTING)]
    check("still one device running the table", len(hosts) == 1, str(hosts))

    play(names, 6)
    # 2) the device running the table goes to the background
    runner = hosts[0] if hosts else "Dhruv"
    others = [n for n in names if n != runner]
    away(runner); play(others, AWAY); back(runner)
    t = caught_up(runner, others[0])
    check(f"table runner ({runner}) back from background catches up", t is not None, f"{t}s")
    t0 = time.time()
    while time.time() - t0 < 10:
        hosts = [n for n in names if pg[n].evaluate(HOSTING)]
        if len(hosts) == 1: break
        time.sleep(0.3)
    check("back to one device running the table", len(hosts) == 1, f"{hosts} after {round(time.time() - t0, 1)}s")

    t = time.time()
    while time.time() - t < 400 and not all(pg[n].evaluate(f"() => {J}.S.view?.phase") == "gameOver" for n in names): play(names, 2)
    phases = [pg[n].evaluate(f"() => {J}.S.view?.phase") for n in names]
    check("game finishes on every screen", all(p == "gameOver" for p in phases), str(phases))
    backs = {n: pg[n].evaluate("() => window.__back") for n in names}
    check("nobody's game ever went backwards", not any(backs.values()), str(backs))
    seqs = {n: pg[n].evaluate(PROGRESS) for n in names}
    check("all screens agree", len(set(seqs.values())) == 1, str(seqs))
    check("no page errors", not errs, str(errs[:3]))
    cr.close()

print(f"{GAME}: {sum(results)}/{len(results)} background/resume checks passed")
sys.exit(0 if all(results) else 1)
