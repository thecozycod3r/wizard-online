// Coup — pure engine. No DOM, no network. Base game plus the Reformation options (Inquisitor, factions, 7–10 players).
// newGame(players, {deck:"classic"|"inquisitor", factions:"off"|"on", window}) · act(G, pid, a) · viewFor · waitingOn · smartAction · timerKey · pause
//
// A turn: the player declares an action (claiming a character or not) → a reaction window where anyone may challenge the claim and the
// players allowed to may block → if blocked, a window where anyone may challenge the block → influence losses (the loser picks the card)
// → the effect. Coins paid for an action stay spent even if it fails.
// Actions: {type:"income"|"aid"|"coup"|"tax"|"assassinate"|"steal"|"exchange"|"examine"|"convert"|"embezzle", target?}
//          {type:"pass"} · {type:"challenge"} · {type:"block", as} · {type:"lose", card} · {type:"keep", keep:[i…]}
//          {type:"show", card} · {type:"decide", force} · {type:"close"} (the table closes a reaction window by itself)

export const MIN_PLAYERS = 2, MAX_PLAYERS = 10;
export const ROLE = {
  duke: { name: "Duke", act: "Tax: take 3 coins", block: "Blocks Foreign Aid" },
  assassin: { name: "Assassin", act: "Assassinate: pay 3, a player loses an influence", block: "" },
  captain: { name: "Captain", act: "Steal: take 2 coins from a player", block: "Blocks stealing" },
  ambassador: { name: "Ambassador", act: "Exchange: draw 2, return 2", block: "Blocks stealing" },
  contessa: { name: "Contessa", act: "", block: "Blocks assassination" },
  inquisitor: { name: "Inquisitor", act: "Exchange 1, or examine a player's card", block: "Blocks stealing" },
};
// what each action costs, claims and who may block it with what
export const ACT = {
  income: { label: "Income", gain: 1 },
  aid: { label: "Foreign Aid", gain: 2, blockBy: ["duke"], blockers: "any" },
  coup: { label: "Coup", cost: 7, target: true },
  tax: { label: "Tax", claim: "duke", gain: 3 },
  assassinate: { label: "Assassinate", cost: 3, claim: "assassin", target: true, blockBy: ["contessa"], blockers: "target" },
  steal: { label: "Steal", claim: "captain", target: true, blockBy: ["captain", "SWAP"], blockers: "target" },
  exchange: { label: "Exchange", claim: "SWAP" },
  examine: { label: "Examine", claim: "inquisitor", target: true, inq: true },
  convert: { label: "Convert", fac: true },
  embezzle: { label: "Embezzle", fac: true, anti: "duke" },
};
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const copiesFor = n => (n <= 6 ? 3 : n <= 8 ? 4 : 5);
export const swapRole = G => (G.settings.deck === "inquisitor" ? "inquisitor" : "ambassador");
const roleOf = (G, r) => (r === "SWAP" ? swapRole(G) : r);
export const roles = G => ["duke", "assassin", "captain", swapRole(G), "contessa"];

// what a table of n players actually plays, from the lobby's settings (factions need 3+ players)
export const tableSettings = (settings = {}, n) => ({ deck: settings.deck === "inquisitor" ? "inquisitor" : "classic", factions: settings.factions === "on" && n >= 3 ? "on" : "off", window: [8, 12, 20].includes(+settings.window) ? +settings.window : 12 });
export function newGame(players, settings = {}) {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("Coup needs 2 to 10 players.");
  const s = tableSettings(settings, n);
  const G = {
    v: 1, game: "coup", gameId: Math.random().toString(36).slice(2, 10), seq: 0, n: 0, turns: 0, settings: s,
    players: players.map(p => ({ id: p.id, name: p.name })), cards: {}, coins: {}, faction: {}, deck: [], reserve: 0,
    turn: Math.floor(Math.random() * n), phase: "action", T: null, log: [], last: { n: 1, kind: "start", items: [] }, result: null,
  };
  G.deck = shuffle(roles(G).flatMap(r => Array(copiesFor(n)).fill(r)));
  players.forEach((p, i) => {
    G.cards[p.id] = [{ r: G.deck.pop(), up: false }, { r: G.deck.pop(), up: false }];
    G.coins[p.id] = n === 2 && i === G.turn ? 1 : 2;   // two players: whoever starts begins with 1 coin
    // factions alternate round the table from the first player
    if (s.factions === "on") G.faction[p.id] = (i - G.turn + n) % 2 ? "R" : "L";
  });
  return G;
}

