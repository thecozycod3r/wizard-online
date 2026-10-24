// Kings Cup (Ring of Fire) — pure engine. No DOM, no network. 52 cards; each rank has a rule; the 4th King drinks the cup.
// newGame(players, {jack, queen}) · act(G, pid, a) · viewFor · waitingOn · autoAction · smartAction · timerKey
// Actions: {type:"draw"} · {type:"done", target?} (2 = pick who drinks, 8 = pick a mate; anything else just passes the turn).
import { fullDeck, rankOf } from "../drinks/cards.js";

export const MIN_PLAYERS = 3, MAX_PLAYERS = 12;
// the classic rules; Jack and Queen have a choice in the lobby
export function ruleFor(rank, s = {}) {
  return {
    1: { name: "Waterfall", text: "Everyone starts drinking. You can stop only when the person before you stops — the drawer stops first." },
    2: { name: "You", text: "Pick someone to drink.", target: "drink" },
    3: { name: "Me", text: "You drink." },
    4: { name: "Floor", text: "Last person to touch the floor drinks." },
    5: { name: "Guys", text: "All the guys drink." },
    6: { name: "Chicks", text: "All the girls drink." },
    7: { name: "Heaven", text: "Last person to point to the sky drinks." },
    8: { name: "Mate", text: "Pick a mate — whenever you drink, they drink too, for the rest of the game.", target: "mate" },
    9: { name: "Rhyme", text: "Say a word; go round rhyming with it. First to repeat or fail drinks." },
    10: { name: "Categories", text: "Pick a category; go round naming things in it. First to fail drinks." },
    11: s.jack === "rule"
      ? { name: "Make a Rule", text: "Make a rule everyone must follow for the rest of the game. Break it, drink." }
      : { name: "Thumb Master", text: "You're the Thumb Master: whenever you put your thumb on the table, the last to copy drinks. Lasts until the next Jack.", role: "thumb" },
    12: s.queen === "never"
      ? { name: "Never Have I Ever", text: "Go round with Never Have I Ever. First to put down three fingers drinks." }
      : { name: "Question Master", text: "You're the Question Master: anyone who answers your question drinks. Lasts until the next Queen.", role: "question" },
    13: { name: "King's Cup", text: "Pour some of your drink into the cup. Whoever draws the 4th King drinks the whole cup!" },
  }[rank];
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Kings Cup needs 3 to 12 players.");
  return {
    v: 1, game: "kingscup", gameId: Math.random().toString(36).slice(2, 10), seq: 0, n: 0,
    players: players.map(p => ({ id: p.id, name: p.name })), settings: { jack: settings.jack === "rule" ? "rule" : "thumb", queen: settings.queen === "never" ? "never" : "question" },
    deck: shuffle(fullDeck()), drawn: [], turn: Math.floor(Math.random() * n), phase: "draw", card: null, kings: 0,
    mates: {}, roles: { thumb: null, question: null }, rules: [], counts: Object.fromEntries(players.map(p => [p.id, 0])),
    last: { n: 1, kind: "start" }, result: null,
  };
}
const cur = G => G.players[G.turn].id;
export const waitingOn = G => (G.phase === "draw" || G.phase === "show" ? [cur(G)] : []);
export const timerKey = G => `${G.drawn.length}.${G.phase}`;

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!waitingOn(G).includes(pid)) throw new Error("It's not your turn.");
  if (a.type === "draw") {
    if (G.phase !== "draw") throw new Error("You've already drawn.");
    const card = G.deck.pop(); G.drawn.push(card); G.card = card; G.counts[pid]++; G.seq++;
    const r = rankOf(card), rule = ruleFor(r, G.settings), ev = { n: ++G.n, kind: "draw", pid, card, rule };
    if (rule.role) G.roles[rule.role] = pid;
    if (r === 11 && G.settings.jack === "rule") G.rules.push({ by: pid });
    if (r === 13) { G.kings++; ev.kings = G.kings; if (G.kings === 4) { ev.cup = true; G.last = ev; return finish(G, pid); } }
    G.phase = "show"; G.last = ev;
    if (!G.deck.length) return finish(G, null);
    return G;
  }
  if (a.type === "done") {
    if (G.phase !== "show") throw new Error("Draw a card first.");
    const rule = ruleFor(rankOf(G.card), G.settings), ev = { n: ++G.n, kind: "done", pid };
    if (rule.target) {
      if (!G.players.some(p => p.id === a.target && p.id !== pid)) throw new Error(rule.target === "mate" ? "Pick your mate." : "Pick who drinks.");
      ev.target = a.target; ev.what = rule.target;
      if (rule.target === "mate") G.mates[pid] = a.target;
    }
    G.turn = (G.turn + 1) % G.players.length; G.phase = "draw"; G.card = null; G.seq++; G.last = ev;
    return G;
  }
  throw new Error("Unknown action.");
}
function finish(G, cupBy) {
  G.phase = "gameOver"; G.seq++;
  const rows = G.players.map(p => ({ pid: p.id, points: G.counts[p.id] })).sort((a, b) => (a.pid === cupBy ? -1 : b.pid === cupBy ? 1 : 0));
  G.result = { rows, winners: cupBy ? [cupBy] : [], cup: cupBy };
  return G;
}
// everyone who drinks when pid drinks: their mate, their mate's mate, …
export function chain(G, pid) {
  const out = [], seen = new Set([pid]);
  let q = [pid];
  while (q.length) { const nx = []; for (const x of q) for (const [a, b] of Object.entries(G.mates)) { const o = a === x ? b : b === x ? a : null; if (o && !seen.has(o)) { seen.add(o); out.push(o); nx.push(o); } } q = nx; }
  return out;
}

export function viewFor(G, pid) {
  return {
    game: "kingscup", gameId: G.gameId, seq: G.seq, phase: G.phase, me: G.players.findIndex(p => p.id === pid), waiting: waitingOn(G),
    turn: cur(G), card: G.card, rule: G.card ? ruleFor(rankOf(G.card), G.settings) : null, left: G.deck.length, kings: G.kings,
    recent: G.drawn.slice(-6), mates: { ...G.mates }, roles: { ...G.roles }, rulesMade: G.rules.length, settings: { ...G.settings },
    players: G.players.map(p => ({ id: p.id, name: p.name, cards: G.counts[p.id], mate: G.mates[p.id] || Object.keys(G.mates).find(k => G.mates[k] === p.id) || null })),
    last: structuredClone(G.last), result: G.result ? structuredClone(G.result) : null,
  };
}
export function autoAction(G, pid) {
  if (!waitingOn(G).includes(pid)) return null;
  if (G.phase === "draw") return { type: "draw" };
  const rule = ruleFor(rankOf(G.card), G.settings), others = G.players.filter(p => p.id !== pid);
  return { type: "done", ...(rule.target ? { target: others[Math.floor(Math.random() * others.length)].id } : {}) };
}
export const smartAction = autoAction;
