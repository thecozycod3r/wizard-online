// Catan — pure rules engine with custom island-building rules. No DOM, no network.
// newGame(players, settings) · act(G, pid, a) · viewFor · waitingOn · autoAction · smartAction · botAction · timerKey · pause
// Board: axial hexes "q,r". Outposts sit in one of a tile's slots; trails link the centres of two adjacent land tiles.
// Renown comes from outposts and from public delivery contracts; Seafarers adds fog, ships and isles; Cities & Knights
// adds a visible raider fleet that every player defends against together through a shared beacon.

export const MIN_PLAYERS = 2, MAX_PLAYERS = 6;
export const RES = ["timber", "stone", "flax", "grain", "copper"];
export const GOODS = [...RES, "fish"];
export const BASE_PRICE = { timber: 3, stone: 3, flax: 3, grain: 3, copper: 3, fish: 3 };
export const TERRAIN = { pine: "timber", quarry: "stone", flax: "flax", barley: "grain", copper: "copper", ruins: null };
export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
export const SEASON_BONUS = ["flax", "barley", "pine", "copper"];
export const SEASON_TURNS = 12, RICH = 2;
export const COST = {
  trail: { timber: 1, flax: 1 },
  outpost: { timber: 1, stone: 1, grain: 1 },
  charter: { flax: 1, copper: 1 },
  ship: { timber: 2, flax: 1 },
  repair: { timber: 1, stone: 1 },
};
export const LIMIT = { trail: 13, outpost: 7, ship: 3 };
export const MUSTER = { timber: 1, stone: 1, copper: 2 };
export const CONTRACTS = [
  ["keel", "Ship's keel", { timber: 3, flax: 1 }, 2, 0], ["granary", "Granary walls", { stone: 3, grain: 1 }, 2, 0],
  ["bread", "Bread for the fleet", { grain: 3 }, 1, 2], ["bells", "Copper bells", { copper: 2, stone: 2 }, 2, 0],
  ["sails", "Linen sails", { flax: 3, timber: 1 }, 2, 0], ["crane", "Harbour crane", { timber: 2, stone: 2, copper: 1 }, 3, 0],
  ["smithy", "Smithy order", { copper: 3 }, 1, 2], ["thatch", "Thatched barn", { flax: 2, grain: 2 }, 2, 0],
  ["pilings", "Bridge pilings", { timber: 2, stone: 1 }, 1, 1], ["cross", "Market cross", { stone: 2, copper: 1, grain: 1 }, 2, 0],
  ["rope", "Rope walk", { flax: 2, timber: 1 }, 1, 1], ["feast", "Feast day", { grain: 2, flax: 1, copper: 1 }, 2, 0],
  ["light", "Lighthouse", { stone: 3, copper: 2 }, 3, 0], ["yard", "Shipyard", { timber: 3, copper: 1, flax: 1 }, 3, 0],
  ["mill", "Mill wheel", { timber: 1, stone: 2, grain: 1 }, 2, 0], ["roof", "Copper roof", { copper: 3, timber: 1 }, 2, 0],
  ["weave", "Weaving house", { flax: 3, stone: 1, grain: 1 }, 3, 0], ["table", "Long table", { timber: 2, grain: 2 }, 2, 0],
  ["quay", "Quay steps", { stone: 4 }, 2, 0], ["pantry", "Pantry stores", { grain: 2, copper: 1 }, 1, 1],
  ["toll", "Toll road", { timber: 1, stone: 1, flax: 1, grain: 1, copper: 1 }, 3, 0], ["foundry", "Bell foundry", { copper: 2, timber: 2, grain: 1 }, 3, 0],
  ["nets", "Net makers", { flax: 2, copper: 1 }, 1, 1], ["grand", "Grand charter hall", { timber: 2, stone: 2, flax: 2, grain: 2 }, 4, 0],
].map(([id, name, need, renown, silver]) => ({ id, name, need, renown, silver }));
export const CHARTERS = {
  windfall: { n: 4, name: "Windfall", text: "Take 2 of one resource." },
  seam: { n: 4, name: "Rich Seam", text: "Refill a tile you're on and take 1 of its resource." },
  caravan: { n: 4, name: "Caravan", text: "Take 3 silver." },
  surveyor: { n: 3, name: "Surveyor", text: "Swap the tide marks of two tiles (6, 7 and 8 may not end up side by side)." },
  requisition: { n: 3, name: "Requisition", text: "Name a good: the two rivals holding the most of it (3 or more) each give you 1." },
  rush: { n: 3, name: "Rush order", text: "This turn, fulfil a contract with one good missing." },
};
export const OMENS = {
  squall: { name: "Squall", text: "Wind drives every ship one hex downwind." },
  bumper: { name: "Bumper crop", text: "Every outpost on a barley field gets 1 grain." },
  spike: { name: "Price spike", text: "One good's price jumps by 2." },
  glut: { name: "Glut", text: "One good's price falls by 2." },
  rot: { name: "Grain rot", text: "Anyone holding 5+ grain loses half of it." },
  festival: { name: "Festival", text: "Everyone gets 1 silver." },
  raider: { name: "Raider sails", text: "The raider fleet closes in a day sooner." },
  winds: { name: "Fair winds", text: "Ships sail 2 extra hexes this round." },
  lode: { name: "Lode found", text: "A spent tile is full again." },
  fogbank: { name: "Fog bank", text: "Fog swallows a stretch of open water." },
  calm: { name: "Calm seas", text: "Nothing happens." },
};
const OMEN_DECK = ["squall", "bumper", "spike", "glut", "rot", "festival", "raider", "raider", "winds", "lode", "fogbank", "calm"];

export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const key = (q, r) => `${q},${r}`;
export const unkey = k => k.split(",").map(Number);
export const ring = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
export const nbrs = k => { const [q, r] = unkey(k); return DIRS.map(([a, b]) => key(q + a, r + b)); };
export const linkKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const pips = m => (m ? 6 - Math.abs(7 - m) : 0);
// six 60° coast sectors around the island centre (pointy-top layout, matches the 3D world); sector s is centred on bearing s·60°
export function sectorOf(k) {
  const [q, r] = unkey(k); if (!q && !r) return -1;
  const x = Math.sqrt(3) * (q + r / 2), y = 1.5 * r;
  return Math.floor(((Math.atan2(y, x) + Math.PI * 2 + Math.PI / 6) % (Math.PI * 2)) / (Math.PI / 3)) % 6;
}

