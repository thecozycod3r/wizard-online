"""End-to-end driver for Table Night kit games (6 Nimmt!, Skull King, Kings Cup, Ride the Bus) on emulated phones.

A game's test/e2e.py defines HOOK (window global of the kit), MAX (seat limit) and PLAN — JS run on each phone that returns
null (nothing to do) or {a: <action>, taps: [css selectors to tap in order]} from what that phone's screen knows — then
exec()s this file. Host on iPhone 13 (WebKit), others alternate Pixel 7 (Chromium) and iPhone SE (WebKit). A tap that
doesn't change the game falls back to the internal action and counts as a UI failure.

    python3 <game>/test/e2e.py <base_url> <players> [max_minutes]
"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

SLUG = Path(sys.argv[0]).resolve().parents[1].name
BASE = sys.argv[1] if len(sys.argv) > 1 else f"http://localhost:8765/{SLUG}/"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 4
MAXMIN = float(sys.argv[3]) if len(sys.argv) > 3 else 15
SH = f"/tmp/{SLUG}-"
J = f"window.{HOOK}"  # noqa: F821  (set by the game's e2e.py)


class P:
    def __init__(s, name, page, eng):
        s.name, s.page, s.eng = name, page, eng
        s.ok = s.fail = 0; s.err = []; s.kinds = {}; s.misses = []
        page.on("pageerror", lambda e: s.err.append(str(e)))

    def tap(s, sel):
        for _ in range(3):
            loc = s.page.locator(sel).first
            if not loc.count(): return False
            try:
                loc.scroll_into_view_if_needed(timeout=1500)
                b = loc.bounding_box()
                if not b: return False
                s.page.touchscreen.tap(b["x"] + b["width"] / 2, b["y"] + min(b["height"] / 2, 28)); time.sleep(0.2); return True
            except Exception:
                time.sleep(0.2)
        return False

    def seq(s): return s.page.evaluate(f"() => {J}.V()?.seq ?? -1")

    def step(s):
        if s.page.evaluate(f"() => ['scores', 'rules'].includes({J}.ui.overlay)"): s.tap('.sheethead [data-act="close"]')
        plan = s.page.evaluate(PLAN)  # noqa: F821
        if not plan: return False
        before = s.seq(); ok = True
        for sel in plan.get("taps", []):
            if not s.tap(sel): ok = False; break
        for _ in range(20):
            time.sleep(0.15)
            if s.seq() != before: break
        else: ok = False
        if ok: s.ok += 1
        else:
            s.page.evaluate(f"() => {{ {J}.ui.overlay = null; }}")
            if s.seq() == before:
                s.fail += 1
                if len(s.misses) < 4: s.misses.append((plan["a"]["type"], plan.get("taps"), s.page.evaluate(f"() => {J}.V()?.phase")))
                try: s.page.evaluate(f"a => {J}.room.act(a)", plan["a"])
                except Exception: pass
        k = plan["a"]["type"]; s.kinds[k] = s.kinds.get(k, 0) + 1
        return True


def main():
    with sync_playwright() as pw:
        wk = pw.webkit.launch(); cr = pw.chromium.launch(channel="chrome")
        devs = [("iPhone 13", wk, "webkit"), ("Pixel 7", cr, "chromium"), ("iPhone SE", wk, "webkit")]
        names = ["Dhruv", "Anya", "Henry", "Freya", "Omar", "Lena", "Kofi", "Maya", "Ravi", "Zoe", "Ivan", "Nia"][:N]
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
        h.page.wait_for_selector(f"text=Players · {N}/{MAX}", timeout=20000)  # noqa: F821
        h.page.screenshot(path=SH + f"{N}p-lobby.png", full_page=True)
        h.tap('[data-act="start"]')
        for p in players: p.page.wait_for_selector(".bar", timeout=20000)
        time.sleep(5.5)
        for p in players: p.page.evaluate("() => document.querySelector('.fx-welcome')?.remove()")
        t0 = time.time(); over = {}; shot = 0
        while time.time() - t0 < MAXMIN * 60:
            if h.page.evaluate(f"() => {J}.V()?.phase") == "gameOver": break
            moved = False
            for p in players:
                if p.step(): moved = True
                if p.page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"): over[p.name] = True
            if moved and sum(p.ok for p in players) // 20 > shot:
                shot += 1
                for p in players[:2]: p.page.screenshot(path=SH + f"{N}p-{shot}-{p.name}.png")
            time.sleep(0.05 if moved else 0.4)
        time.sleep(4)
        for p in players[:3]: p.page.screenshot(path=SH + f"{N}p-end-{p.name}.png")
        phases = [p.page.evaluate(f"() => {J}.V()?.phase") for p in players]
        finals = [json.dumps(p.page.evaluate(f"() => {J}.V()?.result"), sort_keys=True) for p in players]
        agree = len(set(finals)) == 1 and finals[0] != "null"
        res = h.page.evaluate(f"() => {{ const v = {J}.V(); return v?.result && v.result.rows.map(r => v.players.find(p => p.id === r.pid).name + ':' + r.points).join(' '); }}")
        print(f"{SLUG} {N} players phases={phases} {int(time.time() - t0)}s all screens agree={agree}")
        for p in players: print(f"  {p.name:6s} {p.eng:8s} ui {p.ok:3d} fallback {p.fail:2d} {p.kinds} errors {p.err or 'none'}")
        print("overflow:", over or "none", "| result:", res)
        for p in players:
            for m in p.misses: print("  miss", p.name, m)
        wk.close(); cr.close()
        sys.exit(0 if all(x == "gameOver" for x in phases) and agree and not any(p.err for p in players) else 1)


main()
