// Card faces for UNO Flip / No Mercy, drawn as SVG: a coloured card, a tilted white oval with the big mark, small marks in the corners.
// Light-side and No Mercy cards have a white border; Flip's dark side has a black one.
export const HEX = {
  r: "#e5322d", y: "#f6c21c", g: "#2fa84f", b: "#1f6fd1",
  o: "#ff7a1a", p: "#ff3d9a", t: "#12b5b0", v: "#7d3cff", w: "#1b1b1f",
};
const DARKSIDE = new Set(["o", "p", "t", "v"]);

const ICON = {
  skip: s => `<circle cx="0" cy="0" r="${s * .55}" fill="none" stroke="currentColor" stroke-width="${s * .16}"/><path d="M${-s * .38} ${s * .38} L${s * .38} ${-s * .38}" stroke="currentColor" stroke-width="${s * .16}"/>`,
  rev: s => { const a = `<path d="M${-s * .1} ${s * .12} L${-s * .1} ${-s * .28} L${-s * .32} ${-s * .28} L${s * .08} ${-s * .68} L${s * .48} ${-s * .28} L${s * .26} ${-s * .28} L${s * .26} ${s * .12} Z"/>`; return `<g fill="currentColor" stroke="#111" stroke-width="${s * .05}" stroke-linejoin="round" transform="rotate(45)"><g transform="translate(${-s * .2} 0)">${a}</g><g transform="translate(${s * .2} 0) rotate(180)">${a}</g></g>`; },
  flip: s => `<g fill="none" stroke="currentColor" stroke-width="${s * .14}" stroke-linecap="round" stroke-linejoin="round"><path d="M${-s * .5} ${-s * .15} A${s * .5} ${s * .5} 0 0 1 ${s * .45} ${-s * .3}"/><path d="M${s * .5} ${s * .15} A${s * .5} ${s * .5} 0 0 1 ${-s * .45} ${s * .3}"/><path d="M${s * .45} ${-s * .62} L${s * .48} ${-s * .28} L${s * .14} ${-s * .26}"/><path d="M${-s * .45} ${s * .62} L${-s * .48} ${s * .28} L${-s * .14} ${s * .26}"/></g>`,
  skipall: s => `<circle r="${s * .5}" fill="none" stroke="currentColor" stroke-width="${s * .14}"/><path d="M${-s * .35} ${s * .35} L${s * .35} ${-s * .35}" stroke="currentColor" stroke-width="${s * .14}"/><g fill="currentColor">${[0, 90, 180, 270].map(a => `<path transform="rotate(${a})" d="M${s * .62} ${-s * .14} L${s * .9} 0 L${s * .62} ${s * .14} Z"/>`).join("")}</g>`,
  discall: s => `<g fill="currentColor"><rect x="${-s * .42}" y="${-s * .5}" width="${s * .52}" height="${s * .72}" rx="${s * .08}" transform="rotate(-14)" opacity=".55"/><rect x="${-s * .26}" y="${-s * .42}" width="${s * .52}" height="${s * .72}" rx="${s * .08}" opacity=".8"/><rect x="${-s * .08}" y="${-s * .32}" width="${s * .52}" height="${s * .72}" rx="${s * .08}" transform="rotate(14)"/></g>`,
};
const WHEEL = s => `<g>${["#e5322d", "#f6c21c", "#2fa84f", "#1f6fd1"].map((c, i) => `<path d="M0 0 L${Math.cos(i * Math.PI / 2) * s * .6} ${Math.sin(i * Math.PI / 2) * s * .6} A${s * .6} ${s * .6} 0 0 1 ${Math.cos((i + 1) * Math.PI / 2) * s * .6} ${Math.sin((i + 1) * Math.PI / 2) * s * .6} Z" fill="${c}"/>`).join("")}<circle r="${s * .62}" fill="none" stroke="#fff" stroke-width="${s * .06}"/><circle r="${s * .12}" fill="#fff"/></g>`;
const quad = (cols, s) => { const q = Math.round(s); return `<g transform="rotate(28)"><clipPath id="uq${q}"><ellipse rx="${s * .5}" ry="${s * .8}"/></clipPath><g clip-path="url(#uq${q})"><rect x="${-s}" y="${-s}" width="${s}" height="${s}" fill="${cols[0]}"/><rect x="0" y="${-s}" width="${s}" height="${s}" fill="${cols[1]}"/><rect x="0" y="0" width="${s}" height="${s}" fill="${cols[2]}"/><rect x="${-s}" y="0" width="${s}" height="${s}" fill="${cols[3]}"/></g><ellipse rx="${s * .5}" ry="${s * .8}" fill="none" stroke="#fff" stroke-width="${s * .05}"/></g>`; };
const WILD_COLS = { light: ["#e5322d", "#1f6fd1", "#f6c21c", "#2fa84f"], dark: ["#ff3d9a", "#12b5b0", "#ff7a1a", "#7d3cff"] };

