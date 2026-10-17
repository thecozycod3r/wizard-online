// Seven Marvels rules engine: 7 Wonders base-game rules (Repos Production, 2010) with an original theme.
// Pure state machine run by whichever device runs the table. act(G, pid, action) mutates G or throws Error(message).
//
// Phases: "pick" (everyone chooses a card at once; the turn resolves when the last pick is in)
//         "extra" (Hanging Terraces B: play the 7th card of the Age) · "salvage" (Royal Tomb: build one discarded card free)
//         "gameOver".

import { DATA } from "./data.js";

export const RAW = DATA.raw, GOODS = DATA.goods, RES = [...RAW, ...GOODS], RES_NAME = DATA.resName;
export const SCI = ["compass", "gear", "tablet"];
const CARD = Object.fromEntries(DATA.cards.map(c => [c.id, c]));
const MARVEL = Object.fromEntries(DATA.marvels.map(m => [m.id, m]));
export const cardOf = inst => CARD[inst.split("~")[0]];
export const marvelOf = id => MARVEL[id];
export const MIN_PLAYERS = 3, MAX_PLAYERS = 7;
export const AGE_WIN = { 1: 1, 2: 3, 3: 5 };

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const nameOf = (G, pid) => G.players.find(p => p.id === pid)?.name || "?";
function log(G, m) { G.log.push(m); if (G.log.length > 80) G.log.shift(); }

// ---------------------------------------------------------------- seats
const idx = (G, pid) => G.players.findIndex(p => p.id === pid);
export const leftOf = (G, pid) => G.players[(idx(G, pid) - 1 + G.players.length) % G.players.length].id;
export const rightOf = (G, pid) => G.players[(idx(G, pid) + 1) % G.players.length].id;
const sideOf = (G, pid, side) => (side === "left" ? leftOf(G, pid) : side === "right" ? rightOf(G, pid) : pid);
// Age I and III pass to the left neighbour, Age II to the right.
export const passTo = (G, pid) => (G.age === 2 ? rightOf(G, pid) : leftOf(G, pid));

// ---------------------------------------------------------------- setup
export function setupFor(n) { return { players: n, cardsPerAge: 7 * n, guilds: n + 2 }; }

function dealAge(G) {
  const n = G.players.length, deck = [];
  for (const c of DATA.cards) for (const t of c.ages[G.age] || []) if (t <= n) deck.push(`${c.id}~${G.age}${t}`);
  if (G.age === 3) deck.push(...shuffle(DATA.cards.filter(c => c.color === "purple")).slice(0, n + 2).map(c => `${c.id}~3g`));
  shuffle(deck);
  G.players.forEach((p, i) => { G.hands[p.id] = deck.slice(i * 7, i * 7 + 7); });
  G.turn = 1; G.phase = "pick";
  G.picks = Object.fromEntries(G.players.map(p => [p.id, null]));
  log(G, `Age ${["I", "II", "III"][G.age - 1]} begins. Hands pass to the ${G.age === 2 ? "right" : "left"}.`);
}

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Seven Marvels needs 3 to 7 players.");
  const ms = shuffle(DATA.marvels.map(m => m.id));
  const side = () => (settings.side === "B" ? "B" : settings.side === "random" ? (Math.random() < .5 ? "A" : "B") : "A");
  const G = {
    v: 1, game: "marvels", gameId: Math.random().toString(36).slice(2, 10), seq: 0,
    settings: { side: settings.side || "A" }, players: players.map(p => ({ id: p.id, name: p.name })),
    age: 1, turn: 1, phase: "pick", hands: {}, picks: {}, queue: [], discard: [],
    pl: Object.fromEntries(players.map((p, i) => [p.id, { marvel: ms[i], side: side(), built: [], stages: [], coins: 3, tokens: [], freeUsed: 0 }])),
    last: null, log: [], result: null,
  };
  dealAge(G);
  return G;
}

