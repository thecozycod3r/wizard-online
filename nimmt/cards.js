// 6 Nimmt! card faces (SVG): white card, number in the middle, its bull heads above.
import { bulls } from "./engine.js";

export const BULL_COL = { 1: "#c9b8ff", 2: "#6fd3ff", 3: "#ffd34d", 5: "#ff6b5e", 7: "#ff3dc8" };
const HEAD = c => `<path d="M3 4 Q1 1 4 1 Q5 3 7 4 Q10 3 13 4 Q15 3 16 1 Q19 1 17 4 Q19 6 17 9 Q16 15 10 16 Q4 15 3 9 Q1 6 3 4 Z" fill="${c}" stroke="#000" stroke-width="1"/><circle cx="7.5" cy="8" r="1.2" fill="#000"/><circle cx="12.5" cy="8" r="1.2" fill="#000"/><ellipse cx="10" cy="12.5" rx="3" ry="1.8" fill="#000" opacity=".55"/>`;
export const headIcon = (n = 1) => `<svg class="hd" viewBox="0 0 20 17" aria-hidden="true">${HEAD(BULL_COL[n] || "#c9b8ff")}</svg>`;

// one card face: white card, the number big in the middle, its bull heads above
export function cardSvg(num) {
  const b = bulls(num), col = BULL_COL[b];
  const heads = Array.from({ length: b }, (_, i) => {
    const per = Math.min(b, 4), row = Math.floor(i / 4), k = i % 4, cnt = row === 0 ? per : b - 4;
    const x = 50 - (cnt - 1) * 9 + k * 18 - 9, y = 14 + row * 15;
    return `<g transform="translate(${x} ${y})">${HEAD(col)}</g>`;
  }).join("");
  return `<svg class="nc" viewBox="0 0 100 150" role="img" aria-label="${num}, ${b} bull head${b > 1 ? "s" : ""}">
    <rect x="1.5" y="1.5" width="97" height="147" rx="10" fill="#fbf8f1" stroke="${col}" stroke-width="3"/>
    <rect x="8" y="${b > 4 ? 44 : 38}" width="84" height="${b > 4 ? 98 : 104}" rx="7" fill="${col}" opacity=".22"/>
    ${heads}
    <text x="50" y="112" text-anchor="middle" font-size="54" font-weight="800" fill="#1b1730" font-family="Bricolage Grotesque,system-ui">${num}</text>
    <text x="12" y="140" font-size="15" font-weight="800" fill="#1b1730" font-family="Bricolage Grotesque,system-ui">${num}</text>
    <text x="88" y="140" text-anchor="end" font-size="15" font-weight="800" fill="#1b1730" font-family="Bricolage Grotesque,system-ui">${num}</text></svg>`;
}
