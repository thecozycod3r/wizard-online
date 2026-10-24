// "Play again, same group": a button for the game-over screen. The host picks another game that fits the group;
// room.moveTo opens it and every phone at the table follows. Draws its own sheet, so any game can use it.
import { GAMES } from "./games.js";

export const againButton = isHost => (isHost ? `<button class="btn ghost" data-again>Play something else together</button>` : "");

export function initAgain(room, here) {
  const css = document.createElement("style");
  css.textContent = `.again-ov{position:fixed;inset:0;z-index:70;background:rgba(4,6,14,.86);display:flex;align-items:flex-end;justify-content:center;padding:12px 8px 0;animation:agf .2s}
.again-sh{width:100%;max-width:560px;max-height:85vh;overflow:auto;background:#141a2e;color:#f5f0e3;border:1px solid rgba(255,255,255,.14);border-bottom:0;border-radius:20px 20px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));font-family:system-ui,sans-serif}
.again-sh h2{margin:0 0 4px;font-size:22px} .again-sh p{margin:0 0 12px;color:#b9b6c8;font-size:14px}
.again-gr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.again-g{all:unset;box-sizing:border-box;cursor:pointer;padding:12px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font-weight:700}
.again-g small{display:block;font-weight:500;color:#b9b6c8;font-size:12px;margin-top:2px} .again-g:active{transform:scale(.98)}
.again-x{all:unset;cursor:pointer;float:right;padding:6px 10px;border:1px solid rgba(255,255,255,.2);border-radius:9px;font-size:13px}
@keyframes agf{from{opacity:0}}`;
  document.head.append(css);
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-again]"); if (!b) return;
    e.stopPropagation();
    const n = room.S.lobby?.players?.length || room.S.view?.players?.length || 0;
    const fits = GAMES.filter(g => g.path !== here && n >= g.min && n <= g.max);
    const ov = document.createElement("div"); ov.className = "again-ov";
    ov.innerHTML = `<div class="again-sh" role="dialog" aria-label="Play something else"><button class="again-x" data-x>Close</button><h2>Play something else</h2>
      <p>Everyone at this table (${n}) moves with you — no new link needed.</p>
      <div class="again-gr">${fits.map(g => `<button class="again-g" data-go="${g.path}" data-l="${g.letter}">${g.name}<small>${g.min}–${g.max} players · ~${g.mins} min</small></button>`).join("") || "<p>No other game fits this many players.</p>"}</div></div>`;
    document.body.append(ov);
    ov.addEventListener("click", ev => {
      const go = ev.target.closest("[data-go]");
      if (go) { go.textContent = "Opening…"; room.moveTo(go.dataset.go, go.dataset.l); return; }
      if (ev.target === ov || ev.target.closest("[data-x]")) ov.remove();
    });
  }, true);
}