// ---------------------------------------------------------------- what a city has
const board = (G, pid) => { const P = G.pl[pid]; return marvelOf(P.marvel)[P.side]; };
const builtStages = (G, pid) => board(G, pid).slice(0, G.pl[pid].stages.length);
const hasPower = (G, pid, pw) => builtStages(G, pid).some(s => s.power === pw);
const builtCards = (G, pid) => G.pl[pid].built.map(cardOf);
const hasBuilt = (G, pid, id) => G.pl[pid].built.some(b => b.split("~")[0] === id);
export const countColor = (G, pid, color) => builtCards(G, pid).filter(c => c.color === color).length;

// Production units: each unit is a list of resources it can be. forTrade=true lists only what neighbours may buy.
export function production(G, pid, forTrade = false) {
  const P = G.pl[pid], units = [[marvelOf(P.marvel).res]];
  for (const c of builtCards(G, pid)) {
    if (!c.produce) continue;
    if (forTrade && c.private) continue;
    units.push(...c.produce);
  }
  if (!forTrade) {
    if (hasPower(G, pid, "anyRaw")) units.push([...RAW]);
    if (hasPower(G, pid, "anyGoods")) units.push([...GOODS]);
  }
  return units;
}

export function shields(G, pid) {
  return builtCards(G, pid).reduce((s, c) => s + (c.shields || 0), 0) + builtStages(G, pid).reduce((s, st) => s + (st.shields || 0), 0);
}

// Price of one resource bought from a neighbour on `side`.
export function price(G, pid, side, res) {
  const cards = builtCards(G, pid);
  if (RAW.includes(res)) {
    if (hasPower(G, pid, "tradeRaw") || cards.some(c => c.trade?.raw?.includes(side))) return 1;
  } else if (cards.some(c => c.trade?.goods?.includes(side))) return 1;
  return 2;
}

// Cheapest way to pay `cost`: { ok, coins (to the bank), left, right, total, missing[] }.
export function payPlan(G, pid, cost) {
  const P = G.pl[pid], bank = cost.coins || 0;
  const need = RES.flatMap(r => Array(cost[r] || 0).fill(r));
  if (!need.length) return { ok: P.coins >= bank, coins: bank, left: 0, right: 0, total: bank, missing: P.coins >= bank ? [] : ["coins"] };
  const own = production(G, pid).map(u => ({ u, used: false }));
  const nb = ["left", "right"].map(side => ({ side, units: production(G, sideOf(G, pid, side), true).map(u => ({ u, used: false })) }));
  let best = null;
  const spend = { left: 0, right: 0 };
  const budget = P.coins - bank;
  // Rarest needs first so the search fails fast.
  need.sort((a, b) => own.filter(o => o.u.includes(a)).length - own.filter(o => o.u.includes(b)).length);
  (function dfs(i, cost) {
    if (best && cost >= best.cost) return;
    if (cost > budget) return;
    if (i === need.length) { best = { cost, left: spend.left, right: spend.right }; return; }
    const r = need[i];
    const tried = new Set();
    for (const o of own) {
      if (o.used || !o.u.includes(r)) continue;
      const sig = o.u.join(); if (tried.has(sig)) continue; tried.add(sig);
      o.used = true; dfs(i + 1, cost); o.used = false;
      if (best && best.cost === 0) return;
    }
    for (const n of nb) {
      const p = price(G, pid, n.side, r), tried2 = new Set();
      for (const o of n.units) {
        if (o.used || !o.u.includes(r)) continue;
        const sig = o.u.join(); if (tried2.has(sig)) continue; tried2.add(sig);
        o.used = true; spend[n.side] += p; dfs(i + 1, cost + p); spend[n.side] -= p; o.used = false;
      }
    }
  })(0, 0);
  if (!best) {
    // What's missing even with every neighbour's help (ignoring coins)?
    const all = [...production(G, pid), ...nb.flatMap(n => n.units.map(o => o.u))].map(u => ({ u, used: false }));
    const missing = [];
    for (const r of need) { const o = all.find(x => !x.used && x.u.includes(r)); if (o) o.used = true; else missing.push(r); }
    return { ok: false, coins: bank, left: 0, right: 0, total: 0, missing: missing.length ? missing : ["coins"] };
  }
  return { ok: true, coins: bank, left: best.left, right: best.right, total: bank + best.left + best.right, missing: [] };
}