const ids = G => G.players.map(p => p.id);
export const alive = (G, pid) => G.cards[pid].some(c => !c.up);
const living = G => ids(G).filter(p => alive(G, p));
const hidden = (G, pid) => G.cards[pid].filter(c => !c.up);
const has = (G, pid, r) => hidden(G, pid).some(c => c.r === r);
const cur = G => ids(G)[G.turn];
// same side under the Reformation factions (and there are still two sides in play) → can't attack each other
export function sameSide(G, a, b) {
  if (G.settings.factions !== "on" || a === b) return false;
  const sides = new Set(living(G).map(p => G.faction[p]));
  return sides.size > 1 && G.faction[a] === G.faction[b];
}
export function canTarget(G, actor, type, t) {
  return t !== actor && G.cards[t] && alive(G, t) && !sameSide(G, actor, t) && (type !== "examine" || G.settings.deck === "inquisitor");
}
// who may react to the declared action, and how
function blockersOf(G) {
  const T = G.T, spec = ACT[T.type];
  if (!spec.blockBy) return [];
  if (spec.blockers === "target") return T.target && alive(G, T.target) ? [T.target] : [];
  return living(G).filter(p => p !== T.actor && !sameSide(G, T.actor, p));
}
const challengeable = G => !!(ACT[G.T.type].claim || ACT[G.T.type].anti);
function responders(G) {
  const T = G.T;
  if (G.phase === "respond") {
    const b = T.blockOnly ? [] : blockersOf(G);
    const pool = T.blockOnly ? blockersOf(G) : challengeable(G) ? living(G).filter(p => p !== T.actor) : b;
    return pool.filter(p => !T.responded.includes(p));
  }
  if (G.phase === "blockRespond") return living(G).filter(p => p !== T.blocker && !T.responded.includes(p));
  return [];
}
export function waitingOn(G) {
  if (!G.T && G.phase !== "action") return [];
  switch (G.phase) {
    case "action": return [cur(G)];
    case "respond": case "blockRespond": return responders(G);
    case "lose": return [G.T.lose.pid];
    case "exchange": case "examineDecide": return [G.T.actor];
    case "examineShow": return [G.T.target];
    default: return [];
  }
}
export const timerKey = G => `${G.turns}.${G.phase}.${G.T?.lose?.pid || ""}.${G.T?.blocker || ""}`;
// reaction windows close by themselves: everyone who hasn't reacted lets it through
export const pause = G => (G.phase === "respond" || G.phase === "blockRespond" ? { ms: G.settings.window * 1000, action: { type: "close" } } : null);

const ev = (G, e) => { G.last.items.push(e); G.log.push(e); if (G.log.length > 14) G.log.shift(); };
function replaceCard(G, pid, r) {   // a proven card goes back into the Court deck and the player draws a new one
  const c = G.cards[pid].find(x => !x.up && x.r === r);
  G.deck.push(c.r); shuffle(G.deck); c.r = G.deck.pop();
}

export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!G.cards[pid]) throw new Error("You're not in this game.");
  if (a.type === "close") {
    if (G.phase !== "respond" && G.phase !== "blockRespond") throw new Error("Nothing to close.");
    G.last = { n: ++G.n, kind: "close", items: [] }; G.seq++;
    for (const p of responders(G)) G.T.responded.push(p);
    return G.phase === "respond" ? afterWindow(G) : blockStands(G);
  }
  if (!waitingOn(G).includes(pid)) throw new Error("It's not your turn.");
  G.last = { n: ++G.n, kind: a.type, items: [] }; G.seq++;
  switch (G.phase) {
    case "action": return declare(G, pid, a);
    case "respond": return respond(G, pid, a);
    case "blockRespond": return blockRespond(G, pid, a);
    case "lose": return loseCard(G, pid, a);
    case "exchange": return keep(G, pid, a);
    case "examineShow": return show(G, pid, a);
    case "examineDecide": return decide(G, pid, a);
  }
  throw new Error("Unknown action.");
}

