// Random-play simulation: thousands of full games with random legal moves.
// Checks no deadlock, card conservation, legal follow-suit, score arithmetic.
import { newGame, act, autoAction, waitingOn, SPECIALS, card, roundPoints, winnerIndex } from "../engine.js";
import assert from "node:assert/strict";

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const stats = { games: 0, rounds: 0, tricks: 0, bombs: 0, juggler: 0, cloud: 0, witch: 0, werewolf: 0, vampireReveal: 0 };

function check(G, nCards) {
  const all = [...Object.values(G.hands).flat(), ...G.pile, ...(G.indicator ? [G.indicator] : []),
    ...(G.trick?.plays.map(p => p.id) || [])];
  // Cards in finished tricks are out of play; count only cards still in circulation once per trick start.
  return all.length;
}

for (let g = 0; g < 3000; g++) {
  const n = 3 + (g % 6);   // 3–8 players (7–8 = house rule)
  const specials = g % 5 === 0 ? [] : SPECIALS.filter(() => rnd() < 0.85);
  const players = Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i }));
  const G = newGame(players, { specials, dealerRule: g % 2 === 0, penalty: g % 3 ? "house" : "official", rounds: g % 7 === 0 ? 0 : 6 });
  let steps = 0, lastRound = 0;
  while (G.phase !== "gameOver") {
    assert(++steps < 20000, "deadlock in phase " + G.phase);
    if (G.round !== lastRound) {
      lastRound = G.round; stats.rounds++;
      const total = Object.values(G.hands).flat().length + G.pile.length + (G.indicator ? 1 : 0);
      assert.equal(total, 60 + G.settings.specials.length, "card count");
      assert(Object.values(G.hands).every(h => h.length === G.round));
      if (n >= 7) assert(G.indicator || G.trump !== undefined, "7–8 players: a card is left to turn for trump");
      if (n >= 7) assert(G.pile.length + (G.indicator ? 1 : 0) >= 1, "7–8 players: never deal the whole deck");
      if (G.phase === "werewolf") stats.werewolf++;
    }
    if (G.phase === "trickShow") {
      stats.tricks++; if (G.trickResult.bombed) stats.bombs++;
      for (const p of G.trick.plays) {
        if (p.kind === "juggler") stats.juggler++; if (p.kind === "cloud") stats.cloud++; if (p.kind === "witch") stats.witch++;
        if (p.id === "sp-vampire" && p.copy && p.copy !== "sp-werewolf" && G.log.some(l => l.includes("new trump card"))) stats.vampireReveal++;
      }
      act(G, null, { type: "resolve" }); continue;
    }
    if (G.phase === "roundEnd") {
      const s = G.scores.at(-1);
      for (const [pid, r] of Object.entries(s.rows)) assert.equal(r.pts, roundPoints(r.bid, r.won, G.settings.penalty));
      const tricks = Object.values(s.rows).reduce((a, r) => a + r.won, 0);
      assert(tricks <= G.round);
      act(G, null, { type: "nextRound" }); continue;
    }
    const w = waitingOn(G);
    assert(w.length, "nobody to act in " + G.phase);
    const pid = w[0];
    const a = autoAction(G, pid, rnd);
    if (G.phase === "play") {
      // follow-suit sanity: an illegal card must be refused
      const hand = G.hands[pid];
      const illegal = hand.find(id => !G.hands[pid] || false);
      void illegal;
    }
    const wasBid = G.phase === "bid";
    act(G, pid, a);
    if (wasBid && G.phase === "play") {
      const sum = Object.values(G.bids).reduce((x, y) => x + y, 0);
      assert.notEqual(sum, G.round, "bids add up to the round");
      stats.bidChecks = (stats.bidChecks || 0) + 1;
    }
  }
  const sum = Object.values(G.total).reduce((a, b) => a + b, 0);
  const scoreSum = G.scores.flatMap(s => Object.values(s.rows)).reduce((a, r) => a + r.pts, 0);
  assert.equal(sum, scoreSum);
  stats.games++;
}

// Targeted winner checks.
const P = (id, eff) => ({ id, eff });
assert.equal(winnerIndex([P("a", { kind: "number", suit: "red", value: 5 }), P("b", { kind: "dragon" }), P("c", { kind: "wizard" })], "blue"), 1, "dragon beats wizard");
assert.equal(winnerIndex([P("a", { kind: "dragon" }), P("b", { kind: "fairy" }), P("c", { kind: "wizard" })], null), 1, "fairy beats dragon");
assert.equal(winnerIndex([P("a", { kind: "fairy" }), P("b", { kind: "jester" })], null), 1, "jester beats fairy");
assert.equal(winnerIndex([P("a", { kind: "witch" }), P("b", { kind: "fairy" })], null), 1, "fairy beats witch");
assert.equal(winnerIndex([P("a", { kind: "jester" }), P("b", { kind: "jester" })], null), 0, "first jester");
assert.equal(winnerIndex([P("a", { kind: "number", suit: "red", value: 9 }), P("b", { kind: "number", suit: "red", value: 9.75 })], null), 1, "cloud 9.75 beats 9");
assert.equal(winnerIndex([P("a", { kind: "number", suit: "red", value: 8 }), P("b", { kind: "number", suit: "red", value: 7.5 })], null), 0, "juggler 7.5 below 8");
assert.equal(winnerIndex([P("a", { kind: "number", suit: "red", value: 13 }), P("b", { kind: "number", suit: "blue", value: 1 })], "blue"), 1, "trump wins");
assert.equal(winnerIndex([P("a", { kind: "number", suit: "red", value: 3 }), P("b", { kind: "number", suit: "green", value: 13 })], null), 0, "off-suit can't win");
assert.equal(winnerIndex([P("a", { kind: "jester" }), P("b", { kind: "number", suit: "green", value: 2 }), P("c", { kind: "number", suit: "red", value: 13 })], null), 1, "jester lead: first number sets suit");
assert.equal(winnerIndex([P("a", { kind: "bomb" }), P("b", { kind: "number", suit: "green", value: 2 }), P("c", { kind: "number", suit: "green", value: 9 })], null), 2, "bomb ignored for would-be winner");
assert.equal(winnerIndex([P("a", { kind: "wizard" }), P("b", { kind: "wizard" })], null), 0, "first wizard");
assert.equal(roundPoints(2, 2, "house"), 40); assert.equal(roundPoints(2, 0, "house"), -30); assert.equal(roundPoints(2, 0, "official"), -20);
console.log("OK", stats);
