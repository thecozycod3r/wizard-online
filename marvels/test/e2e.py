"""Seven Marvels end-to-end on emulated phones, driven through the real UI.

    python3 test/e2e.py <base_url> <players> [max_minutes]

Host on iPhone 13 (WebKit, taps); others alternate Pixel 7 (Chromium, real touch drags onto Build / Marvel stage / Sell)
and iPhone SE (WebKit, taps). Each pick goes through on-screen controls; a control that can't be found falls back to
the internal action and is counted as a UI failure.
"""
import json, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/marvels/"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 4
MAXMIN = float(sys.argv[3]) if len(sys.argv) > 3 else 15
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/mar-"

PLAN = """() => {
  const { S } = window.__mar, v = S.view; if (!v || !S.me) return null;
  if (!v.waiting.includes(S.me)) return null;
  if (v.phase === 'salvage') return { type: 'salvage', card: (v.salvage || [])[0] ?? null };
  if (v.phase === 'pick' && v.pick) return null;
  const hand = v.hand || []; if (!hand.length) return null;
  const b = hand.filter(c => v.options[c].build.ok), r = Math.random();
  if (b.length && r < .75) return { type: 'pick', card: b[Math.floor(Math.random() * b.length)], how: 'build' };
  const s = hand.find(c => v.options[c].stage.ok); if (s && r < .9) return { type: 'pick', card: s, how: 'stage' };
  if (b.length) return { type: 'pick', card: b[0], how: 'build' };
  return { type: 'pick', card: hand[0], how: 'sell' };
}"""


class P:
    def __init__(s, name, page, mode, eng):
        s.name, s.page, s.mode, s.eng = name, page, mode, eng
        s.cdp = page.context.new_cdp_session(page) if eng == "chromium" else None
        s.ok = s.fail = 0; s.err = []; s.kinds = {}
        page.on("pageerror", lambda e: s.err.append(str(e)))

    def c(s, sel, scroll=True):
        for _ in range(3):
            loc = s.page.locator(sel).first
            if not loc.count(): return None
            try:
                if scroll: loc.scroll_into_view_if_needed(timeout=1500)
                b = loc.bounding_box()
                return (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2) if b else None
            except Exception:
                time.sleep(0.2)
        return None

    def tap(s, sel):
        c = s.c(sel)
        if not c: return False
        s.page.touchscreen.tap(*c); time.sleep(0.18); return True

    def drag(s, sel, how):
        a = s.c(sel)
        z = s.page.evaluate(f"() => {{ const r = document.querySelector('.zone[data-how=\"{how}\"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }}")
        if not a or not s.cdp: return False
        pt = lambda x, y: [{"x": x, "y": y, "id": 1}]
        s.cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": pt(*a)})
        for k in range(1, 15):
            s.cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": pt(a[0] + (z[0] - a[0]) * k / 14, a[1] + (z[1] - a[1]) * k / 14)}); time.sleep(0.015)
        s.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); time.sleep(0.2)
        return True

    def seq(s): return s.page.evaluate("() => window.__mar.S.view?.seq ?? -1")

    def step(s):
        # a person closes the battle summary before playing on
        if s.page.evaluate("() => window.__mar.ui.overlay === 'battle'"): s.tap('.sheethead [data-act="close"]')
        a = s.page.evaluate(PLAN)
        if not a: return False
        before = s.seq(); t = a["type"]; ok = False
        try:
            if t == "pick":
                sel = f'.hand [data-card="{a["card"]}"]'
                if s.mode == "drag": ok = s.drag(sel, a["how"])
                else: ok = s.tap(sel) and s.tap(f'[data-act="pick"][data-how="{a["how"]}"][data-card="{a["card"]}"]')
            elif t == "salvage":
                if s.page.evaluate("() => window.__mar.ui.overlay") != "salvage": s.tap('[data-act="open-salvage"]')
                ok = s.tap(f'[data-act="salvage"][data-card="{a["card"]}"]') if a["card"] else s.tap('[data-act="salvage-skip"]')
        except Exception:
            ok = False
        for _ in range(20):
            time.sleep(0.15)
            if s.seq() != before: break
        else: ok = False
        if ok: s.ok += 1
        else:
            s.page.evaluate("() => { const u = window.__mar.ui; if (u.overlay !== 'salvage') u.overlay = null; }")
            if s.seq() == before: s.fail += 1; s.page.evaluate("a => window.__mar.room.act(a)", a)
        k = a.get("how", t); s.kinds[k] = s.kinds.get(k, 0) + 1
        return True


