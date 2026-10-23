// Incan Gold — pure rules engine (Alan R. Moon & Bruno Faidutti). No DOM, no network.
// newGame(players) · act(G, pid, {type:"choose", go}) · viewFor(G, pid) · waitingOn(G) · autoAction · smartAction · timerKey

export const MIN_PLAYERS = 3, MAX_PLAYERS = 8, ROUNDS = 5;
export const TREASURES = [1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17];
export const HAZARDS = ["spiders", "snakes", "mummies", "fire", "rockfall"];
export const HAZARD_NAME = { spiders: "Giant spiders", snakes: "Snakes", mummies: "Mummies", fire: "Fire", rockfall: "Rockfall" };
export const ARTIFACTS = [
  { id: "a1", name: "Golden Mask" }, { id: "a2", name: "Jade Idol" }, { id: "a3", name: "Sun Disc" },
  { id: "a4", name: "Feathered Crown" }, { id: "a5", name: "Ceremonial Knife" },
];
export const artifactOf = id => ARTIFACTS.find(a => a.id === id);

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// card ids: t<i> treasure (value TREASURES[i]), h-<kind>-<n> hazard, a<n> artifact
export const cardOf = id => id[0] === "t" ? { kind: "treasure", value: TREASURES[+id.slice(1)] }
  : id[0] === "h" ? { kind: "hazard", hazard: id.split("-")[1] } : { kind: "artifact", ...artifactOf(id) };

export function newGame(players) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Incan Gold needs 3 to 8 players.");
  const G = {
    v: 1, game: "incan", gameId: Math.random().toString(36).slice(2, 10), seq: 0,
    players: players.map(p => ({ id: p.id, name: p.name })),
    round: 0, phase: "decide", artifactOrder: shuffle(ARTIFACTS.map(a => a.id)),
    pool: [...TREASURES.map((_, i) => "t" + i), ...HAZARDS.flatMap(h => [1, 2, 3].map(k => `h-${h}-${k}`))],   // cards still in the game
    removed: [],          // hazard cards gone for good
    artifactsOut: 0,      // how many artifacts have left the temple (first three score 5)
    pl: Object.fromEntries(players.map(p => [p.id, { tent: 0, artifacts: [], carry: 0, inside: true, roundsSafe: 0 }])),
    deck: [], path: [], choices: {}, last: null, log: [], result: null,
  };
  startRound(G);
  return G;
}

function startRound(G) {
  G.round++; G.phase = "decide";
  const art = G.artifactOrder[G.round - 1];
  G.pool.push(art);
  G.deck = shuffle(G.pool.slice());
  G.path = [];
  G.choices = {};
  for (const p of G.players) Object.assign(G.pl[p.id], { carry: 0, inside: true });
  G.roundArtifact = art;
  const ev = { kind: "round", round: G.round, artifact: art, cards: [] };
  // nobody would leave before the first card, so it's turned at once — and another if it's a Hazard
  flip(G, ev);
  if (G.path.length === 1 && cardOf(G.path[0].id).kind === "hazard" && G.phase !== "roundOver") flip(G, ev);
  G.last = ev;
}

const inside = G => G.players.map(p => p.id).filter(id => G.pl[id].inside);

// Turn the next card for everyone still in the temple.
function flip(G, ev) {
  const id = G.deck.pop();
  if (!id) { endRound(G, ev, null); return; }
  const c = cardOf(id), here = inside(G), slot = { id, left: 0 };
  G.path.push(slot);
  const e = { id };
  if (c.kind === "treasure") {
    const each = Math.floor(c.value / here.length);
    for (const p of here) G.pl[p].carry += each;
    slot.left = c.value - each * here.length;
    Object.assign(e, { each, left: slot.left, to: here.slice() });
  }
  if (c.kind === "hazard") {
    const twice = G.path.filter(s => s !== slot && cardOf(s.id).kind === "hazard" && cardOf(s.id).hazard === c.hazard).length > 0;
    if (twice) {
      e.disaster = { hazard: c.hazard, lost: Object.fromEntries(here.map(p => [p, G.pl[p].carry])) };
      for (const p of here) G.pl[p].carry = 0;
      G.pool = G.pool.filter(x => x !== id); G.removed.push(id);   // this Hazard card is gone for the rest of the game
      ev.cards.push(e);
      endRound(G, ev, c.hazard);
      return;
    }
  }
  ev.cards.push(e);
}

function endRound(G, ev, disaster) {
  // artifacts still on the path are lost forever
  const lost = G.path.filter(s => cardOf(s.id).kind === "artifact").map(s => s.id);
  G.pool = G.pool.filter(x => !lost.includes(x));
  for (const p of G.players) { G.pl[p.id].inside = false; G.pl[p.id].carry = 0; }
  G.log.push({ round: G.round, disaster, lostArtifacts: lost, path: G.path.map(s => s.id) });
  ev.end = { disaster, lostArtifacts: lost };
  if (G.round >= ROUNDS) return finish(G);
  G.phase = "roundOver";
}

function finish(G) {
  G.phase = "gameOver";
  const rows = G.players.map(p => ({ pid: p.id, points: score(G, p.id), artifacts: G.pl[p.id].artifacts.length }))
    .sort((a, b) => b.points - a.points || b.artifacts - a.artifacts);
  const top = rows[0];
  G.result = { rows, winners: rows.filter(r => r.points === top.points && r.artifacts === top.artifacts).map(r => r.pid) };
}

