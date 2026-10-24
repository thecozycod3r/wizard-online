// node nimmt/test/sim.mjs — thousands of 6 Nimmt! games with random and smart players; rules checked every step.
import * as E from "../engine.js";
let fails = 0;
const bad = m => { fails++; if (fails < 10) console.log("FAIL", m); };
const ok = (c, m) => (c ? console.log("ok  ", m) : bad(m));
const stats = { games: 0, rounds: 0, takes: 0, chosen: 0, smartWins: 0, smartGames: 0 };
for (let g = 0; g < 3000; g++) {
  const n = 2 + (g % 9), players = Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i }));
  const G = E.newGame(players, { target: g % 4 === 0 ? 0 : 66 });
  let steps = 0;
  while (G.phase !== "gameOver" && steps++ < 20000) {
    if (G.phase === "roundOver") { E.act(G, "p0", { type: "next" }); stats.rounds++; continue; }
    // cards in play: hands + rows + revealed-but-unplaced always total 104 minus what's been taken this round
    for (const pid of E.waitingOn(G)) {
      const a = (pid === "p0" ? E.smartAction : E.autoAction)(G, pid);
      try { E.act(G, pid, a); } catch (e) { bad("threw " + e.message); break; }
      if (G.last?.steps) for (const s of G.last.steps) { if (s.took) { stats.takes++; if (s.took.length !== 5 && !s.chosen) bad("took a row that wasn't full"); if (s.chosen) stats.chosen++; } }
      if (G.rows.some(r => r.length > 5)) bad("row longer than 5");
      for (const r of G.rows) for (let i = 1; i < r.length; i++) if (r[i] <= r[i - 1]) bad("row not ascending");
    }
  }
  if (G.phase !== "gameOver") bad("never ended");
  const total = Object.values(G.score).reduce((s, x) => s + x, 0);
  if (total < 0) bad("negative");
  stats.games++; stats.smartGames++; if (G.result.winners.includes("p0")) stats.smartWins++;
}
ok(E.bulls(55) === 7 && E.bulls(11) === 5 && E.bulls(10) === 3 && E.bulls(5) === 2 && E.bulls(7) === 1 && E.bulls(100) === 3, "bull heads: 55=7, 11s=5, 10s=3, 5s=2, else 1");
ok(Array.from({ length: 104 }, (_, i) => E.bulls(i + 1)).reduce((s, x) => s + x, 0) === 171, "the deck holds 171 bull heads");
{ // the 6th card takes the row; a card lower than every row makes its player choose
  const G = E.newGame([{ id: "a", name: "A" }, { id: "b", name: "B" }], { target: 66 });
  G.rows = [[10, 11, 12, 13, 14], [30], [50], [70]]; G.hands = { a: [15, 1], b: [99, 2] };
  E.act(G, "a", { type: "pick", card: 15 }); E.act(G, "b", { type: "pick", card: 99 });
  ok(G.score.a === E.rowBulls([10, 11, 12, 13, 14]) && G.rows[0].join() === "15", "sixth card takes the five and starts the row");
  E.act(G, "a", { type: "pick", card: 1 }); E.act(G, "b", { type: "pick", card: 2 });
  ok(G.phase === "row" && G.chooser === "a", "lowest card fits nowhere: its player picks a row");
  E.act(G, "a", { type: "row", row: 1 });
  ok(G.score.a === 15 - 15 + E.rowBulls([10, 11, 12, 13, 14]) + E.bulls(30) && G.rows[1].join() === "1,2", "chosen row taken (bulls added), then the next card goes on top of it");
}
const winRate = (stats.smartWins / stats.smartGames * 100).toFixed(0);
console.log({ ...stats, smartWinRate: winRate + "%" });
console.log(fails ? `${fails} FAILURES` : "all checks passed"); process.exitCode = fails ? 1 : 0;
