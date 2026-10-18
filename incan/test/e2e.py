"""Incan Gold end-to-end on emulated phones, driven through the real UI.

    python3 test/e2e.py <base_url> <players> [max_minutes]

Host on iPhone 13 (WebKit), others alternate Pixel 7 (Chromium) and iPhone SE (WebKit); everyone taps Torch or Camp.
A button that can't be found falls back to the internal action and is counted as a UI failure.
"""
import json, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/incan/"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 4
MAXMIN = float(sys.argv[3]) if len(sys.argv) > 3 else 15
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/inc-"

# What a player would do now, from what their own screen knows. Shared tests read this too.
PLAN = """() => {
  const { S } = window.__inc, v = S.view; if (!v || !S.me || !v.waiting.includes(S.me)) return null;
  const P = v.players[v.me], warn = Object.values(v.seen).filter(Boolean).length;
  return { type: 'choose', go: P.carry < 5 || Math.random() < .85 - .13 * warn };
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
                return (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2) if b else None
            except Exception:
                time.sleep(0.2)
        return None

    def tap(s, sel):
        c = s.c(sel)
        if not c: return False
        s.page.touchscreen.tap(*c); time.sleep(0.15); return True

    def mark(s): return s.page.evaluate("() => { const v = window.__inc.S.view; return v ? v.seq + ':' + v.players.filter(p => p.decided).length : '-'; }")

    def step(s):
        if s.page.evaluate("() => ['scores', 'rules'].includes(window.__inc.ui.overlay)"): s.tap('.sheethead [data-act="close"]')
        a = s.page.evaluate(PLAN)
        if not a: return False
        before = s.page.evaluate("() => window.__inc.S.view?.seq ?? -1"); ok = False
        try: ok = s.tap(f'[data-act="choose"][data-go="{1 if a["go"] else 0}"]')
        except Exception: ok = False
        for _ in range(20):
            time.sleep(0.15)
            if s.page.evaluate("() => window.__inc.S.view?.seq ?? -1") != before: break
        else: ok = False
        if ok: s.ok += 1
        else:
            s.page.evaluate("() => { window.__inc.ui.overlay = null; }")
            if s.page.evaluate("() => window.__inc.S.view?.seq ?? -1") == before: s.fail += 1; s.page.evaluate("a => window.__inc.room.act(a)", a)
        k = "torch" if a["go"] else "camp"; s.kinds[k] = s.kinds.get(k, 0) + 1
        return True


def main():
    with sync_playwright() as pw:
        wk = pw.webkit.launch(); cr = pw.chromium.launch(channel="chrome")
        devs = [("iPhone 13", wk, "webkit"), ("Pixel 7", cr, "chromium"), ("iPhone SE", wk, "webkit")]
        names = ["Dhruv", "Anya", "Henry", "Freya", "Omar", "Lena", "Kofi", "Maya"][:N]
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
        h.page.wait_for_selector(f"text=Players · {N}/8", timeout=20000)
        h.page.screenshot(path=SH + f"{N}p-lobby.png", full_page=True)
        h.tap('[data-act="start"]')
        for p in players: p.page.wait_for_selector(".bar", timeout=20000)
        time.sleep(5.5)
        for p in players: p.page.evaluate("() => document.querySelector('.fx-welcome')?.remove()")
        t0 = time.time(); over = {}; shots = set()
        while time.time() - t0 < MAXMIN * 60:
            if h.page.evaluate("() => window.__inc.S.view?.phase") == "gameOver": break
            moved = False
            for p in players:
                if p.step(): moved = True
                if p.page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"): over[p.name] = True
            rd = h.page.evaluate("() => window.__inc.S.view?.round + '-' + Math.min(4, window.__inc.S.view?.path.length)")
            if rd and rd.endswith("-4") and rd not in shots:
                for p in players[:3]: p.page.screenshot(path=SH + f"{N}p-r{rd}-{p.name}.png")
                shots.add(rd)
            time.sleep(0.1 if moved else 0.3)
        time.sleep(4)
        for p in players[:3]: p.page.screenshot(path=SH + f"{N}p-end-{p.name}.png")
        phases = [p.page.evaluate("() => window.__inc.S.view?.phase") for p in players]
        finals = [json.dumps(p.page.evaluate("() => window.__inc.S.view?.result"), sort_keys=True) for p in players]
        agree = len(set(finals)) == 1 and finals[0] != "null"
        res = h.page.evaluate("() => { const v = window.__inc.S.view; return v?.result && v.result.rows.map(r => v.players.find(p => p.id === r.pid).name + ':' + r.points).join(' '); }")
        print(f"{N} players phases={phases} {int(time.time() - t0)}s all screens agree={agree}")
        for p in players: print(f"  {p.name:6s} {p.eng:8s} ui {p.ok:3d} fallback {p.fail:2d} {p.kinds} errors {p.err or 'none'}")
        print("overflow:", over or "none", "| result:", res)
        wk.close(); cr.close()
        sys.exit(0 if all(x == "gameOver" for x in phases) and agree and not any(p.err for p in players) else 1)


main()
