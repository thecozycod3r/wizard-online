"""Phone swipe on side-scrolling rows while the game updates, for any Games4free game.

    python3 shared/test/swipe.py <wizard|lodestone|marvels> [base_url]

6 players (so rows overflow on a phone). The phone (Pixel 7, real CDP touch) swipes each scrolling row — starting the
swipe ON a card — while the other players keep moving. The row must move with the finger, stay where it was left after
the next state updates, and a sideways swipe must never pick a card up.
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

GAME = sys.argv[1]
BASE = sys.argv[2] if len(sys.argv) > 2 else f"http://localhost:8765/{GAME}/"
J = {"wizard": "window.__wiz", "lodestone": "window.__lode", "marvels": "window.__mar", "avalon": "window.__ava", "incan": "window.__inc", "unoflip": "window.__uno", "nomercy": "window.__uno", "nimmt": "window.__nim", "skullking": "window.__sk", "kingscup": "window.__kc", "ridebus": "window.__rb", "coup": "window.__coup", "spyfall": "window.__spy", "codenames": "window.__cn"}[GAME]
ROWS = {"wizard": [".opps"], "lodestone": [".mrow", ".opps"], "marvels": [".hand", ".opps"], "avalon": [".tabs"], "incan": [".tabs"], "unoflip": [".hand", ".opps"], "nomercy": [".hand", ".opps"], "nimmt": [".hand"], "skullking": [".hand"], "kingscup": [".tabs"], "ridebus": [".tabs"], "coup": [".tabs"], "spyfall": [".tabs"], "codenames": [".tabs"]}[GAME]   # Avalon has no sideways rows on the table
ROOT = Path(__file__).resolve().parents[2]
PLAN = (open(ROOT / "wizard/test/e2e.py").read().split('CHOOSE = """')[1].split('"""')[0] if GAME == "wizard"
        else open(ROOT / f"{GAME}/test/e2e.py").read().split('PLAN = """')[1].split('"""')[0])
# kit games' PLAN returns {a: action, taps: [...]}; these suites want the action itself
if GAME in ("nimmt", "skullking", "kingscup", "ridebus", "coup", "spyfall", "codenames"): PLAN = f"() => {{ const p = ({PLAN})(); return p ? p.a : null; }}"
MAXP = {"marvels": 7, "avalon": 10, "incan": 8, "unoflip": 10, "nomercy": 6, "nimmt": 10, "skullking": 8, "kingscup": 12, "ridebus": 10, "wizard": 8, "coup": 10, "spyfall": 10, "codenames": 12}.get(GAME, 6)
results = []

def check(name, ok, detail=""):
    results.append(ok); print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

with sync_playwright() as pw:
    cr = pw.chromium.launch(channel="chrome")
    errs = []
    names = ["Dhruv", "Anya", "Henry", "Freya", "Omar", "Lena"]
    ctx = {n: cr.new_context(**pw.devices["Pixel 7"]) for n in names}
    pg = {}
    for n in names:
        pg[n] = ctx[n].new_page(); pg[n].on("pageerror", lambda e, n=n: errs.append((n, str(e))))
    pg["Dhruv"].goto(BASE); pg["Dhruv"].fill("#nm", "Dhruv"); pg["Dhruv"].click("text=Start a game"); pg["Dhruv"].wait_for_selector("#link")
    link = pg["Dhruv"].inner_text("#link")
    for n in names[1:]:
        pg[n].goto(link); pg[n].fill("#nm", n); pg[n].evaluate("document.fonts.ready.then(() => 0)"); pg[n].click("text=Join game")
    pg["Dhruv"].wait_for_selector(f"text=Players · 6/{MAXP}", timeout=30000)
    pg["Dhruv"].click('[data-act="start"]')
    for n in names: pg[n].wait_for_selector(".bar", timeout=20000)
    time.sleep(5.5)
    for n in names: pg[n].evaluate("() => document.querySelector('.fx-welcome')?.remove()")

    me = pg["Anya"]   # the swiping phone
    others = list(pg.values())   # Anya's own moves go straight to the room, never through her screen
    cdp = ctx["Anya"].new_cdp_session(me)
    stop = [False]

    def tick(me_too=True):
        for p in others if me_too else [q for q in others if q is not me]:
            try:
                a = p.evaluate(PLAN)
                if a: a.pop("from", None); p.evaluate(f"a => {J}.room.act(a)", a)
            except Exception: pass

    def touch(kind, x, y):
        pts = [] if kind == "touchEnd" else [{"x": x, "y": y, "id": 1}]
        cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": pts})

    def swipe_row(sel, idx):
        # start on a card near the right edge and drag left, like a thumb
        box = me.evaluate("""([s, i]) => { const r = document.querySelectorAll(s)[i]; if (!r || r.scrollWidth <= r.clientWidth + 4) return null;
            r.scrollIntoView({block: 'center'}); const b = r.getBoundingClientRect(); return {x: b.right - 30, y: b.top + b.height / 2, max: r.scrollWidth - r.clientWidth}; }""", [sel, idx])
        if not box: return None
        time.sleep(0.4)
        box = me.evaluate("([s, i]) => { const b = document.querySelectorAll(s)[i].getBoundingClientRect(); return {x: b.right - 30, y: b.top + b.height / 2}; }", [sel, idx])
        seq0 = me.evaluate(f"() => {J}.S.view?.seq || 0")
        x, y = box["x"], box["y"]
        touch("touchStart", x, y)
        for k in range(1, 13):
            x -= 18; touch("touchMove", x, y + (k % 2)); time.sleep(0.05)
            if k == 6: tick()       # a state update lands mid-swipe
        mid = me.evaluate("([s, i]) => document.querySelectorAll(s)[i].scrollLeft", [sel, idx])
        touch("touchEnd", x, y)
        time.sleep(0.4)
        ghost = me.evaluate("() => !!document.querySelector('.dragghost')")
        left = me.evaluate("([s, i]) => document.querySelectorAll(s)[i]?.scrollLeft || 0", [sel, idx])
        # more updates after the swipe (in Marvels Anya holds her pick, so her hand stays the same cards)
        for _ in range(4): tick(GAME not in ("marvels", "nimmt")); time.sleep(0.6)
        seq1 = me.evaluate(f"() => {J}.S.view?.seq || 0")
        after = me.evaluate("([s, i]) => document.querySelectorAll(s)[i]?.scrollLeft || 0", [sel, idx])
        return dict(mid=mid, left=left, after=after, ghost=ghost, updates=seq1 - seq0)

    tried = 0
    for sel in ROWS:
        n = me.evaluate("s => document.querySelectorAll(s).length", sel)
        for i in range(n):
            r = swipe_row(sel, i)
            if not r: continue
            tried += 1
            name = f"{sel}[{i}]"
            check(f"{name} moves with the finger", r["mid"] > 40, f"scrollLeft mid-swipe {r['mid']}")
            check(f"{name} stays put through {r['updates']} updates", r["updates"] > 0 and r["after"] > 40 and abs(r["after"] - r["left"]) < 4, f"{r['left']} → {r['after']}")
            check(f"{name} swipe doesn't pick up a card", not r["ghost"])
            me.evaluate("([s, i]) => { const r = document.querySelectorAll(s)[i]; if (r) r.scrollLeft = 0; }", [sel, i])
    # only games whose table really has sideways rows must find one; the rest just must not error
    if GAME in ("wizard", "lodestone", "marvels", "unoflip", "nomercy"): check("found rows that overflow on a phone", tried > 0, f"{tried} rows")
    else: print(f"     ({tried} sideways rows on this table)")
    check("no page errors", not errs, str(errs[:3]))
    cr.close()

print(f"{GAME}: {sum(results)}/{len(results)} swipe checks passed")
sys.exit(0 if all(results) else 1)
