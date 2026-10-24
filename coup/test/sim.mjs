// node coup/test/sim.mjs — thousands of bot games over every option and player count, plus scripted rule checks.
import * as E from "../engine.js";
let fails = 0; const bad = m => { fails++; if (fails < 12) console.log("FAIL", m); }; const ok = (c, m) => (c ? console.log("ok  ", m) : bad(m));
const mk = (n, s = {}) => E.newGame(Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), s);
const total = G => G.deck.length + Object.values(G.cards).flat().length + (G.T?.pool?.length || 0);
let games = 0, lens = [];
for (let g = 0; g < 6000; g++) {
  const n = 2 + (g % 9), s = { deck: g % 2 ? "inquisitor" : "classic", factions: g % 3 ? "off" : "on" };
  const G = mk(n, s), want = E.copiesFor(n) * 5;
  let steps = 0;
  while (G.phase !== "gameOver" && steps++ < 3000) {
    const w = E.waitingOn(G);
    if (!w.length) { bad(`stuck in ${G.phase}`); break; }
    // sometimes the table closes a window by itself instead of everyone answering
    if ((G.phase === "respond" || G.phase === "blockRespond") && Math.random() < .15) { E.act(G, w[0], { type: "close" }); continue; }
    const pid = w[Math.floor(Math.random() * w.length)];
    let a = E.smartAction(G, pid);
    // spice: random bluffs, challenges and blocks so every path runs
    const r = Math.random();
    if (G.phase === "action" && G.coins[pid] < 10 && r < .25) {
      const t = G.players.map(p => p.id).filter(x => E.canTarget(G, pid, "steal", x));
      const opts = [{ type: "tax" }, { type: "exchange" }, t.length && { type: "steal", target: t[0] }, t.length && G.coins[pid] >= 3 && { type: "assassinate", target: t[0] },
        s.deck === "inquisitor" && t.length && { type: "examine", target: t[0] }, G.settings.factions === "on" && G.coins[pid] >= 1 && { type: "convert" }, G.settings.factions === "on" && G.reserve && { type: "embezzle" }].filter(Boolean);
      a = opts[Math.floor(Math.random() * opts.length)];
    }
    if (G.phase === "respond" && r < .2 && !G.T.blockOnly && ["tax", "steal", "assassinate", "exchange", "examine", "embezzle"].includes(G.T.type)) a = { type: "challenge" };
    if (G.phase === "blockRespond" && r < .3) a = { type: "challenge" };
    try { E.act(G, pid, a); } catch (e) { bad(`${G.phase} ${JSON.stringify(a)}: ${e.message}`); break; }
    if (total(G) !== want) { bad(`card count ${total(G)} != ${want} after ${a.type}`); break; }
    if (Object.values(G.coins).some(c => c < 0)) { bad("negative coins"); break; }
    if (Object.entries(G.cards).some(([p, cs]) => !E.alive(G, p) && G.coins[p])) { bad("dead player kept coins"); break; }
  }
  if (G.phase !== "gameOver") { bad(`game ${g} (n=${n}) never ended (${G.phase})`); continue; }
  if (G.result.winners.length !== 1 || !E.alive(G, G.result.winners[0])) bad("winner not alive");
  games++; lens.push(steps);
}
ok(fails === 0, `${games} games over 2–10 players, classic/inquisitor, factions on/off; avg ${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)} steps`);

