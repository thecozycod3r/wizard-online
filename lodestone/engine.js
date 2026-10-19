// Lodestone rules engine: Splendor rules (Space Cowboys, 2014) with an ore theme,
// plus a 5–6 player setup on the same single deck. Pure state machine run by whichever device runs the table.
// act(G, pid, action) mutates G and returns it, or throws Error(message).

import { DATA } from "./data.js";

export const ORES = DATA.ores;                 // silver, cobalt, malachite, cinnabar, iron
export const ALL = [...ORES, "gold"];
export const ORE_NAME = Object.fromEntries(Object.entries(DATA.oreInfo).map(([k, v]) => [k, v.name]));
const CARD = Object.fromEntries(DATA.cards.map(c => [c.id, c]));
const NOBLE = Object.fromEntries(DATA.nobles.map(n => [n.id, n]));
export const cardOf = id => CARD[id.replace(/b$/, "")];
export const nobleOf = id => NOBLE[id.replace(/b$/, "")];
export const MIN_PLAYERS = 2, MAX_PLAYERS = 6;

export function setupFor(n) {
  // One set of 90 cards at every table size, so a card never appears twice. 5–6 players get a fifth level-1 card face up.
  return {
    twin: false,
    tokensPer: { 2: 4, 3: 5, 4: 7 }[n] ?? 7,
    gold: 5,
    display: n >= 5 ? { 1: 5, 2: 4, 3: 4 } : { 1: 4, 2: 4, 3: 4 },
    nobles: n + 1,
    target: 15,
  };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const zero = () => Object.fromEntries(ALL.map(o => [o, 0]));
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Splendor needs 2 to 6 players.");
  const S = setupFor(n);
  const copies = id => (S.twin ? [id, id + "b"] : [id]);
  const decks = {};
  for (const l of [1, 2, 3]) decks[l] = shuffle(DATA.cards.filter(c => c.level === l).flatMap(c => copies(c.id)));
  const market = {};
  for (const l of [1, 2, 3]) market[l] = Array.from({ length: S.display[l] }, () => decks[l].shift() ?? null);
  const nobles = shuffle(DATA.nobles.flatMap(nb => copies(nb.id))).slice(0, S.nobles);
  const bank = Object.fromEntries(ORES.map(o => [o, S.tokensPer]));
  bank.gold = S.gold;
  const first = Math.floor(Math.random() * n);
  const G = {
    v: 1, game: "lodestone", gameId: Math.random().toString(36).slice(2, 10), seq: 0,
    settings: { ...S }, players: players.map(p => ({ id: p.id, name: p.name })),
    first, turn: first, round: 1, turns: Object.fromEntries(players.map(p => [p.id, 0])),
    bank, decks, market, nobles,
    pl: Object.fromEntries(players.map(p => [p.id, { tokens: zero(), cards: [], reserved: [], nobles: [] }])),
    phase: "turn", pending: null, final: false, last: null, log: [], result: null,
  };
  log(G, `${G.players[first].name} goes first. ${S.twin ? "Twin-deck game: " : ""}${S.tokensPer} of each ore, ${S.nobles} nobles.`);
  return G;
}

const pidAt = (G, i) => G.players[i].id;
const nameOf = (G, pid) => G.players.find(p => p.id === pid)?.name || "?";
function log(G, m) { G.log.push(m); if (G.log.length > 60) G.log.shift(); }

export function bonuses(G, pid) {
  const b = Object.fromEntries(ORES.map(o => [o, 0]));
  for (const id of G.pl[pid].cards) b[cardOf(id).ore] += 1;
  return b;
}
export function points(G, pid) {
  const P = G.pl[pid];
  return P.cards.reduce((s, id) => s + cardOf(id).points, 0) + P.nobles.reduce((s, id) => s + nobleOf(id).points, 0);
}

// What buying `id` costs this player: { pay: {ore: n, gold: n}, ok }
export function payment(G, pid, id) {
  const c = cardOf(id), P = G.pl[pid], b = bonuses(G, pid);
  const pay = zero();
  let short = 0;
  for (const o of ORES) {
    const need = Math.max(0, (c.cost[o] || 0) - b[o]);
    const use = Math.min(need, P.tokens[o]);
    pay[o] = use; short += need - use;
  }
  pay.gold = short;
  return { pay, ok: short <= P.tokens.gold };
}

