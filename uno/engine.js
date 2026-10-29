// UNO Flip + UNO Show 'Em No Mercy — one pure rules engine, two variants. No DOM, no network.
// newGame(players, {variant:"flip"|"mercy", target}) · act(G, pid, a) · viewFor(G, pid) · waitingOn(G) · autoAction · smartAction · timerKey · pause
// Actions: {type:"play", card, color?, target?, uno?} · {type:"draw"} · {type:"pass"} · {type:"color", color} (Flip: wild turned up by a flip;
// No Mercy: Colour Roulette victim) · {type:"uno"} · {type:"catch"} · {type:"next"} (between rounds).

export const VARIANTS = {
  flip: { name: "UNO Flip", min: 2, max: 10 },
  mercy: { name: "UNO No Mercy", min: 2, max: 6 },
};
export const COLORS = {
  light: ["r", "y", "g", "b"], dark: ["o", "p", "t", "v"], mercy: ["r", "y", "g", "b"],
};
export const COLOR_NAME = { r: "Red", y: "Yellow", g: "Green", b: "Blue", o: "Orange", p: "Pink", t: "Teal", v: "Purple" };
export const KIND_NAME = {
  skip: "Skip", rev: "Reverse", d1: "Draw One", d2: "Draw Two", d4: "Draw Four", d5: "Draw Five", flip: "Flip", skipall: "Skip Everyone",
  discall: "Discard All", w: "Wild", wd2: "Wild Draw Two", wdc: "Wild Draw Color", wrd4: "Wild Reverse Draw 4", wd6: "Wild Draw 6",
  wd10: "Wild Draw 10", roul: "Wild Colour Roulette",
};
const DRAW = { d1: 1, d2: 2, d4: 4, d5: 5, wd2: 2, wrd4: 4, wd6: 6, wd10: 10 };
export const drawValue = k => DRAW[k] || 0;
const WILD = new Set(["w", "wd2", "wdc", "wrd4", "wd6", "wd10", "roul"]);
export const isWild = k => WILD.has(k);
const isNum = k => /^\d$/.test(k);
export const MERCY_LIMIT = 25;
const FLIP_POINTS = { d1: 10, d5: 20, skip: 20, rev: 20, flip: 20, skipall: 30, w: 40, wd2: 50, wdc: 60 };
export const flipPoints = k => (isNum(k) ? +k : FLIP_POINTS[k] || 0);

// ---------------------------------------------------------------- decks (index = card id number)
function colourSet(cols, nums, actions) {
  const out = [];
  for (const c of cols) {
    for (const n of nums) out.push({ c, k: String(n) }, { c, k: String(n) });
    for (const [k, x] of actions) for (let i = 0; i < x; i++) out.push({ c, k });
  }
  return out;
}
const rep = (k, x) => Array.from({ length: x }, () => ({ c: "w", k }));
export const LIGHT = [...colourSet(COLORS.light, [1, 2, 3, 4, 5, 6, 7, 8, 9], [["d1", 2], ["rev", 2], ["skip", 2], ["flip", 2]]), ...rep("w", 4), ...rep("wd2", 4)];
export const DARK = [...colourSet(COLORS.dark, [1, 2, 3, 4, 5, 6, 7, 8, 9], [["d5", 2], ["rev", 2], ["skipall", 2], ["flip", 2]]), ...rep("w", 4), ...rep("wdc", 4)];
export const MERCY = [...colourSet(COLORS.mercy, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [["skip", 3], ["rev", 3], ["d2", 3], ["discall", 3], ["d4", 2], ["skipall", 2]]),
  ...rep("roul", 8), ...rep("wrd4", 8), ...rep("wd6", 4), ...rep("wd10", 4)];

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// The face of a card as it lies now. Flip ids are light-side indexes; G.pair maps them to their dark side.
export function face(G, id, side = G.side) {
  if (G.variant === "mercy") return MERCY[id];
  return side === "dark" ? DARK[G.pair[id]] : LIGHT[id];
}
const other = s => (s === "dark" ? "light" : "dark");
export const colorsNow = G => (G.variant === "mercy" ? COLORS.mercy : COLORS[G.side]);

