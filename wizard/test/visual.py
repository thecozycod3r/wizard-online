"""Visual check: phone + desktop, big hand (round 15, 3 players), Guide overlay."""
import sys
from playwright.sync_api import sync_playwright
BASE = "http://localhost:8765/"
SH = "/private/tmp/claude-501/-Users-dhruvshricharan/0bd99fd1-7258-490a-8f79-3642f4174666/scratchpad/"
FF = """async () => {
  const E = await import('./engine.js'); const w = window.__wiz, H = w.H;
  H.players.push({id:'pA', token:'a', name:'Anya', conn:null, online:false}, {id:'pB', token:'b', name:'Henry', conn:null, online:false});
  H.G = E.newGame(H.players, H.settings);
  let guard = 0;
  while (!(H.G.round === 15 && H.G.phase === 'play' && E.waitingOn(H.G)[0] === H.me) && guard++ < 20000) {
    const G = H.G;
    if (G.phase === 'trickShow') { E.act(G, null, {type:'resolve'}); continue; }
    if (G.phase === 'roundEnd') { E.act(G, null, {type:'nextRound'}); continue; }
    const pid = E.waitingOn(G)[0]; E.act(G, pid, E.autoAction(G, pid));
  }
  document.dispatchEvent(new Event('x'));
  w.refresh();
  return [H.G.round, H.G.phase];
}"""
with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome")
    for name, vp in [("phone", {"width": 390, "height": 844}), ("desk", {"width": 1280, "height": 800})]:
        p = b.new_context(viewport=vp, device_scale_factor=2).new_page()
        p.goto(BASE); p.fill("#nm", "Dhruv"); p.click("text=Start a game"); p.wait_for_selector("text=Room code")
        print(name, p.evaluate(FF))
        p.wait_for_timeout(600); p.screenshot(path=SH + f"vis-{name}.png")
        p.click("text=Guide"); p.wait_for_timeout(300); p.screenshot(path=SH + f"vis-{name}-guide.png")
    b.close()
