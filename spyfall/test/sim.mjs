// node spyfall/test/sim.mjs — bot games (accusations, votes, spy guesses, time-ups) plus scripted scoring checks.
import * as E from "../engine.js";
import { LOCATIONS } from "../locations.js";
let fails = 0; const bad = m => { fails++; if (fails < 12) console.log("FAIL", m); }; const ok = (c, m) => (c ? console.log("ok  ", m) : bad(m));
const mk = (n, s = {}) => E.newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), s);
ok(LOCATIONS.length === 30 && LOCATIONS.every(l => l.roles.length === 7) && new Set(LOCATIONS.map(l => l.id)).size === 30, "30 locations × 7 roles");
let games = 0, how = {};
for (let g = 0; g < 3000; g++) {
  const n = 3 + (g % 8), G = mk(n, { rounds: [3, 5, 8][g % 3] }); let steps = 0;
  while (G.phase !== "gameOver" && steps++ < 2000) {
    const ids = G.players.map(p => p.id), R = G.R, r = Math.random();
    try {
      if (G.phase === "play") {
        if (r < .3) { const others = ids.filter(p => p !== R.asker && p !== R.prevAsker); E.act(G, R.asker, { type: "ask", target: others[0] }); }
        else if (r < .55) { const who = ids.find(p => !R.stopped.includes(p)); if (who) E.act(G, who, { type: "accuse", target: ids.find(p => p !== who) }); else { R.deadline = 0; E.act(G, ids[0], { type: "timeup" }); } }
        else if (r < .65) E.act(G, R.spy, { type: "guess", loc: Math.random() < .5 ? R.loc : LOCATIONS[0].id });
        else { R.deadline = 0; E.act(G, ids[0], { type: "timeup" }); }
      } else if (G.phase === "roundOver") E.act(G, ids[0], { type: "next" });
      else { const w = E.waitingOn(G); if (!w.length) { bad("stuck " + G.phase); break; } E.act(G, w[0], E.smartAction(G, w[0])); }
    } catch (e) { bad(`${G.phase}: ${e.message}`); break; }
    if (G.phase === "roundOver") how[G.R.outcome.how] = (how[G.R.outcome.how] || 0) + 1;
  }
  if (G.phase !== "gameOver") { bad("never ended"); continue; }
  if (G.history.length !== G.settings.rounds || new Set(G.history.map(h => h.loc)).size !== G.history.length) bad("rounds / repeated location");
  games++;
}
ok(fails === 0, `${games} games over 3–10 players; endings ${JSON.stringify(how)}`);
{ const G = mk(4); const spy = G.R.spy, t = G.players.map(p => p.id).filter(p => p !== spy), acc = t[0];
  ok(E.viewFor(G, spy).you.spy && !E.viewFor(G, spy).you.loc && E.viewFor(G, t[0]).you.loc === G.R.loc, "spy sees no location; others do");
  E.act(G, acc, { type: "accuse", target: spy }); ok(G.phase === "vote" && !E.waitingOn(G).includes(spy) && !E.waitingOn(G).includes(acc), "suspect doesn't vote, accuser already said yes");
  for (const p of E.waitingOn(G)) E.act(G, p, { type: "vote", yes: true });
  ok(G.phase === "roundOver" && G.scores[acc] === 2 && G.scores[t[1]] === 1 && G.scores[spy] === 0, "spy caught mid-round: accuser 2, others 1"); }
{ const G = mk(4); const spy = G.R.spy, t = G.players.map(p => p.id).filter(p => p !== spy);
  E.act(G, t[0], { type: "accuse", target: t[1] }); for (const p of E.waitingOn(G)) E.act(G, p, { type: "vote", yes: true });
  ok(G.scores[spy] === 4, "innocent convicted: spy 4"); }
{ const G = mk(4); const spy = G.R.spy, t = G.players.map(p => p.id).filter(p => p !== spy);
  E.act(G, t[0], { type: "accuse", target: spy }); E.act(G, E.waitingOn(G)[0], { type: "vote", yes: false });
  ok(G.phase === "play", "one no: the clock runs again");
  let threw = false; try { E.act(G, t[0], { type: "accuse", target: spy }); } catch { threw = true; } ok(threw, "only one clock stop per player per round");
  E.act(G, spy, { type: "guess", loc: G.R.loc }); ok(G.scores[spy] === 4, "spy guesses right: 4"); }
{ const G = mk(3); G.R.deadline = 0; E.act(G, "p0", { type: "timeup" }); ok(G.phase === "final", "time up: accusations in turn");
  for (let i = 0; i < 3; i++) { const w = E.waitingOn(G)[0]; E.act(G, w, { type: "accuse", target: G.players.map(p => p.id).find(p => p !== w) }); if (G.phase === "vote") E.act(G, E.waitingOn(G)[0], { type: "vote", yes: false }); }
  ok(G.phase === "roundOver" && G.scores[G.R.spy] === 2, "nobody convicted after everyone accused: spy 2");
  let threw = false; try { E.act(G, G.R.spy, { type: "guess", loc: G.R.loc }); } catch { threw = true; } ok(threw, "no guessing once the round is over"); }
console.log(fails ? `${fails} FAILURES` : "all checks passed"); process.exitCode = fails ? 1 : 0;
