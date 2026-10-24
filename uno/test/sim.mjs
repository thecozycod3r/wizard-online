// node uno/test/sim.mjs [games]  — random + smart games for both variants, checking the rules hold every move.
import * as E from "../engine.js";

const N = +process.argv[2] || 1500;
let fails = 0;
const bad = (m, G) => { fails++; if (fails < 12) console.log("FAIL", m, G ? JSON.stringify({ v: G.variant, phase: G.phase, pend: G.pend, side: G.side }) : ""); };
const ok = (c, m) => { if (!c) bad(m); else console.log("ok  ", m); };
const total = G => (G.variant === "mercy" ? E.MERCY.length : E.LIGHT.length);
const all = G => [...G.draw, ...G.discard, ...G.aside, ...Object.values(G.hands).flat()];

function check(G) {
  const cards = all(G);
  if (cards.length !== total(G) || new Set(cards).size !== total(G)) bad("card count " + cards.length, G);
  if (G.variant === "mercy") for (const p of G.players) if (!G.out.includes(p.id) && G.hands[p.id].length >= E.MERCY_LIMIT) bad("over the mercy limit", G);
  if (G.phase === "play" && G.out.includes(G.players[G.turn].id)) bad("turn on a knocked-out player", G);
}

function play(variant, n, smart) {
  const players = Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i }));
  const G = E.newGame(players, { variant, target: variant === "flip" ? 200 : 0 });
  const stats = { moves: 0, flips: 0, stacks: 0, knocks: 0 };
  for (let m = 0; m < 20000 && G.phase !== "gameOver"; m++) {
    check(G);
    if (G.phase === "roundOver") { E.act(G, "p0", { type: "next" }); continue; }
    const [pid] = E.waitingOn(G);
    // sometimes catch a forgotten UNO
    if (G.unoRisk && Math.random() < .3) { const c = players.find(p => p.id !== G.unoRisk && !G.out.includes(p.id)); if (c) { E.act(G, c.id, { type: "catch" }); continue; } }
    const a = (smart ? E.smartAction : E.autoAction)(G, pid);
    if (a.type === "play") {
      const f = E.face(G, a.card);
      if (G.pend) {
        stats.stacks++;
        if (variant === "flip" && f.k !== G.pend.kind) bad("flip stacked a different card", G);
        if (variant === "mercy" && E.drawValue(f.k) < G.pend.last) bad("mercy stacked a smaller card", G);
      }
      if (f.k === "flip") stats.flips++;
      if (Math.random() < .15) delete a.uno;
    }
    try { E.act(G, pid, a); } catch (e) { bad(`act threw: ${e.message} ${JSON.stringify(a)}`, G); break; }
    if (G.last?.knocked) stats.knocks += G.last.knocked.length;
    stats.moves++;
  }
  if (G.phase !== "gameOver") bad("game never ended", G);
  check(G);
  return stats;
}

for (const variant of ["flip", "mercy"]) {
  const agg = { games: 0, moves: 0, flips: 0, stacks: 0, knocks: 0 };
  const { min, max } = E.VARIANTS[variant];
  for (let i = 0; i < N; i++) {
    const s = play(variant, min + (i % (max - min + 1)), i % 2 === 0);
    agg.games++; for (const k of ["moves", "flips", "stacks", "knocks"]) agg[k] += s[k];
  }
  console.log(variant, agg);
}

// ---------------------------------------------------------------- targeted rules
const two = v => E.newGame([{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }], { variant: v });
const find = (G, pred, from = G.draw) => from.find(id => pred(E.face(G, id)));
function setHand(G, pid, ids) { for (const id of ids) { for (const k of ["draw", "discard"]) { const i = G[k].indexOf(id); if (i >= 0) G[k].splice(i, 1); } for (const p in G.hands) { const i = G.hands[p].indexOf(id); if (i >= 0) G.hands[p].splice(i, 1); } } G.draw.push(...G.hands[pid]); G.hands[pid] = ids.slice(); }
function setTop(G, id, color) { for (const k of ["draw"]) { const i = G[k].indexOf(id); if (i >= 0) G[k].splice(i, 1); } G.discard.push(id); G.color = color ?? E.face(G, id).c; }

