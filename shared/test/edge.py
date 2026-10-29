"""Edge cases for any Games4free game (real browsers, real network).

    python3 shared/test/edge.py <wizard|lodestone|marvels> [base_url]
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

GAME = sys.argv[1]
BASE = sys.argv[2] if len(sys.argv) > 2 else f"http://localhost:8765/{GAME}/"
J = {"wizard": "window.__wiz", "lodestone": "window.__lode", "marvels": "window.__mar", "avalon": "window.__ava", "incan": "window.__inc", "unoflip": "window.__uno", "nomercy": "window.__uno", "nimmt": "window.__nim", "skullking": "window.__sk", "kingscup": "window.__kc", "ridebus": "window.__rb", "coup": "window.__coup", "spyfall": "window.__spy", "codenames": "window.__cn"}[GAME]
MAX = {"marvels": 7, "avalon": 10, "incan": 8, "unoflip": 10, "nomercy": 6, "nimmt": 10, "skullking": 8, "kingscup": 12, "ridebus": 10, "wizard": 8, "coup": 10, "spyfall": 10, "codenames": 12}.get(GAME, 6)
ROOT = Path(__file__).resolve().parents[2]
PLAN = (open(ROOT / "wizard/test/e2e.py").read().split('CHOOSE = """')[1].split('"""')[0] if GAME == "wizard"
        else open(ROOT / f"{GAME}/test/e2e.py").read().split('PLAN = """')[1].split('"""')[0])
# kit games' PLAN returns {a: action, taps: [...]}; these suites want the action itself
if GAME in ("nimmt", "skullking", "kingscup", "ridebus", "coup", "spyfall", "codenames"): PLAN = f"() => {{ const p = ({PLAN})(); return p ? p.a : null; }}"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail)); print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)


def wait(pred, secs=20):
    t = time.time()
    while time.time() - t < secs:
        try:
            if pred(): return True
        except Exception: pass
        time.sleep(0.3)
    return False


with sync_playwright() as pw:
    br = pw.chromium.launch(channel="chrome")
    errs = []
    def page(name, dev="Pixel 7"):
        c = br.new_context(**pw.devices[dev]); p = c.new_page(); p.on("pageerror", lambda e: errs.append((name, str(e)))); return c, p

    # 1. bogus link: no crash, friendly waiting message
    c0, p0 = page("bogus")
    p0.goto(BASE + "?g=zzzzzz"); p0.fill("#nm", "Ghost"); p0.evaluate("document.fonts.ready.then(() => 0)"); p0.click("text=Join game")
    check("unknown table link shows a waiting message", wait(lambda: "waiting for the table" in p0.inner_text("body").lower(), 15))
    c0.close()

    # host + joiners up to the table's maximum, one with an HTML name
    hc, host = page("host", "iPhone 13")
    host.goto(BASE); host.fill("#nm", "Dhruv"); host.evaluate("document.fonts.ready.then(() => 0)"); host.click("text=Start a game"); host.wait_for_selector("#link")
    link = host.inner_text("#link")
    names = ["Anya", "<img src=x onerror=alert(1)>", "Freya", "Omar", "Lena", "Kofi", "Maya", "Ravi", "Zoe", "Ivan", "Nia"][:MAX - 1]
    joiners = []
    for n in names:
        c, p = page(n); p.goto(link); p.fill("#nm", n); p.evaluate("document.fonts.ready.then(() => 0)"); p.click("text=Join game"); joiners.append((c, p))
    check(f"{MAX} players can sit at the table", wait(lambda: f"players · {MAX}/{MAX}" in host.inner_text("body").lower(), 30))
    check("HTML in a name is shown as text, not run", host.locator("img[src='x']").count() == 0 and "&lt;img" not in host.inner_text("body") and "<img src=x" in host.inner_text("body"))

    # 2. one more player is refused
    c7, p7 = page("seventh"); p7.goto(link); p7.fill("#nm", "Seventh"); p7.evaluate("document.fonts.ready.then(() => 0)"); p7.click("text=Join game")
    check(f"player {MAX + 1} gets 'table is full'", wait(lambda: "full" in p7.inner_text("body").lower(), 15))
    c7.close()

    # 3. non-host can't change settings
    jp = joiners[0][1]
    before = host.evaluate(f"() => JSON.stringify({J}.S.lobby.settings)")
    jp.evaluate(f"() => {J}.room.settings({{ timer: 120 }})")
    time.sleep(1.5)
    check("a non-host can't change the settings", host.evaluate(f"() => JSON.stringify({J}.S.lobby.settings)") == before)

    # 4. host removes a player
    lena_c, lena = joiners[-1]
    lena_pid = lena.evaluate(f"() => {J}.S.me")
    host.click(f'[data-act="kick"][data-pid="{lena_pid}"]')
    check("removed player is told and leaves the list", wait(lambda: "removed you" in lena.inner_text("body").lower(), 15) and wait(lambda: f"players · {MAX - 1}/{MAX}" in host.inner_text("body").lower()))
    lena_c.close(); joiners.pop()

    # 5. start; a newcomer after the start gets the rejoin screen, not a seat
    if GAME == "wizard": host.select_option("#rounds", "3")
    host.click('[data-act="start"]')
    for _, p in joiners: p.wait_for_selector(".bar", timeout=20000)
    cn, pn = page("late"); pn.goto(link); pn.fill("#nm", "Latecomer"); pn.evaluate("document.fonts.ready.then(() => 0)"); pn.click("text=Join game")
    check("a newcomer after the start sees 'Which player are you?'", wait(lambda: "which player are you?" in pn.inner_text("body").lower(), 20))
    check("…and no seat was added", host.evaluate(f"() => {J}.S.view.players.length") == MAX - 1)
    cn.close()
    time.sleep(5)

    # 6. illegal action sent straight over the network is refused, state unchanged
    who = host.evaluate(f"() => {J}.S.view.waiting[0]")
    actor = next((p for _, p in joiners if p.evaluate(f"() => {J}.S.me") == who), host)
    seq = host.evaluate(f"() => {J}.S.view.seq")
    other = next(p for _, p in joiners if p.evaluate(f"() => {J}.S.me") != who)
    bad = {"wizard": '{"type":"bid","n":99}', "lodestone": '{"type":"take","ores":["gold","gold"]}', "marvels": '{"type":"pick","card":"palace~37","how":"build"}', "avalon": '{"type":"propose","team":[]}', "incan": '{"type":"choose","go":"maybe"}', "unoflip": '{"type":"play","card":-1}', "nomercy": '{"type":"play","card":-1}'}.get(GAME, '{"type":"nope"}')
    other.evaluate(f"() => {J}.room.act({bad})")   # not their turn AND invalid
    actor.evaluate(f"() => {J}.room.act({bad})")   # their turn but invalid
    time.sleep(2)
    check("illegal and out-of-turn moves are refused", host.evaluate(f"() => {J}.S.view.seq") == seq)

    # 7. double tap: the same move sent twice applies once
    a = actor.evaluate(PLAN)
    if a:
        a.pop("from", None)
        seq = host.evaluate(f"() => {J}.S.view.seq")
        actor.evaluate(f"a => {{ {J}.room.act(a); {J}.room.act(a); }}", a)
        time.sleep(2.5)
        d = host.evaluate(f"() => {J}.S.view.seq") - seq
        check("a double-tapped move is applied once", d in (1, 2) and all(p.evaluate(f"() => {J}.S.view.seq") == host.evaluate(f"() => {J}.S.view.seq") for _, p in joiners), f"seq advanced {d}")

    # 8. same seat open in two tabs (same browser): both follow the game, either can act
    ac, ap = joiners[0]
    ap2 = ac.new_page(); ap2.on("pageerror", lambda e: errs.append(("tab2", str(e))))
    ap2.goto(link)
    check("second tab of the same player rejoins the same seat", wait(lambda: ap2.evaluate(f"() => {J}.S.me") == ap.evaluate(f"() => {J}.S.me"), 20))

    # 9. a player reloads mid-game → same seat, same hand
    fc, fp = joiners[2]
    me_before = fp.evaluate(f"() => {J}.S.me"); hand_before = fp.evaluate(f"() => JSON.stringify({J}.S.view.hand || {J}.S.view.players[{J}.S.view.me].tokens)")
    fp.reload()
    check("a player who reloads gets the same seat back", wait(lambda: fp.evaluate(f"() => {J}.S.me") == me_before and fp.evaluate(f"() => {J}.S.mode") == "game", 25))

    # 10. the host reloads mid-game → game carries on, one runner
    host.reload()
    check("host reload: still exactly one device runs the table", wait(lambda: sum(p.evaluate(f"() => {J}.room.isHost ? 1 : 0") for p in [host] + [p for _, p in joiners]) == 1 and host.evaluate(f"() => {J}.S.mode") == "game", 30))

    # 11. play on to the end with bots; everyone agrees
    pages = [host] + [p for _, p in joiners]
    t = time.time()
    while time.time() - t < 420:
        if host.evaluate(f"() => {J}.S.view?.phase") == "gameOver": break
        for p in pages:
            try:
                a = p.evaluate(PLAN)
                if a: a.pop("from", None); p.evaluate(f"a => {J}.room.act(a)", a)
            except Exception: pass
        time.sleep(0.25)
    time.sleep(2)
    fin = [p.evaluate(f"() => {J}.S.view?.phase + JSON.stringify({J}.S.view?.players.map(x => x.total ?? x.points))") for p in pages]
    check("game finishes and every screen agrees", len(set(fin)) == 1 and fin[0].startswith("gameOver"), fin[0][:60])

    # 12. play again returns everyone to the lobby with the same seats
    # whoever runs the table now (a reload can hand it to another phone) is the one who sees Play again
    runner = next((p for p in pages if p.evaluate(f"() => {J}.room.isHost")), host)
    runner.evaluate(f"() => {J}.room.backToLobby()")
    check("'Play again' brings everyone back to the lobby", wait(lambda: all(p.evaluate(f"() => {J}.S.mode") == "lobby" for p in pages), 20))

    check("no page errors", not errs, str(errs[:3]))
    br.close()
    bad = [r for r in results if not r[1]]
    print(f"\n{GAME}: {len(results) - len(bad)}/{len(results)} edge cases passed")
    sys.exit(1 if bad else 0)
