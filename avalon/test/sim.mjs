// Avalon engine: random + smart games at every table size, and targeted rule checks.
//   node test/sim.mjs
import * as E from "../engine.js";

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
const players = n => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i }));
const throws = (f, m) => { try { f(); ok(false, m + " (no error)"); } catch { /* expected */ } };
const opts = [{}, { percival: true, morgana: true }, { percival: true, morgana: true, mordred: true, oberon: true, lady: true }, { lady: true, oberon: true }];

function play(n, settings, bot) {
  const G = E.newGame(players(n), settings);
  let guard = 0;
  while (G.phase !== "gameOver" && guard++ < 5000) {
    const w = E.waitingOn(G);
    ok(w.length > 0, "someone is always being waited on");
    const pid = w[Math.floor(Math.random() * w.length)];
    E.act(G, pid, bot(G, pid));
    // nobody's view leaks roles they shouldn't know
    if (G.phase !== "gameOver") for (const p of G.players) {
      const v = E.viewFor(G, p.id);
      ok(!v.roles, "roles hidden until the end");
      ok(v.ladyChecks.every(c => c.side === null || c.by === p.id), "Lady results stay with the holder");
    }
  }
  ok(G.phase === "gameOver", "game ends");
  return G;
}

// 1) role setup and knowledge
for (let n = 5; n <= 10; n++) for (const s of opts) {
  const G = E.newGame(players(n), s), roles = Object.values(G.roles);
  ok(roles.filter(r => E.ROLES[r].side === "evil").length === E.EVIL_COUNT[n], `evil count ${n}`);
  ok(roles.includes("merlin") && roles.includes("assassin"), "Merlin and Assassin always in");
  for (const r of ["percival", "morgana", "mordred", "oberon"]) if (!s[r]) ok(!roles.includes(r), `${r} only when chosen`);
  for (const p of G.players) {
    const r = G.roles[p.id], k = E.knowledge(G, p.id).map(x => x.id).sort();
    const others = G.players.map(q => q.id).filter(q => q !== p.id);
    let want = [];
    if (E.ROLES[r].side === "evil" && r !== "oberon") want = others.filter(q => E.sideOf(G, q) === "evil" && G.roles[q] !== "oberon");
    if (r === "merlin") want = others.filter(q => E.sideOf(G, q) === "evil" && G.roles[q] !== "mordred");
    if (r === "percival") want = others.filter(q => ["merlin", "morgana"].includes(G.roles[q]));
    ok(JSON.stringify(k) === JSON.stringify(want.sort()), `knowledge of ${r} at ${n}`);
  }
}
// optional roles never crowd out Merlin/Assassin, and 5 players can't hold 3 special evils
{ const r = E.rolesFor(5, { morgana: true, mordred: true, oberon: true }); ok(r.evil.length === 2 && r.evil[0] === "assassin", "5p: assassin + one special"); }

