// Drawn art for Incan Gold (SVG). Paintings can replace these later.
const G = `<linearGradient id="ig-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".5" stop-color="#f2c14e"/><stop offset="1" stop-color="#a8701c"/></linearGradient>
  <linearGradient id="ig-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8c58e"/><stop offset="1" stop-color="#9a6c3a"/></linearGradient>
  <linearGradient id="ig-turq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ff3e6"/><stop offset=".6" stop-color="#22b3a3"/><stop offset="1" stop-color="#0d6f66"/></linearGradient>
  <linearGradient id="ig-obs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a8a9c"/><stop offset=".5" stop-color="#2e2e3a"/><stop offset="1" stop-color="#121218"/></linearGradient>`;
const svg = (vb, inner, label) => `<svg viewBox="${vb}" role="img" aria-label="${label}"><defs>${G}</defs>${inner}</svg>`;

// Gems: turquoise 1, obsidian 5, gold 10
const gemShape = fill => `<path d="M12 2 L22 9 L18 22 H6 L2 9 Z" fill="${fill}" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/><path d="M12 2 L12 22 M2 9 H22 M6 22 L12 9 L18 22" stroke="rgba(255,255,255,.35)" stroke-width=".8" fill="none"/>`;
export const GEM = {
  turq: svg("0 0 24 24", gemShape("url(#ig-turq)"), "turquoise"),
  obs: svg("0 0 24 24", gemShape("url(#ig-obs)"), "obsidian"),
  gold: svg("0 0 24 24", `<ellipse cx="12" cy="14" rx="10" ry="7" fill="url(#ig-gold)" stroke="#7a5418"/><ellipse cx="12" cy="11" rx="10" ry="7" fill="url(#ig-gold)" stroke="#7a5418"/>`, "gold"),
};
// a pile showing n gems' worth (gold 10, obsidian 5, turquoise 1), at most a few icons
export function pile(n, max = 6) {
  const out = [];
  let v = n;
  for (const [k, w] of [["gold", 10], ["obs", 5], ["turq", 1]]) while (v >= w && out.length < max) { out.push(k); v -= w; }
  return out.map(k => `<i class="gem">${GEM[k]}</i>`).join("");
}

// Hazards
const HZ = {
  spiders: `<circle cx="50" cy="52" r="13" fill="#efe2c4" stroke="#3a2a14" stroke-width="1.5"/><circle cx="50" cy="36" r="8" fill="#efe2c4" stroke="#3a2a14" stroke-width="1.5"/><circle cx="47" cy="34" r="1.6" fill="#d9201f"/><circle cx="53" cy="34" r="1.6" fill="#d9201f"/>
    ${[-1, 1].map(s => [0, 1, 2, 3].map(i => `<path d="M${50 + s * 10} ${44 + i * 5} q${s * 14} ${-10 + i * 4} ${s * 24} ${4 + i * 6}" stroke="#efe2c4" stroke-width="3" fill="none" stroke-linecap="round"/>`).join("")).join("")}
    <path d="M50 4 V28" stroke="#ddd" stroke-width="1"/>`,
  snakes: `<path d="M22 78 C22 58 48 66 48 50 C48 34 24 40 26 26 C28 14 48 12 56 20" stroke="#2f8f3a" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M22 78 C22 58 48 66 48 50 C48 34 24 40 26 26" stroke="#9fe07a" stroke-width="3" stroke-dasharray="3 6" fill="none"/>
    <ellipse cx="62" cy="22" rx="10" ry="7" fill="#2f8f3a"/><circle cx="64" cy="19" r="1.8" fill="#ffd400"/><path d="M71 24 l8 2 l-6 3" stroke="#e33" stroke-width="2" fill="none"/>`,
  mummies: `<rect x="34" y="16" width="32" height="70" rx="15" fill="#e6dcc0" stroke="#8b7d5c" stroke-width="2"/>${[26, 36, 46, 56, 66, 76].map(y => `<path d="M34 ${y} L66 ${y + 6}" stroke="#a89a74" stroke-width="2"/>`).join("")}
    <rect x="40" y="28" width="20" height="7" rx="3" fill="#2a2414"/><circle cx="45" cy="31.5" r="2" fill="#ffd34d"/><circle cx="55" cy="31.5" r="2" fill="#ffd34d"/>`,
  fire: `<path d="M50 10 C62 30 76 38 70 60 C66 76 56 84 50 84 C40 84 28 76 28 60 C28 46 40 42 40 28 C46 36 46 42 50 46 C54 36 52 22 50 10 Z" fill="#ff6a1a"/>
    <path d="M50 40 C58 52 62 58 58 70 C56 78 52 80 50 80 C44 80 40 74 40 66 C40 58 46 56 46 48 C48 52 50 54 50 40 Z" fill="#ffd44d"/>`,
  rockfall: `<path d="M18 70 L30 50 L46 56 L52 74 L34 84 Z" fill="#8a7b6a" stroke="#4a3f33" stroke-width="2"/><path d="M50 42 L64 26 L80 34 L78 54 L60 58 Z" fill="#a08f7c" stroke="#4a3f33" stroke-width="2"/><path d="M56 78 L66 62 L82 68 L80 84 L62 88 Z" fill="#796a59" stroke="#4a3f33" stroke-width="2"/>
    <path d="M30 14 l4 10 M44 8 l2 12 M60 6 l-2 10" stroke="#c9b9a3" stroke-width="2.5" stroke-linecap="round"/>`,
};
export const hazard = h => svg("0 0 100 92", HZ[h] || "", h);