function slotOf(G, id) {
  for (const l of [1, 2, 3]) { const i = G.market[l].indexOf(id); if (i >= 0) return { l, i }; }
  return null;
}
function refill(G, l, i) { G.market[l][i] = G.decks[l].shift() ?? null; }

const colorsLeft = G => ORES.filter(o => G.bank[o] > 0);

export function hasMove(G, pid) {
  const P = G.pl[pid];
  if (colorsLeft(G).length) return true;
  if (P.reserved.length < 3 && ([1, 2, 3].some(l => G.decks[l].length) || [1, 2, 3].some(l => G.market[l].some(Boolean)))) return true;
  const visible = [1, 2, 3].flatMap(l => G.market[l]).filter(Boolean).concat(P.reserved.map(r => r.id));
  return visible.some(id => payment(G, pid, id).ok);
}

// ---------------------------------------------------------------- actions
export function act(G, pid, a) {
  const fn = ACTIONS[a?.type];
  if (!fn) throw new Error("Unknown action.");
  fn(G, pid, a);
  G.seq += 1;
  return G;
}
function need(c, m) { if (!c) throw new Error(m); }
function myTurn(G, pid) { need(G.phase === "turn" && pidAt(G, G.turn) === pid, "It isn't your turn."); }

const ACTIONS = {
  take(G, pid, a) {
    myTurn(G, pid);
    const ores = Array.isArray(a.ores) ? a.ores : [];
    need(ores.length && ores.every(o => ORES.includes(o)), "Pick ores from the bank (gold only comes with a reservation).");
    const P = G.pl[pid];
    const distinct = new Set(ores).size;
    if (ores.length === 2 && distinct === 1) {
      need(G.bank[ores[0]] >= 4, `You can only take 2 ${ORE_NAME[ores[0]]} when at least 4 are in the bank.`);
    } else {
      need(distinct === ores.length, "Take 3 different ores, or 2 of the same.");
      const want = Math.min(3, colorsLeft(G).length);
      need(ores.length === want, want === 3 ? "Take 3 ores of different colours." : `Only ${want} colour${want > 1 ? "s are" : " is"} left: take one of each.`);
      need(ores.every(o => G.bank[o] > 0), "That ore has run out.");
    }
    for (const o of ores) { G.bank[o] -= 1; P.tokens[o] += 1; }
    G.last = { pid, type: "take", ores };
    log(G, `${nameOf(G, pid)} takes ${ores.map(o => ORE_NAME[o]).join(", ")}.`);
    afterAction(G, pid);
  },

  reserve(G, pid, a) {
    myTurn(G, pid);
    const P = G.pl[pid];
    need(P.reserved.length < 3, "You already have 3 reserved cards. Buy one to reserve again.");
    let id, hidden = false, level;
    if (a.level) {
      level = +a.level;
      need([1, 2, 3].includes(level) && G.decks[level].length, "That deck is empty.");
      id = G.decks[level].shift(); hidden = true;
    } else {
      const s = slotOf(G, a.id);
      need(s, "That card isn't on the table.");
      id = a.id; level = s.l; refill(G, s.l, s.i);
    }
    P.reserved.push({ id, hidden });
    const gold = G.bank.gold > 0;
    if (gold) { G.bank.gold -= 1; P.tokens.gold += 1; }
    G.last = { pid, type: "reserve", id: hidden ? null : id, level, gold };
    log(G, `${nameOf(G, pid)} reserves ${hidden ? `the top level-${level} card` : `"${cardOf(id).scene}"`}${gold ? " and takes a Gold" : ""}.`);
    afterAction(G, pid);
  },

  buy(G, pid, a) {
    myTurn(G, pid);
    const P = G.pl[pid];
    const ri = P.reserved.findIndex(r => r.id === a.id);
    const s = ri < 0 ? slotOf(G, a.id) : null;
    need(ri >= 0 || s, "You can buy a card on the table or one you reserved.");
    const { pay, ok } = payment(G, pid, a.id);
    need(ok, "You can't afford that card yet.");
    for (const o of ALL) { P.tokens[o] -= pay[o]; G.bank[o] += pay[o]; }
    if (ri >= 0) P.reserved.splice(ri, 1); else refill(G, s.l, s.i);
    P.cards.push(a.id);
    const c = cardOf(a.id);
    G.last = { pid, type: "buy", id: a.id, from: ri >= 0 ? "reserved" : "table", pay };
    log(G, `${nameOf(G, pid)} builds "${c.scene}" (+1 ${ORE_NAME[c.ore]}${c.points ? `, ${c.points} pt${c.points > 1 ? "s" : ""}` : ""}).`);
    afterAction(G, pid);
  },

  discard(G, pid, a) {
    need(G.phase === "discard" && G.pending.pid === pid, "Nothing to return.");
    const P = G.pl[pid], back = a.tokens || {};
    need(ALL.every(o => (back[o] || 0) >= 0 && (back[o] || 0) <= P.tokens[o]), "You can only return tokens you have.");
    need(sum(back) === G.pending.n, `Return exactly ${G.pending.n} token${G.pending.n > 1 ? "s" : ""}.`);
    for (const o of ALL) { const k = back[o] || 0; P.tokens[o] -= k; G.bank[o] += k; }
    log(G, `${nameOf(G, pid)} returns ${G.pending.n} token${G.pending.n > 1 ? "s" : ""} to stay at 10.`);
    G.phase = "turn"; G.pending = null;
    checkNobles(G, pid);
  },

  noble(G, pid, a) {
    need(G.phase === "noble" && G.pending.pid === pid, "No noble to choose.");
    need(G.pending.options.includes(a.id), "That noble can't visit you.");
    award(G, pid, a.id);
    G.phase = "turn"; G.pending = null;
    endTurn(G, pid);
  },

  pass(G, pid) {
    myTurn(G, pid);
    need(!hasMove(G, pid), "You still have a move: take ores, reserve or buy.");
    G.last = { pid, type: "pass" };
    log(G, `${nameOf(G, pid)} has no possible move and passes.`);
    endTurn(G, pid);
  },
};