// Every way this player could use `inst` right now.
export function options(G, pid, inst) {
  const c = cardOf(inst), P = G.pl[pid], out = { sell: true };
  if (hasBuilt(G, pid, c.id)) out.build = { ok: false, why: "You already have this building." };
  else if (c.chain.some(x => hasBuilt(G, pid, x))) out.build = { ok: true, chain: true, coins: 0, left: 0, right: 0, total: 0 };
  else out.build = payPlan(G, pid, c.cost);
  const st = board(G, pid)[P.stages.length];
  out.stage = st ? { ...payPlan(G, pid, st.cost), n: P.stages.length + 1 } : { ok: false, why: "Your Marvel is complete." };
  out.free = hasPower(G, pid, "freeBuild") && P.freeUsed < G.age && !hasBuilt(G, pid, c.id) && !out.build.chain && !(out.build.ok && out.build.total === 0);
  return out;
}

// ---------------------------------------------------------------- acting
export function waitingOn(G) {
  if (G.phase === "pick") return G.players.filter(p => !G.picks[p.id]).map(p => p.id);
  if (G.phase === "extra" || G.phase === "salvage") return G.queue.length ? [G.queue[0].pid] : [];
  return [];
}
export const timerKey = G => `${G.age}.${G.turn}.${G.phase}.${G.queue[0]?.pid || ""}`;

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!G.pl[pid]) throw new Error("You're not in this game.");
  if (G.phase === "pick") {
    if (a.type === "unpick") { if (!G.picks[pid]) throw new Error("Nothing to take back."); G.picks[pid] = null; G.seq++; return G; }
    if (a.type !== "pick") throw new Error("Choose a card.");
    if (G.picks[pid] && G.picks[pid].card === a.card && G.picks[pid].how === a.how) throw new Error("Already chosen.");
    G.picks[pid] = checkPick(G, pid, a, G.hands[pid]);
    G.seq++;
    if (G.players.every(p => G.picks[p.id])) resolveTurn(G);
    return G;
  }
  if (!waitingOn(G).includes(pid)) throw new Error("Wait for your turn.");
  if (G.phase === "extra") {
    if (a.type !== "pick") throw new Error("Play your last card.");
    const pk = checkPick(G, pid, a, G.hands[pid]);
    G.last = { kind: "extra", plays: [play(G, pid, pk)] };
    payOut(G, [pk.pid]);
    G.hands[pid] = [];
    log(G, `${nameOf(G, pid)} plays the 7th card of the Age.`);
    G.queue.shift(); G.seq++; advance(G); return G;
  }
  if (G.phase === "salvage") {
    if (a.type !== "salvage") throw new Error("Pick a card from the discard pile, or skip.");
    if (a.card != null) {
      if (!G.discard.includes(a.card)) throw new Error("That card isn't in the discard pile.");
      if (hasBuilt(G, pid, cardOf(a.card).id)) throw new Error("You already have this building.");
      G.discard.splice(G.discard.indexOf(a.card), 1);
      G.pl[pid].built.push(a.card);
      immediate(G, pid, a.card);
      G.last = { kind: "salvage", plays: [{ pid, how: "build", card: a.card, coins: 0 }] };
      log(G, `${nameOf(G, pid)} rebuilds ${cardOf(a.card).name} from the discard pile.`);
    } else log(G, `${nameOf(G, pid)} takes nothing from the discard pile.`);
    G.queue.shift(); G.seq++; advance(G); return G;
  }
  throw new Error("Unknown action.");
}