// Artifacts
const ART = {
  a1: `<path d="M30 20 Q50 8 70 20 L74 54 Q50 86 26 54 Z" fill="url(#ig-gold)" stroke="#7a5418" stroke-width="2"/><path d="M36 40 h10 M54 40 h10" stroke="#2a1a06" stroke-width="4" stroke-linecap="round"/><path d="M42 60 q8 6 16 0" stroke="#2a1a06" stroke-width="3" fill="none"/><circle cx="50" cy="26" r="4" fill="#2ec4b6"/>`,
  a2: `<path d="M40 18 h20 v10 h6 v14 h-6 v34 h8 v8 h-36 v-8 h8 v-34 h-6 v-14 h6 z" fill="#2fa36b" stroke="#0f4a2e" stroke-width="2"/><circle cx="46" cy="36" r="2.5" fill="#0f4a2e"/><circle cx="54" cy="36" r="2.5" fill="#0f4a2e"/><path d="M44 46 h12" stroke="#0f4a2e" stroke-width="2.5"/>`,
  a3: `<circle cx="50" cy="48" r="26" fill="url(#ig-gold)" stroke="#7a5418" stroke-width="2"/>${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M${50 + Math.cos(a) * 28} ${48 + Math.sin(a) * 28} L${50 + Math.cos(a) * 38} ${48 + Math.sin(a) * 38}" stroke="#f2c14e" stroke-width="4" stroke-linecap="round"/>`; }).join("")}<circle cx="50" cy="48" r="12" fill="none" stroke="#7a5418" stroke-width="2"/>`,
  a4: `<path d="M22 64 Q50 70 78 64 L74 76 Q50 82 26 76 Z" fill="url(#ig-gold)" stroke="#7a5418" stroke-width="2"/>${[-3, -2, -1, 0, 1, 2, 3].map(i => `<path d="M${50 + i * 7} 66 Q${50 + i * 10} 40 ${50 + i * 13} 16" stroke="${["#e63946", "#2ec4b6", "#f2c14e"][Math.abs(i) % 3]}" stroke-width="6" stroke-linecap="round" fill="none"/>`).join("")}`,
  a5: `<path d="M50 10 L58 54 H42 Z" fill="#c9ccd6" stroke="#55596a" stroke-width="2"/><rect x="36" y="54" width="28" height="6" rx="2" fill="url(#ig-gold)"/><rect x="44" y="60" width="12" height="22" rx="3" fill="url(#ig-gold)" stroke="#7a5418"/><circle cx="50" cy="86" r="5" fill="#2ec4b6"/>`,
};
export const artifact = id => svg("0 0 100 92", ART[id] || "", "artifact");

export const TORCH = svg("0 0 64 64", `<rect x="28" y="28" width="8" height="32" rx="3" fill="#8a5a2b" stroke="#4a2d12" stroke-width="1.5"/><path d="M24 26 h16 l-3 6 h-10z" fill="#5a3a1c"/><path d="M32 4 C40 12 44 18 40 25 C38 28 35 29 32 29 C27 29 24 26 24 21 C24 15 30 13 30 8 C33 12 33 14 32 18 C35 14 34 9 32 4Z" fill="#ff7a1a"/><path d="M32 13 C36 18 37 21 35 25 C34 27 33 27 32 27 C29 27 28 25 28 23 C28 20 31 19 31 16 C32 18 32 19 32 13Z" fill="#ffd84d"/>`, "torch");
export const CAMP = svg("0 0 64 64", `<path d="M6 54 L32 12 L58 54 Z" fill="#c9a06a" stroke="#6b4a24" stroke-width="2"/><path d="M32 12 L24 54 H40 Z" fill="#6b4a24"/><path d="M4 56 H60" stroke="#3b2a14" stroke-width="3" stroke-linecap="round"/><path d="M50 22 l6 -6 M54 26 l8 -2" stroke="#f2c14e" stroke-width="2" stroke-linecap="round"/>`, "camp");
export const TEMPLE = svg("0 0 100 80", `<path d="M10 74 H90 V66 H82 V58 H74 V50 H66 V42 H34 V50 H26 V58 H18 V66 H10 Z" fill="url(#ig-sand)" stroke="#5a3e1c" stroke-width="2"/><rect x="42" y="26" width="16" height="16" fill="url(#ig-sand)" stroke="#5a3e1c" stroke-width="2"/><rect x="47" y="32" width="6" height="10" fill="#2a1a08"/><path d="M50 74 V44" stroke="#5a3e1c" stroke-width="1.5" stroke-dasharray="3 3"/>`, "temple");
