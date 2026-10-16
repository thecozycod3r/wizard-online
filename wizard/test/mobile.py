"""4-player mobile test against a live URL, driven through the real UI with touch.

  host  : iPhone 13 (WebKit)           taps (tap card twice to play)
  Anya  : Pixel 7 (Chromium)           real touch drag via CDP
  Henry : iPhone SE (WebKit, 375x667)  taps
  Freya : Pixel 7 landscape (Chromium) real touch drag via CDP

Every action goes through on-screen controls; if a control can't be found the test falls back to
the internal action and counts it as a UI failure.

    python3 test/mobile.py https://wizard30.vercel.app/ [rounds]
"""
import random, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/wizard/"
ROUNDS = sys.argv[2] if len(sys.argv) > 2 else "5"
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/m-"

STATE = """() => { const S = window.__wiz.S, v = S.view; if (!v || !S.me) return null;
  return { phase: v.phase, mine: v.waiting.includes(S.me), legal: v.legal, hand: v.hand, round: v.round,
    blocked: v.dealerBlocked, needs: v.pending?.needs || null, done: v.pending?.done || null, me: S.me,
    bid: (v.players.find(p => p.id === S.me) || {}).bid, role: S.role,
    trick: (v.lastTrick?.cards || []), overlay: S.ui.overlay, decl: S.ui.decl } }"""


class Player:
    def __init__(self, name, page, mode, engine):
        self.name, self.page, self.mode, self.engine = name, page, mode, engine
        self.cdp = page.context.new_cdp_session(page) if engine == "chromium" else None
        self.ui_ok = 0; self.ui_fail = 0; self.errors = []
        page.on("pageerror", lambda e: self.errors.append(str(e)))

    def center(self, sel):
        # the screen re-renders on every state update; retry if the element was just replaced
        for _ in range(3):
            try:
                loc = self.page.locator(sel).first
                if not loc.count(): return None
                loc.scroll_into_view_if_needed(timeout=2000)
                b = loc.bounding_box()
                return (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2) if b else None
            except Exception:
                time.sleep(0.2)
        return None

    def tap(self, sel):
        c = self.center(sel)
        if not c: return False
        self.page.touchscreen.tap(*c); return True

    def drag(self, sel, target):
        a, z = self.center(sel), self.center(target)
        if not a or not z: return False
        if self.cdp:
            pt = lambda x, y: [{"x": x, "y": y, "id": 1}]
            self.cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": pt(*a)})
            for k in range(1, 11):
                x = a[0] + (z[0] - a[0]) * k / 10; y = a[1] + (z[1] - a[1]) * k / 10
                self.cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": pt(x, y)})
                time.sleep(0.015)
            self.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            return True
        return False

    def play_card(self, cid, zone="#zone"):
        sel = f'.hcard[data-id="{cid}"]'
        if self.mode == "drag":
            return self.drag(sel, zone)
        ok = self.tap(sel); time.sleep(0.25)
        return ok and self.tap(sel)  # second tap plays

    def fallback(self, a):
        self.ui_fail += 1
        self.page.evaluate("a => window.__wiz.act(a)", a)

    def step(self):
        st = self.page.evaluate(STATE)
        if not st: return False
        suits = ["blue", "green", "red", "yellow"]
        if st["phase"] == "roundEnd":
            if st["role"] == "host" and st["overlay"] == "round":
                time.sleep(0.6)
                if self.tap('[data-act="next"]'): self.ui_ok += 1
                else: self.fallback({"type": "nextRound"})
                return True
            return False
        if not st["mine"]: return False
        ph = st["phase"]
        before = self.page.evaluate("() => window.__wiz.S.view.seq")
        if ph == "bid":
            opts = [n for n in range(st["round"] + 1) if n != st["blocked"]]
            n = random.choice(opts)
            ok = self.tap(f'[data-act="bid"][data-n="{n}"]'); a = {"type": "bid", "n": n}
        elif ph == "play":
            cid = random.choice(st["legal"])
            ok = self.play_card(cid); a = {"type": "play", "id": cid}
        elif ph in ("werewolf", "trump"):
            s = random.choice(suits); ok = self.tap(f'[data-act="{ph}"][data-suit="{s}"]'); a = {"type": ph, "suit": s}
        elif ph == "declare":
            need = [n for n in st["needs"] if not (st["decl"] or {}).get(n)][0]
            if need == "mode":
                m = random.choice(["wizard", "jester"]); ok = self.tap(f'[data-act="decl-mode"][data-v="{m}"]'); a = None
            else:
                s = random.choice(suits); ok = self.tap(f'[data-act="decl-{need}"][data-suit="{s}"]'); a = None
            if ok: self.ui_ok += 1; time.sleep(0.3); return True
            self.fallback({"type": "declare", "mode": "wizard", "suit": "red", "trump": "red"}); return True
        elif ph == "cloud":
            d = 1 if st["bid"] == 0 else random.choice([1, -1]); ok = self.tap(f'[data-act="cloud"][data-d="{d}"]'); a = {"type": "cloud", "delta": d}
        elif ph == "juggler":
            if st["me"] in (st["done"] or []): return False
            cid = random.choice(st["hand"])
            if self.mode == "drag": ok = self.drag(f'.hcard[data-id="{cid}"]', "#zone")
            else: ok = self.tap(f'.hcard[data-id="{cid}"]') and (time.sleep(0.25) or True) and self.tap('[data-act="passsel"]')
            a = {"type": "pass", "id": cid}
        elif ph == "witch":
            give = random.choice(st["hand"]); take = random.choice([c for c in st["trick"] if c != "sp-witch"])
            ok = self.tap(f'.hcard[data-id="{give}"]'); time.sleep(0.2)
            ok = ok and self.tap(f'.tcard[data-id="{take}"]'); time.sleep(0.2)
            ok = ok and self.tap('[data-act="witchgo"]'); a = {"type": "witch", "give": give, "take": take}
        else:
            return False
        # confirm the action registered
        for _ in range(16):
            time.sleep(0.15)
            if self.page.evaluate("() => window.__wiz.S.view.seq") != before: break
        else:
            ok = False
        if ok: self.ui_ok += 1
        else:
            if self.page.evaluate("() => window.__wiz.S.view.seq") == before: self.fallback(a)
        return True

    def overflow(self):
        return self.page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1")


