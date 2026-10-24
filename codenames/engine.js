// Codenames — pure engine. No DOM, no network.
// newGame(players, {timer}) · act(G, pid, a) · viewFor · waitingOn · smartAction · botAction · timerKey
//
// Two teams, red and blue. Before the first clue players pick their team and a spymaster each. 25 words: the starting team has 9,
// the other 8, plus 7 bystanders and 1 assassin. Spymasters see the key. On a team's turn the spymaster gives one word and a number;
// operatives guess one word at a time — up to number + 1 (0 = as many as they like). A wrong colour ends the turn; the assassin
// loses the game; finding all your words wins it (even if the other team turns over your last one).
// Actions: {type:"team", team} · {type:"spymaster"} · {type:"begin"} · {type:"clue", word, n} · {type:"mark", i} · {type:"guess", i}
//          {type:"end"} · {type:"timeout"} (the turn timer ran out on a guessing team)
import { WORDS } from "./words.js";

export const MIN_PLAYERS = 4, MAX_PLAYERS = 12;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ids = G => G.players.map(p => p.id);
export const other = t => (t === "red" ? "blue" : "red");

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Codenames needs 4 to 12 players.");
  const start = Math.random() < .5 ? "red" : "blue";
  const key = shuffle([...Array(9).fill(start), ...Array(8).fill(other(start)), ...Array(7).fill("neutral"), "assassin"]);
  const team = {}, spy = { red: null, blue: null };
  players.forEach((p, i) => { team[p.id] = i % 2 ? "blue" : "red"; });
  spy.red = players[0].id; spy.blue = players[1].id;
  return {
    v: 1, game: "codenames", gameId: Math.random().toString(36).slice(2, 10), seq: 0, n: 0, turnNo: 0,
    players: players.map(p => ({ id: p.id, name: p.name })), settings: { timer: +settings.timer || 120 },
    words: shuffle(WORDS.slice()).slice(0, 25), key, open: Array(25).fill(false), team, spy, start,
    phase: "setup", turn: start, clue: null, guesses: 0, marks: {}, clues: [], last: { n: 1, kind: "start" }, result: null,
  };
}
const ops = (G, t) => ids(G).filter(p => G.team[p] === t && G.spy[t] !== p);
export const left = (G, t) => G.key.filter((c, i) => c === t && !G.open[i]).length;
export function waitingOn(G) {
  if (G.phase === "clue") return [G.spy[G.turn]];
  if (G.phase === "guess") return ops(G, G.turn);
  return [];
}
export const timerKey = G => `${G.turnNo}.${G.phase}`;
const bump = (G, e) => { G.seq++; G.last = { n: ++G.n, ...e }; };
export const ready = G => ["red", "blue"].every(t => G.spy[t] && G.team[G.spy[t]] === t && ops(G, t).length >= 1);

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!(pid in G.team)) throw new Error("You're not in this game.");
  if (G.phase === "setup") {
    if (a.type === "team") {
      if (a.team !== "red" && a.team !== "blue") throw new Error("Pick red or blue.");
      const was = G.team[pid]; if (was === a.team) return G;
      if (G.spy[was] === pid) G.spy[was] = null;
      G.team[pid] = a.team; bump(G, { kind: "team", pid, team: a.team }); return G;
    }
    if (a.type === "spymaster") { G.spy[G.team[pid]] = pid; bump(G, { kind: "spymaster", pid, team: G.team[pid] }); return G; }
    if (a.type === "begin") {
      if (!ready(G)) throw new Error("Each team needs a spymaster and at least one other player.");
      G.phase = "clue"; G.turnNo++; bump(G, { kind: "begin", team: G.turn }); return G;
    }
    throw new Error("Pick your team first.");
  }
  if (a.type === "timeout") {
    if (G.phase !== "guess") throw new Error("Not now.");
    return endTurn(G, { kind: "timeout", team: G.turn });
  }
  if (!waitingOn(G).includes(pid) && a.type !== "mark") throw new Error("It's not your turn.");
  if (G.phase === "clue") {
    if (a.type !== "clue") throw new Error("Give a clue.");
    const n = a.n === "inf" ? 0 : +a.n;
    let word = String(a.word || "").trim();
    if (a.auto) word = "—";
    else {
      if (!/^[\p{L}\p{N}'’-]{1,24}$/u.test(word)) throw new Error("A clue is one word.");
      const lw = word.toLowerCase();
      const clash = G.words.find((w, i) => !G.open[i] && (w.toLowerCase() === lw || (lw.length >= 3 && w.toLowerCase().includes(lw)) || (w.length >= 3 && lw.includes(w.toLowerCase()))));
      if (clash) throw new Error(`Too close to "${clash}" on the board.`);
    }
    if (!(Number.isInteger(n) && n >= 0 && n <= 9)) throw new Error("Pick a number.");
    G.clue = { word, n, team: G.turn, by: pid }; G.guesses = 0; G.marks = {}; G.phase = "guess";
    G.clues.push({ ...G.clue, got: [] });
    bump(G, { kind: "clue", team: G.turn, word, n, pid }); return G;
  }
  if (G.phase === "guess") {
    if (a.type === "mark") {
      if (G.team[pid] !== G.turn || G.spy[G.turn] === pid) throw new Error("Only your team's operatives can mark.");
      const i = +a.i; if (!(i >= 0 && i < 25) || G.open[i]) throw new Error("Pick a covered word.");
      const m = G.marks[i] || []; G.marks[i] = m.includes(pid) ? m.filter(x => x !== pid) : [...m, pid];
      bump(G, { kind: "mark", pid, i }); return G;
    }
    if (a.type === "end") {
      if (!G.guesses) throw new Error("Make at least one guess first.");
      return endTurn(G, { kind: "end", team: G.turn, pid });
    }
    if (a.type !== "guess") throw new Error("Guess a word.");
    const i = +a.i; if (!(i >= 0 && i < 25) || G.open[i]) throw new Error("Pick a covered word.");
    G.open[i] = true; G.guesses++; delete G.marks[i];
    const c = G.key[i], t = G.turn, e = { kind: "guess", pid, i, word: G.words[i], color: c, team: t };
    G.clues[G.clues.length - 1].got.push(i);
    if (c === "assassin") return finish(G, other(t), "assassin", e);
    if (!left(G, "red")) return finish(G, "red", "words", e);
    if (!left(G, "blue")) return finish(G, "blue", "words", e);
    if (c !== t) return endTurn(G, { ...e, ends: true });
    const max = G.clue.n ? G.clue.n + 1 : 99;
    if (G.guesses >= max) return endTurn(G, { ...e, ends: true, maxed: true });
    bump(G, e); return G;
  }
  throw new Error("Unknown action.");
}
function endTurn(G, e) {
  G.turn = other(G.turn); G.phase = "clue"; G.clue = null; G.guesses = 0; G.marks = {}; G.turnNo++;
  bump(G, { ...e, next: G.turn }); return G;
}
function finish(G, winner, how, e) {
  G.phase = "gameOver"; G.clue = null;
  const rows = G.players.map(p => ({ pid: p.id, team: G.team[p.id], points: G.team[p.id] === winner ? 1 : 0 })).sort((a, b) => b.points - a.points);
  G.result = { winner, how, winners: rows.filter(r => r.points).map(r => r.pid), rows, left: { red: left(G, "red"), blue: left(G, "blue") } };
  bump(G, { ...e, win: winner, how }); return G;
}

export function viewFor(G, pid) {
  const spyView = G.spy.red === pid || G.spy.blue === pid || G.phase === "gameOver";
  return {
    game: "codenames", gameId: G.gameId, seq: G.seq, phase: G.phase, me: G.players.findIndex(p => p.id === pid), waiting: waitingOn(G),
    words: G.words.slice(), open: G.open.slice(), key: G.key.map((c, i) => (spyView || G.open[i] ? c : null)), spyView,
    team: { ...G.team }, spy: { ...G.spy }, start: G.start, turn: G.turn, clue: G.clue ? { ...G.clue } : null, guesses: G.guesses,
    marks: G.team[pid] === G.turn || spyView ? structuredClone(G.marks) : {}, clues: structuredClone(G.clues),
    left: { red: left(G, "red"), blue: left(G, "blue") }, ready: ready(G), timer: G.settings.timer,
    players: G.players.map(p => ({ id: p.id, name: p.name, team: G.team[p.id], spymaster: G.spy[G.team[p.id]] === p.id })),
    last: structuredClone(G.last), result: G.result ? structuredClone(G.result) : null,
  };
}
// when the turn timer runs out: a spymaster gives a blank clue for 1; a guessing team's turn passes to the other team
export function smartAction(G, pid) {
  if (G.phase === "clue" && G.spy[G.turn] === pid) return { type: "clue", auto: true, n: 1 };
  if (G.phase === "guess" && waitingOn(G).includes(pid)) return { type: "timeout" };
  return null;
}
export const autoAction = smartAction;
// a bot that took over a seat: as spymaster it gives a blank clue; as an operative it only guesses when nobody human is left to
// guess for its team (then it picks a covered word at random and stops after one).
export function botAction(G, pid, bots = []) {
  if (G.phase === "clue") return smartAction(G, pid);
  if (G.phase !== "guess" || !waitingOn(G).includes(pid)) return null;
  if (ops(G, G.turn).some(p => !bots.includes(p))) return null;
  if (G.guesses) return { type: "end" };
  const free = G.open.map((o, i) => (o ? -1 : i)).filter(i => i >= 0);
  return { type: "guess", i: free[Math.floor(Math.random() * free.length)] };
}
