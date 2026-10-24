// Spyfall — pure engine. No DOM, no network (the round clock uses Date.now(); the table runner ends the round when it runs out).
// newGame(players, {rounds, mins}) · act(G, pid, a) · viewFor · waitingOn · smartAction · timerKey · pause
//
// Each round one player is the spy; everyone else sees the location and a role. Players question each other; the asker taps who
// they asked, and that player asks next. Anyone may stop the clock once per round to accuse someone — if everyone else (not the
// suspect) votes yes, the round ends and the suspect's card is turned over. The spy may stop the clock to guess the location.
// When time runs out, players accuse in turn from the dealer; the first unanimous vote ends the round, and if none passes the spy wins.
// Actions: {type:"ask", target} · {type:"accuse", target} · {type:"vote", yes} · {type:"guess", loc} · {type:"timeup"} · {type:"next"}
import { LOCATIONS, LOC } from "./locations.js";

export const MIN_PLAYERS = 3, MAX_PLAYERS = 10;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ids = G => G.players.map(p => p.id);

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Spyfall needs 3 to 10 players.");
  const G = {
    v: 1, game: "spyfall", gameId: Math.random().toString(36).slice(2, 10), seq: 0, n: 0,
    players: players.map(p => ({ id: p.id, name: p.name })), settings: { rounds: [3, 5, 8].includes(+settings.rounds) ? +settings.rounds : 5, mins: [4, 6, 8].includes(+settings.mins) ? +settings.mins : 6 },
    scores: Object.fromEntries(players.map(p => [p.id, 0])), round: 0, dealer: Math.floor(Math.random() * n), used: [], history: [],
    phase: "play", last: { n: 1, kind: "start" }, result: null,
  };
  startRound(G);
  return G;
}
function startRound(G) {
  const pool = LOCATIONS.filter(l => !G.used.includes(l.id)), loc = pool[Math.floor(Math.random() * pool.length)];
  G.used.push(loc.id); G.round++;
  const order = ids(G), spy = order[Math.floor(Math.random() * order.length)];
  const roles = shuffle(loc.roles.slice());
  G.R = { loc: loc.id, spy, roles: Object.fromEntries(order.filter(p => p !== spy).map((p, i) => [p, roles[i % roles.length]])),
    deadline: Date.now() + G.settings.mins * 60000, left: null, asker: order[G.dealer], prevAsker: null, stopped: [], vote: null, finalTurn: null, outcome: null };
  G.phase = "play";
}
export function waitingOn(G) {
  const R = G.R;
  if (G.phase === "vote") return ids(G).filter(p => p !== R.vote.suspect && !(p in R.vote.votes));
  if (G.phase === "final") return [ids(G)[(G.dealer + R.finalTurn) % G.players.length]];
  return [];
}
export const timerKey = G => `${G.round}.${G.phase}.${G.R.vote ? G.R.vote.by + G.R.vote.suspect : ""}.${G.R.finalTurn}`;
export function pause(G) {
  if (G.phase === "play") return { ms: Math.max(0, G.R.deadline - Date.now()), action: { type: "timeup" } };
  if (G.phase === "roundOver") return { ms: 12000, action: { type: "next" } };
  return null;
}

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!(pid in G.scores)) throw new Error("You're not in this game.");
  const R = G.R;
  // the table runner's own follow-ups
  if (a.type === "timeup") {
    if (G.phase !== "play") throw new Error("Not now.");
    if (Date.now() < R.deadline - 1500) throw new Error("There's still time.");
    G.phase = "final"; R.finalTurn = 0; R.deadline = Date.now(); bump(G, { kind: "timeup" });
    return G;
  }
  if (a.type === "next") {
    if (G.phase !== "roundOver") throw new Error("Not now.");
    if (G.round >= G.settings.rounds) return finish(G);
    G.dealer = (G.dealer + 1) % G.players.length; startRound(G); bump(G, { kind: "round", round: G.round });
    return G;
  }
  if (a.type === "ask") {
    if (G.phase !== "play" || R.asker !== pid) throw new Error("It's not your question.");
    if (a.target === pid || !(a.target in G.scores)) throw new Error("Ask someone else.");
    if (a.target === R.prevAsker && G.players.length > 2) throw new Error("You can't ask back the person who just asked you.");
    R.prevAsker = pid; R.asker = a.target; bump(G, { kind: "ask", pid, target: a.target });
    return G;
  }
  if (a.type === "accuse") {
    const finalNow = G.phase === "final";
    if (finalNow ? waitingOn(G)[0] !== pid : G.phase !== "play") throw new Error("You can't accuse right now.");
    if (!finalNow && R.stopped.includes(pid)) throw new Error("You've already stopped the clock this round.");
    if (a.target === pid || !(a.target in G.scores)) throw new Error("Accuse someone else.");
    if (!finalNow) { R.stopped.push(pid); R.left = Math.max(0, R.deadline - Date.now()); }
    R.vote = { by: pid, suspect: a.target, votes: { [pid]: true }, final: finalNow };
    G.phase = "vote"; bump(G, { kind: "accuse", pid, target: a.target, final: finalNow });
    return settle(G);
  }
  if (a.type === "vote") {
    if (G.phase !== "vote" || !waitingOn(G).includes(pid)) throw new Error("You're not voting now.");
    R.vote.votes[pid] = !!a.yes; bump(G, { kind: "vote", pid, yes: !!a.yes });
    return settle(G);
  }
  if (a.type === "guess") {
    if (G.phase !== "play" || pid !== R.spy) throw new Error("Only the spy can guess, while the clock runs.");
    if (!LOC[a.loc]) throw new Error("Pick a location.");
    const right = a.loc === R.loc;
    return endRound(G, right ? { winner: "spy", how: "guess", guess: a.loc, pts: 4 } : { winner: "town", how: "guess", guess: a.loc });
  }
  throw new Error("Unknown action.");
}
const bump = (G, e) => { G.seq++; G.last = { n: ++G.n, ...e }; };
// a vote ends the moment it can't be unanimous, or when everyone has said yes
function settle(G) {
  const R = G.R, v = R.vote, voters = ids(G).filter(p => p !== v.suspect);
  if (Object.values(v.votes).some(x => !x)) {
    const final = v.final; R.vote = null;
    G.last = { ...G.last, failed: true, suspect: v.suspect };
    if (!final) { G.phase = "play"; R.deadline = Date.now() + R.left; R.left = null; return G; }
    R.finalTurn++;
    if (R.finalTurn >= G.players.length) return endRound(G, { winner: "spy", how: "nobody", pts: 2 });
    G.phase = "final"; return G;
  }
  if (voters.every(p => v.votes[p])) {
    const caught = v.suspect === R.spy;
    return endRound(G, caught ? { winner: "town", how: "caught", by: v.by, final: v.final, suspect: v.suspect } : { winner: "spy", how: "framed", suspect: v.suspect, pts: 4 });
  }
  return G;
}
function endRound(G, o) {
  const R = G.R, gain = {};
  if (o.winner === "spy") gain[R.spy] = o.pts || 2;
  else for (const p of ids(G)) if (p !== R.spy) gain[p] = 1 + (o.how === "caught" && !o.final && o.by === p ? 1 : 0);
  for (const [p, n] of Object.entries(gain)) G.scores[p] += n;
  R.outcome = { ...o, gain, spy: R.spy, loc: R.loc };
  R.vote = null;
  G.history.push({ round: G.round, loc: R.loc, spy: R.spy, winner: o.winner, how: o.how });
  G.phase = "roundOver"; bump(G, { kind: "roundOver", outcome: structuredClone(R.outcome) });
  return G;
}
function finish(G) {
  G.phase = "gameOver";
  const rows = G.players.map(p => ({ pid: p.id, points: G.scores[p.id] })).sort((a, b) => b.points - a.points);
  G.result = { rows, winners: rows.filter(r => r.points === rows[0].points).map(r => r.pid) };
  bump(G, { kind: "gameOver" });
  return G;
}