{ // Flip: Draw One stacks only on Draw One; the stack adds up
  const G = two("flip"); G.turn = 0;
  const d1a = find(G, f => f.k === "d1"), d1b = G.draw.filter(id => E.face(G, id).k === "d1" && id !== d1a)[0], wd2 = find(G, f => f.k === "wd2");
  setTop(G, find(G, f => f.k === "5" && f.c === E.face(G, d1a).c));
  setHand(G, "a", [d1a, find(G, f => f.k === "3")]); setHand(G, "b", [d1b, wd2, find(G, f => f.k === "4")]);
  E.act(G, "a", { type: "play", card: d1a });
  ok(E.canPlay(G, "b", d1b) && !E.canPlay(G, "b", wd2), "flip: only Draw One goes on Draw One");
  E.act(G, "b", { type: "play", card: d1b });
  ok(G.pend?.n === 2, "flip: two Draw Ones stack to 2");
  const before = G.hands.c.length; E.act(G, "c", { type: "draw" });
  ok(G.hands.c.length === before + 2 && G.players[G.turn].id === "a", "flip: the player who can't stack draws 2 and loses the turn");
}
{ // Flip: Flip turns everything over
  const G = two("flip"); G.turn = 0;
  const fl = find(G, f => f.k === "flip"); setTop(G, find(G, f => f.k === "2" && f.c === E.face(G, fl).c));
  setHand(G, "a", [fl, find(G, f => f.k === "3"), find(G, f => f.k === "4")]);
  const bottom = G.discard[0];
  E.act(G, "a", { type: "play", card: fl });
  ok(G.side === "dark" && E.topCard(G) === bottom, "flip: side turns dark and the old bottom card is on top");
}
{ // Mercy: stack equal-or-higher, any colour
  const G = two("mercy"); G.turn = 0;
  const d2 = find(G, f => f.k === "d2"), d4 = find(G, f => f.k === "d4" && f.c !== E.face(G, d2).c), d2b = G.draw.filter(id => E.face(G, id).k === "d2" && id !== d2)[0], wd6 = find(G, f => f.k === "wd6");
  setTop(G, find(G, f => f.k === "5" && f.c === E.face(G, d2).c));
  setHand(G, "a", [d2, find(G, f => f.k === "1"), find(G, f => f.k === "1" && true)]); setHand(G, "b", [d4, find(G, f => f.k === "8")]); setHand(G, "c", [d2b, wd6, find(G, f => f.k === "9")]);
  E.act(G, "a", { type: "play", card: d2 });
  ok(E.canPlay(G, "b", d4), "mercy: +4 of another colour stacks on +2");
  E.act(G, "b", { type: "play", card: d4, uno: true });
  ok(!E.canPlay(G, "c", d2b) && E.canPlay(G, "c", wd6), "mercy: +2 can't go on +4, +6 can");
  E.act(G, "c", { type: "play", card: wd6, color: "r" });
  ok(G.pend?.n === 12, "mercy: stack totals 2+4+6 = 12");
}
{ // Mercy: 7 swaps, Discard All, mercy limit
  const G = two("mercy"); G.turn = 0;
  const seven = find(G, f => f.k === "7"); setTop(G, find(G, f => f.k === "3" && f.c === E.face(G, seven).c));
  setHand(G, "a", [seven, find(G, f => f.k === "1"), find(G, f => f.k === "2")]);
  const bHand = G.hands.b.slice();
  E.act(G, "a", { type: "play", card: seven, target: "b" });
  ok(JSON.stringify(G.hands.a) === JSON.stringify(bHand), "mercy: 7 swaps hands with the chosen player");
  const H = two("mercy"); H.turn = 0;
  const da = find(H, f => f.k === "discall"), col = E.face(H, da).c;
  setTop(H, find(H, f => f.k === "4" && f.c === col));
  const reds = H.draw.filter(id => E.face(H, id).c === col && E.face(H, id).k !== "discall").slice(0, 3);
  setHand(H, "a", [da, ...reds, find(H, f => f.c !== col && f.c !== "w")]);
  E.act(H, "a", { type: "play", card: da });
  ok(H.hands.a.length === 1, "mercy: Discard All drops every card of that colour");
  const K = two("mercy"); K.turn = 2; K.hands.a.length = 0;
  for (let i = 0; i < 23; i++) K.hands.a.push(K.draw.pop());
  K.unoRisk = "a"; E.act(K, "c", { type: "catch" });
  ok(K.out.includes("a"), "mercy: 25 cards knocks you out");
}

console.log(fails ? `${fails} FAILURES` : "all checks passed");
process.exitCode = fails ? 1 : 0;