// ---------------------------------------------------------------- setup
export function newGame(players, settings = {}) {
  const variant = settings.variant === "mercy" ? "mercy" : "flip", V = VARIANTS[variant];
  if (players.length < V.min || players.length > V.max) throw new Error(`${V.name} needs ${V.min} to ${V.max} players.`);
  const G = {
    v: 1, game: "uno", variant, gameId: Math.random().toString(36).slice(2, 10), seq: 0,
    players: players.map(p => ({ id: p.id, name: p.name })),
    target: variant === "flip" ? (+settings.target || 0) : 0,
    scores: Object.fromEntries(players.map(p => [p.id, 0])),
    round: 0, pair: variant === "flip" ? shuffle([...DARK.keys()]) : null,
    log: [], result: null,
  };
  deal(G);
  return G;
}

function deal(G) {
  G.round++; G.seq++;
  G.side = "light"; G.dir = 1; G.phase = "play"; G.pend = null; G.drawn = null; G.unoRisk = null; G.unoSaid = {};
  G.out = []; G.aside = []; G.turnNo = 0; G.roundWinner = null; G.waiter = null;
  const n = G.variant === "mercy" ? MERCY.length : LIGHT.length;
  G.draw = shuffle([...Array(n).keys()]);
  G.hands = Object.fromEntries(G.players.map(p => [p.id, []]));
  for (let i = 0; i < 7; i++) for (const p of G.players) G.hands[p.id].push(G.draw.pop());
  // the first card turned must be a number; anything else goes back into the pile
  let top;
  for (;;) {
    top = G.draw.pop();
    if (isNum(face(G, top).k)) break;
    G.draw.unshift(top);
  }
  G.discard = [top];
  G.color = face(G, top).c;
  G.turn = Math.floor(Math.random() * G.players.length);
  G.last = { kind: "deal", round: G.round, top, pid: G.players[G.turn].id };
}

// ---------------------------------------------------------------- helpers
const ids = G => G.players.map(p => p.id);
const active = G => ids(G).filter(id => !G.out.includes(id));
export const topCard = G => G.discard[G.discard.length - 1];
const cur = G => G.players[G.turn].id;
function step(G, from, n = 1) {
  // the n-th active player after `from` in the current direction
  const N = G.players.length;
  let i = from;
  for (let k = 0; k < n;) { i = (i + G.dir + N) % N; if (!G.out.includes(G.players[i].id)) k++; }
  return i;
}
const idx = (G, pid) => G.players.findIndex(p => p.id === pid);

function drawOne(G) {
  if (!G.draw.length) {
    const top = G.discard.pop();
    G.draw = shuffle([...G.discard, ...G.aside]);
    G.discard = [top]; G.aside = [];
    if (G.variant === "flip") G.reshuffled = (G.reshuffled || 0) + 1;
  }
  return G.draw.pop();
}
// Give pid up to n cards. Returns the cards. In No Mercy, 25+ cards knocks them out.
function give(G, pid, n, ev) {
  const got = [];
  for (let i = 0; i < n; i++) { const c = drawOne(G); if (c === undefined) break; G.hands[pid].push(c); got.push(c); }
  if (ev) (ev.drew ||= {})[pid] = ((ev.drew[pid]) || 0) + got.length;
  mercyCheck(G, pid, ev);
  return got;
}
function mercyCheck(G, pid, ev) {
  if (G.variant !== "mercy" || G.out.includes(pid) || G.hands[pid].length < MERCY_LIMIT) return false;
  G.out.push(pid); G.aside.push(...G.hands[pid]); G.hands[pid] = [];
  if (ev) (ev.knocked ||= []).push(pid);
  return true;
}
// draw until a card of colour `col` turns up (wilds don't count); they keep everything
function drawUntil(G, pid, col, ev) {
  let n = 0;
  for (let guard = 0; guard < 200; guard++) {
    const c = drawOne(G); if (c === undefined) break;
    G.hands[pid].push(c); n++;
    const f = face(G, c);
    if (G.variant === "mercy" && G.hands[pid].length >= MERCY_LIMIT) break;
    if (!isWild(f.k) && f.c === col) break;
  }
  (ev.drew ||= {})[pid] = (ev.drew[pid] || 0) + n;
  mercyCheck(G, pid, ev);
  return n;
}

