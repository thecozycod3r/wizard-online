"""Lodestone end-to-end on emulated phones, driven through the real UI.

    python3 test/e2e.py <base_url> <players> [max_minutes]

Host on iPhone 13 (WebKit, taps); others alternate Pixel 7 (Chromium, real touch drags for building) and
iPhone SE (WebKit, taps). Each action goes through on-screen controls; a control that can't be found
falls back to the internal action and is counted as a UI failure.
"""
import random, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/lodestone/"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 4
MAXMIN = float(sys.argv[3]) if len(sys.argv) > 3 else 12
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/lode-"

PLAN = """() => {
  const { S, E } = window.__lode, v = S.view; if (!v || !S.me) return null;
  if (!v.waiting.includes(S.me)) return null;
  const G = { ...v };  // decide from the public view, like a person would
  const P = v.players[v.me];
  if (v.phase === 'discard') { const back = {}; let n = v.pending.n;
    for (const o of E.ALL) { while (n > 0 && (back[o]||0) < P.tokens[o]) { back[o] = (back[o]||0)+1; n--; } } return { type: 'discard', tokens: back }; }
  if (v.phase === 'noble') return { type: 'noble', id: v.pending.options[0] };
  const visible = [1,2,3].flatMap(l => v.market[l]).filter(Boolean).concat(P.reserved.map(r => r.id).filter(Boolean));
  const buy = visible.filter(id => v.pay[id]?.ok).sort((a,b) => E.cardOf(b).points - E.cardOf(a).points)[0];
  if (buy) return { type: 'buy', id: buy, from: P.reserved.some(r => r.id === buy) ? 'reserved' : 'table' };
  const toks = E.ALL.reduce((s,o) => s + P.tokens[o], 0);
  const left = E.ORES.filter(o => v.bank[o] > 0);
  if (toks >= 9 && P.reserved.length < 3) {
    const t = [1,2,3].flatMap(l => v.market[l]).filter(Boolean);
    if (t.length && Math.random() < .7) return { type: 'reserve', id: t[Math.floor(Math.random()*t.length)] };
    const d = [1,2,3].filter(l => v.decks[l]); if (d.length) return { type: 'reserve', level: d[0] };
  }
  const two = E.ORES.filter(o => v.bank[o] >= 4);
  if (two.length && Math.random() < .25) { const o = two[Math.floor(Math.random()*two.length)]; return { type: 'take', ores: [o,o] }; }
  if (left.length) return { type: 'take', ores: left.sort(() => Math.random() - .5).slice(0, Math.min(3, left.length)) };
  if (v.canPass) return { type: 'pass' };
  const t = [1,2,3].flatMap(l => v.market[l]).filter(Boolean);
  return { type: 'reserve', id: t[0] };
}"""


