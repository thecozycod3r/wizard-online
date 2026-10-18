// Avalon — pure rules engine (The Resistance: Avalon, Don Eskridge). No DOM, no network.
// newGame(players, settings) · act(G, pid, action) · viewFor(G, pid) · waitingOn(G) · autoAction · smartAction · timerKey
//
// Phases: reveal → propose → vote → quest → (lady) → … → assassin → gameOver
// Actions: {type:"ready"} · {type:"propose", team:[pid…]} · {type:"vote", yes} · {type:"quest", ok}
//          {type:"lady", target} · {type:"assassinate", target}

export const MIN_PLAYERS = 5, MAX_PLAYERS = 10;
export const EVIL_COUNT = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
export const QUEST_SIZES = {
  5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};
export const OPTIONAL = ["percival", "morgana", "mordred", "oberon"];
export const ROLES = {
  merlin: { name: "Merlin", side: "good" },
  percival: { name: "Percival", side: "good" },
  servant: { name: "Loyal Servant of Arthur", side: "good" },
  assassin: { name: "The Assassin", side: "evil" },
  morgana: { name: "Morgana", side: "evil" },
  mordred: { name: "Mordred", side: "evil" },
  oberon: { name: "Oberon", side: "evil" },
  minion: { name: "Minion of Mordred", side: "evil" },
};

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const idx = (G, pid) => G.players.findIndex(p => p.id === pid);
export const sideOf = (G, pid) => ROLES[G.roles[pid]].side;
export const questSize = (G, q = G.quest) => QUEST_SIZES[G.players.length][q - 1];
export const twoFails = (G, q = G.quest) => q === 4 && G.players.length >= 7;
export const leaderId = G => G.players[G.leader].id;

// Which optional roles actually fit the table (you can't have more special Evil roles than Evil seats).
export function rolesFor(n, settings = {}) {
  const evilN = EVIL_COUNT[n], goodN = n - evilN;
  const want = OPTIONAL.filter(r => settings[r]);
  const good = ["merlin"], evil = ["assassin"];
  if (want.includes("percival") && good.length < goodN) good.push("percival");
  for (const r of ["morgana", "mordred", "oberon"]) if (want.includes(r) && evil.length < evilN) evil.push(r);
  while (good.length < goodN) good.push("servant");
  while (evil.length < evilN) evil.push("minion");
  return { good, evil };
}

export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Avalon needs 5 to 10 players.");
  const { good, evil } = rolesFor(n, settings);
  const deck = shuffle([...good, ...evil]);
  const G = {
    v: 1, game: "avalon", gameId: Math.random().toString(36).slice(2, 10), seq: 0,
    settings: { percival: !!settings.percival, morgana: !!settings.morgana, mordred: !!settings.mordred, oberon: !!settings.oberon, lady: !!settings.lady },
    players: players.map(p => ({ id: p.id, name: p.name })),
    roles: Object.fromEntries(players.map((p, i) => [p.id, deck[i]])),
    phase: "reveal", ready: {}, quest: 1, attempt: 1, leader: Math.floor(Math.random() * n),
    team: [], votes: {}, cards: {}, results: [], proposals: [], lady: null, ladyUsed: [], ladyChecks: [],
    last: null, result: null,
  };
  if (G.settings.lady) {
    const holder = G.players[(G.leader - 1 + n) % n].id;   // the player to the leader's right
    G.lady = holder; G.ladyUsed = [holder];
  }
  return G;
}

// What a player knows at the start, from their role. Returns [{id, as}] where `as` is how they appear to this player.
export function knowledge(G, pid) {
  const r = G.roles[pid], ids = G.players.map(p => p.id).filter(x => x !== pid);
  if (ROLES[r].side === "evil" && r !== "oberon") return ids.filter(x => sideOf(G, x) === "evil" && G.roles[x] !== "oberon").map(id => ({ id, as: "evil" }));
  if (r === "merlin") return ids.filter(x => sideOf(G, x) === "evil" && G.roles[x] !== "mordred").map(id => ({ id, as: "evil" }));
  if (r === "percival") return ids.filter(x => G.roles[x] === "merlin" || G.roles[x] === "morgana").map(id => ({ id, as: "merlin?" }));
  return [];
}

export function waitingOn(G) {
  const all = G.players.map(p => p.id);
  if (G.phase === "reveal") return all.filter(p => !G.ready[p]);
  if (G.phase === "propose") return [leaderId(G)];
  if (G.phase === "vote") return all.filter(p => !(p in G.votes));
  if (G.phase === "quest") return G.team.filter(p => !(p in G.cards));
  if (G.phase === "lady") return [G.lady];
  if (G.phase === "assassin") return [G.players.find(p => G.roles[p.id] === "assassin").id];
  return [];
}
export const timerKey = G => `${G.phase}.${G.quest}.${G.attempt}`;

// Who the Lady may examine: anyone except the holder and players who already held her.
export const ladyTargets = G => G.players.map(p => p.id).filter(p => p !== G.lady && !G.ladyUsed.includes(p));

