"""Turn-timer test for any Games4free game.

    python3 shared/test/timer.py <game> [base_url]        game = wizard | lodestone

4 players, 30 s timer. Henry never touches his screen: every one of his moves must come from the timer.
Halfway through one of Henry's turns the device running the table goes offline; the takeover device must keep
the clock running and still make Henry's move. The game must finish.
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

GAME = sys.argv[1]
BASE = sys.argv[2] if len(sys.argv) > 2 else f"http://localhost:8765/{GAME}/"
HOOK = {"wizard": "__wiz", "lodestone": "__lode", "marvels": "__mar", "avalon": "__ava"}[GAME]
ROOT = Path(__file__).resolve().parents[2]
if GAME == "wizard":
    PLAN = open(ROOT / "wizard/test/e2e.py").read().split('CHOOSE = """')[1].split('"""')[0]
else:
    PLAN = open(ROOT / f"{GAME}/test/e2e.py").read().split('PLAN = """')[1].split('"""')[0]
ACT = f"a => {{ delete a.from; window.{HOOK}.room.act(a); }}"
J = f"window.{HOOK}"


def main():
    with sync_playwright() as pw:
        cr = pw.chromium.launch(channel="chrome")
        errs = []
        ctxs, pages = [], []
        NM = ["Dhruv", "Anya", "Henry", "Freya"] + (["Omar"] if GAME == "avalon" else [])
        for n in NM:
            c = cr.new_context(**pw.devices["Pixel 7"]); pg = c.new_page()
            pg.on("pageerror", lambda e, n=n: errs.append((n, str(e))))
            ctxs.append(c); pages.append(pg)
        host, anya, henry, freya = pages[:4]
        host.goto(BASE); host.fill("#nm", "Dhruv"); host.click("text=Start a game"); host.wait_for_selector("#link")
        link = host.inner_text("#link")
        for pg, n in zip(pages[1:], NM[1:]):
            pg.goto(link); pg.fill("#nm", n); pg.click("text=Join game")
        host.wait_for_selector(f"text=Players · {len(NM)}/{ {'marvels': 7, 'avalon': 10}.get(GAME, 6) }", timeout=30000)
        if GAME == "avalon": host.evaluate(f"() => {J}.room.settings({{ timer: 30 }})")   # Avalon's shortest button is 1 min; the test uses 30 s
        else: host.click('[data-act="timer"][data-v="30"]')
        time.sleep(1)
        assert all(p.evaluate(f"() => {J}.S.lobby.settings.timer") == 30 for p in pages), "timer setting not shared"
        if GAME == "wizard": host.select_option("#rounds", "3")
        host.click("text=Start game")
        for p in pages: p.wait_for_selector(".bar", timeout=20000)
        t0 = time.time()
        henry_pid = henry.evaluate(f"() => {J}.S.me")
        countdown_seen = False; dropped = False; takeover = None
        active = [host, anya, freya] + pages[4:]
        notes = lambda: anya.evaluate(f"() => ({J}.S.notes || []).filter(m => m.includes('Henry')).length")
        while time.time() - t0 < 900:
            if anya.evaluate(f"() => {J}.S.view?.phase") == "gameOver": break
            for p in active:
                try:
                    a = p.evaluate(PLAN)
                    if a: p.evaluate(ACT, a)
                except Exception:
                    pass
            if anya.evaluate(f"() => document.querySelector('.opp [data-tmr=\"{henry_pid}\"], .knight [data-tmr=\"{henry_pid}\"]')?.textContent || ''"): countdown_seen = True
            w = anya.evaluate(f"() => {J}.S.view?.waiting || []")
            if not dropped and notes() >= 1 and henry_pid in w:
                left = anya.evaluate(f"() => {J}.room.clock()?.left || 0")
                if 12000 < left < 20000:
                    runner = next(i for i, p in enumerate(pages) if p.evaluate(f"() => {J}.room.isHost"))
                    ctxs[runner].set_offline(True); dropped = time.time(); dropped_left = left
                    active = [p for i, p in enumerate(pages) if i not in (runner, 2)]
                    print(f"dropped the table runner ({NM[runner]}) with {left / 1000:.0f}s left on Henry's clock")
            if dropped and takeover is None:
                h = [i for i, p in enumerate(pages) if p in active and p.evaluate(f"() => {J}.room.isHost")]
                if h: takeover = (NM[h[0]], round(time.time() - dropped, 1))
            time.sleep(0.4)
        for _ in range(30):   # let every remaining screen receive the final state
            if all(p.evaluate(f"() => {J}.S.view?.phase") == "gameOver" for p in active): break
            time.sleep(0.5)
        timed_out = notes()
        phase = [p.evaluate(f"() => {J}.S.view?.phase") for p in pages if p in active]
        print(f"{GAME}: finished={all(x == 'gameOver' for x in phase)} in {int(time.time() - t0)}s | Henry moves made by the timer: {timed_out} | "
              f"countdown visible to others: {countdown_seen} | takeover after drop: {takeover}")
        print("errors:", errs or "none")
        cr.close()
        ok = all(x == "gameOver" for x in phase) and timed_out >= 2 and countdown_seen and takeover and not errs
        sys.exit(0 if ok else 1)


main()
