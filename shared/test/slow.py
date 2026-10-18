"""Joining on weak mobile data, for any Games4free game.

    python3 shared/test/slow.py <wizard|lodestone|marvels> [base_url]

The host is on normal internet; Anya's phone is throttled to slow 4G (1.6 Mbps down, 750 kbps up, 150 ms latency).
Measures how long until she sees the join form, until the table is on screen, until every picture on screen has
loaded, and how much she downloaded. Then she plays with a short signal drop (5 s offline) mid-game.
"""
import sys, time
from playwright.sync_api import sync_playwright

GAME = sys.argv[1]
BASE = sys.argv[2] if len(sys.argv) > 2 else f"http://localhost:8765/{GAME}/"
J = {"wizard": "window.__wiz", "lodestone": "window.__lode", "marvels": "window.__mar", "avalon": "window.__ava", "incan": "window.__inc"}[GAME]
MINP = {"lodestone": 2, "avalon": 5}.get(GAME, 3)
results = []
def check(name, ok, detail=""):
    results.append(ok); print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

IMGS_DONE = """() => { const vis = [...document.images].filter(i => { const r = i.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.left < innerWidth && i.src; });
  const bg = [...document.querySelectorAll('[style*="background-image"]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; });
  // a table drawn without picture files (Avalon's crests) counts as loaded once it's on screen
  return (vis.length > 0 || !!document.querySelector('#table')) && vis.every(i => i.complete && i.naturalWidth > 0); }"""

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome")
    names = ["Dhruv", "Anya", "Henry", "Freya", "Omar"][:max(MINP, 3)]
    pg = {}
    for n in names: pg[n] = b.new_context(**pw.devices["Pixel 7"]).new_page()
    a = pg["Anya"]; cdp = a.context.new_cdp_session(a)
    cdp.send("Network.enable")
    cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
    cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 150, "downloadThroughput": 1.6e6 / 8, "uploadThroughput": 750e3 / 8})
    got = [0]
    cdp.on("Network.loadingFinished", lambda e: got.__setitem__(0, got[0] + e.get("encodedDataLength", 0)))
    h = pg["Dhruv"]; h.goto(BASE); h.fill("#nm", "Dhruv"); h.click("text=Start a game"); h.wait_for_selector("#link"); link = h.inner_text("#link")
    t0 = time.time(); a.goto(link, wait_until="commit"); a.wait_for_selector("#nm", timeout=60000); t_form = time.time() - t0
    a.fill("#nm", "Anya"); a.click("text=Join game")
    for n in names[2:]: pg[n].goto(link); pg[n].fill("#nm", n); pg[n].click("text=Join game")
    h.wait_for_selector(f"text=Players · {len(names)}/", timeout=60000)
    h.click('[data-act="start"]')
    t1 = time.time(); a.wait_for_selector(".bar", timeout=60000); t_table = time.time() - t1
    t2 = time.time()
    while time.time() - t2 < 60 and not a.evaluate(IMGS_DONE): time.sleep(0.25)
    t_imgs = time.time() - t2 + t_table
    mb = got[0] / 1e6
    check("join form shows in under 5 s on slow 4G", t_form < 5, f"{t_form:.1f}s")
    check("table appears within 3 s of the start", t_table < 3, f"{t_table:.1f}s")
    check("pictures on screen loaded within 10 s", t_imgs < 10, f"{t_imgs:.1f}s")
    print(f"downloaded so far: {mb:.2f} MB", flush=True)

    # a short signal drop while playing
    PLAN_SRC = None
    seq0 = a.evaluate(f"() => {J}.S.view?.seq ?? 0")
    cdp.send("Network.emulateNetworkConditions", {"offline": True, "latency": 0, "downloadThroughput": -1, "uploadThroughput": -1})
    a.context.set_offline(True); time.sleep(5); a.context.set_offline(False)
    cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 150, "downloadThroughput": 1.6e6 / 8, "uploadThroughput": 750e3 / 8})
    t3 = time.time(); ok = False
    while time.time() - t3 < 20:
        if a.evaluate(f"() => {J}.S.net") and a.evaluate(f"() => {J}.S.mode") == "game": ok = True; break
        time.sleep(0.3)
    check("back in the game after a 5 s signal drop", ok, f"{time.time() - t3:.1f}s")
    b.close()
print(f"{GAME}: {sum(results)}/{len(results)} slow-network checks passed")
