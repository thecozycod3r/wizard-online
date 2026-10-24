"""Animation probe for any Games4free game: plays a full 3-player game and records every effect element that
appears on each screen (welcome, banners, flying cards/tokens, pops, crown, battle screens).

    python3 shared/test/fx.py <wizard|lodestone|marvels> [base_url]
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
# What each game must show at least once on some screen during a full game.
NEED = {
    "wizard": ["fx-welcome", "crown", "fx-"],
    "lodestone": ["fx-welcome", "crown", "fly", "fx-banner"],
    "marvels": ["fx-welcome", "crown", "fly", "pop", "fx-banner", "battle"],
    "avalon": ["fx-welcome", "crown", "fx-banner", "fly", "pop", "glow"],
    "incan": ["fx-welcome", "crown", "fx-banner", "fly", "pop", "glow", "badgefx"],
    "unoflip": ["fx-welcome", "crown", "fx-banner", "fly"],
    "nomercy": ["fx-welcome", "crown", "fx-banner", "fly"],
    "nimmt": ["fx-welcome", "fx-banner", "pop"],
    "skullking": ["fx-welcome", "fx-banner", "pop"],
    "kingscup": ["fx-welcome", "fx-banner"],
    "ridebus": ["fx-welcome", "fx-banner"],
}[GAME]
NAMES = ["Dhruv", "Anya", "Henry"] + (["Freya", "Omar"] if GAME == "avalon" else [])
WATCH = """() => { window.__fxSeen = {};
  const note = el => { if (!(el instanceof Element)) return; for (const c of el.classList) if (/^(fx|fly|pop|crown|battle|fx-|glow|badgefx|hurt)/.test(c)) window.__fxSeen[c] = (window.__fxSeen[c] || 0) + 1;
    el.querySelectorAll?.('.crown,.battle,[class^="fx"]').forEach(x => { for (const c of x.classList) if (/^(fx|crown|battle)/.test(c)) window.__fxSeen[c] = (window.__fxSeen[c] || 0) + 1; }); };
  new MutationObserver(ms => ms.forEach(m => { if (m.type === 'attributes') { if (/\\b(pop|glow|hurt)\\b/.test(m.target.className)) note(m.target); } else m.addedNodes.forEach(note); })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); }"""

with sync_playwright() as pw:
    cr = pw.chromium.launch(channel="chrome")
    pages, errs = [], []
    for n in NAMES:
        p = cr.new_context(**pw.devices["Pixel 7"]).new_page(); p.on("pageerror", lambda e, n=n: errs.append((n, str(e)))); pages.append(p)
    host = pages[0]
    host.goto(BASE); host.evaluate(WATCH); host.fill("#nm", "Dhruv"); host.click("text=Start a game"); host.wait_for_selector("#link")
    link = host.inner_text("#link")
    for p, n in zip(pages[1:], NAMES[1:]):
        p.goto(link); p.evaluate(WATCH); p.fill("#nm", n); p.click("text=Join game")
    host.wait_for_selector(f"text=Players · {len(NAMES)}/", timeout=30000)
    if GAME == "wizard": host.select_option("#rounds", "3")
    host.click('[data-act="start"]')
    for p in pages: p.wait_for_selector(".bar", timeout=20000)
    time.sleep(5.5)
    t = time.time()
    while time.time() - t < 600:
        if host.evaluate(f"() => {J}.S.view?.phase") == "gameOver": break
        for p in pages:
            try:
                a = p.evaluate(PLAN)
                if a: a.pop("from", None); p.evaluate(f"a => {J}.room.act(a)", a)
            except Exception: pass
        time.sleep(0.6)   # slow enough for effects to play
    time.sleep(4)
    seen = {}
    for p in pages:
        for k, v in p.evaluate("() => window.__fxSeen").items(): seen[k] = seen.get(k, 0) + v
    missing = [k for k in NEED if not any(s.startswith(k) for s in seen)]
    print(f"{GAME}: finished={host.evaluate(f'() => {J}.S.view?.phase') == 'gameOver'} effects seen: {dict(sorted(seen.items()))}")
    print(f"{GAME}: missing {missing or 'nothing'} | errors {errs or 'none'}")
    cr.close()
    sys.exit(1 if missing or errs else 0)
