// 6 Nimmt! (Wolfgang Kramer, AMIGO) — pure rules engine. No DOM, no network.
// newGame(players, {target}) · act(G, pid, a) · viewFor · waitingOn · autoAction · smartAction · timerKey · pause
// Actions: {type:"pick", card} (everyone at once) · {type:"row", row} (the player whose card fits nowhere takes a row) · {type:"next"}.

export const MIN_PLAYERS = 2, MAX_PLAYERS = 10, ROW_MAX = 5, HAND = 10;
export const bulls = n => (n === 55 ? 7 : n % 11 === 0 ? 5 : n % 10 === 0 ? 3 : n % 5 === 0 ? 2 : 1);
export const rowBulls = row => row.reduce((s, c) => s + bulls(c), 0);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("6 Nimmt! needs 2 to 10 players.");
  const G = {
    v: 1, game: "nimmt", gameId: Math.random().toString(36).slice(2, 10), seq: 0, n: 0,
    players: players.map(p => ({ id: p.id, name: p.name })),
    target: settings.target === 0 ? 0 : (+settings.target || 66),
    score: Object.fromEntries(players.map(p => [p.id, 0])), round: 0, log: [], result: null,
  };
  deal(G);
  return G;
}

function deal(G) {
  G.round++; G.turn = 0; G.phase = "pick"; G.picks = {}; G.queue = []; G.chooser = null; G.taken = Object.fromEntries(G.players.map(p => [p.id, 0]));
  const deck = shuffle(Array.from({ length: 104 }, (_, i) => i + 1));
  G.hands = Object.fromEntries(G.players.map(p => [p.id, deck.splice(0, HAND).sort((a, b) => a - b)]));
  G.rows = [0, 1, 2, 3].map(() => [deck.pop()]).sort((a, b) => a[0] - b[0]);
  G.last = { n: ++G.n, kind: "deal", round: G.round };
  G.seq++;
}

export function waitingOn(G) {
  if (G.phase === "pick") return G.players.map(p => p.id).filter(id => !(id in G.picks));
  if (G.phase === "row") return [G.chooser];
  return [];
}
export const timerKey = G => `${G.round}.${G.turn}.${G.phase}`;
export const pause = G => (G.phase === "roundOver" ? { ms: 6500, action: { type: "next" } } : null);

// where a card goes: the row whose last card is the highest one still below it (-1 = fits nowhere)
export function rowFor(rows, card) {
  let best = -1;
  rows.forEach((r, i) => { const top = r[r.length - 1]; if (top < card && (best < 0 || top > rows[best][rows[best].length - 1])) best = i; });
  return best;
}

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!G.hands[pid]) throw new Error("You're not in this game.");
  if (a.type === "next") { if (G.phase !== "roundOver") throw new Error("The round isn't over."); deal(G); return G; }
  if (a.type === "pick") {
    if (G.phase !== "pick") throw new Error("Wait for the cards to be placed.");
    if (pid in G.picks) throw new Error("You've already picked.");
    if (!G.hands[pid].includes(a.card)) throw new Error("That card isn't in your hand.");
    G.picks[pid] = a.card; G.seq++;
    if (!waitingOn(G).length) reveal(G);
    return G;
  }
  if (a.type === "row") {
    if (G.phase !== "row" || G.chooser !== pid) throw new Error("It's not your row to take.");
    if (![0, 1, 2, 3].includes(a.row)) throw new Error("Pick a row.");
    const [c] = G.queue, ev = { n: ++G.n, kind: "place", steps: [] };
    take(G, c, a.row, ev, true);
    G.queue.shift(); G.phase = "pick"; G.chooser = null; G.seq++;
    place(G, ev);
    return G;
  }
  throw new Error("Unknown action.");
}