// Can `id` go on the pile right now for pid?
export function canPlay(G, pid, id) {
  if (G.phase !== "play" || cur(G) !== pid) return false;
  if (!G.hands[pid].includes(id)) return false;
  if (G.drawn != null && id !== G.drawn) return false;
  const f = face(G, id), t = face(G, topCard(G));
  if (G.pend) {
    if (G.variant === "mercy") return drawValue(f.k) > 0 && drawValue(f.k) >= G.pend.last;
    return f.k === G.pend.kind;      // Flip house rule: only the same card stacks
  }
  if (isWild(f.k)) {
    // Flip: the drawing wilds need a hand with nothing of the current colour
    if (G.variant === "flip" && (f.k === "wd2" || f.k === "wdc")) return !G.hands[pid].some(x => x !== id && face(G, x).c === G.color);
    return true;
  }
  return f.c === G.color || f.k === t.k;
}
export const playable = (G, pid) => (G.hands[pid] || []).filter(id => canPlay(G, pid, id));

// ---------------------------------------------------------------- turn order
export function waitingOn(G) {
  if (G.phase === "play" || G.phase === "color" || G.phase === "roulette") return [G.waiter ?? cur(G)];
  return [];
}
export const timerKey = G => `${G.round}.${G.turnNo}.${G.phase}`;
export const pause = G => (G.phase === "roundOver" ? { ms: 7000, action: { type: "next" } } : null);

function endTurn(G, skip = 0) {
  G.drawn = null; G.turnNo++;
  G.turn = step(G, G.turn, 1 + skip);
  if (G.variant === "mercy" && active(G).length === 1) return winRound(G, active(G)[0], "last");
}

// ---------------------------------------------------------------- actions
export function act(G, pid, a) {
  if (!a || typeof a !== "object") throw new Error("Unknown action.");
  if (G.phase === "gameOver") throw new Error("The game is over.");
  if (!G.hands[pid]) throw new Error("You're not in this game.");
  if (a.type === "next") {
    if (G.phase !== "roundOver") throw new Error("The round isn't over.");
    deal(G); return G;
  }
  if (a.type === "uno") {
    if (G.unoRisk !== pid) throw new Error("Nothing to call.");
    G.unoRisk = null; G.seq++; G.last = { kind: "uno", pid }; return G;
  }
  if (a.type === "catch") {
    if (!G.unoRisk || G.unoRisk === pid) throw new Error("Nobody to catch.");
    const victim = G.unoRisk, ev = { kind: "caught", pid, victim };
    G.unoRisk = null; give(G, victim, 2, ev); G.seq++; G.last = ev;
    if (G.variant === "mercy" && active(G).length === 1) winRound(G, active(G)[0], "last");
    return G;
  }
  if (G.out.includes(pid)) throw new Error("You're out of this hand.");
  if (!waitingOn(G).includes(pid)) throw new Error("It's not your turn.");

  if (G.phase === "color") {
    if (!colorsNow(G).includes(a.color)) throw new Error("Pick a colour.");
    G.color = a.color; G.phase = "play"; G.waiter = null; G.seq++;
    G.last = { kind: "color", pid, color: a.color };
    endTurn(G);
    return G;
  }
  if (G.phase === "roulette") {
    if (!colorsNow(G).includes(a.color)) throw new Error("Pick a colour.");
    const ev = { kind: "roulette", pid, color: a.color };
    G.phase = "play"; G.waiter = null; G.seq++; G.color = a.color;
    drawUntil(G, pid, a.color, ev);
    G.last = ev;
    endTurn(G);          // the victim loses their turn (G.turn is already them)
    return G;
  }

  // play phase, my turn
  G.unoRisk = null;      // the next move closes the chance to catch
  if (a.type === "draw") return doDraw(G, pid);
  if (a.type === "pass") {
    if (G.drawn == null) throw new Error("Draw first.");
    G.seq++; G.last = { kind: "pass", pid };
    endTurn(G); return G;
  }
  if (a.type !== "play") throw new Error("Unknown action.");
  if (!canPlay(G, pid, a.card)) throw new Error("That card can't go on the pile.");
  return doPlay(G, pid, a);
}