function declare(G, pid, a) {
  const spec = ACT[a.type];
  if (!spec) throw new Error("Unknown action.");
  if (G.coins[pid] >= 10 && a.type !== "coup") throw new Error("With 10 or more coins you must launch a Coup.");
  if (spec.inq && G.settings.deck !== "inquisitor") throw new Error("Examine needs the Inquisitor.");
  if (spec.fac && G.settings.factions !== "on") throw new Error("That needs the factions option.");
  let cost = spec.cost || 0;
  if (a.type === "convert") { const t = a.target || pid; if (!alive(G, t)) throw new Error("Pick a player still in."); cost = t === pid ? 1 : 2; a = { type: "convert", target: t }; }
  if (spec.target && !canTarget(G, pid, a.type, a.target)) throw new Error(sameSide(G, pid, a.target) ? "They're on your side." : "Pick a player still in.");
  if (G.coins[pid] < cost) throw new Error(`That costs ${cost} coins.`);
  if (a.type === "embezzle" && !G.reserve) throw new Error("The Treasury Reserve is empty.");
  G.coins[pid] -= cost;
  G.T = { actor: pid, type: a.type, target: a.target || null, claim: spec.claim ? roleOf(G, spec.claim) : null, responded: [], blocker: null, blockAs: null, blockOnly: false, lose: null, pool: null, shown: null };
  ev(G, { k: "declare", pid, type: a.type, target: G.T.target, claim: G.T.claim, cost });
  if (a.type === "income") { G.coins[pid] += 1; return endTurn(G); }
  if (a.type === "coup") return lose(G, a.target, "end");
  if (a.type === "convert") { G.reserve += cost; G.faction[a.target] = G.faction[a.target] === "L" ? "R" : "L"; ev(G, { k: "convert", pid, target: a.target, to: G.faction[a.target] }); return endTurn(G); }
  return openWindow(G, false);
}
function openWindow(G, blockOnly) {
  G.T.blockOnly = blockOnly; G.T.responded = [];
  G.phase = "respond";
  if (!responders(G).length) return doAction(G);
  return G;
}
function respond(G, pid, a) {
  const T = G.T;
  if (a.type === "pass") { T.responded.push(pid); ev(G, { k: "pass", pid }); return responders(G).length ? G : afterWindow(G); }
  if (a.type === "challenge") {
    if (T.blockOnly || !challengeable(G)) throw new Error("There's no claim to challenge.");
    return challengeAction(G, pid);
  }
  if (a.type === "block") {
    const spec = ACT[T.type], as = a.as;
    if (!blockersOf(G).includes(pid)) throw new Error("You can't block this.");
    if (!spec.blockBy.map(r => roleOf(G, r)).includes(as)) throw new Error("That character can't block this.");
    T.blocker = pid; T.blockAs = as; T.responded = []; G.phase = "blockRespond";
    ev(G, { k: "block", pid, as, type: T.type });
    if (!responders(G).length) return blockStands(G);
    return G;
  }
  throw new Error("Pass, challenge or block.");
}
function afterWindow(G) { return doAction(G); }
function blockRespond(G, pid, a) {
  const T = G.T;
  if (a.type === "pass") { T.responded.push(pid); ev(G, { k: "pass", pid }); return responders(G).length ? G : blockStands(G); }
  if (a.type === "challenge") {
    const ok = has(G, T.blocker, T.blockAs);
    ev(G, { k: "challenge", pid, on: T.blocker, role: T.blockAs, proved: ok });
    if (ok) { replaceCard(G, T.blocker, T.blockAs); return lose(G, pid, "blocked"); }
    return lose(G, T.blocker, "do");
  }
  throw new Error("Pass or challenge the block.");
}
function blockStands(G) { ev(G, { k: "blocked", pid: G.T.blocker, as: G.T.blockAs, type: G.T.type, actor: G.T.actor }); return endTurn(G); }
function challengeAction(G, pid) {
  const T = G.T;
  if (T.type === "embezzle") {   // inverted: the embezzler must NOT hold the Duke
    const duke = has(G, T.actor, "duke");
    ev(G, { k: "challenge", pid, on: T.actor, role: "duke", anti: true, proved: !duke });
    if (duke) return lose(G, T.actor, "end");
    for (const c of hidden(G, T.actor)) { G.deck.push(c.r); shuffle(G.deck); c.r = G.deck.pop(); }
    return lose(G, pid, "do");
  }
  const ok = has(G, T.actor, T.claim);
  ev(G, { k: "challenge", pid, on: T.actor, role: T.claim, proved: ok });
  if (!ok) return lose(G, T.actor, "end");
  replaceCard(G, T.actor, T.claim);
  return lose(G, pid, "afterChallenge");
}
// pid loses one influence; with one card left it goes at once, otherwise they pick which to turn up
function lose(G, pid, next) {
  const h = hidden(G, pid);
  if (!h.length) return go(G, next);
  if (h.length === 1) { reveal(G, pid, G.cards[pid].indexOf(h[0])); return go(G, next); }
  G.T.lose = { pid, next }; G.phase = "lose";
  return G;
}
function reveal(G, pid, i) {
  const c = G.cards[pid][i]; c.up = true;
  const dead = !alive(G, pid);
  if (dead) G.coins[pid] = 0;
  ev(G, { k: "lose", pid, role: c.r, dead });
}
function loseCard(G, pid, a) {
  const i = +a.card;
  if (a.type !== "lose" || !G.cards[pid][i] || G.cards[pid][i].up) throw new Error("Pick one of your face-down cards.");
  reveal(G, pid, i);
  const next = G.T.lose.next; G.T.lose = null;
  return go(G, next);
}
function go(G, next) {
  if (living(G).length <= 1) return finish(G);
  if (next === "end") return endTurn(G);
  if (next === "blocked") return blockStands(G);
  if (next === "do") return doAction(G);
  if (next === "afterChallenge") {   // the claim held: the action stands, but its target may still block it
    if (!alive(G, G.T.actor)) return endTurn(G);
    return ACT[G.T.type].blockBy && blockersOf(G).length ? openWindow(G, true) : doAction(G);
  }
  return endTurn(G);
}
function doAction(G) {
  const T = G.T, p = T.actor, t = T.target;
  if (!alive(G, p)) return endTurn(G);
  switch (T.type) {
    case "aid": G.coins[p] += 2; ev(G, { k: "gain", pid: p, n: 2 }); break;
    case "tax": G.coins[p] += 3; ev(G, { k: "gain", pid: p, n: 3 }); break;
    case "steal": { if (!alive(G, t)) break; const n = Math.min(2, G.coins[t]); G.coins[t] -= n; G.coins[p] += n; ev(G, { k: "steal", pid: p, target: t, n }); break; }
    case "embezzle": { const n = G.reserve; G.reserve = 0; G.coins[p] += n; ev(G, { k: "gain", pid: p, n, from: "reserve" }); break; }
    case "assassinate": if (alive(G, t)) { ev(G, { k: "hit", pid: p, target: t }); return lose(G, t, "end"); } break;
    case "exchange": {
      const k = swapRole(G) === "ambassador" ? 2 : 1;
      T.pool = []; for (let i = 0; i < k && G.deck.length; i++) T.pool.push(G.deck.pop());
      G.phase = "exchange"; return G;
    }
    case "examine": if (alive(G, t)) { G.phase = "examineShow"; return G; } break;
  }
  return endTurn(G);
}
// exchange: keep as many as you have face-down, out of your face-down cards + the drawn ones (indices into that list)
function keep(G, pid, a) {
  const T = G.T, h = hidden(G, pid), all = [...h.map(c => c.r), ...T.pool], want = h.length;
  const k = [...new Set((a.keep || []).map(Number))];
  if (a.type !== "keep" || k.length !== want || k.some(i => !(i >= 0 && i < all.length))) throw new Error(`Keep ${want} card${want > 1 ? "s" : ""}.`);
  const back = all.filter((_, i) => !k.includes(i));
  h.forEach((c, j) => { c.r = all[k[j]]; });
  G.deck.push(...back); shuffle(G.deck);
  ev(G, { k: "exchanged", pid, n: T.pool.length }); T.pool = null;
  return endTurn(G);
}
function show(G, pid, a) {
  const i = +a.card;
  if (a.type !== "show" || !G.cards[pid][i] || G.cards[pid][i].up) throw new Error("Show one of your face-down cards.");
  G.T.shown = i; G.phase = "examineDecide"; ev(G, { k: "shown", pid, to: G.T.actor });
  return G;
}
function decide(G, pid, a) {
  if (a.type !== "decide") throw new Error("Give it back or force a swap.");
  const T = G.T, c = G.cards[T.target][T.shown];
  if (a.force) { G.deck.push(c.r); shuffle(G.deck); c.r = G.deck.pop(); }
  ev(G, { k: "examined", pid, target: T.target, force: !!a.force });
  return endTurn(G);
}
function endTurn(G) {
  if (living(G).length <= 1) return finish(G);
  const n = G.players.length;
  do { G.turn = (G.turn + 1) % n; } while (!alive(G, cur(G)));
  G.T = null; G.phase = "action"; G.turns++;
  return G;
}
function finish(G) {
  G.phase = "gameOver"; G.T = null;
  const w = living(G)[0];
  const out = G.log.filter(e => e.k === "lose" && e.dead).map(e => e.pid);
  // ranking: the winner, then players in reverse order of being knocked out
  const order = [w, ...out.reverse(), ...ids(G).filter(p => p !== w && !out.includes(p))];
  G.result = { winners: [w], rows: order.map((pid, i) => ({ pid, place: i + 1, points: hidden(G, pid).length })) };
  ev(G, { k: "win", pid: w });
  return G;
}

