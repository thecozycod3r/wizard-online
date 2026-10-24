"""UNO (Flip / No Mercy) end-to-end on emulated phones, driven through the real UI. Same file in unoflip/test and nomercy/test.

    python3 <game>/test/e2e.py <base_url> <players> [max_minutes]

Host on iPhone 13 (WebKit), others alternate Pixel 7 (Chromium) and iPhone SE (WebKit). Players tap cards, colours,
swap targets, Draw and Pass. A button that can't be found falls back to the internal action and counts as a UI failure.
"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

SLUG = Path(__file__).resolve().parents[1].name
BASE = sys.argv[1] if len(sys.argv) > 1 else f"http://localhost:8765/{SLUG}/"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 4
MAXMIN = float(sys.argv[3]) if len(sys.argv) > 3 else 15
SH = f"/tmp/{SLUG}-"

# What a player would do now, from what their own screen knows. Shared tests read this too.
PLAN = """() => {
  const { S, E } = window.__uno, v = S.view; if (!v || !S.me || !v.waiting.includes(S.me)) return null;
  const cols = E.colorsNow({ variant: v.variant, side: v.side });
  const tally = {}; for (const c of v.hand) if (c.face.c !== 'w') tally[c.face.c] = (tally[c.face.c] || 0) + 1;
  const best = cols.slice().sort((a, b) => (tally[b] || 0) - (tally[a] || 0))[0];
  if (v.phase === 'color' || v.phase === 'roulette') return { type: 'color', color: best };
  if (v.phase !== 'play') return null;
  const ok = v.hand.filter(c => c.ok);
  if (ok.length) {
    const c = ok.find(c => c.face.c !== 'w') || ok[0], a = { type: 'play', card: c.id, uno: v.hand.length === 2 && Math.random() < .8 };
    if (c.face.c === 'w' && c.face.k !== 'roul') a.color = best;
    if (v.variant === 'mercy' && c.face.k === '7') { const t = v.players.filter(p => p.id !== S.me && !p.out); if (t.length) a.target = t[0].id; }
    return a;
  }
  if (v.drawn != null) return { type: 'pass' };
  return { type: 'draw' };
}"""


class P:
    def __init__(s, name, page, eng):
        s.name, s.page, s.eng = name, page, eng
        s.ok = s.fail = 0; s.err = []; s.kinds = {}
        page.on("pageerror", lambda e: s.err.append(str(e)))

    def c(s, sel):
        for _ in range(3):
            loc = s.page.locator(sel).first
            if not loc.count(): return None
            try:
                loc.scroll_into_view_if_needed(timeout=1500)
                b = loc.bounding_box()
                return (b["x"] + b["width"] / 2, b["y"] + min(b["height"] / 2, 30)) if b else None
            except Exception:
                time.sleep(0.2)
        return None

    def tap(s, sel):
        c = s.c(sel)
        if not c: return False
        s.page.touchscreen.tap(*c); time.sleep(0.2); return True

    def step(s):
        if s.page.evaluate("() => ['scores', 'rules'].includes(window.__uno.ui.overlay)"): s.tap('.sheethead [data-act="close"]')
        a = s.page.evaluate(PLAN)
        if not a: return False
        before = s.page.evaluate("() => window.__uno.S.view?.seq ?? -1"); ok = False
        try:
            t = a["type"]
            if t == "color": ok = s.tap(f'.colors [data-act="pickphase"][data-c="{a["color"]}"]')
            elif t in ("draw", "pass"): ok = s.tap(f'.dock [data-act="{t}"]')
            else:
                if a.get("uno") and s.page.locator('[data-act="unoarm"]').count() and not s.page.evaluate("() => window.__uno.ui.uno"): s.tap('[data-act="unoarm"]')
                # the card nearest the right edge is on top; tap its visible strip
                ok = s.tap(f'.hand .card[data-id="{a["card"]}"]')
                if ok and a.get("color"): ok = s.tap(f'[data-act="pickcolor"][data-c="{a["color"]}"]')
                if ok and a.get("target"): ok = s.tap(f'[data-act="picktarget"][data-pid="{a["target"]}"]')
        except Exception:
            ok = False
        for _ in range(20):
            time.sleep(0.15)
            if s.page.evaluate("() => window.__uno.S.view?.seq ?? -1") != before: break
        else: ok = False
        if ok: s.ok += 1
        else:
            s.page.evaluate("() => { window.__uno.ui.overlay = null; window.__uno.ui.pick = null; }")
            if s.page.evaluate("() => window.__uno.S.view?.seq ?? -1") == before:
                s.fail += 1
                try: s.page.evaluate("a => window.__uno.room.act(a)", a)
                except Exception: pass
        s.kinds[a["type"]] = s.kinds.get(a["type"], 0) + 1
        return True


def main():
    with sync_playwright() as pw:
        wk = pw.webkit.launch(); cr = pw.chromium.launch(channel="chrome")
        devs = [("iPhone 13", wk, "webkit"), ("Pixel 7", cr, "chromium"), ("iPhone SE", wk, "webkit")]
        names = ["Dhruv", "Anya", "Henry", "Freya", "Omar", "Lena", "Kofi", "Maya", "Ravi", "Zoe"][:N]
        mx = 10 if SLUG == "unoflip" else 6
        players = []
        for i, nm in enumerate(names):
            dev, br, eng = devs[0] if i == 0 else devs[1 + (i - 1) % 2]
            players.append(P(nm, br.new_context(**pw.devices[dev]).new_page(), eng))
        h = players[0]
        h.page.goto(BASE); h.page.fill("#nm", "Dhruv"); h.tap('button[type="submit"]')
        h.page.wait_for_selector("#link", timeout=20000); link = h.page.inner_text("#link")
        for p in players[1:]:
            p.page.goto(link); p.page.fill("#nm", p.name); p.tap('button[type="submit"]')
        for p in players[1:]: p.page.wait_for_selector("text=Waiting for the host to start", timeout=30000)
        h.page.wait_for_selector(f"text=Players · {N}/{mx}", timeout=20000)
        h.tap('[data-act="start"]')
        for p in players: p.page.wait_for_selector(".bar", timeout=20000)
        time.sleep(5.5)
        for p in players: p.page.evaluate("() => document.querySelector('.fx-welcome')?.remove()")
        t0 = time.time(); over = {}; shot = 0
        while time.time() - t0 < MAXMIN * 60:
            if h.page.evaluate("() => window.__uno.S.view?.phase") == "gameOver": break
            moved = False
            for p in players:
                if p.step(): moved = True
                if p.page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"): over[p.name] = True
            if moved and sum(p.ok for p in players) // 25 > shot:
                shot += 1
                for p in players[:2]: p.page.screenshot(path=SH + f"{N}p-{shot}-{p.name}.png")
            time.sleep(0.05 if moved else 0.3)
        time.sleep(4)
        for p in players[:3]: p.page.screenshot(path=SH + f"{N}p-end-{p.name}.png")
        phases = [p.page.evaluate("() => window.__uno.S.view?.phase") for p in players]
        finals = [json.dumps(p.page.evaluate("() => window.__uno.S.view?.result"), sort_keys=True) for p in players]
        agree = len(set(finals)) == 1 and finals[0] != "null"
        res = h.page.evaluate("() => { const v = window.__uno.S.view; return v?.result && v.result.rows.map(r => v.players.find(p => p.id === r.pid).name + ':' + (r.out ? 'out' : r.cards)).join(' '); }")
        print(f"{SLUG} {N} players phases={phases} {int(time.time() - t0)}s all screens agree={agree}")
        for p in players: print(f"  {p.name:6s} {p.eng:8s} ui {p.ok:3d} fallback {p.fail:2d} {p.kinds} errors {p.err or 'none'}")
        print("overflow:", over or "none", "| result:", res)
        wk.close(); cr.close()
        sys.exit(0 if all(x == "gameOver" for x in phases) and agree and not any(p.err for p in players) else 1)


main()