// the big mark in the middle, and the small one in the corners
function mark(f, size, dark) {
  const k = f.k;
  if (/^\d$/.test(k)) return { big: `<text class="n" y="${size * .36}" font-size="${size * 1.05}">${k}</text>`, small: k };
  const plus = { d1: "+1", d2: "+2", d4: "+4", d5: "+5", wd2: "+2", wrd4: "+4", wd6: "+6", wd10: "+10" }[k];
  if (k === "w" || k === "wd2" || k === "wdc") {
    const q = quad(WILD_COLS[dark ? "dark" : "light"], 70);
    const lbl = k === "wdc" ? `<text class="n p" y="${size * .18}" font-size="${size * .5}">+?</text>` : plus ? `<text class="n p" y="${size * .3}" font-size="${size * .8}">${plus}</text>` : "";
    return { big: q + lbl, small: k === "wdc" ? "+?" : plus || "W" };
  }
  if (k === "roul") return { big: `${quad(WILD_COLS.light, 70)}<g transform="scale(.9)">${WHEEL(size)}</g>`, small: "?" };
  if (plus) {
    const big = k.startsWith("w") ? `${quad(WILD_COLS.light, 70)}<text class="n p" y="${size * .3}" font-size="${size * (k === "wd10" ? .66 : .8)}">${plus}</text>` + (k === "wrd4" ? `<g transform="translate(0 ${size * .62}) scale(.45)" style="color:#fff">${ICON.rev(size)}</g>` : "")
      : `<text class="n" y="${size * .3}" font-size="${size * .8}">${plus}</text>`;
    return { big, small: plus };
  }
  return { big: `<g transform="translate(0 0)">${ICON[k](size)}</g>`, small: `<tspan>${{ skip: "⊘", rev: "⇄", flip: "↻", skipall: "⊗", discall: "≡" }[k]}</tspan>` };
}

// <svg> for one face. opts.small = compact (opponent backs)
export function cardSvg(f, opts = {}) {
  const dark = DARKSIDE.has(f.c) || (f.c === "w" && opts.dark);
  const fill = f.c === "w" ? (dark ? "#0e0e12" : "#1b1b1f") : HEX[f.c];
  const ink = f.c === "w" ? "#fff" : HEX[f.c];
  const m = mark(f, 34, dark);
  const border = dark ? "#0a0a0a" : "#fff";
  return `<svg class="cface" viewBox="0 0 100 150" role="img" aria-label="${opts.label || ""}">
    <rect x="1.5" y="1.5" width="97" height="147" rx="11" fill="${border}"/>
    <rect x="7" y="7" width="86" height="136" rx="8" fill="${fill}"/>
    ${dark ? `<rect x="7" y="7" width="86" height="136" rx="8" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>` : ""}
    <ellipse cx="50" cy="75" rx="36" ry="56" transform="rotate(28 50 75)" fill="${dark ? "#121216" : "#fff"}"/>
    <g transform="translate(50 75)" style="color:${ink}" fill="${ink}">${m.big}</g>
    <text class="c" x="15" y="27" fill="#fff">${m.small}</text>
    <text class="c" x="85" y="123" fill="#fff" transform="rotate(180 85 123)">${m.small}</text>
  </svg>`;
}

// No Mercy card back (Codex painting) or a plain back for anything else
export const backHtml = (variant, extra = "") =>
  variant === "mercy" ? `<div class="card back ${extra}"><img src="../uno/art/mercy-back.webp?v=1" srcset="../uno/art/mercy-back@2x.webp?v=1 2x" alt="" draggable="false"></div>`
    : `<div class="card back plain ${extra}"></div>`;

export const cardHtml = (id, f, extra = "", attrs = "") => `<div class="card ${extra}" data-id="${id ?? ""}" ${attrs}>${cardSvg(f)}</div>`;
