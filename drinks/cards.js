// Standard 52-card deck shared by Kings Cup and Ride the Bus. Card ids: rank 1–13 + suit S H D C, e.g. "1S" (ace of spades), "12H".
export const SUITS = ["S", "H", "D", "C"];
export const SUIT_GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_NAME = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
export const RANK_TXT = r => ({ 1: "A", 11: "J", 12: "Q", 13: "K" }[r] || String(r));
export const RANK_NAME = r => ({ 1: "Ace", 11: "Jack", 12: "Queen", 13: "King" }[r] || String(r));
export const fullDeck = () => SUITS.flatMap(s => Array.from({ length: 13 }, (_, i) => `${i + 1}${s}`));
export const rankOf = id => parseInt(id, 10);
export const suitOf = id => id.slice(-1);
export const isRed = id => suitOf(id) === "H" || suitOf(id) === "D";
export const cardName = id => `${RANK_NAME(rankOf(id))} of ${SUIT_NAME[suitOf(id)]}`;

// pip positions (x, y) on a 100×150 face for 2–10
const PIPS = {
  2: [[50, 30], [50, 120]], 3: [[50, 30], [50, 75], [50, 120]], 4: [[32, 30], [68, 30], [32, 120], [68, 120]],
  5: [[32, 30], [68, 30], [50, 75], [32, 120], [68, 120]], 6: [[32, 30], [68, 30], [32, 75], [68, 75], [32, 120], [68, 120]],
  7: [[32, 30], [68, 30], [50, 52], [32, 75], [68, 75], [32, 120], [68, 120]], 8: [[32, 30], [68, 30], [50, 52], [32, 75], [68, 75], [50, 98], [32, 120], [68, 120]],
  9: [[32, 28], [68, 28], [32, 58], [68, 58], [50, 75], [32, 92], [68, 92], [32, 122], [68, 122]],
  10: [[32, 28], [68, 28], [50, 44], [32, 60], [68, 60], [32, 90], [68, 90], [50, 106], [32, 122], [68, 122]],
};
export function faceSvg(id) {
  const r = rankOf(id), s = suitOf(id), col = isRed(id) ? "#d4202a" : "#16161c", g = SUIT_GLYPH[s], t = RANK_TXT(r);
  let mid;
  if (r === 1) mid = `<text x="50" y="98" text-anchor="middle" font-size="64" fill="${col}">${g}</text>`;
  else if (r > 10) mid = `<rect x="22" y="30" width="56" height="90" rx="6" fill="${col}" opacity=".1" stroke="${col}" stroke-width="1.5"/>
    <text x="50" y="92" text-anchor="middle" font-size="46" font-weight="800" fill="${col}" font-family="Georgia,serif">${t}</text><text x="50" y="112" text-anchor="middle" font-size="16" fill="${col}">${g}</text>`;
  else mid = PIPS[r].map(([x, y]) => `<text x="${x}" y="${y + 8}" text-anchor="middle" font-size="22" fill="${col}"${y > 75 ? ` transform="rotate(180 ${x} ${y})"` : ""}>${g}</text>`).join("");
  return `<svg class="pc" viewBox="0 0 100 150" role="img" aria-label="${cardName(id)}">
    <rect x="1" y="1" width="98" height="148" rx="9" fill="#fffdf8" stroke="#d9d3c6" stroke-width="1.5"/>
    <text x="9" y="22" font-size="17" font-weight="800" fill="${col}" font-family="Georgia,serif">${t}</text><text x="9" y="38" font-size="14" fill="${col}">${g}</text>
    <g transform="rotate(180 50 75)"><text x="9" y="22" font-size="17" font-weight="800" fill="${col}" font-family="Georgia,serif">${t}</text><text x="9" y="38" font-size="14" fill="${col}">${g}</text></g>
    ${mid}</svg>`;
}
const BACK = `<img src="../drinks/art/drink-back.webp?v=1" srcset="../drinks/art/drink-back@2x.webp?v=1 2x" alt="" draggable="false">`;
export const cardHtml = (id, cls = "", attrs = "") => (id ? `<div class="pcard ${cls}" data-id="${id}" ${attrs}>${faceSvg(id)}</div>` : `<div class="pcard back ${cls}" ${attrs}>${BACK}</div>`);
export const CSS = `
.pcard{position:relative;width:var(--cw,60px);aspect-ratio:2/3;flex:none;border-radius:8px}
.pcard svg{display:block;width:100%;height:100%;filter:drop-shadow(0 4px 8px rgba(0,0,0,.45))}
.pcard.back{overflow:hidden;background:linear-gradient(135deg,#0f4a3a,#06261d);box-shadow:0 0 0 2px #fff inset,0 4px 8px rgba(0,0,0,.45)}
.pcard.back img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit}
.pcard.flip{animation:pflip .55s cubic-bezier(.3,1.3,.5,1) both}
@keyframes pflip{0%{transform:rotateY(90deg) scale(.85)}100%{transform:none}}`;