function reveal(G) {
  const order = Object.entries(G.picks).map(([pid, card]) => ({ pid, card })).sort((a, b) => a.card - b.card);
  for (const { pid, card } of order) G.hands[pid].splice(G.hands[pid].indexOf(card), 1);
  G.queue = order; G.picks = {}; G.turn++;
  const ev = { n: ++G.n, kind: "reveal", reveals: order.map(o => ({ ...o })), steps: [] };
  place(G, ev);
}
function take(G, item, row, ev, chosen = false) {
  const got = G.rows[row], b = rowBulls(got);
  G.score[item.pid] += b; G.taken[item.pid] += b;
  ev.steps.push({ pid: item.pid, card: item.card, row, took: got.slice(), bulls: b, chosen });
  G.rows[row] = [item.card];
}
// lay the revealed cards from lowest to highest; stop if someone has to choose a row
function place(G, ev) {
  while (G.queue.length) {
    const it = G.queue[0], r = rowFor(G.rows, it.card);
    if (r < 0) { G.phase = "row"; G.chooser = it.pid; ev.waitRow = it; G.last = ev; return; }
    if (G.rows[r].length >= ROW_MAX) take(G, it, r, ev);
    else { G.rows[r].push(it.card); ev.steps.push({ pid: it.pid, card: it.card, row: r }); }
    G.queue.shift();
  }
  G.last = ev; G.phase = "pick";
  if (G.hands[G.players[0].id].length === 0) endRound(G, ev);
}
function endRound(G, ev) {
  G.log.push({ round: G.round, taken: { ...G.taken } });
  ev.roundEnd = { taken: { ...G.taken } };
  const top = Math.max(...Object.values(G.score));
  if (!G.target || top >= G.target) {
    G.phase = "gameOver";
    const rows = G.players.map(p => ({ pid: p.id, points: G.score[p.id] })).sort((a, b) => a.points - b.points);
    G.result = { rows, winners: rows.filter(r => r.points === rows[0].points).map(r => r.pid) };
  } else G.phase = "roundOver";
}

export function viewFor(G, pid) {
  return {
    game: "nimmt", gameId: G.gameId, seq: G.seq, phase: G.phase, round: G.round, turn: G.turn, target: G.target,
    me: G.players.findIndex(p => p.id === pid), waiting: waitingOn(G), chooser: G.chooser,
    hand: (G.hands[pid] || []).slice(), rows: G.rows.map(r => r.slice()), myPick: G.picks[pid] ?? null,
    pending: G.phase === "row" ? G.queue.map(q => ({ ...q })) : [],
    players: G.players.map(p => ({ id: p.id, name: p.name, score: G.score[p.id], taken: G.taken[p.id], picked: p.id in G.picks, left: G.hands[p.id].length })),
    last: G.last ? structuredClone(G.last) : null, result: G.result ? structuredClone(G.result) : null, log: G.log.slice(),
  };
}

// ---------------------------------------------------------------- automatic play
function cost(G, card, pickCount) {
  const r = rowFor(G.rows, card);
  if (r < 0) return Math.min(...G.rows.map(rowBulls)) + 0.5;
  const row = G.rows[r], gap = card - row[row.length - 1];
  if (row.length >= ROW_MAX) return rowBulls(row);
  // a row with 4 cards is dangerous when others play under you; smaller gaps are safer
  return (row.length === ROW_MAX - 1 ? 0.25 * pickCount * Math.min(1, gap / 10) * rowBulls(row) : 0) + gap / 200;
}
export function autoAction(G, pid) {
  if (G.phase === "roundOver") return { type: "next" };
  if (!waitingOn(G).includes(pid)) return null;
  if (G.phase === "row") return { type: "row", row: Math.floor(Math.random() * 4) };
  const h = G.hands[pid]; return { type: "pick", card: h[Math.floor(Math.random() * h.length)] };
}
export function smartAction(G, pid) {
  if (G.phase === "roundOver") return { type: "next" };
  if (!waitingOn(G).includes(pid)) return null;
  if (G.phase === "row") {
    const b = G.rows.map(rowBulls), min = Math.min(...b);
    return { type: "row", row: b.indexOf(min) };
  }
  const h = G.hands[pid], k = G.players.length - 1;
  const best = h.slice().sort((a, b) => cost(G, a, k) - cost(G, b, k) || a - b)[0];
  return { type: "pick", card: best };
}
