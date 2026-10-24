// node skullking/test/sim.mjs — thousands of Skull King games + targeted rules checks.
import * as E from "../engine.js";
let fails = 0;
const bad = m => { fails++; if (fails < 10) console.log("FAIL", m); };
const ok = (c, m) => (c ? console.log("ok  ", m) : bad(m));
const P = (pid, id, as) => ({ pid, id, ...(as ? { as } : {}) });
const W = t => E.winner(t.map((x, i) => (typeof x === "string" ? P("p" + i, x) : x)));
ok(E.deck().length === 70 && new Set(E.deck()).size === 70, "70 cards");
ok(W(["g-05", "g-12", "y-14"]) === 1, "highest of the led suit wins");
ok(W(["g-14", "k-01"]) === 1, "any black beats the led suit");
ok(W(["esc-1", "y-03", "y-09"]) === 2, "an escape lead: the next card sets the suit");
ok(W(["k-14", "pir-1"]) === 1 && W(["pir-1", "pir-2"]) === 0, "pirates beat suits; first pirate wins");
ok(W(["pir-1", "sk"]) === 1, "Skull King beats pirates");
ok(W(["sk", "pir-2", "mer-1"]) === 2 && W(["mer-1", "sk"]) === 0, "a mermaid captures the Skull King");
ok(W(["mer-1", "pir-3"]) === 1, "a pirate beats a mermaid");
ok(W(["mer-1", "k-14"]) === 0, "a mermaid beats suits");
ok(W(["esc-1", "esc-2", P("p2", "tig", "escape")]) === 0, "all escapes: the first wins");
ok(W([P("p0", "tig", "pirate"), "pir-1"]) === 0, "Tigress as a pirate counts as the first pirate");
ok(E.trickBonus([P("a", "sk"), P("b", "pir-1"), P("c", "pir-2")], 0) === 60, "Skull King +30 per pirate");
ok(E.trickBonus([P("a", "pir-1"), P("b", "mer-1"), P("c", "k-14")], 0) === 40, "pirate +20 per mermaid, black 14 +20");
ok(E.trickBonus([P("a", "sk"), P("b", "mer-1")], 1) === 40, "mermaid takes the Skull King +40");
ok(E.roundPoints(3, 3, 10, 5) === 70 && E.roundPoints(2, 4, 30, 5) === -20 && E.roundPoints(0, 0, 0, 6) === 60 && E.roundPoints(0, 1, 0, 6) === -60, "scoring: 20/trick + bonus, -10/off, zero bids ±10×round");
ok(E.leadSuit([P("a", "pir-1"), P("b", "g-04")]) === null, "a character lead: no suit to follow");
ok(E.roundsFor(6) === 10 && E.roundsFor(7) === 10 && E.roundsFor(8) === 8, "rounds: 10, but 8 with 8 players");
const st = { games: 0, tricks: 0, made: 0, bids: 0 };
for (let g = 0; g < 3000; g++) {
  const n = 2 + (g % 7), G = E.newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), { rounds: g % 5 ? 0 : 3 });
  let steps = 0;
  while (G.phase !== "gameOver" && steps++ < 50000) {
    if (G.phase === "trickDone" || G.phase === "roundOver") { E.act(G, "p0", { type: "next" }); continue; }
    if (G.phase === "bid") { const total = Object.values(G.hands).flat().length; if (total !== n * G.round) bad("deal size"); }
    for (const pid of E.waitingOn(G)) {
      const a = (+pid.slice(1) % 2 ? E.autoAction : E.smartAction)(G, pid);
      if (a.type === "play" && !E.legal(G, pid).includes(a.card)) bad("bot picked an illegal card");
      try { E.act(G, pid, a); } catch (e) { bad("threw " + e.message); }
      if (G.last?.kind === "trick") st.tricks++;
    }
  }
  if (G.phase !== "gameOver") bad("never ended");
  for (const h of G.history) for (const p of G.players) { st.bids++; if (h.bids[p.id] === h.won[p.id]) st.made++; if (Object.values(h.won).reduce((s, x) => s + x, 0) !== h.round) bad("tricks don't add up"); }
  st.games++;
}
console.log({ ...st, bidsMade: (st.made / st.bids * 100).toFixed(0) + "%" });
console.log(fails ? `${fails} FAILURES` : "all checks passed"); process.exitCode = fails ? 1 : 0;