class P:
    def __init__(s, name, page, mode, eng):
        s.name, s.page, s.mode, s.eng = name, page, mode, eng
        s.cdp = page.context.new_cdp_session(page) if eng == "chromium" else None
        s.ok = s.fail = 0; s.err = []; s.kinds = {}
        page.on("pageerror", lambda e: s.err.append(str(e)))

    def c(s, sel):
        loc = s.page.locator(sel).first
        if not loc.count(): return None
        try: loc.scroll_into_view_if_needed(timeout=1500)
        except Exception: return None
        b = loc.bounding_box()
        return (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2) if b else None

    def tap(s, sel):
        c = s.c(sel)
        if not c: return False
        s.page.touchscreen.tap(*c); time.sleep(0.18); return True

    def drag(s, sel, target):
        a = s.c(sel); z = s.c(target)
        if not a or not z or not s.cdp: return False
        pt = lambda x, y: [{"x": x, "y": y, "id": 1}]
        s.cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": pt(*a)})
        for k in range(1, 13):
            s.cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": pt(a[0] + (z[0] - a[0]) * k / 12, a[1] + (z[1] - a[1]) * k / 12)}); time.sleep(0.015)
        s.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); time.sleep(0.2)
        return True

    def seq(s): return s.page.evaluate("() => window.__lode.S.view?.seq ?? -1")

    def step(s):
        a = s.page.evaluate(PLAN)
        if not a: return False
        before = s.seq(); t = a["type"]; ok = False
        try:
            if t == "take":
                for o in a["ores"]: s.tap(f'.tok[data-ore="{o}"]')
                ok = s.tap('[data-act="take"]')
            elif t == "buy":
                sel = f'[data-card="{a["id"]}"]'
                if s.mode == "drag" and a["from"] == "table": ok = s.drag(sel, "#mine")
                else: ok = s.tap(sel) and s.tap(f'[data-act="buy"][data-id="{a["id"]}"]')
            elif t == "reserve":
                if a.get("id"): ok = s.tap(f'[data-card="{a["id"]}"]') and s.tap(f'[data-act="reserve"][data-id="{a["id"]}"]')
                else: ok = s.tap(f'.deck[data-level="{a["level"]}"]') and s.tap('[data-act="reserve-deck"]')
            elif t == "discard":
                for o, n in a["tokens"].items():
                    for _ in range(n): s.tap(f'[data-act="dplus"][data-ore="{o}"]')
                ok = s.tap('[data-act="discard"]')
            elif t == "noble": ok = s.tap(f'[data-act="choose-noble"][data-id="{a["id"]}"]')
            elif t == "pass": ok = s.tap('[data-act="pass"]')
        except Exception:
            ok = False
        for _ in range(20):
            time.sleep(0.15)
            if s.seq() != before: break
        else: ok = False
        if ok: s.ok += 1
        else:
            s.page.evaluate("() => { const u = window.__lode.ui; u.overlay = null; u.sel = []; }")
            if s.seq() == before: s.fail += 1; s.page.evaluate("a => window.__lode.room.act(a)", {k: v for k, v in a.items() if k != "from"})
        s.kinds[t] = s.kinds.get(t, 0) + 1
        return True


def main():
    with sync_playwright() as pw:
        wk = pw.webkit.launch(); cr = pw.chromium.launch(channel="chrome")
        devs = [("iPhone 13", wk, "tap", "webkit"), ("Pixel 7", cr, "drag", "chromium"), ("iPhone SE", wk, "tap", "webkit")]
        names = ["Dhruv", "Anya", "Henry", "Freya", "Omar", "Lena"][:N]
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
        h.page.wait_for_selector(f"text=Players · {N}/6", timeout=20000)
        h.page.screenshot(path=SH + f"{N}p-lobby.png")
        h.tap('[data-act="start"]')
        for p in players: p.page.wait_for_selector(".bar", timeout=20000)
        time.sleep(5.5)
        for p in players: p.page.evaluate("() => document.querySelector('.fx-welcome')?.remove()")
        t0 = time.time(); shots = 0; over = {}
        while time.time() - t0 < MAXMIN * 60:
            if h.page.evaluate("() => window.__lode.S.view?.phase") == "gameOver": break
            moved = False
            for p in players:
                if p.step(): moved = True
                if p.page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"): over[p.name] = True
            r = h.page.evaluate("() => window.__lode.S.view?.round")
            if r and r >= 4 and shots < len(players):
                for p in players: p.page.screenshot(path=SH + f"{N}p-{p.name}.png")
                shots = len(players)
            time.sleep(0.1 if moved else 0.3)
        time.sleep(1)
        for p in players[:2]: p.page.screenshot(path=SH + f"{N}p-end-{p.name}.png")
        phases = [p.page.evaluate("() => window.__lode.S.view?.phase") for p in players]
        res = h.page.evaluate("() => window.__lode.S.view?.players.map(p => p.name + ':' + p.points + '/' + p.cards.length)")
        twin = h.page.evaluate("() => window.__lode.S.view?.settings.twin")
        print(f"{N} players (twin={twin}) phases={phases} {int(time.time() - t0)}s rounds={h.page.evaluate('() => window.__lode.S.view?.round')}")
        for p in players: print(f"  {p.name:6s} {p.eng:8s} {p.mode:4s} ui {p.ok:3d} fallback {p.fail:2d} {p.kinds} errors {p.err or 'none'}")
        print("overflow:", over or "none", "| result:", res)
        wk.close(); cr.close()


main()
