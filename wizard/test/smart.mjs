// The timer's auto-move should play legally everywhere and make far more bids than random play.
import { newGame, act, autoAction, smartAction, waitingOn, SPECIALS } from "../engine.js";
import assert from "node:assert/strict";
function run(chooser, games) {
  let made = 0, total = 0;
  for (let g = 0; g < games; g++) {
    const n = 3 + (g % 4);
    const G = newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), { specials: SPECIALS, rounds: 8 });
    let steps = 0;
    while (G.phase !== "gameOver") {
      assert(++steps < 20000);
      if (G.phase === "trickShow") { act(G, null, { type: "resolve" }); continue; }
      if (G.phase === "roundEnd") { act(G, null, { type: "nextRound" }); continue; }
      const pid = waitingOn(G)[0];
      act(G, pid, chooser(G, pid));  // throws if the move were illegal
    }
    for (const s of G.scores) for (const r of Object.values(s.rows)) { total++; if (r.bid === r.won) made++; }
  }
  return made / total;
}
const smart = run(smartAction, 600), rand = run(autoAction, 600);
console.log(`bids made — smart: ${(smart * 100).toFixed(1)}%  random: ${(rand * 100).toFixed(1)}%`);
assert(smart > rand + 0.1, "smart play should clearly beat random");