function checkPick(G, pid, a, hand) {
  if (!hand?.includes(a.card)) throw new Error("That card isn't in your hand.");
  const o = options(G, pid, a.card);
  if (a.how === "sell") return { pid, card: a.card, how: "sell" };
  if (a.how === "build") { if (!o.build.ok) throw new Error(o.build.why || `You can't afford ${cardOf(a.card).name}.`); return { pid, card: a.card, how: "build", plan: o.build }; }
  if (a.how === "free") { if (!o.free) throw new Error("Your free build isn't available."); return { pid, card: a.card, how: "free" }; }
  if (a.how === "stage") { if (!o.stage.ok) throw new Error(o.stage.why || "You can't afford the next stage."); return { pid, card: a.card, how: "stage", plan: o.stage }; }
  throw new Error("Build, build a stage, or sell.");
}

// Apply one pick: pay, place the card. Coins earned from neighbours arrive in payOut, after everyone has paid.
function play(G, pid, pk) {
  const P = G.pl[pid], c = cardOf(pk.card), rec = { pid, how: pk.how, card: pk.how === "build" || pk.how === "free" ? pk.card : null, coins: 0 };
  G.hands[pid] = G.hands[pid].filter(x => x !== pk.card);
  if (pk.plan) {
    P.coins -= pk.plan.total; rec.coins -= pk.plan.total;
    G._credit ||= [];
    if (pk.plan.left) G._credit.push([leftOf(G, pid), pk.plan.left, pid]);
    if (pk.plan.right) G._credit.push([rightOf(G, pid), pk.plan.right, pid]);
    rec.paid = { left: pk.plan.left, right: pk.plan.right, bank: pk.plan.coins };
  }
  if (pk.how === "build" || pk.how === "free") {
    P.built.push(pk.card);
    if (pk.how === "free") P.freeUsed = G.age;
    log(G, `${nameOf(G, pid)} builds ${c.name}${pk.plan?.chain ? " (free by chain)" : pk.how === "free" ? " (free, Sky Father's power)" : ""}.`);
  } else if (pk.how === "stage") {
    P.stages.push(pk.card);
    const st = board(G, pid)[P.stages.length - 1];
    if (st.coins) { P.coins += st.coins; rec.coins += st.coins; }
    if (st.power === "salvage") G._salvage = [...(G._salvage || []), pid];
    rec.stage = P.stages.length;
    log(G, `${nameOf(G, pid)} builds stage ${P.stages.length} of ${marvelOf(P.marvel).name}.`);
  } else {
    G.discard.push(pk.card); P.coins += 3; rec.coins += 3;
    log(G, `${nameOf(G, pid)} sells a card for 3 coins.`);
  }
  return rec;
}

// Coins a card pays out the moment it's built (Inn, Olive Groves, Harbour…).
function immediate(G, pid, inst) {
  const c = cardOf(inst), P = G.pl[pid];
  let g = c.coins || 0;
  if (c.earn?.coins) g += c.earn.coins * earnCount(G, pid, c.earn);
  P.coins += g;
  return g;
}
function earnCount(G, pid, e) {
  if (e.stages) return e.who.reduce((s, w) => s + G.pl[sideOf(G, pid, w)].stages.length, 0);
  if (e.defeats) return e.who.reduce((s, w) => s + G.pl[sideOf(G, pid, w)].tokens.filter(t => t < 0).length, 0);
  return e.who.reduce((s, w) => s + e.colors.reduce((t, col) => t + countColor(G, sideOf(G, pid, w), col), 0), 0);
}
function payOut(G, pids) {
  for (const [to, n] of G._credit || []) G.pl[to].coins += n;
  G._credit = [];
  for (const pid of pids) {
    const r = G.last.plays.find(x => x.pid === pid);
    if (r?.card) r.coins += immediate(G, pid, r.card);
  }
  for (const pid of G._salvage || []) G.queue.push({ pid, kind: "salvage" });
  G._salvage = [];
}

