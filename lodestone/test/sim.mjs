// Random-play simulation of Lodestone at 2–6 players.
import { newGame, act, autoAction, waitingOn, points, ORES, ALL, setupFor, cardOf } from "../engine.js";
import assert from "node:assert/strict";

const stats = { games: 0, byPlayers: {}, turns: 0, buys: 0, reserves: 0, blind: 0, discards: 0, nobles: 0, nobleChoices: 0, passes: 0, ties: 0 };
for (let g = 0; g < 4000; g++) {
  const n = 2 + (g % 5);
  const G = newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })));
  const S = setupFor(n);
  const totalTokens = S.tokensPer * 5 + 5;
  const totalCards = (S.twin ? 180 : 90);
  assert.equal(G.nobles.length, n + 1);
  assert.deepEqual([1, 2, 3].map(l => G.market[l].length), [S.display[1], S.display[2], S.display[3]]);
  let steps = 0;
  while (G.phase !== "gameOver") {
    assert(++steps < 5000, "stuck in " + G.phase);
    const pid = waitingOn(G)[0];
    const a = autoAction(G, pid);
    const before = G.phase;
    act(G, pid, a);
    if (a.type === "buy") stats.buys++;
    if (a.type === "reserve") { stats.reserves++; if (a.level) stats.blind++; }
    if (a.type === "discard") stats.discards++;
    if (a.type === "noble") stats.nobleChoices++;
    if (a.type === "pass") stats.passes++;
    // invariants
    const held = G.players.reduce((s, p) => s + ALL.reduce((t, o) => t + G.pl[p.id].tokens[o], 0), 0);
    assert.equal(held + ALL.reduce((t, o) => t + G.bank[o], 0), totalTokens, "token conservation");
    assert(ALL.every(o => G.bank[o] >= 0) && G.players.every(p => ALL.every(o => G.pl[p.id].tokens[o] >= 0)), "negative tokens");
    if (G.phase === "turn" || G.phase === "gameOver") {
      const prev = G.players.find(p => p.id === pid);
      assert(ALL.reduce((t, o) => t + G.pl[prev.id].tokens[o], 0) <= 10 || G.phase === "discard", "over 10 tokens after turn");
    }
    assert(G.players.every(p => G.pl[p.id].reserved.length <= 3), "reserve cap");
    const cards = [1, 2, 3].reduce((s, l) => s + G.decks[l].length + G.market[l].filter(Boolean).length, 0)
      + G.players.reduce((s, p) => s + G.pl[p.id].cards.length + G.pl[p.id].reserved.length, 0);
    assert.equal(cards, totalCards, "card conservation");
    for (const l of [1, 2, 3]) if (G.decks[l].length) assert(G.market[l].every(Boolean), "empty slot while deck has cards");
  }
  // equal turns, someone hit 15 (unless everyone passed out), tie-break
  const t = Object.values(G.turns);
  assert(t.every(x => x === t[0]), "unequal number of turns");
  const r = G.result.rows;
  assert(G.stalled || r[0].points >= 15 || stats.passes, "game ended without 15 points");
  if (G.stalled) stats.stalled = (stats.stalled || 0) + 1;
  for (let i = 1; i < r.length; i++) assert(r[i - 1].points > r[i].points || (r[i - 1].points === r[i].points && r[i - 1].cards <= r[i].cards));
  if (G.result.winners.length > 1) stats.ties++;
  stats.nobles += G.players.reduce((s, p) => s + G.pl[p.id].nobles.length, 0);
  stats.turns += t.reduce((a, b) => a + b, 0);
  stats.byPlayers[n] = (stats.byPlayers[n] || 0) + 1;
  stats.games++;
}

// Targeted rule checks
{
  const G = newGame([{ id: "a", name: "A" }, { id: "b", name: "B" }]);
  const p = G.players[G.turn].id;
  G.bank.silver = 3;
  assert.throws(() => act(G, p, { type: "take", ores: ["silver", "silver"] }), /at least 4/);
  assert.throws(() => act(G, p, { type: "take", ores: ["silver", "cobalt"] }), /3 ores/);
  assert.throws(() => act(G, p, { type: "take", ores: ["gold", "silver", "cobalt"] }), /gold/i);
  act(G, p, { type: "take", ores: ["silver", "cobalt", "iron"] });
  assert.equal(G.pl[p].tokens.silver, 1);
}
{
  const G = newGame([{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }]);
  for (const o of ORES) G.bank[o] = 0;
  G.bank.cobalt = 2; G.bank.iron = 1;
  const p = G.players[G.turn].id;
  act(G, p, { type: "take", ores: ["cobalt", "iron"] }); // only 2 colours left: take one of each
  assert.equal(G.pl[p].tokens.cobalt + G.pl[p].tokens.iron, 2);
}
{
  const G = newGame(Array.from({ length: 6 }, (_, i) => ({ id: "p" + i, name: "P" + i })));
  assert.equal(G.settings.twin, false); assert.equal(G.nobles.length, 7); assert.equal(G.bank.silver, 7); assert.equal(G.bank.gold, 5);
  assert.deepEqual([G.market[1].length, G.market[2].length, G.market[3].length], [5, 4, 4]);
  // one set of 90 cards: never the same card twice on the table or in the decks
  const all = [1, 2, 3].flatMap(l => [...G.market[l], ...G.decks[l]]);
  assert.equal(all.length, 90); assert.equal(new Set(all).size, 90);
}
console.log("OK", stats);
{
  // Blind reservation from a deck: gets gold, hidden from others, visible to me; 4th reserve refused.
  const { viewFor } = await import("../engine.js");
  const G = newGame([{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }]);
  const order = G.players.map((_, i) => G.players[(G.first + i) % 3].id);
  const p = order[0];
  const deck2 = G.decks[2].length;
  act(G, p, { type: "reserve", level: 2 });
  assert.equal(G.decks[2].length, deck2 - 1); assert.equal(G.pl[p].tokens.gold, 1); assert.equal(G.bank.gold, 4);
  const other = viewFor(G, order[1]).players.find(x => x.id === p).reserved[0];
  assert.deepEqual(other, { hidden: true, level: 2 });
  assert(viewFor(G, p).players.find(x => x.id === p).reserved[0].id);
  G.pl[p].reserved.push({ id: "sil11", hidden: false }, { id: "cob11", hidden: false });
  G.turn = G.players.findIndex(x => x.id === p);
  assert.throws(() => act(G, p, { type: "reserve", level: 1 }), /3 reserved/);
  // Over 10 tokens -> discard step, exact count enforced
  G.pl[p].tokens = { silver: 3, cobalt: 3, malachite: 3, cinnabar: 0, iron: 0, gold: 1 };
  act(G, p, { type: "take", ores: ["cinnabar", "iron", "silver"] });
  assert.equal(G.phase, "discard"); assert.equal(G.pending.n, 3);
  assert.throws(() => act(G, p, { type: "discard", tokens: { silver: 2 } }), /exactly 3/);
  act(G, p, { type: "discard", tokens: { silver: 2, gold: 1 } });
  assert.equal(Object.values(G.pl[p].tokens).reduce((a, b) => a + b, 0), 10);
  console.log("OK targeted: blind reserve, hidden view, reserve cap, discard");
}
