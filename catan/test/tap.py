# 3 players settle the island by tapping glowing corners and sides on the 3D board, then one lays a trail by tap.
import sys
from playwright.sync_api import sync_playwright
B = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/catan/") + "?lite"
OUT = (sys.argv[2] if len(sys.argv) > 2 else "/tmp/") 
errs = []
def tap(p):
    p.evaluate("__tideW.renderOnce()")
    t = p.evaluate("__tideW.targetsOnScreen().filter(o => document.elementFromPoint(o.x, o.y)?.tagName === 'CANVAS')")
    if not t: return None
    x = t[len(t) // 2]; p.mouse.click(x["x"], x["y"]); p.wait_for_timeout(400); return x["t"]
with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pages = []
    for i, n in enumerate(["Dhruv", "Anya", "Henry"]):
        c = br.new_context(viewport={"width": 900, "height": 800}); p = c.new_page(); pages.append(p)
        p.on("pageerror", lambda e, n=n: errs.append(f"{n}: {e}"))
        if i == 0:
            p.goto(B); p.wait_for_timeout(1500); p.fill("#nm", n); p.click("button[type=submit]"); p.wait_for_timeout(2000)
            code = p.evaluate("__tide.S.code")
        else:
            p.goto(B.replace("?lite", f"?g={code}&lite")); p.wait_for_timeout(1500); p.fill("#nm", n); p.click("button[type=submit]"); p.wait_for_timeout(2000)
    pages[0].click("[data-act=start]"); pages[0].wait_for_timeout(7000)
    placed = 0
    for step in range(60):
        v = pages[0].evaluate("__tide.V()")
        if v["phase"] != "setup": break
        cur = v["cur"]
        p = next(p for p in pages if p.evaluate("__tide.S.me") == cur)
        p.wait_for_timeout(300)
        a = tap(p); b = tap(p)
        if not (a and b): print("no targets", step, a, b); break
        p.wait_for_timeout(900); placed += 1
    v = pages[0].evaluate("__tide.V()")
    print("placed", placed, "phase", v["phase"], "builds", len(v["builds"]), "trails", len(v["trails"]))
    for b in v["builds"]: assert "~" in b["v"], b
    # first player rolls, then lays a trail by tapping
    cur = v["cur"]; p = next(p for p in pages if p.evaluate("__tide.S.me") == cur)
    p.wait_for_timeout(500); p.evaluate("document.querySelector('[data-act=roll]').click()"); p.wait_for_timeout(4000)
    n0 = len(p.evaluate("__tide.V()")["trails"])
    p.evaluate("[...document.querySelectorAll('[data-act=sheet]')].find(e => /build/i.test(e.textContent + e.dataset.k))?.click()")
    p.wait_for_timeout(500); p.evaluate("document.querySelector('[data-act=pickbuild][data-k=trail]').click()"); p.wait_for_timeout(500)
    t = tap(p); p.wait_for_timeout(1200)
    n1 = len(p.evaluate("__tide.V()")["trails"])
    print("trail by tap", t, n0, "->", n1)
    q = pages[0]
    q.evaluate("document.getElementById('app').style.display='none'")
    q.evaluate("(()=>{const W=__tideW; W.reset(); W.sync(__tide.V(), {instant:true}); W.arm(null)})()")
    def cam(js, name):
        q.evaluate("(()=>{const W=__tideW, T=W.controls.target, C=W.camera;" + js + "C.lookAt(T); W.controls.update(); W.renderOnce(); W.renderOnce();})()"); q.screenshot(path=OUT + name)
    cam("T.set(0,0,0); C.position.set(0,13,8);", "board.png")
    for i in range(3):
        cam(f"const b=__tide.V().builds[{i*2}]; const [x,z]=__tide.E.vXY(b.v); T.set(x,0.3,z); C.position.set(x+1.2,2.6,z+2.2);", f"close{i}.png")
    print("errors", errs or "none")
    br.close()