function doDraw(G, pid) {
  const ev = { kind: "draw", pid };
  G.seq++;
  if (G.pend) {
    // take the whole stack
    ev.penalty = true;
    if (G.pend.color) for (let i = 0; i < G.pend.times; i++) { drawUntil(G, pid, G.pend.color, ev); if (G.out.includes(pid)) break; }
    else give(G, pid, G.pend.n, ev);
    G.pend = null; G.last = ev;
    endTurn(G); return G;
  }
  if (G.drawn != null) throw new Error("You've already drawn.");
  // No Mercy: only with nothing to play. Both variants draw one card; if it fits, play it or pass
  if (G.variant === "mercy" && playable(G, pid).length) throw new Error("You have a card you can play.");
  const [c] = give(G, pid, 1, ev);
  G.last = ev;
  if (c !== undefined && !G.out.includes(pid) && canPlay(G, pid, c)) { G.drawn = c; ev.playable = true; return G; }
  endTurn(G); return G;
}

function doPlay(G, pid, a) {
  const id = a.card, f = face(G, id), hand = G.hands[pid];
  const others = active(G).filter(x => x !== pid);
  if (isWild(f.k) && f.k !== "roul" && !colorsNow(G).includes(a.color)) throw new Error("Pick a colour.");
  if (G.variant === "mercy" && f.k === "7" && others.length && !others.includes(a.target)) throw new Error("Pick who to swap hands with.");
  hand.splice(hand.indexOf(id), 1);
  G.discard.push(id);
  G.drawn = null; G.seq++;
  const ev = { kind: "play", pid, card: id, face: { ...f } };
  G.color = isWild(f.k) ? (f.k === "roul" ? G.color : a.color) : f.c;
  if (isWild(f.k) && f.k !== "roul") ev.color = G.color;

  // Discard All: every other card of that colour goes too
  if (f.k === "discall") {
    const same = hand.filter(x => { const g = face(G, x); return !isWild(g.k) && g.c === f.c; });
    for (const x of same) { hand.splice(hand.indexOf(x), 1); G.discard.splice(G.discard.length - 1, 0, x); }
    ev.discarded = same;
  }
  // UNO
  if (hand.length === 1 && !a.uno) G.unoRisk = pid;
  if (hand.length === 1 && a.uno) ev.uno = true;
  G.last = ev;

  const dv = drawValue(f.k);
  if (f.k === "flip") doFlip(G, ev);
  if (f.k === "rev" || f.k === "wrd4") { G.dir = -G.dir; ev.dir = G.dir; }

  // going out
  if (!hand.length) {
    // a draw card as the last card still makes the next player draw (counts in the score)
    if (dv) { G.pend = G.pend ? { ...G.pend, n: G.pend.n + dv } : { n: dv }; const nx = G.players[step(G, G.turn)].id; give(G, nx, G.pend.n, ev); G.pend = null; }
    return winRound(G, pid, "out");
  }

  // 7 swaps, 0 passes (No Mercy)
  if (G.variant === "mercy" && f.k === "7" && others.length) {
    [G.hands[pid], G.hands[a.target]] = [G.hands[a.target], G.hands[pid]];
    ev.swap = a.target;
    if (G.unoRisk === pid) G.unoRisk = null;
  }
  if (G.variant === "mercy" && f.k === "0") {
    const order = []; let i = G.turn;
    do { order.push(G.players[i].id); i = step(G, i); } while (G.players[i].id !== pid);
    const hands = order.map(p => G.hands[p]);
    order.forEach((p, k) => { G.hands[p] = hands[(k - 1 + order.length) % order.length]; });
    ev.rotate = true; G.unoRisk = null;
  }
  if (G.variant === "mercy" && (ev.swap || ev.rotate)) {
    for (const p of active(G)) if (!G.hands[p].length) return winRound(G, p, "out");
    for (const p of active(G)) mercyCheck(G, p, ev);
    if (active(G).length === 1) return winRound(G, active(G)[0], "last");
    if (G.out.includes(pid)) return endTurn(G), G;
  }

  // draw cards build the stack and pass it on
  if (dv) {
    if (G.variant === "mercy") G.pend = { n: (G.pend?.n || 0) + dv, last: dv };
    else G.pend = { n: (G.pend?.n || 0) + dv, kind: f.k };
    ev.pend = G.pend.n;
    return endTurn(G), G;
  }
  if (f.k === "wdc") {
    G.pend = { kind: "wdc", color: G.color, times: (G.pend?.times || 0) + 1 };
    ev.pend = G.pend.times;
    return endTurn(G), G;
  }
  if (f.k === "roul") {
    G.turnNo++; G.turn = step(G, G.turn); G.phase = "roulette";
    return G;
  }
  if (ev.flipWild) { G.phase = "color"; G.waiter = pid; G.turnNo++; return G; }
  const two = active(G).length === 2;
  if (f.k === "skip") return endTurn(G, 1), G;
  if (f.k === "skipall") { G.turnNo++; G.drawn = null; return G; }   // everyone else is skipped: go again
  if (f.k === "rev" && two) return endTurn(G, 1), G;
  endTurn(G);
  return G;
}