// 2) targeted rules
{
  const G = E.newGame(players(7), {});
  for (const p of G.players) E.act(G, p.id, { type: "ready" });
  ok(G.phase === "propose", "reveal → propose once all are ready");
  throws(() => E.act(G, G.players.find(p => p.id !== E.leaderId(G)).id, { type: "propose", team: ["p0", "p1"] }), "only the leader proposes");
  throws(() => E.act(G, E.leaderId(G), { type: "propose", team: ["p0"] }), "team size enforced");
  throws(() => E.act(G, E.leaderId(G), { type: "propose", team: ["p0", "p0"] }), "no duplicates");
  // five rejections → Evil
  for (let i = 0; i < 5; i++) {
    E.act(G, E.leaderId(G), { type: "propose", team: G.players.slice(0, E.questSize(G)).map(p => p.id) });
    for (const p of G.players) E.act(G, p.id, { type: "vote", yes: false });
  }
  ok(G.phase === "gameOver" && G.result.winner === "evil", "five rejected teams → Evil wins");
}
{
  // tie rejects; majority approves; leader rotates after every vote
  const G = E.newGame(players(6), {});
  for (const p of G.players) E.act(G, p.id, { type: "ready" });
  const l0 = G.leader;
  E.act(G, E.leaderId(G), { type: "propose", team: ["p0", "p1"] });
  G.players.forEach((p, i) => E.act(G, p.id, { type: "vote", yes: i < 3 }));
  ok(G.phase === "propose" && G.attempt === 2, "3-3 tie rejects");
  ok(G.leader === (l0 + 1) % 6, "leader passes after a rejected vote");
  E.act(G, E.leaderId(G), { type: "propose", team: ["p0", "p1"] });
  G.players.forEach((p, i) => E.act(G, p.id, { type: "vote", yes: i < 4 }));
  ok(G.phase === "quest", "4-2 approves");
  ok(G.leader === (l0 + 2) % 6, "leader passes after an approved vote too");
  const good = G.team.find(t => E.sideOf(G, t) === "good");
  if (good) throws(() => E.act(G, good, { type: "quest", ok: false }), "Good can't play Fail");
  const outsider = G.players.map(p => p.id).find(p => !G.team.includes(p));
  throws(() => E.act(G, outsider, { type: "quest", ok: true }), "only the team plays quest cards");
}
{
  // quest 4 at 7+ needs two fails
  const G = E.newGame(players(8), {});
  G.phase = "quest"; G.quest = 4; const evil = G.players.map(p => p.id).filter(p => E.sideOf(G, p) === "evil"), good = G.players.map(p => p.id).filter(p => E.sideOf(G, p) === "good");
  G.team = [evil[0], ...good.slice(0, 4)]; G.cards = {};
  G.results = [{ success: true }, { success: false }, { success: true }];
  for (const t of G.team) E.act(G, t, { type: "quest", ok: !evil.includes(t) });
  ok(G.results[3].success === true && G.results[3].fails === 1, "one Fail isn't enough on quest 4 at 8 players");
  const H = E.newGame(players(6), {});
  H.phase = "quest"; H.quest = 4; const ev = H.players.map(p => p.id).filter(p => E.sideOf(H, p) === "evil");
  H.team = [ev[0], ...H.players.map(p => p.id).filter(p => E.sideOf(H, p) === "good").slice(0, 2)];
  for (const t of H.team) E.act(H, t, { type: "quest", ok: t !== ev[0] });
  ok(H.results.at(-1).success === false, "one Fail is enough on quest 4 at 6 players");
}
{
  // assassination: three successes → Assassin; naming Merlin wins for Evil, anyone else loses
  for (const hitMerlin of [true, false]) {
    const G = E.newGame(players(5), {});
    G.phase = "quest"; G.quest = 3; G.results = [{ success: true }, { success: true }];
    const good = G.players.map(p => p.id).filter(p => E.sideOf(G, p) === "good");
    G.team = good.slice(0, 2);
    for (const t of G.team) E.act(G, t, { type: "quest", ok: true });
    ok(G.phase === "assassin", "three successes → assassination");
    const ass = E.waitingOn(G)[0];
    ok(G.roles[ass] === "assassin", "the Assassin names Merlin");
    const merlin = G.players.find(p => G.roles[p.id] === "merlin").id, servant = good.find(g => g !== merlin);
    E.act(G, ass, { type: "assassinate", target: hitMerlin ? merlin : servant });
    ok(G.result.winner === (hitMerlin ? "evil" : "good"), `assassin ${hitMerlin ? "hits" : "misses"} Merlin`);
  }
}
{
  // Lady of the Lake: after quests 2, 3 and 4; can't check a previous holder; result private
  const G = E.newGame(players(8), { lady: true });
  ok(G.lady === G.players[(G.leader + 7) % 8].id, "Lady starts to the leader's right");
  for (const p of G.players) E.act(G, p.id, { type: "ready" });
  let checks = 0;
  for (let q = 1; q <= 4 && G.phase !== "gameOver" && G.phase !== "assassin"; q++) {
    // quest 1 fails (an Evil knight on it plays Fail) so the game runs long enough for the Lady to be used twice
    const evil1 = G.players.map(p => p.id).find(p => E.sideOf(G, p) === "evil");
    const team = q === 1 ? [evil1, ...G.players.map(p => p.id).filter(p => p !== evil1)].slice(0, E.questSize(G)) : G.players.map(p => p.id).filter(p => E.sideOf(G, p) === "good").slice(0, E.questSize(G));
    E.act(G, E.leaderId(G), { type: "propose", team });
    for (const p of G.players) E.act(G, p.id, { type: "vote", yes: true });
    for (const t of G.team.slice()) E.act(G, t, { type: "quest", ok: !(q === 1 && t === evil1) });
    if (G.phase === "lady") {
      checks++;
      const holder = G.lady, t = E.ladyTargets(G)[0];
      throws(() => E.act(G, holder, { type: "lady", target: holder }), "Lady can't check herself");
      E.act(G, holder, { type: "lady", target: t });
      ok(G.lady === t, "Lady passes to the examined player");
      ok(E.viewFor(G, holder).ladyChecks.at(-1).side !== null && E.viewFor(G, t).ladyChecks.at(-1).side === null, "result only for the holder");
    }
  }
  ok(checks >= 2, "Lady used after quests 2 and 3");
}

// 3) many full games
const tally = {};
for (let i = 0; i < 3000; i++) {
  const n = 5 + (i % 6), s = opts[i % opts.length], smart = i % 2 === 0;
  const G = play(n, s, smart ? E.smartAction : E.autoAction);
  const k = (smart ? "smart" : "random") + n; (tally[k] ||= { good: 0, evil: 0 })[G.result.winner]++;
  ok(["good", "evil"].includes(G.result.winner), "winner");
  ok(G.results.length <= 5, "at most five quests");
}
for (const [k, t] of Object.entries(tally).sort()) console.log(k.padEnd(9), `good ${t.good}`.padEnd(10), `evil ${t.evil}`);
console.log(fails ? `${fails} FAILURES` : "all checks passed");
process.exit(fails ? 1 : 0);
