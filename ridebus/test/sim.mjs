// node ridebus/test/sim.mjs — Ride the Bus games run all three stages; guesses, drinks and the pyramid add up.
import * as E from "../engine.js";
let fails = 0; const bad = m => { fails++; if (fails < 10) console.log("FAIL", m); }; const ok = (c, m) => (c ? console.log("ok  ", m) : bad(m));
ok(E.right(0, "red", "5H", []) && !E.right(0, "red", "5S", []), "red/black");
ok(E.right(1, "higher", "9S", ["5H"]) && !E.right(1, "higher", "5S", ["5H"]), "higher/lower; equal is wrong");
ok(E.right(2, "inside", "7S", ["5H", "10D"]) && E.right(2, "outside", "12S", ["5H", "10D"]) && !E.right(2, "inside", "5S", ["5H", "10D"]), "inside/outside; equal is wrong");
ok(E.right(3, "C", "4C", []), "suit");
let games = 0, rides = 0, maxTries = 0;
for (let g = 0; g < 3000; g++) {
  const n = 2 + (g % 9), G = E.newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })));
  let steps = 0, given = 0;
  while (G.phase !== "gameOver" && steps++ < 5000) {
    if (G.phase === "flip") { E.act(G, "p0", { type: "flip" }); continue; }
    const w = E.waitingOn(G); if (!w.length) { bad("stuck in " + G.phase); break; }
    for (const pid of w) { const a = E.smartAction(G, pid); try { E.act(G, pid, a); } catch (e) { bad(e.message + " " + G.phase); } }
    if (G.stage === "guess" && Object.values(G.hands).some(h => h.length > 4)) bad("more than 4 cards in stage 1");
  }
  if (G.phase !== "gameOver") bad("never ended");
  if (G.pyramid.length !== 10) bad("pyramid size");
  given = Object.values(G.given).reduce((s, x) => s + x, 0);
  if (given < 0) bad("negative");
  rides++; maxTries = Math.max(maxTries, G.result.tries); games++;
}
ok(fails === 0, `${games} games ran all three stages (longest bus ride: ${maxTries} misses)`);
console.log(fails ? `${fails} FAILURES` : "all checks passed"); process.exitCode = fails ? 1 : 0;
