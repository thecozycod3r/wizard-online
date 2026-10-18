// Drawn heraldic crests for every role and token. When the painted art (OpenAI) is in art/<id>.webp, set PAINTED
// and the app shows the paintings instead; the crests stay as the small icons.
export const PAINTED = false;

const field = side => (side === "good"
  ? `<linearGradient id="fg-good" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a6fd8"/><stop offset="1" stop-color="#132a6b"/></linearGradient>`
  : `<linearGradient id="fg-evil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d23a50"/><stop offset="1" stop-color="#5a0f1c"/></linearGradient>`);
const GOLD = `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".55" stop-color="#e3b85a"/><stop offset="1" stop-color="#9c6c22"/></linearGradient>`;
const shield = side => `<path d="M50 4 L92 16 V52 C92 78 72 94 50 102 C28 94 8 78 8 52 V16 Z" fill="url(#fg-${side})" stroke="url(#gold)" stroke-width="4"/>
  <path d="M50 12 L84 22 V52 C84 73 68 86 50 93 C32 86 16 73 16 52 V22 Z" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.5"/>`;

// Emblems drawn in gold on the shield (viewBox 0 0 100 106).
const EMBLEM = {
  merlin: `<path d="M50 22 L56 40 L74 40 L60 51 L65 69 L50 58 L35 69 L40 51 L26 40 L44 40 Z" fill="url(#gold)"/><path d="M68 70 a12 12 0 1 1 -10 -20 a9 9 0 1 0 10 20z" fill="url(#gold)"/>`,
  percival: `<path d="M50 18 L54 24 V70 H46 V24 Z" fill="url(#gold)"/><rect x="34" y="66" width="32" height="6" rx="2" fill="url(#gold)"/><rect x="47" y="72" width="6" height="14" fill="url(#gold)"/><circle cx="50" cy="89" r="4" fill="url(#gold)"/>`,
  servant: `<path d="M34 28 H66 C66 48 60 56 50 58 C40 56 34 48 34 28 Z" fill="url(#gold)"/><rect x="47" y="58" width="6" height="14" fill="url(#gold)"/><path d="M38 80 H62 L58 72 H42 Z" fill="url(#gold)"/>`,
  assassin: `<path d="M50 16 L56 30 L53 66 H47 L44 30 Z" fill="url(#gold)"/><rect x="36" y="64" width="28" height="5" rx="2" fill="url(#gold)"/><rect x="47" y="69" width="6" height="14" fill="url(#gold)"/><path d="M42 88 a8 4 0 0 0 16 0" fill="#ffd2d8" opacity=".9"/>`,
  morgana: `<path d="M64 26 a24 24 0 1 0 0 46 a18 18 0 1 1 0 -46z" fill="url(#gold)"/><ellipse cx="50" cy="49" rx="9" ry="5" fill="#2a0a12"/><circle cx="50" cy="49" r="3" fill="url(#gold)"/>`,
  mordred: `<path d="M26 66 L30 34 L42 48 L50 28 L58 48 L70 34 L74 66 Z" fill="url(#gold)"/><path d="M50 30 L46 52 L54 58 L48 74" stroke="#3a0a14" stroke-width="3" fill="none"/>`,
  oberon: `<path d="M24 50 C34 34 66 34 76 50 C66 66 34 66 24 50 Z" fill="url(#gold)"/><path d="M30 50 C40 58 60 58 70 50" stroke="#3a0a14" stroke-width="4" fill="none"/><path d="M34 60 l-4 8 M44 63 l-2 9 M56 63 l2 9 M66 60 l4 8" stroke="url(#gold)" stroke-width="3"/>`,
  minion: `<path d="M32 30 H68 V58 C68 70 60 78 50 80 C40 78 32 70 32 58 Z" fill="url(#gold)"/><rect x="38" y="44" width="24" height="5" fill="#2a0a12"/><rect x="47.5" y="49" width="5" height="18" fill="#2a0a12"/>`,
};

const svg = (inner, defs, label) => `<svg viewBox="0 0 100 106" role="img" aria-label="${label}"><defs>${GOLD}${defs}</defs>${inner}</svg>`;
export const crest = (role, side) => svg(shield(side) + (EMBLEM[role] || ""), field(side), role);

// Quest cards, vote tokens, Lady of the Lake.
export const questCard = ok => svg(ok
  ? `<rect x="6" y="4" width="88" height="98" rx="10" fill="#14306e" stroke="url(#gold)" stroke-width="4"/><path d="M34 26 H66 C66 48 60 56 50 58 C40 56 34 48 34 26 Z" fill="url(#gold)"/><rect x="47" y="58" width="6" height="14" fill="url(#gold)"/><path d="M38 82 H62 L58 72 H42 Z" fill="url(#gold)"/>`
  : `<rect x="6" y="4" width="88" height="98" rx="10" fill="#4a0c18" stroke="url(#gold)" stroke-width="4"/><path d="M34 26 H66 C66 48 60 56 50 58 C40 56 34 48 34 26 Z" fill="#a83244"/><path d="M50 24 L44 40 L54 46 L46 60" stroke="#1a0408" stroke-width="3" fill="none"/><rect x="47" y="58" width="6" height="14" fill="#a83244"/><path d="M38 82 H62 L58 72 H42 Z" fill="#a83244"/>`,
  "", ok ? "Success" : "Fail");
export const LADY = svg(`<circle cx="50" cy="53" r="44" fill="#0f3d4a" stroke="url(#gold)" stroke-width="4"/><path d="M14 62 C26 54 36 70 50 62 C64 54 74 70 86 62 V70 C74 78 64 62 50 70 C36 78 26 62 14 70Z" fill="#5ec3d4" opacity=".8"/><path d="M50 18 L54 26 V58 H46 V26 Z" fill="url(#gold)"/><rect x="38" y="54" width="24" height="5" rx="2" fill="url(#gold)"/>`, "", "Lady of the Lake");
export const SIGIL = side => crest(side === "good" ? "servant" : "minion", side);