// ---------------------------------------------------------------- random (seeded, stored in G so replays are exact)
function rnd(G) { let t = (G.rng = (G.rng + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const ri = (G, n) => Math.floor(rnd(G) * n);
const shuffle = (G, a) => { for (let i = a.length - 1; i > 0; i--) { const j = ri(G, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------------------------------------------------------- setup
export const targetFor = (s, n = 4) => 13 + (s.sea ? 1 : 0) + (s.raiders ? 1 : 0) - (n === 2 ? 1 : 0);
export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Catan needs 2 to 6 players.");
  if (new Set(players.map(p => p.id)).size !== n || players.some(p => typeof p.id !== "string" || !p.id)) throw new Error("Every player needs their own id.");
  const sea = !!(settings.sea ?? 1), raiders = !!(settings.raiders ?? 1);
  const G = {
    v: 2, game: "tide", gameId: Math.random().toString(36).slice(2, 10), seq: 0, n: 0,
    rng: (settings.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0,
    sea, raiders, target: settings.target > 0 ? +settings.target : targetFor({ sea, raiders }, n),
    players: players.map(p => ({ id: p.id, name: p.name })),
    R: n <= 4 ? 2 : 3, tiles: {}, builds: [], trails: [], ships: [], shipN: 0,
    hands: {}, charters: {}, score: {}, done: {}, prices: { ...BASE_PRICE },
    round: 1, season: 0, turn: 0, turnNo: 0, phase: "setup", setupStep: 0,
    fleet: null, beacon: { def: 0, by: {} }, raids: 0, revealed: {}, awards: { chart: null },
    dice: null, moves: 0, mustered: 0, dealt: {}, played: false, rush: false, offer: null, sailed: {}, winds: false,
    result: null, last: null,
  };
  for (const p of G.players) {
    G.hands[p.id] = { timber: 1, stone: 1, flax: 1, grain: 1, copper: 0, fish: 0, silver: 3 };
    G.charters[p.id] = []; G.score[p.id] = 0; G.done[p.id] = []; G.revealed[p.id] = 0;
  }
  makeBoard(G);
  G.charterDeck = shuffle(G, Object.entries(CHARTERS).flatMap(([k, c]) => Array(c.n).fill(k)));
  G.omenDeck = shuffle(G, OMEN_DECK.slice());
  G.contractDeck = shuffle(G, CONTRACTS.map(c => c.id));
  G.contracts = G.contractDeck.splice(0, 3); G.contractDiscard = [];
  const ids = G.players.map(p => p.id);
  G.setupOrder = [...ids, ...ids.slice().reverse()];
  G.last = { n: ++G.n, kind: "start" };
  return G;
}

function makeBoard(G) {
  const R = G.R, land = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (ring(q, r) <= R) land.push(key(q, r));
  let use = land;
  if (R === 3) {   // 37 → 30: drop the six ring-3 corners and one more coast tile (never next to a corner gap twice)
    const corners = DIRS.map(([a, b]) => key(a * 3, b * 3));
    const rest = land.filter(k => ring(...unkey(k)) === 3 && !corners.includes(k));
    use = land.filter(k => !corners.includes(k) && k !== rest[ri(G, rest.length)]);
  }
  const ruins = R === 2 ? ["0,0"] : ["0,0", key(...DIRS[ri(G, 6)].map(x => x * 2))];
  const counts = R === 2 ? { pine: 4, quarry: 3, flax: 4, barley: 4, copper: 3 } : { pine: 6, quarry: 5, flax: 6, barley: 6, copper: 5 };
  const bag = Object.entries(counts).flatMap(([t, c]) => Array(c).fill(t));
  const prod = use.filter(k => !ruins.includes(k));
  // fixed multiplicities: one each of 2 and 12, the rest spread evenly
  const marks0 = R === 2 ? [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 8, 9, 9, 10, 10, 11, 12] : [2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12];
  const hot = m => [6, 7, 8].includes(m);
  let T = null;
  for (let round = 0; round < 60; round++) {
    let best = -Infinity; T = null;
    for (let tries = 0; tries < 400; tries++) {
      const terr = shuffle(G, bag.slice()), marks = shuffle(G, marks0.slice());
      const cand = {}; prod.forEach((k, i) => (cand[k] = { terrain: terr[i], mark: marks[i] }));
      const sc = fairness(cand);
      if (sc > best) { best = sc; T = cand; }
      if (sc >= 1) break;
    }
    // guarantee 6/7/8 never touch: move a clashing hot mark onto a cool tile with no hot neighbours
    const clash = k => hot(T[k].mark) && nbrs(k).some(x => T[x] && hot(T[x].mark));
    for (let guard = 0; guard < 200; guard++) {
      const k = prod.find(clash); if (!k) break;
      const to = prod.find(x => !hot(T[x].mark) && nbrs(x).every(y => !T[y] || y === k || !hot(T[y].mark)));
      if (!to) break;
      [T[k].mark, T[to].mark] = [T[to].mark, T[k].mark];
    }
    if (!prod.some(clash)) break;
  }
  for (const k of use) {
    const [q, r] = unkey(k);
    G.tiles[k] = { q, r, land: true, terrain: T[k]?.terrain || "ruins", mark: T[k]?.mark || 0, rich: RICH, slots: 3 };
  }
  // sea: rings around the coast; with Seafarers the outer rings start fogged and are drawn from a bag when revealed
  const outer = G.R + (G.sea ? 4 : 3);
  for (let q = -outer; q <= outer; q++) for (let r = -outer; r <= outer; r++) {
    const k = key(q, r), d = ring(q, r);
    if (d > outer || G.tiles[k]) continue;
    const coast = nbrs(k).some(x => G.tiles[x]?.land);
    G.tiles[k] = { q, r, land: false, sea: "open", fog: G.sea && !coast && d > G.R + 1 };
  }
  if (G.sea) {   // one bag tile for every fogged hex, so the bag never runs dry
    const fogged = Object.keys(G.tiles).filter(k => G.tiles[k].fog).length;
    const mix = { shoal: .13, isle: .12, wreck: .06, reef: .08, current: .09 };
    const special = Object.entries(mix).flatMap(([t, f]) => Array(Math.round(fogged * f)).fill(t));
    G.seaBag = shuffle(G, special.concat(Array(Math.max(0, fogged - special.length)).fill("open")));
  }
}
// 1 = a fair island: no hot marks (6–8) side by side, no twin terrain+mark neighbours, every resource has real yield
function fairness(T) {
  let bad = 0;
  for (const k in T) {
    const m = T[k].mark;
    if ([6, 7, 8].includes(m) && nbrs(k).some(x => [6, 7, 8].includes(T[x]?.mark))) bad++;
    if (nbrs(k).some(x => T[x]?.terrain === T[k].terrain && T[x]?.mark === m)) bad++;
  }
  const w = {};
  for (const k in T) w[T[k].terrain] = (w[T[k].terrain] || 0) + pips(T[k].mark);
  const per = Object.entries(w).map(([t, v]) => v / Object.values(T).filter(x => x.terrain === t).length);
  const mean = per.reduce((a, b) => a + b, 0) / per.length;
  const spread = Math.max(...per) / mean - 1 + (1 - Math.min(...per) / mean);
  return bad ? -bad : spread < 0.35 ? 1 : 1 - spread;
}

// ---------------------------------------------------------------- queries
export const cur = G => (G.phase === "setup" ? G.setupOrder[G.setupStep] : G.players[G.turn]?.id);
export function waitingOn(G) { return G.phase === "gameOver" ? [] : [cur(G)]; }
export const timerKey = G => `${G.turnNo}.${G.phase}.${G.setupStep}`;
export const pause = () => null;
const isLand = (G, k) => !!G.tiles[k]?.land;
const buildsOn = (G, k) => G.builds.filter(b => b.tile === k);
const mine = (G, pid) => G.builds.filter(b => b.pid === pid);
const hasTrail = (G, a, b) => G.trails.some(t => t.k === linkKey(a, b));
const touches = (G, pid, k) => G.trails.some(t => t.pid === pid && (t.a === k || t.b === k));
export function renown(G, pid) {
  return mine(G, pid).filter(b => !b.burned).length + G.score[pid] + (G.awards.chart === pid ? 2 : 0);
}
const costOf = (G, pid, kind) => ({ ...COST[kind] });
// fish may stand in for grain
export function canPay(hand, cost) {
  for (const [r, n] of Object.entries(cost)) if (r === "grain" ? hand.grain + hand.fish < n : (hand[r] || 0) < n) return false;
  return true;
}
function pay(hand, cost) {
  for (const [r, n] of Object.entries(cost)) {
    if (r === "grain") { const g = Math.min(hand.grain, n); hand.grain -= g; hand.fish -= n - g; }
    else hand[r] -= n;
  }
}
// a contract can be met if the hand covers it, or covers all but one good with a Rush order in play
export function shortfall(hand, need) {
  let miss = 0;
  for (const [r, n] of Object.entries(need)) miss += Math.max(0, n - (r === "grain" ? hand.grain + hand.fish : hand[r] || 0));
  return miss;
}
const sellPrice = (G, r) => Math.max(1, G.prices[r] - 1);
const buyPrice = (G, r) => G.prices[r];
export const MARKET_MOVES = 4, MUSTER_MAX = 3;
const shipMoves = G => 2 + (G.winds ? 2 : 0);
export const contract = id => CONTRACTS.find(c => c.id === id);

// legal spots, used by the UI to highlight and by the bot
export function legal(G, pid, kind) {
  const out = [];
  if (kind === "setup") {
    for (const k in G.tiles) {
      const t = G.tiles[k]; if (!t.land || t.isle) continue;
      if (buildsOn(G, k).length >= t.slots || buildsOn(G, k).some(b => b.pid === pid)) continue;
      for (const x of nbrs(k)) if (isLand(G, x) && !hasTrail(G, k, x)) out.push({ tile: k, to: x });
    }
  } else if (kind === "trail") {
    for (const t of Object.keys(G.tiles)) {
      if (!isLand(G, t) || !(touches(G, pid, t) || buildsOn(G, t).some(b => b.pid === pid))) continue;
      for (const x of nbrs(t)) if (isLand(G, x) && !hasTrail(G, t, x) && !out.some(o => o.k === linkKey(t, x))) out.push({ a: t, b: x, k: linkKey(t, x) });
    }
  } else if (kind === "outpost") {
    for (const k in G.tiles) {
      const t = G.tiles[k]; if (!t.land) continue;
      const on = buildsOn(G, k); if (on.length >= t.slots || on.some(b => b.pid === pid)) continue;
      if (touches(G, pid, k) || (t.isle && G.ships.some(s => s.pid === pid && nbrs(k).includes(s.at)))) out.push({ tile: k });
    }
  } else if (kind === "repair") {
    for (const b of mine(G, pid)) if (b.burned) out.push({ tile: b.tile });
  } else if (kind === "ship") {
    if (G.sea) {
      const seen = new Set();
      for (const b of mine(G, pid)) for (const x of nbrs(b.tile)) {
        const t = G.tiles[x];
        if (t && !t.land && !t.fog && t.sea !== "reef" && !G.ships.some(s => s.at === x) && !seen.has(x)) { seen.add(x); out.push({ at: x }); }
      }
    }
  }
  return out;
}
export function sailable(G, pid, id) {
  const s = G.ships.find(x => x.id === id); if (!s || s.pid !== pid) return [];
  if ((G.sailed[id] || 0) >= shipMoves(G)) return [];
  return nbrs(s.at).filter(x => { const t = G.tiles[x]; return t && !t.land && t.sea !== "reef" && !G.ships.some(o => o.at === x); });
}

// ---------------------------------------------------------------- actions
const err = m => { throw new Error(m); };
// all-or-nothing: the table applies actions to its live state, so a refused action must leave no trace
export function act(G, pid, a) {
  const snap = structuredClone(G);
  try { return apply(G, pid, a); }
  catch (e) { for (const k of Object.keys(G)) delete G[k]; Object.assign(G, snap); throw e; }
}
function apply(G, pid, a) {
  if (!a || typeof a !== "object") err("Unknown action.");
  if (G.phase === "gameOver") err("The game is over.");
  if (typeof pid !== "string" || !Object.hasOwn(G.hands, pid)) err("You're not in this game.");
  const ev = { n: G.n + 1, kind: a.type, pid };
  if (a.type === "accept" || a.type === "decline") return respond(G, pid, a, ev);
  if (cur(G) !== pid) err("It's not your turn.");
  const h = G.hands[pid];
  if (a.type !== "place" && a.type !== "roll" && G.phase !== "act") err(G.phase === "roll" ? "Roll first." : "Not now.");
  switch (a.type) {
    case "place": {
      if (G.phase !== "setup") err("Setup is over.");
      if (!legal(G, pid, "setup").some(o => o.tile === a.tile && o.to === a.to)) err("You can't settle there.");
      G.builds.push({ pid, tile: a.tile, slot: freeSlot(G, a.tile) });
      G.trails.push({ pid, a: a.tile, b: a.to, k: linkKey(a.tile, a.to) });
      ev.tile = a.tile; ev.to = a.to;
      if (G.setupStep >= G.players.length) {
        const r = TERRAIN[G.tiles[a.tile].terrain];
        if (r) h[r] += 2; else h.silver += 2;
        ev.gain = r ? { [r]: 2 } : { silver: 2 };
      }
      G.setupStep++;
      if (G.setupStep >= G.setupOrder.length) {
        G.phase = "roll"; G.turn = 0; G.turnNo = 1; ev.begin = true;
        if (G.raiders) newFleet(G, ev);
      }
      break;
    }
    case "roll": {
      if (G.phase !== "roll") err("You've already rolled.");
      const d = [1 + ri(G, 6), 1 + ri(G, 6)];
      G.dice = d; ev.dice = d; ev.prod = produce(G, d[0] + d[1]);
      if (!ev.prod.some(p => p.gets?.some(g => g.pid === pid))) { h.silver++; ev.wages = true; }   // dock wages: an empty roll still pays 1 silver
      if (d[0] === d[1]) ev.omen = omen(G);
      G.phase = "act";
      break;
    }
    case "build": build(G, pid, a, ev); break;
    case "buy": case "sell": {
      const r = a.res;
      if (!GOODS.includes(r) || (r === "fish" && !G.sea)) err("Unknown good.");
      if (G.moves >= MARKET_MOVES) err("No market moves left this turn.");
      if (G.dealt[r] && G.dealt[r] !== a.type) err("You can't buy and sell the same good in one turn.");
      if (a.type === "buy") {
        const p = buyPrice(G, r); if (h.silver < p) err("Not enough silver.");
        h.silver -= p; h[r]++; G.prices[r] = Math.min(6, G.prices[r] + 1); ev.price = p;
      } else {
        if (h[r] < 1) err(`You have no ${r}.`);
        const p = sellPrice(G, r); h[r]--; h.silver += p; G.prices[r] = Math.max(1, G.prices[r] - 1); ev.price = p;
      }
      G.dealt[r] = a.type; G.moves++; ev.res = r;
      break;
    }
    case "contract": {
      if (G.delivered) err("One contract a turn.");
      const id = G.contracts[a.i]; if (!id) err("No contract there.");
      const c = contract(id), miss = shortfall(h, c.need);
      if (miss > (G.rush ? 1 : 0)) err(`You're ${miss} good${miss > 1 ? "s" : ""} short.`);
      let skip = G.rush ? 1 : 0;
      for (const [r, n] of Object.entries(c.need)) for (let i = 0; i < n; i++) {
        if (r === "grain" ? h.grain + h.fish > 0 : h[r] > 0) pay(h, { [r]: 1 });
        else if (skip) skip--;
      }
      if (G.rush && miss) G.rush = false;
      G.score[pid] += c.renown; h.silver += c.silver; G.done[pid].push(id);
      G.contracts.splice(a.i, 1); G.contractDiscard.push(id);
      G.contracts.push(drawContract(G));
      ev.contract = id; ev.renown = c.renown; G.delivered = true;
      break;
    }
    case "charter": {
      if (!canPay(h, COST.charter)) err("A charter costs flax and copper.");
      if (!G.charterDeck.length) err("The charter deck is empty.");
      pay(h, COST.charter);
      const card = G.charterDeck.pop();
      G.charters[pid].push({ card, at: G.turnNo });
      ev.card = card;
      break;
    }
    case "play": play(G, pid, a, ev); break;
    case "offer": {
      const give = clean(a.give), want = clean(a.want);
      if (!Object.keys(give).length || !Object.keys(want).length) err("Offer something and ask for something.");
      if (!canPayExact(h, give)) err("You don't have what you're offering.");
      G.offer = { id: G.n + 1, from: pid, give, want, yes: [], no: [] };
      ev.give = give; ev.want = want;
      break;
    }
    case "confirm": {
      const o = G.offer; if (!o || o.from !== pid) err("No open offer.");
      if (!o.yes.includes(a.with)) err("They haven't accepted.");
      const other = G.hands[a.with];
      if (!canPayExact(h, o.give) || !canPayExact(other, o.want)) { o.yes = o.yes.filter(x => x !== a.with); err("Someone no longer has the goods."); }
      for (const [r, n] of Object.entries(o.give)) { h[r] -= n; other[r] += n; }
      for (const [r, n] of Object.entries(o.want)) { other[r] -= n; h[r] += n; }
      ev.with = a.with; ev.give = o.give; ev.want = o.want; G.offer = null;
      break;
    }
    case "cancel": { if (!G.offer) err("No open offer."); G.offer = null; break; }
    case "sail": {
      if (!sailable(G, pid, a.ship).includes(a.to)) err("The ship can't sail there.");
      const s = G.ships.find(x => x.id === a.ship);
      ev.from = s.at; s.at = a.to; G.sailed[s.id] = (G.sailed[s.id] || 0) + 1; ev.ship = s.id; ev.to = a.to;
      arrive(G, pid, s, ev);
      break;
    }
    case "muster": {
      if (!G.raiders || !G.fleet) err("No raiders are coming.");
      if (!Object.hasOwn(MUSTER, a.res)) err("The beacon takes timber, stone or copper.");
      if (G.mustered >= MUSTER_MAX) err(`You can feed the beacon ${MUSTER_MAX} times a turn.`);
      if (h[a.res] < 1) err(`You have no ${a.res}.`);
      h[a.res]--; G.mustered++;
      G.beacon.def += MUSTER[a.res]; G.beacon.by[pid] = (G.beacon.by[pid] || 0) + MUSTER[a.res];
      ev.res = a.res; ev.def = G.beacon.def;
      break;
    }
    case "end": endTurn(G, ev); break;
    default: err("Unknown action.");
  }
  G.n++; G.last = ev; G.seq++;
  checkWin(G);
  return G;
}
const freeSlot = (G, k) => [0, 1, 2].find(s => !buildsOn(G, k).some(b => b.slot === s));
function clean(o) {
  const out = {};
  for (const [r, n] of Object.entries(o || {})) {
    if (n === 0) continue;
    if (![...GOODS, "silver"].includes(r) || !Number.isInteger(n) || n < 0 || n > 19) err("Offers take whole amounts of real goods (1–19).");
    out[r] = n;
  }
  return out;
}
const canPayExact = (h, c) => Object.entries(c).every(([r, n]) => h[r] >= n);

function respond(G, pid, a, ev) {
  const o = G.offer;
  if (!o || o.id !== a.offer) err("That offer is gone.");
  if (o.from === pid) err("That's your own offer.");
  o.yes = o.yes.filter(x => x !== pid); o.no = o.no.filter(x => x !== pid);
  if (a.type === "accept") { if (!canPayExact(G.hands[pid], o.want)) err("You don't have what they want."); o.yes.push(pid); }
  else o.no.push(pid);
  G.n++; G.last = ev; G.seq++;
  return G;
}

function build(G, pid, a, ev) {
  const h = G.hands[pid], kind = a.kind;
  if (!["trail", "outpost", "ship", "repair"].includes(kind)) err("Unknown build.");
  if (kind === "ship" && !G.sea) err("Ships come with Seafarers.");
  const c = costOf(G, pid, kind);
  if (!canPay(h, c)) err(`You can't afford a ${kind}.`);
  const count = kind === "trail" ? G.trails.filter(t => t.pid === pid).length : kind === "ship" ? G.ships.filter(s => s.pid === pid).length : mine(G, pid).length;
  if (LIMIT[kind] && count >= LIMIT[kind]) err(`You have no ${kind}s left.`);
  if (kind === "trail") {
    if (!legal(G, pid, "trail").some(o => o.k === linkKey(a.a, a.b))) err("Trails must join your network.");
    pay(h, c); G.trails.push({ pid, a: a.a, b: a.b, k: linkKey(a.a, a.b) }); ev.a = a.a; ev.b = a.b;
    return;
  }
  if (kind === "outpost") {
    if (!legal(G, pid, "outpost").some(o => o.tile === a.tile)) err("You can't build an outpost there.");
    pay(h, c); G.builds.push({ pid, tile: a.tile, slot: freeSlot(G, a.tile) }); ev.tile = a.tile;
    return;
  }
  if (kind === "repair") {
    const b = mine(G, pid).find(x => x.tile === a.tile && x.burned); if (!b) err("Pick one of your burned outposts.");
    pay(h, c); b.burned = false; ev.tile = a.tile;
    return;
  }
  if (!legal(G, pid, "ship").some(o => o.at === a.at)) err("Launch next to one of your coastal outposts.");
  pay(h, c);
  const s = { id: ++G.shipN, pid, at: a.at }; G.ships.push(s); G.sailed[s.id] = shipMoves(G); ev.at = a.at; ev.ship = s.id;
}

function arrive(G, pid, s, ev, depth = 0, prev = ev.from) {
  const t = G.tiles[s.at];
  if (t.fog) { reveal(G, s.at, pid, ev); G.sailed[s.id] = shipMoves(G); }   // sailing into fog ends the move
  if (t.land || t.sea === "reef") {   // land or a reef appeared out of the fog: the ship holds back where it was
    s.at = prev; ev.bounced = t.land ? "isle" : "reef"; ev.to = prev;
    return;
  }
  if (t.sea === "wreck") {
    const loot = {};
    for (let i = 0; i < 2; i++) { const r = RES[ri(G, 5)]; G.hands[pid][r]++; loot[r] = (loot[r] || 0) + 1; }
    G.hands[pid].silver += 2; loot.silver = 2; t.sea = "open"; ev.wreck = loot;
  }
  if (t.sea === "current" && depth < 3) {
    const [q, r] = unkey(s.at), [a, b] = DIRS[t.dir], nx = key(q + a, r + b), n = G.tiles[nx];
    if (n && !n.land && n.sea !== "reef" && !G.ships.some(o => o.at === nx)) { const from = s.at; (ev.pushed ||= []).push({ from, to: nx }); s.at = nx; arrive(G, pid, s, ev, depth + 1, from); }
  }
}
function reveal(G, k, pid, ev) {
  const t = G.tiles[k]; t.fog = false;
  if (t.drawn) return;   // fog that rolled back over a known hex gives no credit
  t.drawn = true;
  const kind = G.seaBag.pop() || "open";
  t.sea = kind;
  if (kind === "current") t.dir = ri(G, 6);
  if (kind === "shoal") { t.mark = [4, 5, 6, 8, 9, 10][ri(G, 6)]; t.rich = RICH; }
  if (kind === "isle") Object.assign(t, { land: true, isle: true, terrain: ["pine", "quarry", "flax", "barley", "copper"][ri(G, 5)], mark: [3, 4, 5, 9, 10, 11][ri(G, 6)], rich: RICH, slots: 2 });
  G.revealed[pid]++;
  (ev.reveal ||= []).push({ tile: k, sea: kind });
  const hold = G.awards.chart;
  if (G.revealed[pid] >= 4 && hold !== pid && (!hold || G.revealed[pid] > G.revealed[hold])) { G.awards.chart = pid; ev.award = "chart"; }
}

function produce(G, total) {
  const out = [], bonus = SEASON_BONUS[G.season];
  for (const k in G.tiles) {
    const t = G.tiles[k];
    if (t.land && t.mark === total) {
      const on = buildsOn(G, k).filter(b => !b.burned); if (!on.length) continue;
      if (t.rich <= 0) { out.push({ tile: k, spent: true }); continue; }
      if (G.season === 3 && t.terrain === "barley") { out.push({ tile: k, frozen: true }); continue; }
      const r = TERRAIN[t.terrain]; if (!r) continue;
      const gets = on.map(b => { const n = 1 + (t.terrain === bonus ? 1 : 0); G.hands[b.pid][r] += n; return { pid: b.pid, g: { [r]: n } }; });
      t.rich--;
      out.push({ tile: k, gets, rich: t.rich });
    }
    if (!t.land && t.sea === "shoal" && !t.fog && t.mark === total) {
      const s = G.ships.find(x => x.at === k);
      if (s && (t.rich ?? RICH) > 0) { t.rich = (t.rich ?? RICH) - 1; G.hands[s.pid].fish += 2; out.push({ tile: k, gets: [{ pid: s.pid, g: { fish: 2 } }], rich: t.rich }); }
    }
  }
  return out;
}

function omen(G) {
  if (!G.omenDeck.length) G.omenDeck = shuffle(G, OMEN_DECK.slice());
  let o = G.omenDeck.pop();
  if (!G.sea && ["squall", "winds", "fogbank"].includes(o)) o = "calm";
  if (!G.raiders && o === "raider") o = "festival";
  const ev = { card: o }, ids = G.players.map(p => p.id);
  switch (o) {
    case "squall": {
      const dir = ri(G, 6); ev.dir = dir; ev.moves = [];
      const [dx, dz] = [Math.sqrt(3) * (DIRS[dir][0] + DIRS[dir][1] / 2), 1.5 * DIRS[dir][1]];
      const along = k => { const [q, r] = unkey(k); return Math.sqrt(3) * (q + r / 2) * dx + 1.5 * r * dz; };
      for (const s of G.ships.slice().sort((x, y) => along(y.at) - along(x.at) || (x.at < y.at ? -1 : 1))) {   // leading ships move first, so launch order never matters
        const [q, r] = unkey(s.at), [a, b] = DIRS[dir], nx = key(q + a, r + b), n = G.tiles[nx];
        if (n && !n.land && !n.fog && n.sea !== "reef" && !G.ships.some(x => x.at === nx)) { ev.moves.push({ ship: s.id, from: s.at, to: nx }); s.at = nx; }
      }
      break;
    }
    case "bumper": for (const b of G.builds) if (!b.burned && G.tiles[b.tile].terrain === "barley") G.hands[b.pid].grain++; break;
    case "spike": case "glut": { const r = RES[ri(G, 5)]; ev.res = r; G.prices[r] = Math.max(1, Math.min(6, G.prices[r] + (o === "spike" ? 2 : -2))); break; }
    case "rot": ev.lost = {}; for (const id of ids) { const h = G.hands[id]; if (h.grain >= 5) { const l = Math.floor(h.grain / 2); h.grain -= l; ev.lost[id] = l; } } break;
    case "festival": for (const id of ids) G.hands[id].silver++; break;
    case "raider": if (G.fleet) G.fleet.eta = Math.max(1, G.fleet.eta - 1); break;
    case "winds": G.winds = true; break;
    case "lode": { const spent = Object.keys(G.tiles).filter(k => G.tiles[k].land && G.tiles[k].rich <= 0); if (spent.length) { const k = spent[ri(G, spent.length)]; G.tiles[k].rich = RICH; ev.tile = k; } break; }
    case "fogbank": {
      const open = Object.keys(G.tiles).filter(k => { const t = G.tiles[k]; return !t.land && !t.fog && t.drawn && t.sea === "open" && !G.ships.some(s => s.at === k); });
      if (open.length) { const k = open[ri(G, open.length)]; G.tiles[k].fog = true; ev.tile = k; }
      break;
    }
    default: break;
  }
  return ev;
}

function play(G, pid, a, ev) {
  const hand = G.charters[pid], i = hand.findIndex(c => c.card === a.card);
  if (i < 0) err("You don't hold that charter.");
  if (G.played) err("One charter per turn.");
  if (hand[i].at === G.turnNo) err("Wait a turn before playing a charter you just took.");
  const h = G.hands[pid];
  switch (a.card) {
    case "windfall": if (!RES.includes(a.res)) err("Name a resource."); h[a.res] += 2; ev.res = a.res; break;
    case "seam": {
      const t = G.tiles[a.tile]; if (!t?.land || !buildsOn(G, a.tile).some(b => b.pid === pid)) err("Pick a tile you have an outpost on.");
      const r = TERRAIN[t.terrain]; if (!r) err("Ruins have nothing to mine.");
      t.rich = RICH; h[r]++; ev.tile = a.tile; break;
    }
    case "caravan": h.silver += 3; break;
    case "surveyor": {
      const A = G.tiles[a.a], B = G.tiles[a.b];
      if (!A?.mark || !B?.mark || !A.land || !B.land || a.a === a.b) err("Pick two producing tiles.");
      [A.mark, B.mark] = [B.mark, A.mark];
      const bad = [a.a, a.b].some(k => [6, 7, 8].includes(G.tiles[k].mark) && nbrs(k).some(x => G.tiles[x]?.land && [6, 7, 8].includes(G.tiles[x].mark)));
      if (bad) { [A.mark, B.mark] = [B.mark, A.mark]; err("6, 7 and 8 can't sit side by side."); }
      ev.a = a.a; ev.b = a.b; break;
    }
    case "requisition": {
      if (!GOODS.includes(a.res)) err("Name a good.");
      ev.took = {};
      const rich = G.players.filter(p => p.id !== pid && G.hands[p.id][a.res] >= 3).sort((x, y) => G.hands[y.id][a.res] - G.hands[x.id][a.res]).slice(0, 2);
      for (const p of rich) { G.hands[p.id][a.res]--; h[a.res]++; ev.took[p.id] = 1; }   // from the two biggest holders at most
      ev.res = a.res; break;
    }
    case "rush": G.rush = true; break;
    default: err("Unknown charter.");
  }
  hand.splice(i, 1); G.played = true; ev.card = a.card;
}

// contracts recycle: when the deck runs out, everything delivered or retired is shuffled back in
function drawContract(G) {
  if (!G.contractDeck.length) G.contractDeck = shuffle(G, G.contractDiscard.splice(0));
  return G.contractDeck.pop();
}
function newFleet(G, ev) {
  G.fleet = { sector: ri(G, 6), eta: 6 };
  G.beacon = { def: 0, by: {} };
  ev.fleet = { ...G.fleet };
}
export const raidStrength = G => G.fleet ? 2 + G.builds.filter(b => !b.burned && sectorOf(b.tile) === G.fleet.sector).length + Math.min(2, Math.floor(G.raids / 2)) : 0;

function endTurn(G, ev) {
  G.offer = null; G.delivered = false; G.moves = 0; G.mustered = 0; G.dealt = {}; G.played = false; G.rush = false; G.sailed = {}; G.dice = null;
  G.turn = (G.turn + 1) % G.players.length; G.turnNo++;
  G.phase = "roll";
  if (G.turn === 0) {   // a full round (a day) ends
    G.round++; G.winds = false;
    for (const r of GOODS) if (G.prices[r] !== BASE_PRICE[r]) G.prices[r] += G.prices[r] > BASE_PRICE[r] ? -1 : 1;
    if (G.raiders && G.fleet && --G.fleet.eta <= 0) { ev.raid = raidNow(G); newFleet(G, ev); }
  }
  if ((G.turnNo - 1) % SEASON_TURNS === 0) {   // seasons run on a fixed clock of turns, whatever the table size
    G.season = (G.season + 1) % 4; ev.season = G.season;
    for (const k in G.tiles) if (G.tiles[k].land || G.tiles[k].sea === "shoal") G.tiles[k].rich = RICH;
    ev.retired = G.contracts.shift(); G.contractDiscard.push(ev.retired); G.contracts.push(drawContract(G));
  }
}
function raidNow(G) {
  const sector = G.fleet.sector, strength = raidStrength(G), def = G.beacon.def, by = G.beacon.by;
  const R = { sector, strength, defence: def, by: { ...by }, won: def >= strength, honours: [], paid: [], burned: [] };
  if (R.won) {
    const top = Math.max(0, ...Object.values(by));
    const tops = Object.keys(by).filter(id => by[id] === top && top >= 2);   // honours need a real share: 2+ defence
    for (const id of tops) { G.score[id] += tops.length === 1 ? 2 : 1; R.honours.push(id); }
    for (const id of Object.keys(by)) if (!tops.includes(id) && by[id] >= 2) { G.hands[id].silver += 2; R.paid.push(id); }
  } else {
    // each player with an outpost in the sector loses one (their best-yielding one burns)
    for (const p of G.players) {
      const hit = G.builds.filter(b => b.pid === p.id && !b.burned && sectorOf(b.tile) === sector).sort((a, b) => pips(G.tiles[b.tile].mark) - pips(G.tiles[a.tile].mark))[0];
      const standing = G.builds.filter(b => b.pid === p.id && !b.burned).length;
      if (hit && standing > 1) { hit.burned = true; R.burned.push({ pid: p.id, tile: hit.tile }); }   // never a player's last standing outpost
    }
  }
  G.raids++;
  return R;
}

function checkWin(G) {
  if (G.phase === "setup" || G.phase === "gameOver") return;
  const id = G.players[G.turn].id;   // renown counts on your own turn
  if (renown(G, id) >= G.target) finish(G, id);
  else if (G.turnNo > 900) finish(G, null);
}
function finish(G, winner) {
  G.phase = "gameOver";
  const rows = G.players.map(p => ({ pid: p.id, points: renown(G, p.id) })).sort((a, b) => b.points - a.points);
  G.result = { rows, winners: winner ? [winner] : rows.filter(r => r.points === rows[0].points).map(r => r.pid) };
  G.last = { ...G.last, over: true };
}

// ---------------------------------------------------------------- view
const hideCard = (ev, pid) => { if (ev.kind === "charter" && ev.pid !== pid) delete ev.card; return ev; };
export function viewFor(G, pid) {
  return {
    game: "tide", gameId: G.gameId, seq: G.seq, phase: G.phase, round: G.round, season: G.season, turn: G.turn, turnNo: G.turnNo,
    seasonLeft: SEASON_TURNS - ((Math.max(1, G.turnNo) - 1) % SEASON_TURNS), sea: G.sea, raiders: G.raiders, target: G.target, R: G.R,
    me: G.players.findIndex(p => p.id === pid), cur: cur(G), waiting: waitingOn(G),
    tiles: structuredClone(G.tiles), builds: structuredClone(G.builds), trails: structuredClone(G.trails), ships: structuredClone(G.ships),
    prices: { ...G.prices }, dice: G.dice, moves: G.moves, maxMoves: MARKET_MOVES, mustered: G.mustered,
    fleet: G.fleet ? { ...G.fleet, strength: raidStrength(G) } : null, beacon: structuredClone(G.beacon),
    contracts: G.contracts.map(id => contract(id)), deckLeft: G.contractDeck.length, rush: G.rush, delivered: !!G.delivered,
    played: G.played, sailed: { ...G.sailed }, winds: G.winds,
    hand: G.hands[pid] ? { ...G.hands[pid] } : null,
    charters: (G.charters[pid] || []).map(c => ({ ...c, fresh: c.at === G.turnNo })),
    costs: COST, offer: G.offer ? structuredClone(G.offer) : null, awards: { ...G.awards },
    deck: G.charterDeck.length, setupStep: G.setupStep, setupLen: G.setupOrder.length,
    players: G.players.map(p => ({
      id: p.id, name: p.name, renown: renown(G, p.id), score: G.score[p.id],
      cards: GOODS.reduce((s, r) => s + G.hands[p.id][r], 0), silver: G.hands[p.id].silver, charters: G.charters[p.id].length,
      done: G.done[p.id].slice(), revealed: G.revealed[p.id],
      outposts: mine(G, p.id).filter(b => !b.burned).length, burned: mine(G, p.id).filter(b => b.burned).length,
    })),
    last: G.last ? hideCard(structuredClone(G.last), pid) : null, result: G.result ? structuredClone(G.result) : null,
  };
}

// ---------------------------------------------------------------- automatic play
const tileValue = (G, k, pid) => {
  const t = G.tiles[k]; if (!t?.land) return 0;
  let v = t.terrain === "ruins" ? 0 : pips(t.mark);
  const r = TERRAIN[t.terrain];
  if (pid && r) { const have = new Set(mine(G, pid).map(b => TERRAIN[G.tiles[b.tile].terrain])); if (!have.has(r)) v += 2; }
  return v - buildsOn(G, k).length * 0.7;
};
// on the clock: do the minimum (place / roll / end the turn)
export function smartAction(G, pid) {
  if (!waitingOn(G).includes(pid)) return null;
  if (G.phase === "setup") return setupPick(G, pid);
  if (G.phase === "roll") return { type: "roll" };
  return { type: "end" };   // ending the turn also withdraws any open offer
}
export const autoAction = smartAction;
function setupPick(G, pid) {
  let best = null, bv = -1e9;
  for (const o of legal(G, pid, "setup")) { const v = tileValue(G, o.tile, pid) * 3 + tileValue(G, o.to, pid) + Math.random() * 0.01; if (v > bv) { bv = v; best = o; } }
  return { type: "place", tile: best.tile, to: best.to };
}
// a seat played by a bot: contracts, outposts, defence, exploring, then the market to close a gap
export function botAction(G, pid) {
  const w = smartAction(G, pid); if (!w || G.phase !== "act") return w;
  const h = G.hands[pid], can = k => canPay(h, COST[k]);
  const outs = legal(G, pid, "outpost"), nOut = mine(G, pid).length;
  // the best contract we can meet
  const ci = G.contracts.map((id, i) => ({ i, c: contract(id) })).filter(x => shortfall(h, x.c.need) <= (G.rush ? 1 : 0)).sort((a, b) => b.c.renown - a.c.renown)[0];
  if (ci && !G.delivered) return { type: "contract", i: ci.i };
  if (outs.length && nOut < LIMIT.outpost && can("outpost")) return { type: "build", kind: "outpost", tile: outs.sort((a, b) => tileValue(G, b.tile, pid) - tileValue(G, a.tile, pid))[0].tile };
  const rep = legal(G, pid, "repair"); if (rep.length && can("repair")) return { type: "build", kind: "repair", tile: rep[0].tile };
  if (G.raiders && G.fleet && G.fleet.eta <= 4 && G.mustered < MUSTER_MAX && G.beacon.def < raidStrength(G)) {
    const exposed = mine(G, pid).some(b => !b.burned && sectorOf(b.tile) === G.fleet.sector);
    const r = ["copper", "stone", "timber"].find(x => h[x] > (exposed ? 0 : 1));
    if (r && (exposed || Math.random() < 0.4)) return { type: "muster", res: r };
  }
  const ch = G.charters[pid].find(c => c.at !== G.turnNo && ["caravan", "windfall", "rush"].includes(c.card));
  if (ch && !G.played && (ch.card !== "rush" || G.contracts.some(id => shortfall(h, contract(id).need) === 1))) return { type: "play", card: ch.card, res: ch.card === "windfall" ? RES[Math.floor(Math.random() * 5)] : undefined };
  const trails = G.trails.filter(t => t.pid === pid).length;
  if (!outs.length && trails < LIMIT.trail && can("trail")) {
    const opts = legal(G, pid, "trail").map(o => ({ ...o, far: touches(G, pid, o.a) || buildsOn(G, o.a).some(b => b.pid === pid) ? o.b : o.a }));
    const good = opts.filter(o => { const on = buildsOn(G, o.far); return on.length < G.tiles[o.far].slots && !on.some(b => b.pid === pid); });
    if (good.length) { const o = good.sort((a, b) => tileValue(G, b.far, pid) - tileValue(G, a.far, pid))[0]; return { type: "build", kind: "trail", a: o.a, b: o.b }; }
  }
  if (G.sea) {
    const ships = G.ships.filter(s => s.pid === pid);
    for (const s of ships) {
      const to = sailable(G, pid, s.id); if (!to.length) continue;
      const fog = to.find(x => G.tiles[x].fog); if (fog) return { type: "sail", ship: s.id, to: fog };
      const far = to.sort((a, b) => ring(...unkey(b)) - ring(...unkey(a)))[0];
      if (ring(...unkey(far)) > ring(...unkey(s.at))) return { type: "sail", ship: s.id, to: far };
    }
    if (!ships.length && can("ship") && nOut >= 3) { const l = legal(G, pid, "ship"); if (l.length) return { type: "build", kind: "ship", at: l[0].at }; }
  }
  if (can("charter") && G.charterDeck.length && Math.random() < 0.35) return { type: "charter" };
  // market: buy the one missing good for a contract or an outpost, selling the biggest surplus to afford it
  if (G.moves < MARKET_MOVES - 1) {
    const goals = [...(rep.length ? [COST.repair] : []), ...G.contracts.map(id => contract(id).need), ...(outs.length && nOut < LIMIT.outpost ? [COST.outpost] : [COST.trail])];
    for (const need of goals) {
      const sf = shortfall(h, need);
      if (!sf || (sf > 1 && h.silver < 4 * sf)) continue;
      const miss = Object.entries(need).find(([r, n]) => (r === "grain" ? h.grain + h.fish : h[r]) < n)[0];
      if (G.dealt[miss] === "sell") continue;
      if (miss === "fish" && !G.sea) continue;
      if (h.silver >= buyPrice(G, miss)) return { type: "buy", res: miss };
      const spare = GOODS.filter(r => (G.sea || r !== "fish") && r !== miss && G.dealt[r] !== "buy" && h[r] > (need[r] || 0) + 1).sort((a, b) => h[b] - h[a])[0];
      if (spare) return { type: "sell", res: spare };
    }
  }
  return { type: "end" };
}