// Flip: the discard pile, draw pile and every hand turn over
function doFlip(G, ev) {
  G.side = other(G.side);
  G.discard.reverse(); G.draw.reverse();
  const t = face(G, topCard(G));
  ev.flipped = G.side;
  ev.newTop = topCard(G);
  if (isWild(t.k)) ev.flipWild = true;
  else G.color = t.c;
}

function winRound(G, pid, how) {
  G.roundWinner = pid;
  const ev = G.last && G.last.kind === "play" ? G.last : (G.last = { kind: "end" });
  let pts = 0;
  if (G.variant === "flip") {
    for (const p of ids(G)) if (p !== pid) pts += G.hands[p].reduce((s, x) => s + flipPoints(face(G, x).k), 0);
    G.scores[pid] += pts;
  } else G.scores[pid] += 1;
  ev.end = { winner: pid, how, points: pts, side: G.side };
  G.log.push({ round: G.round, winner: pid, points: pts, how });
  G.drawn = null; G.pend = null; G.unoRisk = null; G.waiter = null;
  if (G.variant === "mercy" || !G.target || G.scores[pid] >= G.target) {
    G.phase = "gameOver";
    const rows = G.players.map(p => ({ pid: p.id, points: G.scores[p.id], cards: G.hands[p.id].length, out: G.out.includes(p.id) }))
      .sort((a, b) => (a.pid === pid ? -1 : b.pid === pid ? 1 : 0) || b.points - a.points || (a.out - b.out) || a.cards - b.cards);
    G.result = { rows, winners: [pid] };
  } else G.phase = "roundOver";
  return G;
}

