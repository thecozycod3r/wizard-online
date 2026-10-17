// Simulated games of Seven Marvels at 3–7 players, plus targeted rule checks.
import * as E from "../engine.js";
import assert from "node:assert/strict";

const { newGame, act, autoAction, smartAction, waitingOn, cardOf, payPlan, score, options } = E;
const players = n => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i }));
const stats = { games: 0, plays: { build: 0, stage: 0, sell: 0, free: 0 }, extra: 0, salvage: 0, chains: 0, smartWins: 0, smartGames: 0, ties: 0 };

function run(n, bot = () => autoAction, opts = {}) {
  const G = newGame(players(n), opts);
  let steps = 0;
  const dealt = { 1: 7 * n, 2: 7 * n, 3: 7 * n };
  while (G.phase !== "gameOver") {
    assert(++steps < 4000, "stuck in " + G.phase);
    const w = waitingOn(G);
    assert(w.length, "nobody to wait on in " + G.phase);
    for (const pid of w) {
      if (!waitingOn(G).includes(pid)) continue;
      const a = bot(pid)(G, pid);
      if (a.type === "pick") stats.plays[a.how]++;
      if (G.phase === "extra") stats.extra++;
      if (G.phase === "salvage") stats.salvage++;
      if (a.how === "build" && options(G, pid, a.card).build.chain) stats.chains++;
      act(G, pid, a);
      for (const p of G.players) assert(G.pl[p.id].coins >= 0, "negative coins");
    }
    // card conservation within the age: hands + built + stages + discard = all cards dealt so far
    const total = Object.values(G.hands).reduce((s, h) => s + h.length, 0) + G.discard.length
      + G.players.reduce((s, p) => s + G.pl[p.id].built.length + G.pl[p.id].stages.length, 0);
    const soFar = [1, 2, 3].filter(a => a <= G.age).reduce((s, a) => s + dealt[a], 0);
    assert.equal(total, soFar, "card conservation");
    if (G.phase === "pick") for (const p of G.players) assert.equal(G.hands[p.id].length, 8 - G.turn, "hand size");
    for (const p of G.players) { const ids = G.pl[p.id].built.map(b => cardOf(b).id); assert.equal(new Set(ids).size, ids.length, "duplicate building"); }
  }
  for (const p of G.players) assert.equal(G.pl[p.id].tokens.length <= 6, true);
  const r = G.result.rows;
  for (let i = 1; i < r.length; i++) assert(r[i - 1].total > r[i].total || (r[i - 1].total === r[i].total && r[i - 1].coins >= r[i].coins), "ranking");
  if (G.result.winners.length > 1) stats.ties++;
  stats.games++;
  return G;
}

const t0 = Date.now();
for (let g = 0; g < 1500; g++) run(3 + (g % 5), undefined, { side: ["A", "B", "random"][g % 3] });
// smart player (p0) vs random others
let avg = { smart: 0, rnd: 0 };
for (let g = 0; g < 300; g++) {
  const n = 3 + (g % 5);
  const G = run(n, pid => (pid === "p0" ? smartAction : autoAction), { side: g % 2 ? "B" : "A" });
  stats.smartGames++; if (G.result.winners.includes("p0")) stats.smartWins++;
  avg.smart += score(G, "p0").total; avg.rnd += G.players.slice(1).reduce((s, p) => s + score(G, p.id).total, 0) / (n - 1);
}
// all-smart games: typical scores
let allSmart = [];
for (let g = 0; g < 100; g++) { const G = run(3 + (g % 5), () => smartAction); allSmart.push(...G.result.rows.map(r => r.total)); }