function nextLeader(G) { G.leader = (G.leader + 1) % G.players.length; }
function finish(G, winner, why) { G.phase = "gameOver"; G.result = { winner, why, roles: { ...G.roles } }; }

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (idx(G, pid) < 0) throw new Error("You're not in this game.");
  if (!waitingOn(G).includes(pid)) throw new Error(G.phase === "propose" ? "Only the leader picks the team." : "Not your move right now.");

  if (G.phase === "reveal") {
    if (a.type !== "ready") throw new Error("Look at your role first.");
    G.ready[pid] = true; G.seq++;
    if (G.players.every(p => G.ready[p.id])) { G.phase = "propose"; G.last = { kind: "start", leader: leaderId(G) }; }
    return G;
  }
  if (G.phase === "propose") {
    if (a.type !== "propose") throw new Error("Pick your team.");
    const team = [...new Set(a.team || [])];
    if (team.length !== questSize(G)) throw new Error(`This quest needs ${questSize(G)} knights.`);
    if (team.some(t => idx(G, t) < 0)) throw new Error("Pick players at this table.");
    G.team = team; G.votes = {}; G.phase = "vote"; G.seq++;
    G.last = { kind: "propose", leader: pid, team: team.slice(), quest: G.quest, attempt: G.attempt };
    return G;
  }
  if (G.phase === "vote") {
    if (a.type !== "vote" || typeof a.yes !== "boolean") throw new Error("Approve or reject the team.");
    G.votes[pid] = a.yes; G.seq++;
    if (G.players.every(p => p.id in G.votes)) {
      const yes = Object.values(G.votes).filter(Boolean).length, ok = yes * 2 > G.players.length;
      const rec = { quest: G.quest, attempt: G.attempt, leader: leaderId(G), team: G.team.slice(), votes: { ...G.votes }, approved: ok };
      G.proposals.push(rec);
      G.last = { kind: "vote", ...rec };
      nextLeader(G);
      if (ok) { G.phase = "quest"; G.cards = {}; }
      else if (G.attempt >= 5) finish(G, "evil", "Five teams in a row were rejected.");
      else { G.attempt++; G.team = []; G.votes = {}; G.phase = "propose"; }
    }
    return G;
  }
  if (G.phase === "quest") {
    if (a.type !== "quest" || typeof a.ok !== "boolean") throw new Error("Play Success or Fail.");
    if (!a.ok && sideOf(G, pid) === "good") throw new Error("Loyal knights can only play Success.");
    G.cards[pid] = a.ok; G.seq++;
    if (G.team.every(t => t in G.cards)) {
      const fails = Object.values(G.cards).filter(c => !c).length;
      const failed = fails >= (twoFails(G) ? 2 : 1);
      const res = { quest: G.quest, team: G.team.slice(), fails, success: !failed, twoFails: twoFails(G) };
      G.results.push(res); G.last = { kind: "quest", ...res };
      G.cards = {}; G.team = []; G.votes = {};
      const good = G.results.filter(r => r.success).length, bad = G.results.length - good;
      if (bad >= 3) return finish(G, "evil", "Three quests failed."), G;
      if (good >= 3) { G.phase = "assassin"; return G; }
      G.quest++; G.attempt = 1;
      G.phase = G.settings.lady && G.lady && [3, 4, 5].includes(G.quest) && ladyTargets(G).length ? "lady" : "propose";
    }
    return G;
  }
  if (G.phase === "lady") {
    if (a.type !== "lady" || !ladyTargets(G).includes(a.target)) throw new Error("Choose someone the Lady hasn't visited.");
    G.ladyChecks.push({ by: pid, target: a.target, quest: G.quest - 1, side: sideOf(G, a.target) });
    G.last = { kind: "lady", by: pid, target: a.target };
    G.lady = a.target; G.ladyUsed.push(a.target);
    G.phase = "propose"; G.seq++;
    return G;
  }
  if (G.phase === "assassin") {
    if (a.type !== "assassinate" || idx(G, a.target) < 0 || a.target === pid) throw new Error("Name the player you think is Merlin.");
    G.seq++;
    G.last = { kind: "assassin", by: pid, target: a.target, hit: G.roles[a.target] === "merlin" };
    if (G.roles[a.target] === "merlin") finish(G, "evil", "The Assassin found Merlin.");
    else finish(G, "good", "Three quests succeeded and Merlin stayed hidden.");
    G.result.assassinated = a.target;
    return G;
  }
  throw new Error("Unknown action.");
}

