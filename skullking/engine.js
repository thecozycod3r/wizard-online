// Skull King (Grandpa Beck's Games) — pure rules engine. No DOM, no network.
// newGame(players, {rounds}) · act(G, pid, a) · viewFor · waitingOn · autoAction · smartAction · timerKey · pause
// Actions: {type:"bid", n} (everyone at once) · {type:"play", card, as?} (as = "pirate" | "escape" for the Tigress) · {type:"next"}.

export const MIN_PLAYERS = 2, MAX_PLAYERS = 8;
export const SUITS = ["g", "y", "p", "k"];   // parrot (green), treasure chest (yellow), pirate map (purple), Jolly Roger (black, trump)
export const SUIT_NAME = { g: "Parrot", y: "Chest", p: "Map", k: "Jolly Roger" };
export const PIRATES = ["pir-1", "pir-2", "pir-3", "pir-4", "pir-5"];
export const PIRATE_NAME = { "pir-1": "Rosie D'Laney", "pir-2": "Bendt the Bandit", "pir-3": "Rascal of Roatan", "pir-4": "Juanita Jade", "pir-5": "Harry the Giant" };
export function deck() {
  const ids = [];
  for (const s of SUITS) for (let r = 1; r <= 14; r++) ids.push(`${s}-${String(r).padStart(2, "0")}`);
  ids.push(...PIRATES, "sk", "mer-1", "mer-2", "esc-1", "esc-2", "esc-3", "esc-4", "esc-5", "tig");
  return ids;
}
export const DECK_SIZE = 70;
export const roundsFor = n => Math.min(10, Math.floor(DECK_SIZE / n));
// what a card is: kind = suit | pirate | king | mermaid | escape | tigress
export function cardOf(id) {
  if (/^[gypk]-\d\d$/.test(id)) return { kind: "suit", suit: id[0], rank: +id.slice(2) };
  if (id.startsWith("pir")) return { kind: "pirate" };
  if (id === "sk") return { kind: "king" };
  if (id.startsWith("mer")) return { kind: "mermaid" };
  if (id.startsWith("esc")) return { kind: "escape" };
  return { kind: "tigress" };
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// a play as it counts in the trick (the Tigress becomes a pirate or an escape)
const eff = p => (p.id === "tig" ? { kind: p.as === "pirate" ? "pirate" : "escape" } : cardOf(p.id));

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Skull King needs 2 to 8 players.");
  const most = roundsFor(n);
  const G = {
    v: 1, game: "skullking", gameId: Math.random().toString(36).slice(2, 10), seq: 0, n: 0,
    players: players.map(p => ({ id: p.id, name: p.name })),
    totalRounds: Math.min(+settings.rounds || most, most),
    score: Object.fromEntries(players.map(p => [p.id, 0])), round: 0, dealer: Math.floor(Math.random() * n), history: [], result: null,
  };
  deal(G);
  return G;
}
function deal(G) {
  const n = G.players.length;
  G.round++; G.dealer = (G.dealer + 1) % n; G.phase = "bid"; G.seq++;
  const d = shuffle(deck());
  G.hands = Object.fromEntries(G.players.map(p => [p.id, d.splice(0, G.round)]));
  G.bids = {}; G.won = Object.fromEntries(G.players.map(p => [p.id, 0])); G.bonus = Object.fromEntries(G.players.map(p => [p.id, 0]));
  G.leader = (G.dealer + 1) % n; G.turn = G.leader; G.trick = []; G.trickNo = 0;
  G.last = { n: ++G.n, kind: "deal", round: G.round };
}
const pidAt = (G, i) => G.players[i % G.players.length].id;

export function waitingOn(G) {
  if (G.phase === "bid") return G.players.map(p => p.id).filter(id => !(id in G.bids));
  if (G.phase === "play") return [pidAt(G, G.turn)];
  return [];
}
export const timerKey = G => `${G.round}.${G.phase}.${G.trickNo}.${G.trick.length}`;
export const pause = G => (G.phase === "trickDone" ? { ms: 1800, action: { type: "next" } } : G.phase === "roundOver" ? { ms: 5500, action: { type: "next" } } : null);