function resolveTurn(G) {
  const picks = G.players.map(p => G.picks[p.id]);
  G.last = { kind: "turn", age: G.age, turn: G.turn, plays: picks.map(pk => play(G, pk.pid, pk)) };
  // Trade income is credited after everyone has paid.
  for (const [to, n, from] of G._credit || []) { const r = G.last.plays.find(x => x.pid === to); if (r) r.coins += n; void from; }
  payOut(G, picks.map(p => p.pid));
  G.picks = Object.fromEntries(G.players.map(p => [p.id, null]));
  if (G.turn < 6) {
    const next = {};
    for (const p of G.players) next[passTo(G, p.id)] = G.hands[p.id];
    G.hands = next; G.turn += 1;
  } else {
    // Turn 6: the 7th card is discarded, unless the Hanging Terraces (B) lets its owner play it.
    for (const p of G.players) {
      if (!G.hands[p.id]?.length) continue;
      if (hasPower(G, p.id, "seventh")) G.queue.unshift({ pid: p.id, kind: "extra" });
      else { G.discard.push(...G.hands[p.id]); G.hands[p.id] = []; }
    }
    G.ageDone = true;
  }
  G.seq++;
  advance(G);
}

// Run queued special steps, then Age end, then the next pick.
function advance(G) {
  while (G.queue.length) {
    const q = G.queue[0];
    if (q.kind === "extra" && G.hands[q.pid]?.length) { G.phase = "extra"; return; }
    if (q.kind === "salvage" && G.discard.some(d => !hasBuilt(G, q.pid, cardOf(d).id))) { G.phase = "salvage"; return; }
    G.queue.shift();
  }
  if (G.ageDone) {
    G.ageDone = false;
    battles(G);
    if (G.age === 3) return finish(G);
    G.age += 1; dealAge(G); return;
  }
  G.phase = "pick";
}

function battles(G) {
  const res = [];
  for (const p of G.players) {
    const me = shields(G, p.id);
    for (const side of ["left", "right"]) {
      const o = shields(G, sideOf(G, p.id, side));
      const t = me > o ? AGE_WIN[G.age] : me < o ? -1 : 0;
      if (t) G.pl[p.id].tokens.push(t);
      res.push({ pid: p.id, side, vs: sideOf(G, p.id, side), me, them: o, token: t });
    }
  }
  G.last = { ...(G.last || {}), battles: { age: G.age, res } };
  log(G, `Battles of Age ${["I", "II", "III"][G.age - 1]} are fought.`);
}

// ---------------------------------------------------------------- scoring
function scienceScore(c) { return SCI.reduce((s, k) => s + c[k] * c[k], 0) + 7 * Math.min(...SCI.map(k => c[k])); }
export function science(G, pid, copied) {
  const c = { compass: 0, gear: 0, tablet: 0 };
  for (const x of builtCards(G, pid)) if (x.science) c[x.science] += 1;
  let wild = builtStages(G, pid).filter(s => s.power === "science").length + builtCards(G, pid).filter(x => x.guild?.science).length + (copied?.guild?.science ? 1 : 0);
  let best = scienceScore(c);
  (function go(cc, w) {
    if (!w) { best = Math.max(best, scienceScore(cc)); return; }
    for (const k of SCI) go({ ...cc, [k]: cc[k] + 1 }, w - 1);
  })(c, wild);
  return { counts: c, wild, points: best };
}
function guildVp(G, pid, c) {
  const g = c.guild;
  if (!g || g.science) return 0;
  return g.vp * earnCount(G, pid, g);
}
export function score(G, pid) {
  const P = G.pl[pid], cards = builtCards(G, pid);
  let copy = null;
  if (hasPower(G, pid, "copyGuild")) {
    const mine = new Set(cards.map(c => c.id));
    const cand = [leftOf(G, pid), rightOf(G, pid)].flatMap(n => builtCards(G, n).filter(c => c.color === "purple" && !mine.has(c.id)));
    let bestV = -1;
    const base = science(G, pid).points;
    for (const c of cand) { const v = c.guild.science ? science(G, pid, c).points - base : guildVp(G, pid, c); if (v > bestV) { bestV = v; copy = c; } }
  }
  const sci = science(G, pid, copy);
  const r = {
    military: P.tokens.reduce((s, t) => s + t, 0),
    treasury: Math.floor(P.coins / 3),
    marvel: builtStages(G, pid).reduce((s, st) => s + (st.vp || 0), 0),
    civic: cards.reduce((s, c) => s + (c.vp || 0), 0),
    science: sci.points,
    commerce: cards.reduce((s, c) => s + (c.earn?.vp ? c.earn.vp * earnCount(G, pid, c.earn) : 0), 0),
    guilds: cards.reduce((s, c) => s + guildVp(G, pid, c), 0) + (copy && !copy.guild.science ? guildVp(G, pid, copy) : 0),
  };
  r.total = Object.values(r).reduce((a, b) => a + b, 0);
  r.copied = copy?.id || null;
  return r;
}