export function viewFor(G, pid) {
  const T = G.T, mine = G.cards[pid] || [];
  const me = G.players.findIndex(p => p.id === pid);
  const t = T && {
    actor: T.actor, type: T.type, target: T.target, claim: T.claim, blocker: T.blocker, blockAs: T.blockAs, blockOnly: T.blockOnly, responded: T.responded.slice(),
    lose: T.lose ? { pid: T.lose.pid } : null,
    pool: T.actor === pid && T.pool ? T.pool.slice() : null, poolN: T.pool ? T.pool.length : 0,
    shown: T.shown != null && T.actor === pid ? G.cards[T.target][T.shown].r : null, shownIdx: T.target === pid ? T.shown : null,
  };
  // what this player could do right now in a reaction window
  let can = null;
  if (T && waitingOn(G).includes(pid) && (G.phase === "respond" || G.phase === "blockRespond")) {
    const blocks = G.phase === "respond" && blockersOf(G).includes(pid) ? ACT[T.type].blockBy.map(r => roleOf(G, r)) : [];
    can = { challenge: G.phase === "blockRespond" || (!T.blockOnly && challengeable(G)), blocks };
  }
  return {
    game: "coup", gameId: G.gameId, seq: G.seq, phase: G.phase, me, waiting: waitingOn(G), turn: G.phase === "gameOver" ? null : cur(G), turns: G.turns,
    settings: { ...G.settings }, reserve: G.reserve, deckN: G.deck.length, copies: copiesFor(G.players.length), roles: roles(G), T: t, can,
    players: G.players.map(p => ({
      id: p.id, name: p.name, coins: G.coins[p.id], faction: G.faction[p.id] || null, alive: alive(G, p.id),
      cards: G.cards[p.id].map(c => (c.up || p.id === pid || G.phase === "gameOver" ? { r: c.r, up: c.up } : { r: null, up: false })),
    })),
    mine: mine.map(c => ({ ...c })), log: G.log.slice(-10).map(e => ({ ...e })),
    last: structuredClone(G.last), result: G.result ? structuredClone(G.result) : null,
  };
}