export function viewFor(G, pid) {
  const R = G.R, spy = R.spy === pid, open = G.phase === "roundOver" || G.phase === "gameOver";
  return {
    game: "spyfall", gameId: G.gameId, seq: G.seq, phase: G.phase, me: G.players.findIndex(p => p.id === pid), waiting: waitingOn(G),
    round: G.round, rounds: G.settings.rounds, mins: G.settings.mins, dealer: ids(G)[G.dealer],
    you: spy ? { spy: true } : R.roles[pid] ? { spy: false, loc: R.loc, role: R.roles[pid] } : null,
    deadline: R.deadline, left: R.left, asker: R.asker, prevAsker: R.prevAsker, stopped: R.stopped.slice(),
    vote: R.vote ? { by: R.vote.by, suspect: R.vote.suspect, final: R.vote.final, votes: { ...R.vote.votes } } : null,
    finalTurn: R.finalTurn, outcome: open && R.outcome ? { ...R.outcome, roles: { ...R.roles } } : null,
    players: G.players.map(p => ({ id: p.id, name: p.name, score: G.scores[p.id] })), history: G.history.slice(),
    last: structuredClone(G.last), result: G.result ? structuredClone(G.result) : null,
  };
}
// timer / bots: vote on a hunch, accuse someone at random when it's their turn to accuse
export function smartAction(G, pid) {
  if (G.phase === "vote" && waitingOn(G).includes(pid)) return { type: "vote", yes: pid === G.R.spy ? true : Math.random() < .5 };
  if (G.phase === "final" && waitingOn(G)[0] === pid) { const o = ids(G).filter(p => p !== pid); return { type: "accuse", target: o[Math.floor(Math.random() * o.length)] }; }
  return null;
}
export const autoAction = smartAction;