// the suit to follow: the first suit card played, unless a character (pirate, Skull King, mermaid, Tigress-as-pirate) led
export function leadSuit(trick) {
  for (const p of trick) {
    const e = eff(p);
    if (e.kind === "suit") return e.suit;
    if (e.kind !== "escape") return null;
  }
  return null;
}
export function legal(G, pid) {
  const h = G.hands[pid] || [], ls = leadSuit(G.trick);
  if (!ls || !h.some(id => cardOf(id).kind === "suit" && cardOf(id).suit === ls)) return h.slice();
  return h.filter(id => { const c = cardOf(id); return c.kind !== "suit" || c.suit === ls; });
}
// index (in the trick) of the winning play
export function winner(trick) {
  const e = trick.map(eff), first = k => e.findIndex(x => x.kind === k);
  const king = first("king"), mer = first("mermaid"), pir = first("pirate");
  if (king >= 0 && mer >= 0) return mer;            // the mermaid captures the Skull King
  if (king >= 0) return king;
  if (pir >= 0) return pir;
  if (mer >= 0) return mer;
  const best = suit => { let b = -1; e.forEach((x, i) => { if (x.kind === "suit" && x.suit === suit && (b < 0 || x.rank > e[b].rank)) b = i; }); return b; };
  const trump = best("k"); if (trump >= 0) return trump;
  const ls = leadSuit(trick); if (ls) return best(ls);
  return 0;                                         // all escapes: the first one wins
}
// bonus points the trick's winner earns (only kept if their bid is made)
export function trickBonus(trick, w) {
  const e = trick.map(eff), win = e[w];
  let b = 0;
  trick.forEach((p, i) => { const c = cardOf(p.id); if (c.kind === "suit" && c.rank === 14) b += c.suit === "k" ? 20 : 10; void i; });
  if (win.kind === "pirate") b += 20 * e.filter(x => x.kind === "mermaid").length;
  if (win.kind === "king") b += 30 * e.filter(x => x.kind === "pirate").length;
  if (win.kind === "mermaid" && e.some(x => x.kind === "king")) b += 40;
  return b;
}
export function roundPoints(bid, won, bonus, round) {
  if (bid === 0) return won === 0 ? 10 * round : -10 * round;
  return won === bid ? 20 * bid + bonus : -10 * Math.abs(won - bid);
}

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!G.hands[pid]) throw new Error("You're not in this game.");
  if (a.type === "next") {
    if (G.phase === "trickDone") { G.trick = []; G.phase = "play"; G.turn = G.leader; G.seq++; return G; }
    if (G.phase === "roundOver") { deal(G); return G; }
    throw new Error("Nothing to move on to.");
  }
  if (a.type === "bid") {
    if (G.phase !== "bid") throw new Error("Bidding is over.");
    if (pid in G.bids) throw new Error("You've already bid.");
    const n = Math.floor(+a.n);
    if (!(n >= 0 && n <= G.round)) throw new Error(`Bid 0 to ${G.round}.`);
    G.bids[pid] = n; G.seq++;
    if (!waitingOn(G).length) { G.phase = "play"; G.last = { n: ++G.n, kind: "bids", bids: { ...G.bids } }; }
    return G;
  }
  if (a.type === "play") {
    if (G.phase !== "play" || pidAt(G, G.turn) !== pid) throw new Error("It's not your turn.");
    if (!legal(G, pid).includes(a.card)) throw new Error("You must follow suit.");
    if (a.card === "tig" && a.as !== "pirate" && a.as !== "escape") throw new Error("Play the Tigress as a pirate or an escape.");
    const h = G.hands[pid]; h.splice(h.indexOf(a.card), 1);
    G.trick.push({ pid, id: a.card, ...(a.card === "tig" ? { as: a.as } : {}) });
    G.seq++;
    if (G.trick.length < G.players.length) { G.turn = (G.turn + 1) % G.players.length; G.last = { n: ++G.n, kind: "play", pid, card: a.card, as: a.as }; return G; }
    const w = winner(G.trick), wp = G.trick[w].pid, bonus = trickBonus(G.trick, w);
    G.won[wp]++; G.bonus[wp] += bonus; G.trickNo++;
    G.leader = G.players.findIndex(p => p.id === wp);
    G.last = { n: ++G.n, kind: "trick", pid, card: a.card, as: a.as, trick: G.trick.map(p => ({ ...p })), winner: wp, bonus };
    if (G.hands[pid].length === 0) return endRound(G);
    G.phase = "trickDone";
    return G;
  }
  throw new Error("Unknown action.");
}
function endRound(G) {
  const pts = {};
  for (const p of G.players) { pts[p.id] = roundPoints(G.bids[p.id], G.won[p.id], G.bonus[p.id], G.round); G.score[p.id] += pts[p.id]; }
  G.history.push({ round: G.round, bids: { ...G.bids }, won: { ...G.won }, bonus: { ...G.bonus }, pts });
  G.last.roundEnd = { pts, bids: { ...G.bids }, won: { ...G.won } };
  if (G.round >= G.totalRounds) {
    G.phase = "gameOver";
    const rows = G.players.map(p => ({ pid: p.id, points: G.score[p.id] })).sort((a, b) => b.points - a.points);
    G.result = { rows, winners: rows.filter(r => r.points === rows[0].points).map(r => r.pid) };
  } else G.phase = "roundOver";
  return G;
}

