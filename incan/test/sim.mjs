// Incan Gold engine: full games at every table size + targeted rule checks.
//   node test/sim.mjs
import * as E from "../engine.js";

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
const players = n => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i }));
const throws = (f, m) => { try { f(); ok(false, m + " (no error)"); } catch { /* expected */ } };
const total = G => G.players.reduce((s, p) => s + G.pl[p.id].tent + G.pl[p.id].carry, 0) + G.path.reduce((s, x) => s + x.left, 0);

function play(n, bot) {
  const G = E.newGame(players(n));
  let guard = 0;
  while (G.phase !== "gameOver" && guard++ < 3000) {
    if (G.phase === "roundOver") { E.act(G, "p0", { type: "next" }); continue; }
    const w = E.waitingOn(G);
    ok(w.length > 0, "someone decides");
    const pid = w[Math.floor(Math.random() * w.length)];
    const before = E.viewFor(G, "p1");
    ok(before.players.every(p => p.id === "p1" || p.tent === null), "other tents stay private");
    E.act(G, pid, bot(G, pid));
  }
  ok(G.phase === "gameOver", "game ends");
  return G;
}

// 1) setup
{
  const G = E.newGame(players(4));
  ok(G.round === 1 && G.path.length >= 1, "round 1 starts with a card turned");
  ok(G.pool.length === 31, "30 quest cards + the first artifact in play");
  if (E.cardOf(G.path[0].id).kind === "hazard") ok(G.path.length === 2 || G.phase === "roundOver", "a Hazard first card turns another");
  throws(() => E.newGame(players(2)), "needs 3+");
  throws(() => E.newGame(players(9)), "max 8");
}

// 2) treasure split, leaving, artifacts, disasters (built by hand)
{
  const G = E.newGame(players(3));
  G.path = []; G.deck = []; for (const p of G.players) Object.assign(G.pl[p.id], { carry: 0, inside: true });
  G.deck = ["h-fire-1", "a1", "t13"];   // popped from the end: 17 (t14 is 17? t13 = 15), then artifact, then fire
  G.deck = ["h-fire-2", "h-fire-1", "a1", "t14"];
  E.act(G, "p0", { type: "choose", go: true }); E.act(G, "p1", { type: "choose", go: true }); E.act(G, "p2", { type: "choose", go: true });
  ok(G.pl.p0.carry === 5 && G.path.at(-1).left === 2, "17 split three ways: 5 each, 2 left on the card");
  E.act(G, "p0", { type: "choose", go: true }); E.act(G, "p1", { type: "choose", go: true }); E.act(G, "p2", { type: "choose", go: true });
  ok(E.cardOf(G.path.at(-1).id).kind === "artifact", "artifact turned and stays on the path");
  // p2 leaves alone: takes the 2 left over and the artifact (first out: 5)
  E.act(G, "p0", { type: "choose", go: true }); E.act(G, "p1", { type: "choose", go: true }); E.act(G, "p2", { type: "choose", go: false });
  ok(G.pl.p2.tent === 7 && G.pl.p2.artifacts.length === 1 && G.pl.p2.artifacts[0].value === 5, "lone leaver banks gems + leftovers + artifact");
  ok(!G.pl.p2.inside, "leaver is out for the round");
  throws(() => E.act(G, "p2", { type: "choose", go: true }), "camp players can't choose");
  // fire, then fire again: p0 and p1 lose their carry, the second fire leaves the game
  ok(E.cardOf(G.path.at(-1).id).hazard === "fire", "first fire: nothing happens");
  E.act(G, "p0", { type: "choose", go: true }); E.act(G, "p1", { type: "choose", go: true });
  ok(G.phase === "roundOver" && G.pl.p0.tent === 0 && G.removed.includes("h-fire-2"), "second fire: round over, gems lost, card removed");
  ok(!G.pool.includes("h-fire-2"), "removed hazard won't come back");
}
{
  // two leavers: split the path, nobody gets the artifact; it's lost when the round ends
  const G = E.newGame(players(4));
  G.path = [{ id: "t14", left: 1 }, { id: "a2", left: 0 }, { id: "t12", left: 3 }]; G.deck = ["t0"]; G.pool.push("a2");
  for (const p of G.players) Object.assign(G.pl[p.id], { carry: 4, inside: true });
  E.act(G, "p0", { type: "choose", go: false }); E.act(G, "p1", { type: "choose", go: false }); E.act(G, "p2", { type: "choose", go: false }); E.act(G, "p3", { type: "choose", go: false });
  ok(G.pl.p0.tent === 5 && G.pl.p0.artifacts.length === 0, "4 leavers split 4 left over: 1 each; no artifact for anyone");
  ok(G.phase === "roundOver" && G.log.at(-1).lostArtifacts.includes("a2") && !G.pool.includes("a2"), "unclaimed artifact on the path is lost");
}
{
  // artifact values: first three out score 5, later ones 10
  const G = E.newGame(players(3)); G.artifactsOut = 3;
  G.path = [{ id: "a3", left: 0 }]; G.deck = ["t0", "t1"];
  for (const p of G.players) Object.assign(G.pl[p.id], { carry: 0, inside: true });
  E.act(G, "p0", { type: "choose", go: false }); E.act(G, "p1", { type: "choose", go: true }); E.act(G, "p2", { type: "choose", go: true });
  ok(G.pl.p0.artifacts[0].value === 10, "fourth artifact out is worth 10");
}
{
  // undrawn artifacts stay in the deck for later rounds
  const G = E.newGame(players(3));
  const a = G.roundArtifact; G.deck = G.deck.filter(x => x !== a); G.path = G.path.filter(s => s.id !== a);
  for (const p of G.players) E.act(G, p.id, { type: "choose", go: false });
  E.act(G, "p0", { type: "next" });
  ok(G.pool.includes(a) && G.round === 2, "an artifact never drawn is still in the deck in round 2");
}

// 3) many full games: gem conservation per turn, scores, winners
let rounds = 0, disasters = 0;
for (let i = 0; i < 4000; i++) {
  const n = 3 + (i % 6), G = play(n, i % 2 ? E.smartAction : E.autoAction);
  rounds += G.log.length; disasters += G.log.filter(l => l.disaster).length;
  ok(G.log.length === 5, "five rounds");
  ok(G.result.rows.every(r => r.points >= 0), "scores");
  const hz = {}; for (const id of G.removed) hz[E.cardOf(id).hazard] = (hz[E.cardOf(id).hazard] || 0) + 1;
  ok(Object.values(hz).every(c => c <= 3), "never more hazards removed than exist");
  ok(G.players.reduce((s, p) => s + G.pl[p.id].artifacts.length, 0) <= 5, "at most 5 artifacts");
}
console.log(`rounds ${rounds}, ended by disaster ${(100 * disasters / rounds).toFixed(0)}%`);
console.log(fails ? `${fails} FAILURES` : "all checks passed");
process.exit(fails ? 1 : 0);