function afterAction(G, pid) {
  const over = sum(G.pl[pid].tokens) - 10;
  if (over > 0) { G.phase = "discard"; G.pending = { type: "discard", pid, n: over }; return; }
  checkNobles(G, pid);
}

function checkNobles(G, pid) {
  const b = bonuses(G, pid);
  const options = G.nobles.filter(id => Object.entries(nobleOf(id).req).every(([o, n]) => b[o] >= n));
  if (options.length === 1) award(G, pid, options[0]);
  if (options.length > 1) { G.phase = "noble"; G.pending = { type: "noble", pid, options }; return; }
  endTurn(G, pid);
}

function award(G, pid, id) {
  G.nobles.splice(G.nobles.indexOf(id), 1);
  G.pl[pid].nobles.push(id);
  G.last = { ...(G.last || {}), pid, noble: id };
  log(G, `${nobleOf(id).name}, ${nobleOf(id).title}, visits ${nameOf(G, pid)} (+3).`);
}

function endTurn(G, pid) {
  G.turns[pid] += 1;
  if (!G.final && points(G, pid) >= G.settings.target) {
    G.final = true;
    log(G, `${nameOf(G, pid)} reaches ${points(G, pid)} points: this is the final round.`);
  }
  // With one deck at 5–6 players the cards can run out. Once a deck is empty, if six whole rounds go by with nobody
  // building or reserving anything, nobody can make progress: the game ends and the highest score wins.
  G.idle = ["buy", "reserve"].includes(G.last?.type) ? 0 : (G.idle || 0) + 1;
  const next = (G.turn + 1) % G.players.length;
  if (!G.final && G.idle >= 6 * G.players.length && next === G.first && [1, 2, 3].some(l => !G.decks[l].length)) {
    log(G, "The cards have run out and nobody has built anything for six rounds: the game ends here.");
    G.stalled = true;
    return finish(G);
  }
  if (G.final && next === G.first) return finish(G);
  if (next === G.first) G.round += 1;
  G.turn = next; G.phase = "turn"; G.pending = null;
}

function finish(G) {
  const rows = G.players.map(p => ({ pid: p.id, points: points(G, p.id), cards: G.pl[p.id].cards.length }));
  rows.sort((a, b) => b.points - a.points || a.cards - b.cards);
  const best = rows[0];
  const winners = rows.filter(r => r.points === best.points && r.cards === best.cards).map(r => r.pid);
  G.result = { rows, winners };
  G.phase = "gameOver"; G.pending = null;
  log(G, `Game over. ${winners.map(w => nameOf(G, w)).join(" and ")} win${winners.length > 1 ? "" : "s"}!`);
}