export const artifactValue = a => a.value;
export const score = (G, pid) => G.pl[pid].tent + G.pl[pid].artifacts.reduce((s, a) => s + a.value, 0);

export function waitingOn(G) {
  if (G.phase !== "decide") return [];
  return inside(G).filter(p => !(p in G.choices));
}
export const timerKey = G => `${G.round}.${G.path.length}.${G.phase}`;
// Between temples the table runner moves on by itself after a short pause (room.js "timers").
export const pause = G => (G.phase === "roundOver" ? { ms: 6000, action: { type: "next" } } : null);

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!G.pl[pid]) throw new Error("You're not in this game.");
  if (G.phase === "roundOver") {
    // anyone's "next temple" (or the timer) moves on
    if (a.type !== "next") throw new Error("Wait for the next temple.");
    G.seq++; startRound(G); return G;
  }
  if (a.type !== "choose" || typeof a.go !== "boolean") throw new Error("Choose the torch or the camp.");
  if (!G.pl[pid].inside) throw new Error("You're back at camp for this round.");
  if (pid in G.choices) throw new Error("You've already chosen.");
  G.choices[pid] = a.go; G.seq++;
  if (waitingOn(G).length) return G;
  resolve(G);
  return G;
}

function resolve(G) {
  const here = inside(G), leavers = here.filter(p => !G.choices[p]), stayers = here.filter(p => G.choices[p]);
  const ev = { kind: "turn", round: G.round, choices: { ...G.choices }, leavers, cards: [] };
  if (leavers.length) {
    // leavers share what's left on the path; the remainder stays where it is
    const onPath = G.path.reduce((s, x) => s + x.left, 0), each = Math.floor(onPath / leavers.length);
    let rest = onPath - each * leavers.length;
    for (const s of G.path) { const keep = Math.min(s.left, rest); rest -= keep; s.left = keep; }
    ev.split = { each, carried: Object.fromEntries(leavers.map(p => [p, G.pl[p].carry + each])) };
    let arts = [];
    if (leavers.length === 1) {
      arts = G.path.filter(s => cardOf(s.id).kind === "artifact").map(s => s.id);
      for (const id of arts) {
        G.artifactsOut++;
        G.pl[leavers[0]].artifacts.push({ id, value: G.artifactsOut <= 3 ? 5 : 10 });
      }
      G.path = G.path.filter(s => !arts.includes(s.id));
      G.pool = G.pool.filter(x => !arts.includes(x));
      ev.artifacts = arts.map(id => ({ id, value: G.pl[leavers[0]].artifacts.find(x => x.id === id).value }));
    }
    for (const p of leavers) { const P = G.pl[p]; P.tent += P.carry + each; P.carry = 0; P.inside = false; P.roundsSafe++; }
  }
  G.choices = {};
  if (stayers.length) flip(G, ev);
  else endRound(G, ev, null);
  G.last = ev;
}

export function viewFor(G, pid) {
  const over = G.phase === "gameOver";
  const v = {
    game: "incan", gameId: G.gameId, seq: G.seq, phase: G.phase, round: G.round, rounds: ROUNDS,
    me: G.players.findIndex(p => p.id === pid), waiting: waitingOn(G),
    path: G.path.map(s => ({ ...s })), deckLeft: G.deck.length, removed: G.removed.slice(), artifactsOut: G.artifactsOut,
    roundArtifact: G.roundArtifact, seen: Object.fromEntries(HAZARDS.map(h => [h, G.path.filter(s => cardOf(s.id).hazard === h).length])),
    gone: Object.fromEntries(HAZARDS.map(h => [h, G.removed.filter(x => cardOf(x).hazard === h).length])),
    players: G.players.map(p => {
      const P = G.pl[p.id];
      return { id: p.id, name: p.name, inside: P.inside, carry: P.carry, decided: p.id in G.choices, artifacts: P.artifacts.map(a => ({ ...a })),
        tent: P.tent, points: score(G, p.id) };   // tents are open to everyone (house rule, 24 Oct 2026)
    }),
    last: G.last ? structuredClone(G.last) : null, result: G.result ? structuredClone(G.result) : null,
  };
  if (G.pl[pid] && pid in G.choices) v.myChoice = G.choices[pid];
  return v;
}

// ---------------------------------------------------------------- automatic play
export function autoAction(G, pid) {
  if (G.phase === "roundOver") return { type: "next" };
  if (!waitingOn(G).includes(pid)) return null;
  return { type: "choose", go: Math.random() < .75 };
}

// A sensible choice: compare the chance the next card ends the round with what you'd lose.
export function smartAction(G, pid) {
  if (G.phase === "roundOver") return { type: "next" };
  if (!waitingOn(G).includes(pid)) return null;
  const deck = G.deck.length || 1, here = inside(G).length;
  const deadly = HAZARDS.reduce((s, h) => s + (G.path.some(x => cardOf(x.id).hazard === h) ? G.deck.filter(x => cardOf(x).hazard === h).length : 0), 0);
  const risk = deadly / deck;
  const avgTreasure = G.deck.filter(x => cardOf(x).kind === "treasure").reduce((s, x) => s + cardOf(x).value, 0) / deck;
  const gain = avgTreasure / here;
  const onPath = G.path.reduce((s, x) => s + x.left, 0), arts = G.path.filter(s => cardOf(s.id).kind === "artifact").length;
  const atStake = G.pl[pid].carry + onPath / Math.max(1, here) + arts * 3;
  const go = gain * (1 - risk) > risk * atStake + (G.round === ROUNDS ? 0 : 0.5);
  return { type: "choose", go };
}
