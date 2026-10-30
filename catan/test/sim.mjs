// Bot-vs-bot games across every module mix and table size; checks the rules hold and every game ends.
import * as E from "../engine.js";
const N = +(process.argv[2] || 300);
const combos = [[false, false], [true, false], [false, true], [true, true]];
let games = 0, turns = 0, maxT = 0, stuck = 0;
const wins = {}, ends = { target: 0, cap: 0 };
for (const [sea, raiders] of combos) for (let n = 2; n <= 6; n++) for (let g = 0; g < N / 4; g++) {
  const players = Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i }));
  const G = E.newGame(players, { sea, raiders, seed: g * 977 + n });
  let steps = 0;
  while (G.phase !== "gameOver") {
    const pid = E.waitingOn(G)[0];
    const a = E.botAction(G, pid);
    try { E.act(G, pid, a); } catch (e) {
      // a bot proposal the engine refuses must never loop forever: fall back to ending the turn
      if (++stuck > 50000) throw new Error("bot stuck: " + e.message + " " + JSON.stringify(a));
      E.act(G, pid, G.phase === "roll" ? { type: "roll" } : { type: "end" });
    }
    if (++steps > 20000) throw new Error(`no end: sea=${sea} raiders=${raiders} n=${n}`);
    for (const p of G.players) for (const [r, v] of Object.entries(G.hands[p.id])) if (v < 0 || !Number.isInteger(v)) throw new Error(`bad hand ${r}=${v}`);
    const at = new Set(G.builds.map(b => b.v));
    if (at.size !== G.builds.length || G.builds.some(b => E.vNbrs(b.v).some(u => at.has(u)))) throw new Error("outposts too close");
  }
  games++; turns += G.turnNo; maxT = Math.max(maxT, G.turnNo);
  if (G.result.winners.length === 1 && E.renown(G, G.result.winners[0]) >= G.target) ends.target++; else ends.cap++;
  const key = `${sea ? "S" : "-"}${raiders ? "R" : "-"}${n}`; (wins[key] ||= []).push(G.round);
}
console.log({ games, avgTurns: (turns / games).toFixed(1), maxT, ends, refused: stuck });
for (const [k, r] of Object.entries(wins)) console.log(k, "avg rounds", (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1), "max", Math.max(...r));
// seat advantage: win share by seat at 4 players, base + both modules
{
  const seat = [0, 0, 0, 0]; let g = 0;
  for (let i = 0; i < 600; i++) {
    const G = E.newGame([0, 1, 2, 3].map(k => ({ id: "p" + k, name: "P" + k })), { sea: i % 2 === 0, raiders: i % 3 === 0, seed: 5000 + i });
    while (G.phase !== "gameOver") { const pid = E.waitingOn(G)[0]; try { E.act(G, pid, E.botAction(G, pid)); } catch { E.act(G, pid, G.phase === "roll" ? { type: "roll" } : { type: "end" }); } }
    for (const w of G.result.winners) seat[+w.slice(1)]++; g++;
  }
  console.log("4p seat win share", seat.map(x => (x / g * 100).toFixed(0) + "%").join(" "));
}