def main():
    with sync_playwright() as pw:
        wk = pw.webkit.launch(); cr = pw.chromium.launch(channel="chrome")
        iphone13 = pw.devices["iPhone 13"]; se = pw.devices["iPhone SE"]; pixel = pw.devices["Pixel 7"]
        pixel_land = pw.devices["Pixel 7 landscape"]
        host = Player("Dhruv", wk.new_context(**iphone13).new_page(), "tap", "webkit")
        host.page.goto(BASE); host.page.fill("#nm", "Dhruv"); host.tap('button[type="submit"]')
        host.page.wait_for_selector("#link", timeout=20000)
        link = host.page.inner_text("#link")
        print("link", link)
        host.page.screenshot(path=SH + "lobby-iphone13.png")
        guests = []
        N = int(sys.argv[3]) if len(sys.argv) > 3 else 4
        roster = [("Anya", cr, pixel, "drag", "chromium"), ("Henry", wk, se, "tap", "webkit"), ("Freya", cr, pixel_land, "drag", "chromium"),
                  ("Omar", wk, iphone13, "tap", "webkit"), ("Lena", cr, pixel, "drag", "chromium")][:N - 1]
        for name, br, dev, mode, eng in roster:
            p = Player(name, br.new_context(**dev).new_page(), mode, eng)
            p.page.goto(link); p.page.fill("#nm", name); p.tap('button[type="submit"]')
            guests.append(p)
        for g in guests: g.page.wait_for_selector("text=Waiting for the host to start", timeout=30000)
        host.page.wait_for_selector(f"text=Players · {N}/6", timeout=20000)
        guests[0].page.screenshot(path=SH + "lobby-pixel.png")
        host.page.select_option("#rounds", ROUNDS)
        host.tap('[data-act="start"]')
        allp = [host] + guests
        for g in guests: g.page.wait_for_selector(".bar", timeout=20000)
        time.sleep(5.5)  # the welcome screen stays up for 3 whole seconds
        shots = set(); overflow = {}
        t0 = time.time()
        while time.time() - t0 < 600:
            ph = host.page.evaluate("() => window.__wiz.S.view?.phase")
            if ph == "gameOver": break
            rnd = host.page.evaluate("() => window.__wiz.S.view?.round")
            for p in allp:
                st = p.page.evaluate("() => { const v = window.__wiz.S.view; return v ? v.phase + ':' + v.round + ':' + (v.trick?.plays.length||0) : '' }")
                key = None
                if st.startswith("bid:4"): key = "bid"
                if st.startswith("play:5") and not st.endswith(":0"): key = "trick"
                if key and (p.name, key) not in shots:
                    shots.add((p.name, key)); p.page.screenshot(path=SH + f"{key}-{p.name}.png")
                if p.overflow(): overflow[p.name] = st
            moved = any([p.step() for p in allp])
            time.sleep(0.15 if moved else 0.35)
        for p in allp: p.page.screenshot(path=SH + f"end-{p.name}.png")
        phases = [p.page.evaluate("() => window.__wiz.S.view?.phase") for p in allp]
        print("phases", phases, f"{int(time.time() - t0)}s")
        for p in allp:
            print(f"  {p.name:6s} {p.engine:8s} {p.mode:4s} ui-actions {p.ui_ok:3d}  ui-fallbacks {p.ui_fail}  errors {p.errors or 'none'}")
        print("horizontal overflow:", overflow or "none")
        print("totals", host.page.evaluate("() => window.__wiz.S.view.players.map(p => p.name + ':' + p.total)"))
        wk.close(); cr.close()


main()