def main():
    with sync_playwright() as pw:
        wk = pw.webkit.launch(); cr = pw.chromium.launch(channel="chrome")
        devs = [("iPhone 13", wk, "tap", "webkit"), ("Pixel 7", cr, "drag", "chromium"), ("iPhone SE", wk, "tap", "webkit")]
        names = ["Dhruv", "Anya", "Henry", "Freya", "Omar", "Lena", "Kofi"][:N]
        players = []
        for i, nm in enumerate(names):
            dev, br, mode, eng = devs[0] if i == 0 else devs[1 + (i - 1) % 2]
            players.append(P(nm, br.new_context(**pw.devices[dev]).new_page(), mode, eng))
        h = players[0]
        h.page.goto(BASE); h.page.fill("#nm", "Dhruv"); h.tap('button[type="submit"]')
        h.page.wait_for_selector("#link", timeout=20000); link = h.page.inner_text("#link")
        for p in players[1:]:
            p.page.goto(link); p.page.fill("#nm", p.name); p.tap('button[type="submit"]')
        for p in players[1:]: p.page.wait_for_selector("text=Waiting for the host to start", timeout=30000)
        h.page.wait_for_selector(f"text=Players · {N}/7", timeout=20000)
        h.page.screenshot(path=SH + f"{N}p-lobby.png")
        h.tap('[data-act="start"]')
        for p in players: p.page.wait_for_selector(".bar", timeout=20000)
        time.sleep(5.5)
        for p in players: p.page.evaluate("() => document.querySelector('.fx-welcome')?.remove()")
        t0 = time.time(); shots = set(); over = {}
        while time.time() - t0 < MAXMIN * 60:
            if h.page.evaluate("() => window.__mar.S.view?.phase") == "gameOver": break
            moved = False
            for p in players:
                if p.step(): moved = True
                if p.page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"): over[p.name] = True
            age = h.page.evaluate("() => window.__mar.S.view?.age")
            if age and age not in shots and h.page.evaluate("() => window.__mar.S.view?.turn") >= 3:
                for p in players[:3]: p.page.screenshot(path=SH + f"{N}p-age{age}-{p.name}.png")
                shots.add(age)
            time.sleep(0.1 if moved else 0.3)
        time.sleep(4)
        for p in players[:2]: p.page.screenshot(path=SH + f"{N}p-end-{p.name}.png")
        phases = [p.page.evaluate("() => window.__mar.S.view?.phase") for p in players]
        res = h.page.evaluate("() => window.__mar.S.view?.result?.rows.map(r => window.__mar.S.view.players.find(p => p.id === r.pid).name + ':' + r.total)")
        finals = [json.dumps(p.page.evaluate("() => window.__mar.S.view?.result?.rows"), sort_keys=True) for p in players]
        agree = len(set(finals)) == 1 and finals[0] != "null"
        if not agree: print(*[f[:300] for f in finals], sep="\n")
        print(f"{N} players phases={phases} {int(time.time() - t0)}s all screens agree={agree}")
        for p in players: print(f"  {p.name:6s} {p.eng:8s} {p.mode:4s} ui {p.ok:3d} fallback {p.fail:2d} {p.kinds} errors {p.err or 'none'}")
        print("overflow:", over or "none", "| result:", res)
        wk.close(); cr.close()
        sys.exit(0 if all(x == "gameOver" for x in phases) and agree and not any(p.err for p in players) else 1)


main()
