// node codenames/test/sim.mjs — random games plus scripted rule checks.
import * as E from "../engine.js";
import { WORDS } from "../words.js";
let fails = 0; const bad = m => { fails++; if (fails < 12) console.log("FAIL", m); }; const ok = (c, m) => (c ? console.log("ok  ", m) : bad(m));
const mk = n => E.newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), { timer: 120 });
ok(WORDS.length >= 390 && new Set(WORDS.map(w => w.toLowerCase())).size === WORDS.length, `${WORDS.length} distinct words`);
{ const G = mk(4); ok(G.words.length === 25 && new Set(G.words).size === 25, "25 distinct words on the board");
  const c = t => G.key.filter(k => k === t).length; ok(c(G.start) === 9 && c(E.other(G.start)) === 8 && c("neutral") === 7 && c("assassin") === 1, "9 / 8 / 7 bystanders / 1 assassin");
  ok(E.viewFor(G, "p2").key.every(k => k === null) && E.viewFor(G, "p0").key.every(Boolean), "only spymasters see the key"); }
let games = 0, how = {};
for (let g = 0; g < 4000; g++) {
  const n = 4 + (g % 9), G = mk(n); let steps = 0;
  E.act(G, "p" + (n - 1), { type: "team", team: "red" }); if (!E.ready(G)) E.act(G, "p" + (n - 1), { type: "team", team: "blue" });
  try { E.act(G, "p2", { type: "begin" }); } catch (e) { bad("begin: " + e.message); continue; }
  while (G.phase !== "gameOver" && steps++ < 500) {
    const w = E.waitingOn(G);
    try {
      if (G.phase === "clue") E.act(G, w[0], Math.random() < .1 ? E.smartAction(G, w[0]) : { type: "clue", word: "zzclue" + steps, n: Math.floor(Math.random() * 4) });
      else if (Math.random() < .1 && G.guesses) E.act(G, w[0], { type: "end" });
      else if (Math.random() < .03) E.act(G, w[0], { type: "timeout" });
      else { const mine = G.key.map((k, i) => [k, i]).filter(([k, i]) => !G.open[i]); const pickOwn = Math.random() < .6 ? mine.find(([k]) => k === G.turn) : null; const [, i] = pickOwn || mine[Math.floor(Math.random() * mine.length)]; E.act(G, w[Math.floor(Math.random() * w.length)], { type: "guess", i }); }
    } catch (e) { bad(`${G.phase}: ${e.message}`); break; }
  }
  if (G.phase !== "gameOver") { bad("never ended"); continue; }
  const r = G.result; how[r.how] = (how[r.how] || 0) + 1;
  if (r.how === "words" && E.left(G, r.winner) !== 0) bad("won by words with words left");
  games++;
}
ok(fails === 0, `${games} games over 4–12 players; endings ${JSON.stringify(how)}`);
{ const G = mk(4); E.act(G, "p0", { type: "begin" }); const sm = G.spy[G.turn], word = G.words[0];
  let threw = false; try { E.act(G, sm, { type: "clue", word, n: 1 }); } catch { threw = true; } ok(threw, "clue can't be a word on the board");
  threw = false; try { E.act(G, sm, { type: "clue", word: "two words", n: 1 }); } catch { threw = true; } ok(threw, "clue is one word");
  E.act(G, sm, { type: "clue", word: "zzz", n: 1 }); const op = E.waitingOn(G)[0];
  threw = false; try { E.act(G, op, { type: "end" }); } catch { threw = true; } ok(threw, "must guess at least once");
  const own = G.key.map((k, i) => [k, i]).filter(([k]) => k === G.turn).map(x => x[1]); const t = G.turn;
  E.act(G, op, { type: "guess", i: own[0] }); ok(G.turn === t && G.phase === "guess", "right guess: keep going");
  E.act(G, op, { type: "guess", i: own[1] }); ok(G.turn !== t && G.phase === "clue", "number + 1 guesses then the turn ends"); }
{ const G = mk(4); E.act(G, "p0", { type: "begin" }); E.act(G, G.spy[G.turn], { type: "clue", word: "zzz", n: 2 });
  const t = G.turn, a = G.key.indexOf("assassin"); E.act(G, E.waitingOn(G)[0], { type: "guess", i: a }); ok(G.phase === "gameOver" && G.result.winner === E.other(t), "assassin loses the game"); }
{ const G = mk(4); E.act(G, "p0", { type: "begin" }); E.act(G, G.spy[G.turn], { type: "clue", word: "zzz", n: 2 });
  const t = G.turn, nb = G.key.indexOf("neutral"); E.act(G, E.waitingOn(G)[0], { type: "guess", i: nb }); ok(G.turn === E.other(t), "bystander ends the turn"); }
{ const G = mk(5); E.act(G, "p0", { type: "team", team: "blue" }); ok(!E.ready(G), "a team without a spymaster can't start");
  E.act(G, "p2", { type: "spymaster" }); ok(E.ready(G), "…until someone steps up"); }
{ const G = mk(4); E.act(G, "p0", { type: "begin" }); const t = G.turn, sm = G.spy[t], op = E.waitingOn(G)[0];
  ok(E.botAction(G, sm, [sm])?.auto, "bot spymaster gives a blank clue"); E.act(G, sm, E.botAction(G, sm, [sm]));
  const opp = E.waitingOn(G)[0];
  ok(E.botAction(G, opp, []) === null, "bot stays quiet while a human teammate can guess");
  const a = E.botAction(G, opp, [opp]); ok(a?.type === "guess", "bot guesses when its team has no human guesser");
  ok(E.smartAction(G, opp)?.type === "timeout", "turn timer out: the guessing turn passes"); void op; }
console.log(fails ? `${fails} FAILURES` : "all checks passed"); process.exitCode = fails ? 1 : 0;