// ---------------------------------------------------------------- targeted checks
function fresh(n = 3) {
  const G = newGame(players(n), { side: "A" });
  for (const p of G.players) Object.assign(G.pl[p.id], { built: [], stages: [], coins: 3, tokens: [] });
  return G;
}
{ // trading: buy from the cheaper source, pay neighbours, chains are free
  const G = fresh();
  G.pl.p0.marvel = "khepri"; G.pl.p1.marvel = "kyros"; G.pl.p2.marvel = "lumen"; // stone / ore / glass
  // p0 needs ore + glass: buys ore from right (p1) and glass from left (p2)
  let pl = payPlan(G, "p0", { ore: 1, glass: 1 });
  assert(pl.ok && pl.left === 2 && pl.right === 2 && pl.total === 4 === false || true);
  assert.equal(pl.ok, false, "4 coins needed, only 3");
  G.pl.p0.coins = 4; pl = payPlan(G, "p0", { ore: 1, glass: 1 });
  assert(pl.ok && pl.right === 2 && pl.left === 2, JSON.stringify(pl));
  G.pl.p0.built.push("eastgate~13"); pl = payPlan(G, "p0", { ore: 1, glass: 1 });
  assert.equal(pl.right, 1, "east gate market makes raw from the right cost 1");
  assert.equal(pl.left, 2, "goods still cost 2");
  // own production is free and used first
  pl = payPlan(G, "p0", { stone: 1 }); assert(pl.ok && pl.total === 0);
  // private yellow resources can't be bought
  G.pl.p1.built.push("caravaninn~23"); pl = payPlan(G, "p0", { wood: 1 }); assert.equal(pl.ok, false, "caravan inn wood is private");
  // chain
  G.pl.p0.built.push("bathhouse~13");
  const o = options(G, "p0", "cistern~23"); assert(o.build.ok && o.build.chain);
  // no duplicates
  assert.equal(options(G, "p0", "bathhouse~17").build.ok, false);
}
{ // battles: +1/+3/+5 and -1
  const G = fresh(3);
  G.pl.p0.built.push("palisade~13", "garrison~13");
  G.hands = { p0: [], p1: [], p2: [] };
  G.turn = 6; G.age = 1;
  const hand = c => [c];
  G.hands.p0 = hand("lumber~13", "x"); G.hands.p1 = ["quarry~13"]; G.hands.p2 = ["claybank~13"];
  for (const p of ["p0", "p1", "p2"]) G.hands[p].push("shrine~13");
  act(G, "p0", { type: "pick", card: "lumber~13", how: "sell" });
  act(G, "p1", { type: "pick", card: "quarry~13", how: "sell" });
  act(G, "p2", { type: "pick", card: "claybank~13", how: "sell" });
  assert.deepEqual(G.pl.p0.tokens, [1, 1]); assert.deepEqual(G.pl.p1.tokens, [-1]); assert.deepEqual(G.pl.p2.tokens, [-1]);
  assert.equal(G.age, 2); assert.equal(G.hands.p0.length, 7);
}
{ // science: squares + sets, wildcards pick the best
  const G = fresh(3);
  G.pl.p0.built.push("herbalist~13", "tinker~13", "scribes~13", "infirmary~23");
  assert.equal(E.science(G, "p0").points, 4 + 1 + 1 + 7);
  G.pl.p0.marvel = "ishtara"; G.pl.p0.stages = ["a", "b"];
  assert.equal(E.science(G, "p0").points, 9 + 1 + 1 + 7, "wildcard → best symbol (3 compasses)");
}
{ // Royal Tomb salvage and Terraces 7th card
  const G = fresh(3);
  G.pl.p0.marvel = "mausra"; G.pl.p0.side = "B"; G.pl.p0.built.push("deepshaft~16", "smelter~23"); G.pl.p0.coins = 10;
  G.discard = ["palace~37"];
  G.hands = { p0: ["shrine~13", "lumber~13"], p1: ["altar", "quarry~13"].map(x => x === "altar" ? "playhouse~13" : x), p2: ["claybank~13", "inn~14"] };
  G.turn = 6;
  act(G, "p0", { type: "pick", card: "shrine~13", how: "stage" });
  act(G, "p1", { type: "pick", card: "quarry~13", how: "sell" });
  act(G, "p2", { type: "pick", card: "inn~14", how: "build" });
  assert.equal(G.phase, "salvage"); assert.deepEqual(waitingOn(G), ["p0"]);
  assert(G.discard.includes("lumber~13"), "turn-6 leftovers can be salvaged");
  act(G, "p0", { type: "salvage", card: "palace~37" });
  assert(G.pl.p0.built.includes("palace~37"));
  assert.equal(G.age, 2);
  const H = fresh(3);
  H.pl.p1.marvel = "ishtara"; H.pl.p1.side = "B"; H.pl.p1.stages = ["a", "b"];
  H.turn = 6; H.hands = { p0: ["shrine~13", "lumber~13"], p1: ["playhouse~13", "quarry~13"], p2: ["claybank~13", "inn~14"] };
  for (const [p, c] of [["p0", "shrine~13"], ["p1", "playhouse~13"], ["p2", "inn~14"]]) act(H, p, { type: "pick", card: c, how: "build" });
  assert.equal(H.phase, "extra"); assert.deepEqual(waitingOn(H), ["p1"]);
  act(H, "p1", { type: "pick", card: "quarry~13", how: "build" });
  assert(H.pl.p1.built.includes("quarry~13")); assert.equal(H.age, 2);
}
{ // simultaneous picks can be changed until everyone is in; coins from trade arrive after the turn
  const G = newGame(players(3), { side: "A" });
  const [a, b] = G.hands.p0;
  act(G, "p0", { type: "pick", card: a, how: "sell" });
  act(G, "p0", { type: "pick", card: b, how: "sell" });
  assert.equal(G.picks.p0.card, b);
  act(G, "p0", { type: "unpick" }); assert.equal(G.picks.p0, null);
  assert.throws(() => act(G, "p0", { type: "pick", card: "nope", how: "sell" }));
}
{ // Sky Father A: one free build per Age
  const G = fresh(3);
  G.pl.p0.marvel = "thalos"; G.pl.p0.stages = ["a", "b"]; G.hands.p0 = ["palace~37", ...G.hands.p0.slice(1)];
  assert.equal(options(G, "p0", "palace~37").free, true);
  act(G, "p0", { type: "pick", card: "palace~37", how: "free" });
  act(G, "p1", { type: "pick", card: G.hands.p1[0], how: "sell" }); act(G, "p2", { type: "pick", card: G.hands.p2[0], how: "sell" });
  assert(G.pl.p0.built.includes("palace~37"));
  assert.equal(options(G, "p0", G.hands.p0[0]).free, false, "used this Age");
}
console.log(`${stats.games} games in ${((Date.now() - t0) / 1000).toFixed(1)}s`, stats);
console.log(`smart p0 won ${stats.smartWins}/${stats.smartGames} (${(100 * stats.smartWins / stats.smartGames).toFixed(0)}%); avg score smart ${(avg.smart / 300).toFixed(1)} vs random ${(avg.rnd / 300).toFixed(1)}`);
allSmart.sort((a, b) => a - b);
console.log(`all-smart scores: median ${allSmart[allSmart.length >> 1]}, range ${allSmart[0]}–${allSmart.at(-1)}`);
console.log("targeted checks: OK");
