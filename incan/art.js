// Art for Incan Gold: painted cards and icons (made with Codex, see ~/wizard-deck/incan), plus drawn SVG gems.
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

// Paintings: art/<id>.webp, with a 2x copy for sharp phones. Bump V when an image is repainted.
const V = 1;
const paint = (id, label, cls = "") => `<img class="pa${cls ? " " + cls : ""}" src="art/${id}.webp?v=${V}" srcset="art/${id}@2x.webp?v=${V} 2x" alt="${label}" draggable="false" decoding="async">`;
export const artUrl = (id, big = true) => `art/${id}${big ? "@2x" : ""}.webp?v=${V}`;

const HZ_NAME = { spiders: "Giant spiders", snakes: "Snakes", mummies: "Mummies", fire: "Fire", rockfall: "Rockfall" };
export const hazard = h => paint(h, HZ_NAME[h] || h);
const ART_NAME = { a1: "Golden Mask", a2: "Jade Idol", a3: "Sun Disc", a4: "Feathered Crown", a5: "Ceremonial Knife" };
export const artifact = id => paint(id, ART_NAME[id] || "artifact");
export const TREASURE = paint("treasure", "treasure");
export const TORCH = paint("torch", "torch", "icon");
export const CAMP = paint("camp", "camp", "icon");
export const TEMPLE = paint("temple", "temple");
export const ALL_ART = ["spiders", "snakes", "mummies", "fire", "rockfall", "a1", "a2", "a3", "a4", "a5", "treasure", "torch", "camp", "temple"];