function finish(G) {
  const rows = G.players.map(p => ({ pid: p.id, ...score(G, p.id), coins: G.pl[p.id].coins }));
  rows.sort((a, b) => b.total - a.total || b.coins - a.coins);
  const top = rows[0];
  G.result = { rows, winners: rows.filter(r => r.total === top.total && r.coins === top.coins).map(r => r.pid) };
  G.phase = "gameOver";
  G.queue = [];
  log(G, `Game over. ${G.result.winners.map(w => nameOf(G, w)).join(" & ")} win${G.result.winners.length > 1 ? "" : "s"}.`);
}

// ---------------------------------------------------------------- what each player sees
export function viewFor(G, pid) {
  const v = {
    game: "marvels", gameId: G.gameId, seq: G.seq, phase: G.phase, age: G.age, turn: G.turn, settings: G.settings,
    me: idx(G, pid), waiting: waitingOn(G), discardCount: G.discard.length, log: G.log.slice(-20), result: G.result,
    passTo: G.pl[pid] ? passTo(G, pid) : null,
    players: G.players.map(p => {
      const P = G.pl[p.id], sc = score(G, p.id);
      return {
        id: p.id, name: p.name, marvel: P.marvel, side: P.side, stages: P.stages.length, built: P.built.slice(), coins: P.coins,
        tokens: P.tokens.slice(), shields: shields(G, p.id), picked: !!G.picks?.[p.id], handSize: G.hands[p.id]?.length || 0,
        produce: production(G, p.id), trade: production(G, p.id, true).length, science: science(G, p.id).counts, points: sc.total, score: sc,
        freeReady: hasPower(G, p.id, "freeBuild") && P.freeUsed < G.age,
      };
    }),
  };
  if (G.pl[pid]) {
    const P = G.pl[pid];
    v.hand = (G.hands[pid] || []).slice();
    v.pick = G.picks?.[pid] ? { card: G.picks[pid].card, how: G.picks[pid].how } : null;
    v.options = Object.fromEntries(v.hand.map(c => [c, options(G, pid, c)]));
    v.prices = Object.fromEntries(["left", "right"].map(s => [s, Object.fromEntries(RES.map(r => [r, price(G, pid, s, r)]))]));
    if (G.phase === "salvage" && waitingOn(G)[0] === pid) v.salvage = G.discard.filter(d => !hasBuilt(G, pid, cardOf(d).id));
    v.myStages = P.stages.slice();
  }
  // Only show what was publicly played: stages and sold cards stay face down.
  v.last = G.last ? structuredClone(G.last) : null;
  return v;
}

