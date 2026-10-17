"""Cross-device ergonomics, for any Games4free game, at a full table.

    python3 shared/test/ergo.py <wizard|lodestone|marvels> [base_url]

One room, every seat on a different screen (small/large phones, a phone held sideways, tablet, laptop). At the start,
mid-game, on that player's own turn and at game over, each screen is checked for:
  - no sideways scroll
  - tap targets big enough for a thumb (>= 32px on the short side; 44px is Apple's ideal)
  - no text smaller than 10px
  - nothing tappable hidden under something else
  - the player's own area (hand / ledger / dock) on screen without scrolling
Screenshots go to the scratchpad as ergo-<game>-<device>-<moment>.png.
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

GAME = sys.argv[1]
BASE = sys.argv[2] if len(sys.argv) > 2 else f"http://localhost:8765/{GAME}/"
J = {"wizard": "window.__wiz", "lodestone": "window.__lode", "marvels": "window.__mar"}[GAME]
MINE = {"wizard": ".hand", "lodestone": "#mine", "marvels": ".dock"}[GAME]
ROOT = Path(__file__).resolve().parents[2]
PLAN = (open(ROOT / "wizard/test/e2e.py").read().split('CHOOSE = """')[1].split('"""')[0] if GAME == "wizard"
        else open(ROOT / f"{GAME}/test/e2e.py").read().split('PLAN = """')[1].split('"""')[0])
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/ergo-"
SEATS = [("Dhruv", "iPhone SE", "webkit"), ("Anya", "Pixel 7", "chromium"), ("Henry", "iPhone 13 landscape", "webkit"),
         ("Freya", "iPad Mini", "webkit"), ("Omar", "Desktop", "chromium"), ("Lena", "Galaxy S9+", "chromium"),
         ("Kofi", "iPhone 15 Pro Max", "webkit")]
SEATS = SEATS[:7 if GAME == "marvels" else 6]
results, issues = [], {}
import os
SCALE = float(os.environ.get("SCALE", "1"))   # e.g. SCALE=1.3: phone set to large text (Android Chrome scales page text)
BIG = """s => { const els = [...document.querySelectorAll('body *')].filter(e => !e.closest('svg'));
  const fs = els.map(e => parseFloat(getComputedStyle(e).fontSize));
  els.forEach((e, i) => e.style.setProperty('font-size', (fs[i] * s) + 'px', 'important')); }"""

def check(name, ok, detail=""):
    results.append(ok); print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

PROBE = """mine => {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const inView = r => r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  // visible part of an element after every scrolling/clipping ancestor
  const clip = e => { let r = e.getBoundingClientRect(), x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    for (let p = e.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(s.overflow + s.overflowX + s.overflowY)) { const q = p.getBoundingClientRect();
        x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom); } }
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, innerWidth); y1 = Math.min(y1, innerHeight);
    return x1 - x0 > 2 && y1 - y0 > 2 ? {x: (x0 + x1) / 2, y: (y0 + y1) / 2} : null; };
  const name = e => (e.dataset.act || e.dataset.card || e.className || e.tagName).toString().slice(0, 30) + (e.textContent.trim() ? ' "' + e.textContent.trim().slice(0, 14) + '"' : '');
  // with a sheet open, only what's on the sheet counts (the table behind it is meant to be covered)
  const ov = [...document.querySelectorAll('.overlay')].pop() || document;
  const taps = [...ov.querySelectorAll('button, a[href], [data-act], select, input, .dcard[data-card], .hc[data-card], .hcard, .chip[data-act]')]
    .filter(e => vis(e) && !e.closest('.fx-welcome, .dragghost, [aria-hidden=true]') && !e.disabled);
  const small = [], covered = [];
  for (const e of taps) {
    const r = e.getBoundingClientRect(); if (!inView(r)) continue;
    if (Math.min(r.width, r.height) < 32 && !e.parentElement?.closest('button,[data-act]')) small.push(name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    const c = clip(e); if (!c) continue;
    const top = document.elementFromPoint(c.x, c.y);
    // the pinned own-area (dock / ledger) floats over the scrolling board by design; the board scrolls clear of it
    const pinned = top && top.closest(mine) && !e.closest(mine) && getComputedStyle(top.closest(mine)).position === 'sticky';
    if (top && top !== e && !e.contains(top) && !top.contains(e) && !pinned && !top.closest('.toast, .fx-welcome, .pop, .fly, .fx-banner'))
      covered.push(name(e) + ' under ' + name(top));
  }
  const tiny = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const t = n.textContent.trim(); if (!t || !n.parentElement || !vis(n.parentElement)) continue;
    if (n.parentElement.closest('.fx-welcome, svg, .dragghost')) continue;
    const r = n.parentElement.getBoundingClientRect(); if (!inView(r)) continue;
    const fs = parseFloat(getComputedStyle(n.parentElement).fontSize); if (fs < 10) tiny.add(t.slice(0, 16) + ' ' + fs + 'px'); }
  const hidden = [...document.querySelectorAll('.prompt .btns button, .zones .zone')].filter(e => vis(e) && !clip(e)).map(name);
  const m = document.querySelector(mine), mr = m && m.getBoundingClientRect();
  return { over: document.documentElement.scrollWidth > innerWidth + 1, small: [...new Set(small)], hidden, covered: [...new Set(covered)], tiny: [...tiny],
    mineOk: !m || mr.height < 40 || (mr.top < innerHeight - 30 && mr.bottom > 30), mineBox: mr && [Math.round(mr.top), Math.round(mr.bottom), innerHeight] };
}"""

def device(pw, dev):
    if dev == "Desktop": return {"viewport": {"width": 1440, "height": 900}}
    return dict(pw.devices[dev])

def probe(name, dev, page, moment):
    page.evaluate("() => document.querySelector('.fx-welcome')?.remove()")
    page.wait_for_timeout(500)
    r = page.evaluate(PROBE, MINE)
    tag = f"{dev}/{moment}"
    page.screenshot(path=SH + f"{GAME}-{dev.replace(' ', '_')}-{moment}{'-big' if SCALE != 1 else ''}.png")
    check(f"{tag}: no sideways scroll", not r["over"])
    check(f"{tag}: tap targets >= 32px", not r["small"], "; ".join(r["small"][:6]))
    check(f"{tag}: nothing tappable hidden", not r["covered"], "; ".join(r["covered"][:4]))
    if SCALE == 1: check(f"{tag}: no text under 10px", not r["tiny"], "; ".join(r["tiny"][:6]))
    if moment != "over": check(f"{tag}: own area on screen", r["mineOk"], str(r["mineBox"]))
    check(f"{tag}: action buttons visible", not r["hidden"], "; ".join(r["hidden"][:4]))

with sync_playwright() as pw:
    eng = {"webkit": pw.webkit.launch(), "chromium": pw.chromium.launch(channel="chrome")}
    errs, pg = [], {}
    for n, dev, e in SEATS:
        c = eng[e].new_context(**device(pw, dev)); pg[n] = c.new_page()
        pg[n].on("pageerror", lambda x, n=n: errs.append((n, str(x))))
        if SCALE != 1:   # the phone's own large-text setting, applied before layout like the real thing
            pct = int(SCALE * 100)
            pg[n].add_init_script(f"document.addEventListener('DOMContentLoaded', () => {{ const s = document.createElement('style'); s.textContent = 'html{{-webkit-text-size-adjust:{pct}%!important;text-size-adjust:{pct}%!important}}'; document.head.append(s); }})")
    names = [s[0] for s in SEATS]; DEV = {s[0]: s[1] for s in SEATS}
    h = pg[names[0]]
    h.goto(BASE); h.fill("#nm", names[0]); h.click("text=Start a game"); h.wait_for_selector("#link")
    link = h.inner_text("#link")
    for n in names[1:]:
        pg[n].goto(link); pg[n].fill("#nm", n); pg[n].click("text=Join game")
    h.wait_for_selector(f"text=Players · {len(names)}/", timeout=40000)
    for n in names: probe(n, DEV[n], pg[n], "lobby")
    if GAME == "wizard": h.select_option("#rounds", "3")
    h.click('[data-act="start"]')
    for n in names: pg[n].wait_for_selector(".bar", timeout=30000)
    time.sleep(5.5)
    for n in names: probe(n, DEV[n], pg[n], "start")

    def step(skip=None):
        for n in names:
            if n == skip: continue
            try:
                a = pg[n].evaluate(PLAN)
                if a: a.pop("from", None); pg[n].evaluate(f"a => {J}.room.act(a)", a)
            except Exception: pass
        time.sleep(0.35)

    for _ in range(25): step()
    for n in names:
        for p in pg.values(): p.evaluate("() => document.querySelector('.overlay [data-act=close]')?.click()")
        probe(n, DEV[n], pg[n], "mid")
    # each player's own turn: play until it's their move, then look before acting
    for n in names:
        t = time.time()
        while time.time() - t < 25 and not pg[n].evaluate(PLAN):
            step(skip=n)
        if pg[n].evaluate(f"() => {J}.S.view?.phase") != "gameOver": probe(n, DEV[n], pg[n], "myturn")
    t = time.time()
    while time.time() - t < 400 and not all(pg[n].evaluate(f"() => {J}.S.view?.phase") == "gameOver" for n in names): step()
    time.sleep(3)
    for n in names: probe(n, DEV[n], pg[n], "over")
    check("no page errors", not errs, str(errs[:3]))
    for b in eng.values(): b.close()

print(f"{GAME}: {sum(results)}/{len(results)} ergonomics checks passed")
