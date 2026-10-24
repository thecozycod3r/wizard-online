"""End-to-end: 1 host + 3 joiners in separate browser contexts, real transport, full short game.
Players act through the same sendAct the UI uses; the first play of each human is a real mouse drag.

    python3 test/e2e.py [base_url]
"""
import random, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/wizard/"
SHOTS = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/"

CHOOSE = """() => {
  const w = window.__wiz, S = w.S, v = S.view;
  if (!v || !S.me) return null;
  const me = S.me, pick = a => a[Math.floor(Math.random() * a.length)];
  const suits = ["blue","green","red","yellow"];
  if (v.phase === "roundEnd") return S.role === "host" ? {type:"nextRound"} : null;
  if (!v.waiting.includes(me)) return null;
  switch (v.phase) {
    case "bid": { const o=[]; for (let n=0;n<=v.round;n++) if (v.dealerBlocked!==n) o.push(n); return {type:"bid", n: pick(o)}; }
    case "play": return {type:"play", id: pick(v.legal)};
    case "declare": return {type:"declare", mode: pick(["wizard","jester"]), suit: pick(suits), trump: pick(suits)};
    case "werewolf": return {type:"werewolf", suit: pick([...suits, null])};
    case "trump": return {type:"trump", suit: pick(suits)};
    case "cloud": { const b = v.players.find(p=>p.id===me).bid; return {type:"cloud", delta: b>0 ? pick([1,-1]) : 1}; }
    case "juggler": return {type:"pass", id: pick(v.hand)};
    case "witch": return {type:"witch", give: pick(v.hand), take: pick(v.lastTrick.cards.filter(c=>c!=="sp-witch"))};
  }
  return null;
}"""


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="chrome")
        mk = lambda: b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=False).new_page()
        host = mk()
        errors = []
        host.on("pageerror", lambda e: errors.append(("host", str(e))))
        host.goto(BASE)
        host.fill("#nm", "Dhruv")
        host.evaluate("document.fonts.ready.then(() => 0)"); host.click("text=Start a game")
        host.wait_for_selector("text=Room code")
        link = host.inner_text("#link")
        print("link", link)
        guests = []
        for name in ["Anya", "Henry", "Freya"]:
            g = mk()
            g.on("pageerror", lambda e, n=name: errors.append((n, str(e))))
            g.goto(link)
            g.fill("#nm", name)
            g.evaluate("document.fonts.ready.then(() => 0)"); g.click("text=Join game")
            guests.append(g)
        for g in guests:
            g.wait_for_selector("text=Waiting for the host to start", timeout=30000)
        host.wait_for_selector("text=Players · 4/8")
        host.screenshot(path=SHOTS + "e2e-lobby.png")
        host.select_option("#rounds", "3")
        host.click("text=Start game")
        pages = [host] + guests
        for g in guests:
            g.wait_for_selector(".bar", timeout=20000)
        dragged = set()
        t0 = time.time(); acts = 0; shot = False
        while time.time() - t0 < 240:
            over = host.evaluate("() => window.__wiz.S.view?.phase")
            if host.evaluate("() => { const v = window.__wiz.S.view; return v && v.round === 3 && v.phase === 'bid' }") and not getattr(main, "r3", False):
                main.r3 = True; time.sleep(0.5); host.screenshot(path=SHOTS + "e2e-r3.png")
            if over == "gameOver":
                break
            moved = False
            for i, p in enumerate(pages):
                ph = p.evaluate("() => { const v = window.__wiz.S.view; return v && v.waiting.includes(window.__wiz.S.me) ? v.phase : null }")
                if ph == "play" and i not in dragged:
                    # real drag: first legal card -> trick zone
                    cid = p.evaluate("() => window.__wiz.S.view.legal[0]")
                    c = p.locator(f'.hcard[data-id="{cid}"]').bounding_box()
                    z = p.locator("#zone").bounding_box()
                    if c and z:
                        p.mouse.move(c["x"] + c["width"] / 2, c["y"] + 20)
                        p.mouse.down()
                        for k in range(1, 9):
                            p.mouse.move(c["x"] + c["width"] / 2 + (z["x"] + z["width"] / 2 - c["x"] - c["width"] / 2) * k / 8,
                                         c["y"] + 20 + (z["y"] + z["height"] / 2 - c["y"] - 20) * k / 8)
                        p.mouse.up()
                        dragged.add(i); moved = True; acts += 1
                        if not shot and i == 0:
                            time.sleep(0.4); p.screenshot(path=SHOTS + "e2e-play.png"); shot = True
                        continue
                a = p.evaluate(CHOOSE)
                if a:
                    p.evaluate("a => window.__wiz.act(a)", a); moved = True; acts += 1
            time.sleep(0.25 if moved else 0.4)
        host.screenshot(path=SHOTS + "e2e-host-end.png")
        guests[0].screenshot(path=SHOTS + "e2e-guest-end.png")
        phase = host.evaluate("() => window.__wiz.S.view?.phase")
        gphases = [g.evaluate("() => window.__wiz.S.view?.phase") for g in guests]
        totals = host.evaluate("() => window.__wiz.S.view.players.map(p => p.name + ':' + p.total)")
        transport = "supabase"
        print("transport", transport, "| host phase", phase, "| guests", gphases, "| acts", acts, "| drags", len(dragged), "|", totals)
        print("page errors:", errors or "none")
        b.close()
        ok = phase == "gameOver" and all(x == "gameOver" for x in gphases) and not errors
        sys.exit(0 if ok else 1)


main()
