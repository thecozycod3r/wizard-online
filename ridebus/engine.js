// Ride the Bus — pure engine. No DOM, no network. 52 cards.
// Stage 1 (four rounds): each player guesses red/black → higher/lower → inside/outside → suit; right = give that many drinks, wrong = drink.
// Stage 2 (pyramid): 4-3-2-1 cards flipped one at a time; holding that rank, you hand out the row's drinks (1–4) per card.
// Stage 3 (the bus): whoever holds the most cards rides — four right guesses in a row on fresh cards, a drink for every miss.
// Actions: {type:"guess", g} · {type:"give", target} · {type:"match", card, target} · {type:"pass"} · {type:"flip"} · {type:"ride", g}
import { fullDeck, rankOf, suitOf, isRed } from "../drinks/cards.js";

export const MIN_PLAYERS = 2, MAX_PLAYERS = 10;
export const QUESTIONS = [
  { key: "color", q: "Red or black?", opts: ["red", "black"] },
  { key: "hilo", q: "Higher or lower than your first card?", opts: ["higher", "lower"] },
  { key: "inout", q: "Inside or outside your first two?", opts: ["inside", "outside"] },
  { key: "suit", q: "Which suit?", opts: ["S", "H", "D", "C"] },
];
export const PYRAMID = [4, 3, 2, 1];   // cards per row; the row's drink value is its number (1 bottom … 4 top)
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// is guess g right for card c, given the earlier cards? Equal ranks count as wrong for higher/lower and inside/outside.
export function right(qi, g, c, prev) {
  if (qi === 0) return (g === "red") === isRed(c);
  if (qi === 1) { const a = rankOf(prev[0]), b = rankOf(c); return g === "higher" ? b > a : b < a; }
  if (qi === 2) { const lo = Math.min(rankOf(prev[0]), rankOf(prev[1])), hi = Math.max(rankOf(prev[0]), rankOf(prev[1])), r = rankOf(c); return g === "inside" ? r > lo && r < hi : r < lo || r > hi; }
  return suitOf(c) === g;
}

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Ride the Bus needs 2 to 10 players.");
  const G = {
    v: 1, game: "ridebus", gameId: Math.random().toString(36).slice(2, 10), seq: 0, n: 0,
    players: players.map(p => ({ id: p.id, name: p.name })), deck: shuffle(fullDeck()),
    hands: Object.fromEntries(players.map(p => [p.id, []])), taken: Object.fromEntries(players.map(p => [p.id, 0])), given: Object.fromEntries(players.map(p => [p.id, 0])),
    stage: "guess", q: 0, turn: 0, phase: "guess", give: null,
    pyramid: [], flipped: 0, holders: [], answered: [], rider: null, bus: null, result: null, last: { n: 1, kind: "start" },
  };
  return G;
}
const ids = G => G.players.map(p => p.id);
const draw = G => { if (!G.deck.length) G.deck = shuffle(fullDeck().filter(c => !Object.values(G.hands).flat().includes(c) && !G.pyramid.includes(c))); return G.deck.pop(); };