// scripted rules
const seat = (G, pid, a, b) => { G.cards[pid] = [{ r: a, up: false }, { r: b, up: false }]; };
{ const G = mk(3); G.turn = 0; G.phase = "action"; seat(G, "p0", "duke", "captain"); G.coins.p0 = 10;
  let threw = false; try { E.act(G, "p0", { type: "tax" }); } catch { threw = true; } ok(threw, "10+ coins must coup");
  E.act(G, "p0", { type: "coup", target: "p1" }); ok(G.coins.p0 === 3 && G.phase === "lose" && E.waitingOn(G)[0] === "p1", "coup costs 7 and the target picks a card to lose"); }
{ const G = mk(3); G.turn = 0; seat(G, "p0", "duke", "captain"); E.act(G, "p0", { type: "tax" }); ok(G.phase === "respond", "tax opens a challenge window");
  const before = G.deck.length; E.act(G, "p1", { type: "challenge" });
  ok(G.phase === "lose" ? E.waitingOn(G)[0] === "p1" : G.cards.p1.some(c => c.up), "a true claim makes the challenger lose");
  if (G.phase === "lose") E.act(G, "p1", { type: "lose", card: 0 });
  ok(G.coins.p0 === 5 && G.deck.length === before, "…and the tax still goes through (proven card swapped)"); }
{ const G = mk(3); G.turn = 0; seat(G, "p0", "contessa", "captain"); seat(G, "p1", "duke", "duke"); E.act(G, "p0", { type: "tax" }); E.act(G, "p2", { type: "challenge" });
  ok(G.phase === "lose" && E.waitingOn(G)[0] === "p0", "a bluff caught: the bluffer loses"); E.act(G, "p0", { type: "lose", card: 0 }); ok(G.coins.p0 === 2 && G.phase === "action", "…and gets no tax"); }
{ const G = mk(3); G.turn = 0; seat(G, "p0", "assassin", "duke"); seat(G, "p1", "contessa", "captain"); G.coins.p0 = 3;
  E.act(G, "p0", { type: "assassinate", target: "p1" }); E.act(G, "p1", { type: "block", as: "contessa" });
  ok(G.phase === "blockRespond", "Contessa block opens a window to challenge the block");
  E.act(G, "p0", { type: "pass" }); E.act(G, "p2", { type: "pass" }); ok(G.coins.p0 === 0 && G.cards.p1.every(c => !c.up), "blocked: coins stay spent, nobody loses"); }
{ const G = mk(3); G.turn = 0; seat(G, "p0", "assassin", "duke"); seat(G, "p1", "duke", "captain"); G.coins.p0 = 3;
  E.act(G, "p0", { type: "assassinate", target: "p1" }); E.act(G, "p1", { type: "block", as: "contessa" }); E.act(G, "p0", { type: "challenge" });
  E.act(G, "p1", { type: "lose", card: 0 });
  ok(!E.alive(G, "p1"), "bluffing Contessa and getting caught costs both cards"); }
{ const G = mk(3); G.turn = 0; seat(G, "p0", "ambassador", "duke"); E.act(G, "p0", { type: "exchange" }); E.act(G, "p1", { type: "pass" }); E.act(G, "p2", { type: "pass" });
  ok(G.phase === "exchange" && G.T.pool.length === 2, "Ambassador draws 2"); E.act(G, "p0", { type: "keep", keep: [2, 3] }); ok(G.cards.p0.length === 2 && G.deck.length === 15 - 6, "keeps 2, returns 2"); }
{ const G = mk(4, { factions: "on" }); G.turn = 0; G.faction = { p0: "L", p1: "R", p2: "L", p3: "R" };
  let threw = false; G.coins.p0 = 7; try { E.act(G, "p0", { type: "coup", target: "p2" }); } catch { threw = true; } ok(threw, "factions: can't coup your own side");
  G.coins.p0 = 2; E.act(G, "p0", { type: "convert", target: "p2" }); ok(G.faction.p2 === "R" && G.reserve === 2, "convert another player costs 2 into the reserve");
  G.cards.p1 = [{ r: "captain", up: false }, { r: "contessa", up: false }]; E.act(G, "p1", { type: "embezzle" }); E.act(G, "p0", { type: "challenge" }); E.act(G, "p0", { type: "lose", card: 0 });
  ok(G.coins.p1 === 4 && G.reserve === 0, "embezzle without the Duke survives a challenge and takes the reserve"); }
{ const G = mk(5, { deck: "inquisitor" }); ok(!G.deck.includes("ambassador") && E.roles(G).includes("inquisitor"), "Inquisitor replaces the Ambassador");
  G.turn = 0; seat(G, "p0", "inquisitor", "duke"); E.act(G, "p0", { type: "examine", target: "p1" }); for (const p of ["p1", "p2", "p3", "p4"]) E.act(G, p, { type: "pass" });
  ok(G.phase === "examineShow" && E.waitingOn(G)[0] === "p1", "examine: target shows a card"); E.act(G, "p1", { type: "show", card: 1 });
  ok(E.viewFor(G, "p0").T.shown === G.cards.p1[1].r && E.viewFor(G, "p2").T.shown === null, "only the Inquisitor sees it"); E.act(G, "p0", { type: "decide", force: true }); ok(G.phase === "action", "forced swap ends the turn"); }
{ ok(mk(8).deck.length + 16 === 20 && mk(10).deck.length + 20 === 25, "7–8 players: 4 of each; 9–10: 5 of each"); const G = mk(2); ok(Object.values(G.coins).sort().join() === "1,2", "2 players: the starter has 1 coin"); }
console.log(fails ? `${fails} FAILURES` : "all checks passed"); process.exitCode = fails ? 1 : 0;