export function viewFor(G, pid) {
  const over = G.phase === "gameOver", mine = idx(G, pid) >= 0;
  const v = {
    game: "avalon", gameId: G.gameId, seq: G.seq, phase: G.phase, settings: G.settings,
    quest: G.quest, attempt: G.attempt, leader: leaderId(G), size: questSize(G), twoFails: twoFails(G),
    sizes: QUEST_SIZES[G.players.length], evilCount: EVIL_COUNT[G.players.length],
    me: idx(G, pid), waiting: waitingOn(G),
    players: G.players.map(p => ({ id: p.id, name: p.name, ready: !!G.ready[p.id], voted: p.id in G.votes, played: p.id in G.cards })),
    team: G.team.slice(), results: G.results.map(r => ({ ...r })),
    proposals: G.proposals.map(r => ({ ...r, votes: { ...r.votes } })),
    lady: G.lady, ladyUsed: G.ladyUsed.slice(), ladyTargets: G.phase === "lady" ? ladyTargets(G) : [],
    ladyChecks: G.ladyChecks.map(c => ({ by: c.by, target: c.target, quest: c.quest, side: over || c.by === pid ? c.side : null })),
    roleSet: rolesFor(G.players.length, G.settings), last: G.last ? structuredClone(G.last) : null, result: G.result ? structuredClone(G.result) : null,
  };
  if (mine) {
    v.role = G.roles[pid]; v.side = sideOf(G, pid); v.knows = knowledge(G, pid);
    if (G.phase === "vote" && pid in G.votes) v.myVote = G.votes[pid];
    if (G.phase === "quest" && pid in G.cards) v.myCard = G.cards[pid];
    // At the assassination, Evil talk it over together: they see each other (Oberon still unknown).
    if (G.phase === "assassin" && v.side === "evil") v.knows = G.players.map(p => p.id).filter(x => x !== pid && sideOf(G, x) === "evil" && G.roles[x] !== "oberon" && v.role !== "oberon").map(id => ({ id, as: G.roles[id] === "assassin" ? "assassin" : "evil" }));
  }
  if (over) v.roles = { ...G.roles };
  return v;
}

// ---------------------------------------------------------------- automatic play
const pick = a => a[Math.floor(Math.random() * a.length)];

// Random but legal: used by the simulation.
export function autoAction(G, pid) {
  if (!waitingOn(G).includes(pid)) return null;
  const ids = G.players.map(p => p.id);
  switch (G.phase) {
    case "reveal": return { type: "ready" };
    case "propose": return { type: "propose", team: shuffle(ids.slice()).slice(0, questSize(G)) };
    case "vote": return { type: "vote", yes: Math.random() < .6 };
    case "quest": return { type: "quest", ok: sideOf(G, pid) === "good" ? true : Math.random() < .3 };
    case "lady": return { type: "lady", target: pick(ladyTargets(G)) };
    case "assassin": return { type: "assassinate", target: pick(ids.filter(x => x !== pid)) };
  }
  return null;
}

// A sensible move (timer ran out / a bot plays a seat that left), using only what that player could know.
export function smartAction(G, pid) {
  if (!waitingOn(G).includes(pid)) return null;
  const ids = G.players.map(p => p.id), good = sideOf(G, pid) === "good";
  const known = knowledge(G, pid), knownEvil = new Set(known.filter(k => k.as === "evil").map(k => k.id));
  // Suspicion from public history: failed quests make their members suspect.
  const sus = Object.fromEntries(ids.map(x => [x, 0]));
  for (const r of G.results) for (const t of r.team) sus[t] += r.success ? -0.5 : 1 + r.fails / r.team.length;
  for (const c of G.ladyChecks) if (c.by === pid) sus[c.target] += c.side === "evil" ? 99 : -99;
  for (const k of knownEvil) sus[k] += good ? 99 : 0;
  const trust = x => (x === pid ? -100 : sus[x] + Math.random() * .3);
  switch (G.phase) {
    case "reveal": return { type: "ready" };
    case "propose": {
      const n = questSize(G);
      if (good) return { type: "propose", team: [pid, ...ids.filter(x => x !== pid).sort((a, b) => trust(a) - trust(b))].slice(0, n) };
      // Evil leader: self plus the most trusted-looking others (keeps one Evil on the team without stacking it).
      return { type: "propose", team: [pid, ...shuffle(ids.filter(x => x !== pid && !knownEvil.has(x)))].slice(0, n) };
    }
    case "vote": {
      if (G.attempt >= 5) return { type: "vote", yes: good };           // the fifth team: Good must approve, Evil reject
      if (good) return { type: "vote", yes: G.team.every(t => t === pid || trust(t) < 0.9) };
      return { type: "vote", yes: G.team.some(t => t === pid || knownEvil.has(t)) };
    }
    case "quest": {
      if (good) return { type: "quest", ok: true };
      const evilOnTeam = G.team.filter(t => t === pid || knownEvil.has(t));
      const need = twoFails(G) ? 2 : 1;
      // Fail when it can count; with several Evil on the team only the first (by seat) fails, unless two are needed.
      const iFail = evilOnTeam.length >= need && (need === 2 || evilOnTeam.sort((a, b) => idx(G, a) - idx(G, b))[0] === pid);
      return { type: "quest", ok: !iFail };
    }
    case "lady": return { type: "lady", target: ladyTargets(G).sort((a, b) => Math.abs(sus[a]) - Math.abs(sus[b]))[0] };   // whoever we know least about
    case "assassin": {
      // The Good player who avoided suspicion best is the likeliest Merlin.
      const pool = ids.filter(x => !knownEvil.has(x) && x !== pid);
      return { type: "assassinate", target: pool.sort((a, b) => sus[a] - sus[b] + (Math.random() - .5))[0] };
    }
  }
  return null;
}