export function waitingOn(G) {
  if (G.phase === "guess") return [ids(G)[G.turn]];
  if (G.phase === "give") return [G.give.pid];
  if (G.phase === "match") return G.holders.filter(p => !G.answered.includes(p));
  if (G.phase === "flip") return [];   // the table flips the next pyramid card by itself (pause)
  if (G.phase === "bus") return [G.rider];
  return [];
}
export const timerKey = G => `${G.stage}.${G.q}.${G.turn}.${G.flipped}.${G.phase}.${G.bus?.tries ?? 0}.${G.bus?.step ?? 0}`;
// the pyramid flips by itself when nobody holds the card (or everyone has answered)
export const pause = G => (G.phase === "flip" ? { ms: 2200, action: { type: "flip" } } : null);

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!G.hands[pid]) throw new Error("You're not in this game.");
  if (a.type === "flip") { if (G.phase !== "flip") throw new Error("Not now."); flip(G); return G; }
  if (!waitingOn(G).includes(pid)) throw new Error("It's not your turn.");
  const others = ids(G).filter(x => x !== pid);

  if (G.phase === "guess") {
    const Q = QUESTIONS[G.q];
    if (a.type !== "guess" || !Q.opts.includes(a.g)) throw new Error(Q.q);
    const c = draw(G), prev = G.hands[pid].slice(), win = right(G.q, a.g, c, prev);
    G.hands[pid].push(c); G.seq++;
    const ev = { n: ++G.n, kind: "guess", pid, q: G.q, g: a.g, card: c, win, drinks: G.q + 1 };
    G.last = ev;
    if (win) { G.phase = "give"; G.give = { pid, n: G.q + 1 }; return G; }
    G.taken[pid] += G.q + 1;
    return nextGuess(G);
  }
  if (G.phase === "give") {
    if (a.type !== "give" || !others.includes(a.target)) throw new Error("Pick who drinks.");
    G.taken[a.target] += G.give.n; G.given[pid] += G.give.n; G.seq++;
    G.last = { n: ++G.n, kind: "give", pid, target: a.target, drinks: G.give.n };
    G.give = null;
    return nextGuess(G);
  }
  if (G.phase === "match") {
    G.seq++;
    if (a.type === "pass") { G.answered.push(pid); G.last = { n: ++G.n, kind: "pass", pid }; }
    else if (a.type === "match") {
      const top = G.pyramid[G.flipped - 1];
      if (!G.hands[pid].includes(a.card) || rankOf(a.card) !== rankOf(top)) throw new Error("That card doesn't match.");
      if (!others.includes(a.target)) throw new Error("Pick who drinks.");
      const row = rowOf(G.flipped - 1) + 1;
      G.hands[pid].splice(G.hands[pid].indexOf(a.card), 1);
      G.taken[a.target] += row; G.given[pid] += row;
      G.last = { n: ++G.n, kind: "match", pid, card: a.card, target: a.target, drinks: row };
      if (!G.hands[pid].some(c => rankOf(c) === rankOf(top))) G.answered.push(pid);
    } else throw new Error("Match or pass.");
    if (!waitingOn(G).length) G.phase = G.flipped >= 10 ? "toBus" : "flip";
    if (G.phase === "toBus") startBus(G);
    return G;
  }
  if (G.phase === "bus") {
    const Q = QUESTIONS[G.bus.step];
    if (a.type !== "ride" || !Q.opts.includes(a.g)) throw new Error(Q.q);
    const c = draw(G), win = right(G.bus.step, a.g, c, G.bus.cards);
    G.bus.cards.push(c); G.seq++;
    const ev = { n: ++G.n, kind: "ride", pid, step: G.bus.step, g: a.g, card: c, win };
    if (win) { G.bus.step++; if (G.bus.step === 4) { G.last = { ...ev, off: true }; return finish(G); } }
    else { G.taken[pid] += 1; G.bus.tries++; G.bus.step = 0; ev.restart = true; G.bus.old = G.bus.cards; G.bus.cards = []; if (G.bus.tries >= 10) { G.last = { ...ev, mercy: true }; return finish(G); } }
    G.last = ev;
    return G;
  }
  throw new Error("Unknown action.");
}
function nextGuess(G) {
  G.turn++;
  if (G.turn >= G.players.length) { G.turn = 0; G.q++; }
  if (G.q < 4) { G.phase = "guess"; return G; }
  // pyramid: ten cards face down
  G.stage = "pyramid"; G.pyramid = Array.from({ length: 10 }, () => draw(G)); G.flipped = 0; G.phase = "flip";
  G.last = { ...G.last, toPyramid: true };
  return G;
}
export const rowOf = i => (i < 4 ? 0 : i < 7 ? 1 : i < 9 ? 2 : 3);
function flip(G) {
  G.flipped++; G.seq++;
  const c = G.pyramid[G.flipped - 1], r = rankOf(c);
  G.holders = ids(G).filter(p => G.hands[p].some(x => rankOf(x) === r)); G.answered = [];
  G.last = { n: ++G.n, kind: "flip", i: G.flipped - 1, card: c, row: rowOf(G.flipped - 1) + 1, holders: G.holders.slice() };
  if (G.holders.length) G.phase = "match";
  else if (G.flipped >= 10) startBus(G);
  else G.phase = "flip";
}
function startBus(G) {
  const most = Math.max(...ids(G).map(p => G.hands[p].length)), cands = ids(G).filter(p => G.hands[p].length === most);
  G.rider = cands[Math.floor(Math.random() * cands.length)];
  G.stage = "bus"; G.phase = "bus"; G.bus = { step: 0, tries: 0, cards: [], old: [] }; G.deck = shuffle(fullDeck());
  G.last = { ...G.last, n: ++G.n, toBus: true, rider: G.rider, most };
}
function finish(G) {
  G.phase = "gameOver"; G.stage = "done";
  const rows = G.players.map(p => ({ pid: p.id, points: G.taken[p.id], given: G.given[p.id] })).sort((a, b) => a.points - b.points);
  G.result = { rows, winners: rows.filter(r => r.points === rows[0].points).map(r => r.pid), rider: G.rider, tries: G.bus.tries };
  return G;
}

export function viewFor(G, pid) {
  return {
    game: "ridebus", gameId: G.gameId, seq: G.seq, phase: G.phase, stage: G.stage, q: G.q, me: G.players.findIndex(p => p.id === pid),
    waiting: waitingOn(G), turn: G.phase === "guess" ? ids(G)[G.turn] : null, give: G.give ? { ...G.give } : null,
    pyramid: G.pyramid.map((c, i) => (i < G.flipped ? c : null)), flipped: G.flipped, holders: G.holders.slice(), answered: G.answered.slice(),
    rider: G.rider, bus: G.bus ? { step: G.bus.step, tries: G.bus.tries, cards: G.bus.cards.slice(), old: G.bus.old.slice() } : null,
    players: G.players.map(p => ({ id: p.id, name: p.name, hand: G.hands[p.id].slice(), taken: G.taken[p.id], given: G.given[p.id] })),
    last: structuredClone(G.last), result: G.result ? structuredClone(G.result) : null,
  };
}
// a guess with the odds on its side (from the cards this player can see)
function bestGuess(qi, prev) {
  if (qi === 0) return Math.random() < .5 ? "red" : "black";
  if (qi === 1) return rankOf(prev[0]) >= 7 ? "lower" : "higher";
  if (qi === 2) { const gap = Math.abs(rankOf(prev[0]) - rankOf(prev[1])); return gap > 6 ? "inside" : "outside"; }
  return ["S", "H", "D", "C"][Math.floor(Math.random() * 4)];
}
export function smartAction(G, pid) {
  if (G.phase === "flip") return { type: "flip" };
  if (!waitingOn(G).includes(pid)) return null;
  const others = ids(G).filter(x => x !== pid), victim = others.sort((a, b) => G.taken[a] - G.taken[b])[0];
  if (G.phase === "guess") return { type: "guess", g: bestGuess(G.q, G.hands[pid]) };
  if (G.phase === "give") return { type: "give", target: victim };
  if (G.phase === "match") { const top = G.pyramid[G.flipped - 1], c = G.hands[pid].find(x => rankOf(x) === rankOf(top)); return c ? { type: "match", card: c, target: victim } : { type: "pass" }; }
  if (G.phase === "bus") return { type: "ride", g: bestGuess(G.bus.step, G.bus.cards) };
  return null;
}
export const autoAction = smartAction;