// ---------------------------------------------------------------- automatic play
// Random but legal: used for simulations.
export function autoAction(G, pid) {
  const w = waitingOn(G);
  if (!w.includes(pid)) return null;
  if (G.phase === "salvage") { const s = G.discard.filter(d => !hasBuilt(G, pid, cardOf(d).id)); return { type: "salvage", card: s.length ? s[Math.floor(Math.random() * s.length)] : null }; }
  const hand = shuffle(G.hands[pid].slice());
  for (const c of hand) {
    const o = options(G, pid, c), r = Math.random();
    if (o.free && r < .5) return { type: "pick", card: c, how: "free" };
    if (o.build.ok && r < .75) return { type: "pick", card: c, how: "build" };
    if (o.stage.ok && r < .35) return { type: "pick", card: c, how: "stage" };
  }
  return { type: "pick", card: hand[0], how: "sell" };
}

// A sensible move when a player's timer runs out: the card that's worth most to them right now.
export function smartAction(G, pid) {
  const w = waitingOn(G);
  if (!w.includes(pid)) return null;
  if (G.phase === "salvage") {
    const s = G.discard.filter(d => !hasBuilt(G, pid, cardOf(d).id));
    if (!s.length) return { type: "salvage", card: null };
    return { type: "salvage", card: s.sort((a, b) => worth(G, pid, b) - worth(G, pid, a))[0] };
  }
  const hand = G.hands[pid];
  let best = null;
  const consider = (a, v) => { if (!best || v > best.v) best = { a, v }; };
  const cheapest = hand.slice().sort((a, b) => worth(G, pid, a) - worth(G, pid, b))[0];
  for (const c of hand) {
    const o = options(G, pid, c), v = worth(G, pid, c);
    if (o.build.ok) consider({ type: "pick", card: c, how: "build" }, v - o.build.total / 3);
    if (o.free) consider({ type: "pick", card: c, how: "free" }, v + .5);
  }
  const o = options(G, pid, cheapest);
  if (o.stage.ok) {
    const st = board(G, pid)[G.pl[pid].stages.length];
    const sv = (st.vp || 0) + (st.coins || 0) / 3 + (st.shields || 0) * 1.5 + (st.power ? 4 : 0) - o.stage.total / 3;
    consider({ type: "pick", card: cheapest, how: "stage" }, sv);
  }
  consider({ type: "pick", card: cheapest, how: "sell" }, 1);
  return best.a;
}

// How much a structure is worth to this player now (rough victory-point estimate).
function worth(G, pid, inst) {
  const c = cardOf(inst), age = G.age, ageLeft = 3 - age;
  let v = 0;
  if (c.produce) {
    const have = new Set(production(G, pid).flat());
    const fresh = c.produce.flat().filter(r => !have.has(r)).length;
    v += (age === 1 ? 2 : age === 2 ? 1.2 : 0.2) * c.produce.length + fresh * (ageLeft ? 1 : 0.2);
  }
  if (c.vp) v += c.vp;
  if (c.coins) v += c.coins / 3;
  if (c.trade) v += ageLeft * 0.9;
  if (c.earn) { const n = earnCount(G, pid, c.earn); v += (c.earn.coins || 0) * n / 3 + (c.earn.vp || 0) * n; }
  if (c.shields) {
    const me = shields(G, pid), l = shields(G, leftOf(G, pid)), r = shields(G, rightOf(G, pid));
    for (const o of [l, r]) { if (me <= o && me + c.shields > o) v += AGE_WIN[age] + (me === o ? 0 : 1); else if (me + c.shields > o) v += 0.3; }
  }
  if (c.science) {
    const s = science(G, pid);
    const after = { ...s.counts, [c.science]: s.counts[c.science] + 1 };
    v += scienceScore(after) - scienceScore(s.counts) + ageLeft * 0.8;
  }
  if (c.guild) v += c.guild.science ? 5 : guildVp(G, pid, c);
  if (ageLeft && DATA.cards.some(x => x.chain.includes(c.id))) v += 1;
  return v;
}
