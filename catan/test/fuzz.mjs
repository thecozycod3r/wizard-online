// Fuzz: every seat throws random actions (most illegal) mixed with bot moves. Checks after every step:
// a refused action changes nothing, and the board never reaches an impossible state.
import * as E from "../engine.js";
const N = +(process.argv[2] || 300);
const R = a => a[Math.floor(Math.random() * a.length)];
const TYPES = ["place", "roll", "build", "buy", "sell", "contract", "charter", "play", "offer", "confirm", "cancel", "accept", "decline", "sail", "muster", "end", "nonsense", null];
let refused = 0, applied = 0, games = 0;
function randomAction(G, pid) {
  const t = R(TYPES), tiles = Object.keys(G.tiles), res = R([...E.GOODS, "silver", "gold", undefined]);
  switch (t) {
    case "place": return { type: t, tile: R(tiles), to: R(tiles) };
    case "build": { const k = R(["trail", "outpost", "ship", "repair", "hall", "tower"]); return { type: t, kind: k, tile: R(tiles), a: R(tiles), b: R(tiles), at: R(tiles) }; }
    case "buy": case "sell": case "muster": return { type: t, res };
    case "contract": return { type: t, i: R([0, 1, 2, 3, -1]) };
    case "play": return { type: t, card: R([...Object.keys(E.CHARTERS), "monument"]), res, tile: R(tiles), a: R(tiles), b: R(tiles) };
    case "offer": return { type: t, give: { [R(E.GOODS)]: R([1, 2, -1, 0, 1.5]) }, want: { [R(E.GOODS)]: R([1, 2]) } };
    case "confirm": return { type: t, with: R(G.players).id };
    case "accept": case "decline": return { type: t, offer: G.offer ? (Math.random() < 0.7 ? G.offer.id : 999) : 1 };
    case "sail": { const s = G.ships.length ? R(G.ships) : { id: 1, at: "0,0" }; return { type: t, ship: s.id, to: R(E.nbrs(s.at)) }; }
    case null: return null;
    default: return { type: t };
  }
}
function check(G) {
  const fail = m => { throw new Error(m + " @turn " + G.turnNo); };
  for (const p of G.players) for (const [r, v] of Object.entries(G.hands[p.id])) if (!Number.isInteger(v) || v < 0) fail(`hand ${r}=${v}`);
  const seen = new Set();
  for (const b of G.builds) {
    const t = G.tiles[b.tile]; if (!t?.land) fail("building off land");
    if (seen.has(b.pid + b.tile)) fail("two buildings of one player on a tile"); seen.add(b.pid + b.tile);
  }
  for (const k in G.tiles) { const t = G.tiles[k]; if (t.land && G.builds.filter(b => b.tile === k).length > t.slots) fail("slots"); if (t.land && (t.rich < 0 || t.rich > E.RICH)) fail("rich"); }
  const tk = new Set(); for (const t of G.trails) { if (tk.has(t.k)) fail("dup trail"); tk.add(t.k); if (!G.tiles[t.a]?.land || !G.tiles[t.b]?.land) fail("trail off land"); }
  const sk = new Set(); for (const s of G.ships) { const t = G.tiles[s.at]; if (!t || t.land || t.sea === "reef") fail("ship on " + (t?.sea || "nothing")); if (sk.has(s.at)) fail("two ships one hex"); sk.add(s.at); }
  for (const r of E.GOODS) if (G.prices[r] < 1 || G.prices[r] > 6) fail("price");
  if (G.phase !== "setup" && G.contracts.length !== 3) fail("contracts " + G.contracts.length);
  for (const p of G.players) { if (G.builds.filter(b => b.pid === p.id).length > E.LIMIT.outpost) fail("outpost limit"); if (G.trails.filter(t => t.pid === p.id).length > E.LIMIT.trail) fail("trail limit"); }
  if (G.phase === "gameOver" && !G.result) fail("no result");
}
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 5);
  const G = E.newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), { sea: g % 2 === 0, raiders: g % 3 !== 0, seed: 900 + g });
  let steps = 0;
  while (G.phase !== "gameOver" && steps++ < 30000) {
    const pid = Math.random() < 0.85 ? E.waitingOn(G)[0] : R(G.players).id;
    const a = Math.random() < 0.5 ? randomAction(G, pid) : (E.waitingOn(G)[0] === pid ? E.botAction(G, pid) : randomAction(G, pid));
    const before = JSON.stringify(G);
    try { E.act(G, pid, a); applied++; }
    catch (e) { refused++; if (JSON.stringify(G) !== before) throw new Error(`refused ${JSON.stringify(a)} but state changed: ${e.message}`); }
    check(G);
    // keep games moving: the current seat sometimes falls back to its bot
    if (Math.random() < 0.3 && G.phase !== "gameOver") { const c = E.waitingOn(G)[0]; try { E.act(G, c, E.botAction(G, c)); } catch { /* fine */ } check(G); }
  }
  if (G.phase !== "gameOver") throw new Error("fuzz game never ended, players " + n);
  games++;
}
console.log({ games, applied, refused });