// ---------------------------------------------------------------- host helpers
export function waitingOn(G) {
  if (G.phase === "turn") return [pidAt(G, G.turn)];
  if (G.phase === "discard" || G.phase === "noble") return [G.pending.pid];
  return [];
}

export function autoAction(G, pid, rnd = Math.random) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  const P = G.pl[pid];
  if (G.phase === "discard") {
    const back = {}; let n = G.pending.n;
    while (n > 0) { const o = pick(ALL.filter(x => P.tokens[x] - (back[x] || 0) > 0)); back[o] = (back[o] || 0) + 1; n--; }
    return { type: "discard", tokens: back };
  }
  if (G.phase === "noble") return { type: "noble", id: pick(G.pending.options) };
  const visible = [1, 2, 3].flatMap(l => G.market[l]).filter(Boolean).concat(P.reserved.map(r => r.id));
  const buyable = visible.filter(id => payment(G, pid, id).ok);
  if (buyable.length) return { type: "buy", id: buyable.sort((a, b) => cardOf(b).points - cardOf(a).points || rnd() - 0.5)[0] };
  // Aim at the visible card we're closest to affording, and collect what it still needs.
  const b = bonuses(G, pid);
  const short = id => { const c = cardOf(id); return ORES.reduce((s, o) => s + Math.max(0, (c.cost[o] || 0) - b[o] - P.tokens[o]), 0) - P.tokens.gold; };
  const target = visible.slice().sort((x, y) => short(x) - short(y) || cardOf(y).points - cardOf(x).points)[0];
  const left = colorsLeft(G);
  const held = sum(P.tokens);
  if (target && held < 9) {
    const c = cardOf(target);
    const needs = ORES.filter(o => (c.cost[o] || 0) - b[o] - P.tokens[o] > 0 && G.bank[o] > 0);
    const big = needs.find(o => (c.cost[o] || 0) - b[o] - P.tokens[o] >= 2 && G.bank[o] >= 4);
    if (big && (needs.length < 3 || rnd() < 0.3)) return { type: "take", ores: [big, big] };
    if (left.length) {
      const want = Math.min(3, left.length);
      const pickOres = [...needs, ...shuffle(left.filter(o => !needs.includes(o)))].slice(0, want);
      return { type: "take", ores: pickOres };
    }
  }
  if (P.reserved.length < 3 && (held >= 9 || !left.length || rnd() < 0.1)) {
    const onTable = [1, 2, 3].flatMap(l => G.market[l]).filter(Boolean);
    if (onTable.length) return { type: "reserve", id: onTable.sort((x, y) => short(x) - short(y))[0] };
    const decks = [1, 2, 3].filter(l => G.decks[l].length);
    if (decks.length) return { type: "reserve", level: pick(decks) };
  }
  if (left.length) return { type: "take", ores: shuffle(left.slice()).slice(0, Math.min(3, left.length)) };
  return { type: "pass" };
}

// What one player sees: decks are counts; other players' blind reservations are hidden.
export function viewFor(G, pid) {
  const me = G.players.findIndex(p => p.id === pid);
  const visible = [1, 2, 3].flatMap(l => G.market[l]).filter(Boolean).concat((G.pl[pid]?.reserved || []).map(r => r.id));
  return {
    game: "lodestone", seq: G.seq, gameId: G.gameId, me, phase: G.phase, round: G.round, turn: G.turn, first: G.first, final: G.final,
    settings: G.settings, bank: G.bank, market: G.market, nobles: G.nobles,
    decks: { 1: G.decks[1].length, 2: G.decks[2].length, 3: G.decks[3].length },
    players: G.players.map(p => {
      const P = G.pl[p.id];
      return {
        id: p.id, name: p.name, tokens: P.tokens, bonuses: bonuses(G, p.id), points: points(G, p.id), total: points(G, p.id),
        cards: P.cards, nobles: P.nobles,
        reserved: P.reserved.map(r => (p.id === pid || !r.hidden ? { id: r.id, hidden: r.hidden } : { hidden: true, level: cardOf(r.id).level })),
      };
    }),
    pay: pid && G.pl[pid] ? Object.fromEntries(visible.map(id => [id, payment(G, pid, id)])) : {},
    canPass: G.phase === "turn" && pidAt(G, G.turn) === pid && !hasMove(G, pid),
    pending: G.pending, waiting: waitingOn(G), last: G.last, result: G.result, log: G.log.slice(-14),
    scores: [],
  };
}
export const smartAction = autoAction;