// ---------------------------------------------------------------- views
export function viewFor(G, pid) {
  const over = G.phase === "gameOver" || G.phase === "roundOver";
  const mine = G.hands[pid] || [];
  const v = {
    game: "uno", variant: G.variant, gameId: G.gameId, seq: G.seq, phase: G.phase, round: G.round, target: G.target,
    me: idx(G, pid), side: G.side, color: G.color, dir: G.dir, top: topCard(G), topFace: face(G, topCard(G)),
    under: G.discard.slice(-4, -1).map(id => ({ id, face: face(G, id) })),
    drawLeft: G.draw.length, nextBack: G.variant === "flip" && G.draw.length ? face(G, G.draw[G.draw.length - 1], other(G.side)) : null,
    turn: cur(G), waiting: waitingOn(G), pend: G.pend ? { ...G.pend } : null, drawn: G.drawn, unoRisk: G.unoRisk,
    hand: mine.map(id => ({ id, face: face(G, id), ok: canPlay(G, pid, id) })),
    players: G.players.map(p => ({
      id: p.id, name: p.name, count: G.hands[p.id].length, out: G.out.includes(p.id), score: G.scores[p.id],
      backs: G.variant === "flip" && p.id !== pid ? G.hands[p.id].map(id => face(G, id, other(G.side))) : null,
      cards: over && p.id !== pid ? G.hands[p.id].map(id => face(G, id)) : null,
    })),
    last: G.last ? structuredClone(G.last) : null, result: G.result ? structuredClone(G.result) : null, log: G.log.slice(),
  };
  return v;
}

// ---------------------------------------------------------------- automatic play
const counts = (G, pid) => {
  const c = {}; for (const x of G.hands[pid]) { const f = face(G, x); if (!isWild(f.k)) c[f.c] = (c[f.c] || 0) + 1; }
  return c;
};
export const bestColor = (G, pid) => {
  const c = counts(G, pid); const cols = colorsNow(G);
  return cols.slice().sort((a, b) => (c[b] || 0) - (c[a] || 0))[0];
};
function finish(G, pid, id) {
  const f = face(G, id), a = { type: "play", card: id, uno: G.hands[pid].length === 2 };
  if (isWild(f.k) && f.k !== "roul") a.color = bestColor(G, pid);
  if (G.variant === "mercy" && f.k === "7") {
    const others = active(G).filter(x => x !== pid);
    if (others.length) a.target = others.sort((x, y) => G.hands[x].length - G.hands[y].length)[0];
  }
  return a;
}
function common(G, pid) {
  if (G.phase === "roundOver") return { type: "next" };
  if (!waitingOn(G).includes(pid)) return null;
  if (G.phase === "color" || G.phase === "roulette") return { type: "color", color: bestColor(G, pid) };
  return undefined;
}
export function autoAction(G, pid) {
  const c = common(G, pid); if (c !== undefined) return c;
  const ok = playable(G, pid);
  if (ok.length) return finish(G, pid, ok[Math.floor(Math.random() * ok.length)]);
  if (G.drawn != null) return { type: "pass" };
  return { type: "draw" };
}
// A sensible move: stack when you can, hold wilds back, punish a player close to going out, drop big cards.
export function smartAction(G, pid) {
  const c = common(G, pid); if (c !== undefined) return c;
  const ok = playable(G, pid);
  if (!ok.length) return G.drawn != null ? { type: "pass" } : { type: "draw" };
  const next = G.players[step(G, G.turn)].id, danger = G.hands[next].length <= 2;
  const score = id => {
    const f = face(G, id); let s = 0;
    if (G.pend) return drawValue(f.k) * -1 + (f.k === "wdc" ? 0 : 0);   // stack with the smallest card that works
    if (isWild(f.k)) s -= 30;
    if (drawValue(f.k) || f.k === "skip" || f.k === "skipall" || f.k === "wdc" || f.k === "roul") s += danger ? 40 : -5;
    if (f.k === "discall") s += 10 * G.hands[pid].filter(x => face(G, x).c === f.c).length;
    if (isNum(f.k)) s += +f.k;
    if (G.variant === "mercy" && f.k === "7") s += 5;
    if (!isWild(f.k) && (counts(G, pid)[f.c] || 0) > 1) s += 3;
    return s;
  };
  const best = ok.slice().sort((a, b) => score(b) - score(a))[0];
  return finish(G, pid, best);
}
