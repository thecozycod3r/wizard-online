// Bluff — pure engine. No DOM, no network. One or more standard 52-card decks, dealt out completely.
// A round: the starter names a rank and lays 1–4 cards face down "as" that rank. Each next player either calls Bluff on the
// last play, plays 1–4 more cards claiming the same rank, or passes. Bluff flips the last play: caught liar takes the whole
// pile, a wrong call means the caller takes it. If everyone else passes after a play, the pile is cleared away.
// Empty your hand (and survive the call) to win.
// Actions: {type:"play", cards:[ids], rank?} (rank only when starting a round) · {type:"pass"} · {type:"call"}
import { fullDeck, rankOf } from "../drinks/cards.js";

export const MIN_PLAYERS = 3, MAX_PLAYERS = 8, MAX_PLAY = 4, MAX_DECKS = 4;
export const RANKS = Array.from({ length: 13 }, (_, i) => i + 1);
// how many decks a table uses: the host's pick, or 1 up to six players and 2 beyond
export const decksFor = (settings = {}, n = 4) => (settings.decks >= 1 && settings.decks <= MAX_DECKS ? +settings.decks : n <= 6 ? 1 : 2);
export function dealSizes(decks, n) {
  const total = 52 * decks, base = Math.floor(total / n);
  return { total, base, extra: total % n };
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`Bluff needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  const decks = decksFor(settings, n);
  // with several decks the copies need their own ids: "7H" from deck 1, "7H.2" from deck 2 …
  const cards = shuffle(Array.from({ length: decks }, (_, d) => fullDeck().map(c => (d ? `${c}.${d + 1}` : c))).flat());
  const hands = Object.fromEntries(players.map(p => [p.id, []]));
  const start = Math.floor(Math.random() * n);
  cards.forEach((c, i) => hands[players[(start + i) % n].id].push(c));   // the dealer's left gets any extra cards first
  return {
    v: 1, game: "bluff", gameId: Math.random().toString(36).slice(2, 10), seq: 0, n: 0, decks,
    players: players.map(p => ({ id: p.id, name: p.name })), hands,
    turn: start, rank: null, pile: [], plays: [], passes: 0, cleared: 0,
    called: Object.fromEntries(players.map(p => [p.id, { right: 0, wrong: 0, caught: 0 }])),
    phase: "play", result: null, last: { n: 1, kind: "start", decks },
  };
}
const ids = G => G.players.map(p => p.id);
const cur = G => G.players[G.turn].id;
const idxOf = (G, pid) => G.players.findIndex(p => p.id === pid);
export const waitingOn = G => (G.phase === "play" ? [cur(G)] : []);
export const timerKey = G => String(G.seq);
const err = m => { throw new Error(m); };

export function act(G, pid, a) {
  if (!a || typeof a !== "object") err("Unknown action.");
  if (G.phase === "gameOver") err("The game is over.");
  if (!G.hands[pid]) err("You're not in this game.");
  if (cur(G) !== pid) err("It's not your turn.");
  const h = G.hands[pid], lastPlay = G.plays.at(-1);
  // a player who emptied their hand is out once the next player lets that last play stand
  const settleFinish = () => { if (lastPlay && !G.hands[lastPlay.pid].length) return finish(G, lastPlay.pid); return null; };

  if (a.type === "play") {
    const cards = a.cards;
    if (!Array.isArray(cards) || !cards.length || cards.length > MAX_PLAY) err(`Play 1 to ${MAX_PLAY} cards.`);
    if (new Set(cards).size !== cards.length || cards.some(c => typeof c !== "string" || !h.includes(c))) err("Play cards from your own hand.");
    const leading = G.rank === null;
    if (leading && !RANKS.includes(a.rank)) err("Name the rank you're playing.");
    if (settleFinish()) return G;
    if (leading) G.rank = a.rank;
    for (const c of cards) h.splice(h.indexOf(c), 1);
    G.pile.push(...cards); G.plays.push({ pid, cards: cards.slice() }); G.passes = 0;
    G.last = { n: ++G.n, kind: "play", pid, count: cards.length, rank: G.rank, lead: leading, left: h.length };
    next(G);
  } else if (a.type === "pass") {
    if (G.rank === null) err("You're starting the round: play some cards.");
    if (settleFinish()) return G;
    G.passes++;
    G.last = { n: ++G.n, kind: "pass", pid };
    next(G);
    // everyone after the last player passed: the pile is cleared away and that player starts afresh
    if (G.passes >= G.players.length - 1) {
      const by = lastPlay.pid;
      G.cleared += G.pile.length;
      G.last = { ...G.last, clear: { by, count: G.pile.length } };
      newRound(G, by);
    }
  } else if (a.type === "call") {
    if (!lastPlay) err("Nothing to call yet.");
    if (G.passes) err("Only the player right after a play can call it.");
    const liar = lastPlay.pid, shown = lastPlay.cards.slice(), lie = shown.some(c => rankOf(c) !== G.rank);
    const taker = lie ? liar : pid, count = G.pile.length;
    G.hands[taker].push(...G.pile); G.pile = [];
    if (lie) { G.called[pid].right++; G.called[liar].caught++; } else G.called[pid].wrong++;
    G.last = { n: ++G.n, kind: "call", pid, liar, cards: shown, rank: G.rank, lie, taker, count };
    if (!lie && !G.hands[liar].length) { const ev = G.last; finish(G, liar); G.last = { ...ev, n: G.n, over: true, out: liar }; return G; }   // honest last cards: out
    newRound(G, lie ? pid : liar);   // the winner of the call starts the next round
  } else err("Unknown action.");
  G.seq++;
  return G;
}
function next(G) { G.turn = (G.turn + 1) % G.players.length; }
function newRound(G, starter) { G.pile = []; G.plays = []; G.rank = null; G.passes = 0; G.turn = idxOf(G, starter); }
function finish(G, winner) {
  G.phase = "gameOver"; G.seq++;
  const rows = G.players.map(p => ({ pid: p.id, points: G.hands[p.id].length })).sort((a, b) => a.points - b.points);
  G.result = { rows, winners: [winner] };
  G.last = { n: ++G.n, kind: "out", pid: winner, over: true };
  return G;
}

export function viewFor(G, pid) {
  const lp = G.plays.at(-1);
  return {
    game: "bluff", gameId: G.gameId, seq: G.seq, phase: G.phase, decks: G.decks, me: idxOf(G, pid),
    settings: { decks: G.decks }, waiting: waitingOn(G), turn: cur(G), rank: G.rank, canCall: !!lp && !G.passes, pileCount: G.pile.length, cleared: G.cleared, passes: G.passes,
    plays: G.plays.map(p => ({ pid: p.pid, count: p.cards.length })), lastBy: lp ? lp.pid : null,
    hand: (G.hands[pid] || []).slice(),
    players: G.players.map(p => ({ id: p.id, name: p.name, cards: G.hands[p.id].length, ...G.called[p.id] })),
    last: structuredClone(G.last), result: G.result ? structuredClone(G.result) : null,
  };
}

// ---------------------------------------------------------------- automatic play
// on the clock: the honest minimum — start with your biggest set, follow with matching cards, otherwise pass
export function smartAction(G, pid) {
  if (!waitingOn(G).includes(pid)) return null;
  const h = G.hands[pid];
  if (G.rank === null) { const r = bestRank(h); return { type: "play", rank: r, cards: h.filter(c => rankOf(c) === r).slice(0, MAX_PLAY) }; }
  const have = h.filter(c => rankOf(c) === G.rank);
  return have.length ? { type: "play", cards: have.slice(0, MAX_PLAY) } : { type: "pass" };
}
export const autoAction = smartAction;
const bestRank = h => { const n = {}; for (const c of h) n[rankOf(c)] = (n[rankOf(c)] || 0) + 1; return +Object.entries(n).sort((a, b) => b[1] - a[1])[0][0]; };
// a seat played by a bot: calls when the claim can't add up (or the liar is nearly out), bluffs now and then
export function botAction(G, pid) {
  if (!waitingOn(G).includes(pid)) return null;
  const h = G.hands[pid], lp = G.plays.at(-1);
  if (lp && !G.passes) {
    const mine = h.filter(c => rankOf(c) === G.rank).length;
    const claimed = G.plays.reduce((s, p) => s + p.cards.length, 0);
    const impossible = claimed + mine > 4 * G.decks;
    const danger = G.hands[lp.pid].length <= 1;
    if (impossible || danger || Math.random() < 0.12 + 0.05 * lp.cards.length) return { type: "call" };
  }
  if (G.rank === null) {
    const r = bestRank(h), set = h.filter(c => rankOf(c) === r);
    const extra = Math.random() < 0.35 ? h.filter(c => rankOf(c) !== r).slice(0, Math.max(0, Math.min(MAX_PLAY - set.length, 1))) : [];
    return { type: "play", rank: r, cards: [...set.slice(0, MAX_PLAY), ...extra].slice(0, MAX_PLAY) };
  }
  const have = h.filter(c => rankOf(c) === G.rank);
  if (have.length) return { type: "play", cards: have.slice(0, MAX_PLAY) };
  if (Math.random() < 0.3 && h.length) return { type: "play", cards: [h[Math.floor(Math.random() * h.length)]] };
  return { type: "pass" };
}
