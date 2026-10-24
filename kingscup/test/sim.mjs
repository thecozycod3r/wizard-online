// node kingscup/test/sim.mjs — Kings Cup games end on the 4th King; mates, roles and targets behave.
import * as E from "../engine.js";
import { rankOf } from "../../drinks/cards.js";
let fails = 0; const bad = m => { fails++; if (fails < 10) console.log("FAIL", m); }; const ok = (c, m) => (c ? console.log("ok  ", m) : bad(m));
let cups = 0, games = 0;
for (let g = 0; g < 4000; g++) {
  const n = 3 + (g % 10), G = E.newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), { jack: g % 2 ? "rule" : "thumb", queen: g % 3 ? "never" : "question" });
  let steps = 0;
  while (G.phase !== "gameOver" && steps++ < 500) { const [pid] = E.waitingOn(G); try { E.act(G, pid, E.autoAction(G, pid)); } catch (e) { bad(e.message); break; } }
  if (G.phase !== "gameOver") bad("never ended");
  const kings = G.drawn.filter(c => rankOf(c) === 13).length;
  if (kings !== 4 && G.deck.length) bad("ended early");
  if (G.result.cup) { cups++; if (rankOf(G.drawn[G.drawn.length - 1]) !== 13) bad("cup without a King"); }
  if (G.drawn.length + G.deck.length !== 52) bad("card count");
  games++;
}
ok(fails === 0, `${games} games, ${cups} ended with someone drinking the cup`);
{ const G = E.newGame([{ id: "a" }, { id: "b" }, { id: "c" }].map(p => ({ ...p, name: p.id })));
  G.turn = 0; G.deck.push("8H"); E.act(G, "a", { type: "draw" });
  let threw = false; try { E.act(G, "a", { type: "done" }); } catch { threw = true; }
  ok(threw, "an 8 needs a mate picked"); E.act(G, "a", { type: "done", target: "b" });
  ok(G.mates.a === "b" && E.chain(G, "a").includes("b"), "mates are linked and drink together");
  G.deck.push("11S"); E.act(G, "b", { type: "draw" }); ok(G.roles.thumb === "b", "a Jack makes the drawer Thumb Master"); }
console.log(fails ? `${fails} FAILURES` : "all checks passed"); process.exitCode = fails ? 1 : 0;
