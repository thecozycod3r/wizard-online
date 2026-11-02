// Shared pointy-top hex topology for the rules engine and board.
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const key = (q, r) => `${q},${r}`;
export const unkey = k => k.split(",").map(Number);
export const ring = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
export const nbrs = k => { const [q, r] = unkey(k); return DIRS.map(([a, b]) => key(q + a, r + b)); };
export const linkKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const pips = m => (m ? 6 - Math.abs(7 - m) : 0);
// ---------------------------------------------------------------- corners and sides
const S3 = Math.sqrt(3);
export const vKey = ks => ks.slice().sort().join("~");
export const vHexes = v => v.split("~");
// the six corners of hex k: k plus each pair of neighbours that are also neighbours of each other
export function cornersOf(k) {
  const [q, r] = unkey(k);
  return DIRS.map(([a, b], i) => { const [c, d] = DIRS[(i + 1) % 6]; return vKey([k, key(q + a, r + b), key(q + c, r + d)]); });
}
// a side's two end corners: the side's two hexes plus each hex next to both
export function sideEnds(a, b) {
  const nb = nbrs(b);
  return nbrs(a).filter(x => nb.includes(x)).map(c => vKey([a, b, c]));
}
export const vSides = v => { const [x, y, z] = vHexes(v); return [[x, y], [y, z], [x, z]]; };
export const vNbrs = v => vSides(v).map(([a, b]) => sideEnds(a, b).find(u => u !== v));
// a corner's map position: the centre of its three hexes (the same layout the 3D world draws)
export function vXY(v) {
  let x = 0, y = 0;
  for (const k of vHexes(v)) { const [q, r] = unkey(k); x += S3 * (q + r / 2); y += 1.5 * r; }
  return [x / 3, y / 3];
}
export function sectorOfV(v) {
  const [x, y] = vXY(v);
  return Math.floor(((Math.atan2(y, x) + Math.PI * 2 + Math.PI / 6) % (Math.PI * 2)) / (Math.PI / 3)) % 6;
}

// six 60° coast sectors around the island centre (pointy-top layout, matches the 3D world); sector s is centred on bearing s·60°
export function sectorOf(k) {
  const [q, r] = unkey(k); if (!q && !r) return -1;
  const x = Math.sqrt(3) * (q + r / 2), y = 1.5 * r;
  return Math.floor(((Math.atan2(y, x) + Math.PI * 2 + Math.PI / 6) % (Math.PI * 2)) / (Math.PI / 3)) % 6;
}