// ---------------------------------------------------------------- bots / timer
const PRI = { duke: 5, assassin: 4, captain: 3, contessa: 3.5, inquisitor: 2, ambassador: 1 };
const seenUp = (G, r) => ids(G).reduce((s, p) => s + G.cards[p].filter(c => c.up && c.r === r).length, 0);
// a claim this player knows is impossible (every copy is face up or in their own hand)
const impossible = (G, me, r) => seenUp(G, r) + hidden(G, me).filter(c => c.r === r).length >= copiesFor(G.players.length);
export function smartAction(G, pid) {
  const T = G.T, rnd = Math.random();
  if (G.phase === "action" && cur(G) === pid) {
    const foes = living(G).filter(p => p !== pid);
    const hit = type => foes.filter(t => canTarget(G, pid, type, t)).sort((a, b) => hidden(G, a).length - hidden(G, b).length || G.coins[b] - G.coins[a])[0];
    const c = G.coins[pid];
    if (c >= 7 && hit("coup")) return { type: "coup", target: hit("coup") };
    if (c >= 3 && has(G, pid, "assassin") && hit("assassinate")) return { type: "assassinate", target: hit("assassinate") };
    if (has(G, pid, "duke")) return { type: "tax" };
    const rich = foes.filter(t => canTarget(G, pid, "steal", t) && G.coins[t] >= 2).sort((a, b) => G.coins[b] - G.coins[a])[0];
    if (has(G, pid, "captain") && rich) return { type: "steal", target: rich };
    if (G.settings.factions === "on" && G.reserve >= 3 && !has(G, pid, "duke")) return { type: "embezzle" };
    if (has(G, pid, swapRole(G)) && rnd < .4) return { type: "exchange" };
    if (rnd < .2) return { type: "tax" };
    return rnd < .6 ? { type: "aid" } : { type: "income" };
  }
  if (!waitingOn(G).includes(pid)) return null;
  if (G.phase === "respond") {
    const spec = ACT[T.type], blocks = blockersOf(G).includes(pid) ? spec.blockBy.map(r => roleOf(G, r)) : [];
    const real = blocks.find(r => has(G, pid, r));
    if (real) return { type: "block", as: real };
    if (!T.blockOnly && challengeable(G) && T.claim && impossible(G, pid, T.claim)) return { type: "challenge" };
    if (T.type === "assassinate" && T.target === pid && hidden(G, pid).length === 1 && rnd < .5) return { type: "block", as: "contessa" };
    return { type: "pass" };
  }
  if (G.phase === "blockRespond") return impossible(G, pid, T.blockAs) ? { type: "challenge" } : { type: "pass" };
  if (G.phase === "lose") { const h = G.cards[pid].map((c, i) => [c, i]).filter(([c]) => !c.up).sort((a, b) => PRI[a[0].r] - PRI[b[0].r]); return { type: "lose", card: h[0][1] }; }
  if (G.phase === "exchange") {
    const h = hidden(G, pid), all = [...h.map(c => c.r), ...T.pool];
    const k = all.map((r, i) => [r, i]).sort((a, b) => PRI[b[0]] - PRI[a[0]]).slice(0, h.length).map(x => x[1]);
    return { type: "keep", keep: k };
  }
  if (G.phase === "examineShow") return { type: "show", card: G.cards[pid].findIndex(c => !c.up) };
  if (G.phase === "examineDecide") return { type: "decide", force: PRI[G.cards[T.target][T.shown].r] >= 3.5 };
  return null;
}
export const autoAction = smartAction;