export function viewFor(G, pid) {
  const bidding = G.phase === "bid";
  return {
    game: "skullking", gameId: G.gameId, seq: G.seq, phase: G.phase, round: G.round, totalRounds: G.totalRounds,
    me: G.players.findIndex(p => p.id === pid), waiting: waitingOn(G), turn: pidAt(G, G.turn), leader: pidAt(G, G.leader),
    hand: (G.hands[pid] || []).slice(), legal: G.phase === "play" && pidAt(G, G.turn) === pid ? legal(G, pid) : [],
    trick: G.trick.map(p => ({ ...p })), lead: leadSuit(G.trick), myBid: G.bids[pid] ?? null,
    players: G.players.map(p => ({ id: p.id, name: p.name, score: G.score[p.id], won: G.won[p.id], cards: G.hands[p.id].length,
      bid: bidding ? null : G.bids[p.id] ?? null, hasBid: p.id in G.bids })),
    last: G.last ? structuredClone(G.last) : null, result: G.result ? structuredClone(G.result) : null, history: structuredClone(G.history),
  };
}

// ---------------------------------------------------------------- automatic play
function strength(id) {
  const c = cardOf(id);
  if (c.kind === "king") return 0.95; if (c.kind === "pirate") return 0.8; if (c.kind === "tigress") return 0.7; if (c.kind === "mermaid") return 0.55;
  if (c.kind === "escape") return 0;
  if (c.suit === "k") return 0.25 + c.rank * 0.045;
  return c.rank >= 13 ? 0.45 : c.rank >= 11 ? 0.25 : 0.05;
}
export function autoAction(G, pid) {
  if (G.phase === "trickDone" || G.phase === "roundOver") return { type: "next" };
  if (!waitingOn(G).includes(pid)) return null;
  if (G.phase === "bid") return { type: "bid", n: Math.floor(Math.random() * (G.round + 1)) };
  const l = legal(G, pid), card = l[Math.floor(Math.random() * l.length)];
  return { type: "play", card, ...(card === "tig" ? { as: Math.random() < .5 ? "pirate" : "escape" } : {}) };
}
export function smartAction(G, pid) {
  if (G.phase === "trickDone" || G.phase === "roundOver") return { type: "next" };
  if (!waitingOn(G).includes(pid)) return null;
  if (G.phase === "bid") {
    const est = G.hands[pid].reduce((s, id) => s + strength(id), 0) * (G.players.length <= 3 ? 1.1 : 0.9);
    return { type: "bid", n: Math.max(0, Math.min(G.round, Math.round(est))) };
  }
  const l = legal(G, pid), need = G.bids[pid] - G.won[pid];
  const byS = l.slice().sort((a, b) => strength(a) - strength(b));
  // would this card take the trick as it stands?
  const wins = id => { const t = [...G.trick, { pid, id, as: "pirate" }]; return winner(t) === t.length - 1; };
  let card;
  if (need > 0) card = byS.filter(wins)[0] || byS[0];                 // cheapest card that wins, else dump the weakest
  else card = byS.slice().reverse().find(id => !wins(id)) || byS[0];  // keep losing: the strongest card that still loses
  return { type: "play", card, ...(card === "tig" ? { as: need > 0 ? "pirate" : "escape" } : {}) };
}
