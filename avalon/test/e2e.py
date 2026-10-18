"""Avalon end-to-end on emulated phones, driven through the real UI.

    python3 test/e2e.py <base_url> <players> [max_minutes]

Host on iPhone 13 (WebKit), others alternate Pixel 7 (Chromium) and iPhone SE (WebKit); everyone taps. Every move goes
through on-screen controls (role card → Ready, tap knights → Propose, Approve/Reject, quest cards, Lady, Assassin); a
control that can't be found falls back to the internal action and is counted as a UI failure.
"""
import json, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/avalon/"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 7
MAXMIN = float(sys.argv[3]) if len(sys.argv) > 3 else 15
NICE = "nice" in sys.argv   # Evil never fails a quest, so Good completes three and the Assassin has to act
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/ava-"

# What a player would do now, from what their own screen knows. Shared tests read this too.
PLAN = """() => {
  const { S } = window.__ava, v = S.view; if (!v || !S.me || !v.waiting.includes(S.me)) return null;
  const ids = v.players.map(p => p.id), others = ids.filter(x => x !== S.me), evil = new Set((v.knows || []).filter(k => k.as !== 'merlin?').map(k => k.id));
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  switch (v.phase) {
    case 'reveal': return { type: 'ready' };
    case 'propose': return { type: 'propose', team: [S.me, ...shuffle(others)].slice(0, v.size) };
    case 'vote': return { type: 'vote', yes: v.attempt >= 4 || Math.random() < .7 };
    case 'quest': return { type: 'quest', ok: v.side === 'good' || window.__nice || Math.random() < .4 };   // __nice: Evil plays Success (tests the Assassin)
    case 'lady': return { type: 'lady', target: v.ladyTargets[0] };
    case 'assassin': return { type: 'assassinate', target: shuffle(others.filter(x => !evil.has(x)))[0] };
  }
  return null;
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

    def seq(s): return s.page.evaluate("() => window.__ava.S.view?.seq ?? -1")

    def step(s):
        # a person closes private results / their role card before playing on
        if s.page.evaluate("() => ['ladyres', 'history'].includes(window.__ava.ui.overlay)"): s.tap('.sheethead [data-act="close"]')
        a = s.page.evaluate(PLAN)
        if not a: return False
        before = s.seq(); t = a["type"]; ok = False
        try:
            if t == "ready":
                ok = (s.page.evaluate("() => window.__ava.ui.overlay === 'role'") or s.tap('.dock [data-act="role"]')) and s.tap('[data-act="ready"]')
            elif t == "propose":
                for pid in s.page.evaluate("() => window.__ava.ui.pick"):           # start clean
                    s.tap(f'.knight[data-pid="{pid}"]')
                ok = all(s.tap(f'.knight[data-pid="{pid}"]') for pid in a["team"]) and s.tap('[data-act="propose"]')
            elif t == "vote":
                ok = s.tap(f'[data-act="vote"][data-yes="{1 if a["yes"] else 0}"]')
            elif t == "quest":
                ok = s.tap(f'[data-act="quest"][data-ok="{1 if a["ok"] else 0}"]')
            elif t == "lady":
                ok = s.tap(f'.knight[data-pid="{a["target"]}"]') and s.tap('[data-act="lady"]')
            elif t == "assassinate":
                ok = s.tap(f'.knight[data-pid="{a["target"]}"]') and s.tap('[data-act="assassinate"]')
        except Exception:
            ok = False
        for _ in range(20):
            time.sleep(0.15)
            if s.seq() != before: break
        else: ok = False
        if ok: s.ok += 1
        else:
            s.page.evaluate("() => { const u = window.__ava.ui; u.overlay = null; u.pick = []; u.target = null; }")
            if s.seq() == before: s.fail += 1; s.page.evaluate("a => window.__ava.room.act(a)", a)
        s.kinds[t] = s.kinds.get(t, 0) + 1
        return True


def main():
    with sync_playwright() as pw:
        wk = pw.webkit.launch(); cr = pw.chromium.launch(channel="chrome")
        devs = [("iPhone 13", wk, "webkit"), ("Pixel 7", cr, "chromium"), ("iPhone SE", wk, "webkit")]
        names = ["Dhruv", "Anya", "Henry", "Freya", "Omar", "Lena", "Kofi", "Maya", "Ravi", "Zoe"][:N]
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
        h.page.wait_for_selector(f"text=Players · {N}/10", timeout=20000)
        # every optional character + the Lady, so all of them get played through the UI
        for k in ["percival", "morgana", "mordred", "oberon", "lady"]: h.tap(f'[data-act="opt"][data-k="{k}"]'); time.sleep(0.3)
        h.page.screenshot(path=SH + f"{N}p-lobby.png", full_page=True)
        h.tap('[data-act="start"]')
        for p in players: p.page.wait_for_selector(".bar", timeout=20000)
        time.sleep(5.5)
        for p in players: p.page.evaluate("() => document.querySelector('.fx-welcome')?.remove()")
        if NICE:
            for p in players: p.page.evaluate("() => { window.__nice = true; }")
        t0 = time.time(); over = {}; shots = set()
        while time.time() - t0 < MAXMIN * 60:
            if h.page.evaluate("() => window.__ava.S.view?.phase") == "gameOver": break
            moved = False
            for p in players:
                if p.step(): moved = True
                if p.page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"): over[p.name] = True
            ph = h.page.evaluate("() => window.__ava.S.view?.phase")
            if ph and ph not in shots:
                for p in players[:3]: p.page.screenshot(path=SH + f"{N}p-{ph}-{p.name}.png")
                shots.add(ph)
            time.sleep(0.1 if moved else 0.3)
        time.sleep(4)
        for p in players[:3]: p.page.screenshot(path=SH + f"{N}p-end-{p.name}.png")
        phases = [p.page.evaluate("() => window.__ava.S.view?.phase") for p in players]
        finals = [json.dumps(p.page.evaluate("() => ({r: window.__ava.S.view?.result, q: window.__ava.S.view?.results})"), sort_keys=True) for p in players]
        agree = len(set(finals)) == 1 and '"r": null' not in finals[0]
        res = h.page.evaluate("() => { const v = window.__ava.S.view; return v?.result && (v.result.winner + ' — ' + v.result.why + ' | quests ' + v.results.map(r => r.success ? 'S' : 'F').join('')); }")
        print(f"{N} players phases={phases} {int(time.time() - t0)}s all screens agree={agree}")
        for p in players: print(f"  {p.name:6s} {p.eng:8s} ui {p.ok:3d} fallback {p.fail:2d} {p.kinds} errors {p.err or 'none'}")
        print("overflow:", over or "none", "| result:", res)
        wk.close(); cr.close()
        sys.exit(0 if all(x == "gameOver" for x in phases) and agree and not any(p.err for p in players) else 1)


main()
