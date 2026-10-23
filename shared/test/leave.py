"""Leaving mid-game, for any Games4free game.

    python3 shared/test/leave.py <wizard|lodestone|marvels> [base_url]

4 players. Henry taps Leave → confirms → sees "You left"; everyone sees a BOT badge on his seat and the bot plays his
moves. Then the host (Dhruv, who runs the table) leaves: another device must take over and a bot plays Dhruv. Henry
rejoins from his phone and takes his seat back from the bot. The game must finish with every screen agreeing.
"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

GAME = sys.argv[1]
BASE = sys.argv[2] if len(sys.argv) > 2 else f"http://localhost:8765/{GAME}/"
J = {"wizard": "window.__wiz", "lodestone": "window.__lode", "marvels": "window.__mar", "avalon": "window.__ava", "incan": "window.__inc", "unoflip": "window.__uno", "nomercy": "window.__uno"}[GAME]
ROOT = Path(__file__).resolve().parents[2]
PLAN = (open(ROOT / "wizard/test/e2e.py").read().split('CHOOSE = """')[1].split('"""')[0] if GAME == "wizard"
        else open(ROOT / f"{GAME}/test/e2e.py").read().split('PLAN = """')[1].split('"""')[0])
MAXP = {"marvels": 7, "avalon": 10, "incan": 8, "unoflip": 10, "nomercy": 6}.get(GAME, 6)
results = []

def check(name, ok, detail=""):
    results.append(ok); print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

def wait(pred, secs=20):
    t = time.time()
    while time.time() - t < secs:
        try:
            if pred(): return True
        except Exception: pass
        time.sleep(0.3)
    return False

def leave(p):
    # a person first closes whatever sheet is open (round results, battles…), then taps Leave and confirms
    for _ in range(3):
        if not p.locator(".overlay").count(): break
        p.keyboard.press("Escape"); p.locator('.overlay [data-act="close"]').first.dispatch_event("click") if p.locator('.overlay [data-act="close"]').count() else None
        time.sleep(0.3)
    p.locator('[data-act="leave-ask"]').dispatch_event("click"); p.wait_for_selector("text=Leave the game?", timeout=5000)
    p.locator('[data-act="leave"]').click()

def play(pages, secs, until=lambda: False):
    t = time.time()
    while time.time() - t < secs and not until():
        for p in pages:
            try:
                a = p.evaluate(PLAN)
                if a: a.pop("from", None); p.evaluate(f"a => {J}.room.act(a)", a)
            except Exception: pass
        time.sleep(0.3)

with sync_playwright() as pw:
    cr = pw.chromium.launch(channel="chrome")
    errs = []
    names = ["Dhruv", "Anya", "Henry", "Freya"] + (["Omar"] if GAME == "avalon" else [])
    ctx = {n: cr.new_context(**pw.devices["iPhone 13" if n == "Dhruv" else "Pixel 7"]) for n in names}
    pg = {}
    for n in names:
        pg[n] = ctx[n].new_page(); pg[n].on("pageerror", lambda e, n=n: errs.append((n, str(e))))
    pg["Dhruv"].goto(BASE); pg["Dhruv"].fill("#nm", "Dhruv"); pg["Dhruv"].click("text=Start a game"); pg["Dhruv"].wait_for_selector("#link")
    link = pg["Dhruv"].inner_text("#link")
    for n in names[1:]:
        pg[n].goto(link); pg[n].fill("#nm", n); pg[n].click("text=Join game")
    pg["Dhruv"].wait_for_selector(f"text=Players · {len(names)}/{MAXP}", timeout=30000)
    if GAME == "wizard": pg["Dhruv"].select_option("#rounds", "3")
    pg["Dhruv"].click('[data-act="start"]')
    for n in names: pg[n].wait_for_selector(".bar", timeout=20000)
    time.sleep(5.5)
    for n in names: pg[n].evaluate("() => document.querySelector('.fx-welcome')?.remove()")
    play(list(pg.values()), 12, until=lambda: pg["Anya"].evaluate(f"() => {J}.S.view?.seq || 0") >= 10)
    henry_pid = pg["Henry"].evaluate(f"() => {J}.S.me")
    dhruv_pid = pg["Dhruv"].evaluate(f"() => {J}.S.me")

    # Henry leaves through the UI
    leave(pg["Henry"])
    check("Henry sees the 'You left' screen", wait(lambda: "you left the game" in pg["Henry"].inner_text("body").lower(), 10))
    check("everyone sees a BOT badge on Henry's seat", wait(lambda: all(pg[n].locator(f'[data-pid="{henry_pid}"] .badge.bot, .badge.bot').count() > 0 for n in ["Dhruv", "Anya", "Freya"]), 15))
    seq0 = pg["Anya"].evaluate(f"() => {J}.S.view.seq")
    play([pg["Dhruv"], pg["Anya"], pg["Freya"]] + [pg[n] for n in names[4:]], 25)
    adv = pg["Anya"].evaluate(f"() => {J}.S.view.seq") - seq0
    timed = pg["Anya"].evaluate(f"() => ({J}.S.notes || []).filter(m => m.includes('Henry') && m.includes('Time')).length")
    check("the bot plays Henry's moves (game keeps moving, timer never needed)", adv >= 4 and timed == 0, f"{adv} moves in 25s, timer moves for Henry: {timed}")

    # The host leaves: another device takes over, a bot plays Dhruv
    leave(pg["Dhruv"])
    t = time.time()
    took = wait(lambda: any(pg[n].evaluate(f"() => {J}.room.isHost") for n in ["Anya", "Freya"]), 20)
    check("when the host leaves, another player's device runs the table", took, f"{time.time() - t:.1f}s")
    check("…and a bot plays the host's seat", wait(lambda: dhruv_pid in pg["Anya"].evaluate(f"() => {J}.S.bots"), 10))
    play([pg["Anya"], pg["Freya"]] + [pg[n] for n in names[4:]], 10)

    # Henry comes back and takes his seat from the bot
    pg["Henry"].click('[data-act="rejoin"]')
    pg["Henry"].wait_for_selector("text=Which player are you?", timeout=15000)
    pg["Henry"].locator('li:has-text("Henry") [data-act="claim"]').click()
    check("Henry rejoins and gets his own seat back", wait(lambda: pg["Henry"].evaluate(f"() => {J}.S.mode === 'game' && {J}.S.me") == henry_pid, 20))
    check("…and the bot stops playing for him", wait(lambda: henry_pid not in pg["Anya"].evaluate(f"() => {J}.S.bots"), 10))

    live = [pg["Anya"], pg["Freya"], pg["Henry"]] + [pg[n] for n in names[4:]]   # (Avalon seats a 5th player)
    play(live, 600, until=lambda: all(p.evaluate(f"() => {J}.S.view?.phase") == "gameOver" for p in live))
    time.sleep(2)
    fin = [json.dumps(p.evaluate(f"() => [{J}.S.view?.phase, {J}.S.view?.players.map(x => x.total ?? x.points)]")) for p in live]
    check("the game finishes and every screen agrees", len(set(fin)) == 1 and "gameOver" in fin[0], fin[0][:80])
    check("no page errors", not errs, str(errs[:2]))
    cr.close()
    print(f"\n{GAME}: {sum(results)}/{len(results)} leave checks passed")
    sys.exit(0 if all(results) else 1)
