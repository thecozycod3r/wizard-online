// Wizard 30th-anniversary rules engine. Pure state machine, run only by the host.
// Every rule follows AMIGO rulebook 02601 v1.1 + the March 2026 FAQ (see ../rules/RULES.md).
// act(G, pid, action) mutates G in place and returns it, or throws Error(message) for an illegal action.

export const SUITS = ["blue", "green", "red", "yellow"];
export const SUIT_NAME = { blue: "Blue", green: "Green", red: "Red", yellow: "Yellow" };
export const SPECIALS = ["shapeshifter", "dragon", "fairy", "bomb", "werewolf", "juggler", "cloud", "witch", "vampire"];
export const ROUNDS_FOR = { 3: 20, 4: 15, 5: 12, 6: 10 };

export function card(id) {
  if (id.startsWith("sp-")) return { id, kind: id.slice(3) };
  const [suit, r] = id.split("-");
  if (r === "wizard" || r === "jester") return { id, kind: r, suit };
  return { id, kind: "number", suit, rank: +r };
}

export function cardLabel(id) {
  const c = card(id);
  if (c.kind === "number") return `${SUIT_NAME[c.suit]} ${c.rank}`;
  return c.kind[0].toUpperCase() + c.kind.slice(1);
}

function fullDeck(specials) {
  const ids = [];
  for (const s of SUITS) {
    for (let r = 1; r <= 13; r++) ids.push(`${s}-${String(r).padStart(2, "0")}`);
    ids.push(`${s}-wizard`, `${s}-jester`);
  }
  for (const sp of specials) ids.push(`sp-${sp}`);
  return ids;
}

function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// What a face-up trump-indicator card means for trump.
export function indicatorTrump(id) {
  if (!id) return { none: true };
  const c = card(id);
  if (c.kind === "number") return { suit: c.suit };
  if (["jester", "fairy", "bomb", "witch"].includes(c.kind)) return { none: true };
  return { choose: true }; // wizard, shapeshifter, dragon, werewolf, juggler, cloud, vampire
}

// ---------- game setup ----------

export function newGame(players, settings) {
  const n = players.length;
  if (n < 3 || n > 6) throw new Error("Wizard needs 3 to 6 players.");
  const specials = SPECIALS.filter(s => settings.specials?.includes(s));
  const total = Math.min(settings.rounds || ROUNDS_FOR[n], ROUNDS_FOR[n]);
  const G = {
    v: 1, seq: 0,
    settings: { specials, dealerRule: settings.dealerRule !== false, penalty: settings.penalty || "house", rounds: total },
    players: players.map(p => ({ id: p.id, name: p.name })),
    round: 0, totalRounds: total, dealer: Math.floor(Math.random() * n),
    hands: {}, pile: [], indicator: null, trump: null,
    bids: {}, won: {}, turn: 0, trick: null, trickNo: 0, lastTrick: null,
    pending: null, fx: [], scores: [], total: Object.fromEntries(players.map(p => [p.id, 0])),
    log: [], phase: "deal",
  };
  G.dealer = (G.dealer + n - 1) % n; // startRound advances it
  startRound(G);
  return G;
}

const pidAt = (G, i) => G.players[((i % G.players.length) + G.players.length) % G.players.length].id;
const idxOf = (G, pid) => G.players.findIndex(p => p.id === pid);
const nameOf = (G, pid) => G.players[idxOf(G, pid)]?.name || "?";
function log(G, msg) { G.log.push(msg); if (G.log.length > 60) G.log.shift(); }

function startRound(G) {
  const n = G.players.length;
  G.round += 1;
  G.dealer = (G.dealer + 1) % n;
  const deck = shuffle(fullDeck(G.settings.specials));
  G.hands = {};
  for (const p of G.players) G.hands[p.id] = deck.splice(0, G.round);
  G.indicator = deck.length ? deck.shift() : null;
  G.pile = deck;
  G.trump = null;
  G.bids = Object.fromEntries(G.players.map(p => [p.id, null]));
  G.won = Object.fromEntries(G.players.map(p => [p.id, 0]));
  G.trick = null; G.trickNo = 0; G.lastTrick = null; G.fx = []; G.pending = null;
  log(G, `Round ${G.round}: ${nameOf(G, pidAt(G, G.dealer))} deals ${G.round} card${G.round > 1 ? "s" : ""} each.`);
  if (!G.indicator) log(G, "All cards are dealt: no trump this round.");
  else log(G, `Trump card turned up: ${cardLabel(G.indicator)}.`);

  // Werewolf in a hand beats everything: its holder swaps it for the trump card and names trump.
  const holder = G.players.find(p => G.hands[p.id].includes("sp-werewolf"));
  if (holder && G.indicator) {
    G.phase = "werewolf"; G.pending = { type: "werewolf", pid: holder.id };
    return;
  }
  const t = indicatorTrump(G.indicator);
  if (t.choose) { G.phase = "trump"; G.pending = { type: "trump", pid: pidAt(G, G.dealer) }; return; }
  G.trump = t.suit || null;
  beginBidding(G);
}

function beginBidding(G) {
  G.phase = "bid"; G.pending = null;
  G.turn = (G.dealer + 1) % G.players.length;
}

// ---------- trick logic ----------

// Effective card for a play once its declarations are known.
function effective(kind, base, decl) {
  switch (kind) {
    case "number": return { kind: "number", suit: base.suit, value: base.rank };
    case "wizard": case "dragon": case "fairy": case "witch": case "bomb": case "jester": return { kind };
    case "shapeshifter": return { kind: decl.mode === "wizard" ? "wizard" : "jester" };
    case "juggler": return { kind: "number", suit: decl.suit, value: 7.5 };
    case "cloud": return { kind: "number", suit: decl.suit, value: 9.75 };
    default: return { kind: "jester" }; // werewolf can't normally be played; treat defensively as a Jester
  }
}

// Suit to follow: set by the first number-like card unless a Wizard/Dragon came first.
export function ledInfo(plays) {
  for (const p of plays) {
    if (!p.eff) continue;
    if (p.eff.kind === "wizard" || p.eff.kind === "dragon") return { free: true };
    if (p.eff.kind === "number") return { suit: p.eff.suit };
  }
  return { open: true };
}

export function legalCards(G, pid) {
  const hand = G.hands[pid] || [];
  if (G.phase !== "play" || pidAt(G, G.turn) !== pid) return [];
  const led = ledInfo(G.trick.plays);
  if (!led.suit) return hand.slice();
  const canFollow = hand.some(id => { const c = card(id); return c.kind === "number" && c.suit === led.suit; });
  if (!canFollow) return hand.slice();
  return hand.filter(id => { const c = card(id); return c.kind !== "number" || c.suit === led.suit; });
}

// Index (into plays) of the trick winner, ignoring Bombs. -1 if only Bombs.
export function winnerIndex(plays, trump) {
  const ps = plays.map((p, i) => ({ ...p, i })).filter(p => p.eff.kind !== "bomb");
  if (!ps.length) return -1;
  const dragons = ps.filter(p => p.eff.kind === "dragon");
  if (dragons.length) { const f = ps.find(p => p.eff.kind === "fairy"); return f ? f.i : dragons[0].i; }
  const wiz = ps.find(p => p.eff.kind === "wizard");
  if (wiz) return wiz.i;
  const nums = ps.filter(p => p.eff.kind === "number");
  const best = list => list.reduce((a, b) => (b.eff.value > a.eff.value ? b : a)).i;
  if (trump) { const t = nums.filter(p => p.eff.suit === trump); if (t.length) return best(t); }
  const led = ledInfo(plays);
  if (led.suit) { const l = nums.filter(p => p.eff.suit === led.suit); if (l.length) return best(l); }
  if (nums.length) return nums[0].i;
  const low = { jester: 3, fairy: 2, witch: 1 };
  return ps.reduce((a, b) => ((low[b.eff.kind] || 0) > (low[a.eff.kind] || 0) ? b : a)).i;
}

// ---------- actions ----------

export function act(G, pid, a) {
  const fn = ACTIONS[a?.type];
  if (!fn) throw new Error("Unknown action.");
  fn(G, pid, a);
  G.seq += 1;
  return G;
}

function need(cond, msg) { if (!cond) throw new Error(msg); }
const validSuit = s => SUITS.includes(s);

const ACTIONS = {
  werewolf(G, pid, a) {
    need(G.phase === "werewolf" && G.pending.pid === pid, "It isn't your Werewolf.");
    need(a.suit === null || validSuit(a.suit), "Pick a suit or no trump.");
    const h = G.hands[pid];
    h.splice(h.indexOf("sp-werewolf"), 1, G.indicator);
    log(G, `${nameOf(G, pid)} swaps the Werewolf for the ${cardLabel(G.indicator)} and calls ${a.suit ? SUIT_NAME[a.suit] + " as trump" : "no trump"}.`);
    G.indicator = "sp-werewolf"; G.trump = a.suit;
    beginBidding(G);
  },

  trump(G, pid, a) {
    need(G.phase === "trump" && G.pending.pid === pid, "You aren't choosing trump.");
    need(validSuit(a.suit), "Pick a suit.");
    G.trump = a.suit;
    log(G, `${nameOf(G, pid)} names ${SUIT_NAME[a.suit]} as trump.`);
    beginBidding(G);
  },

  bid(G, pid, a) {
    need(G.phase === "bid" && pidAt(G, G.turn) === pid, "It isn't your turn to bid.");
    const n = a.n;
    need(Number.isInteger(n) && n >= 0 && n <= G.round, `Bid between 0 and ${G.round}.`);
    const isLast = G.turn === G.dealer;
    if (isLast && G.settings.dealerRule) {
      const sum = Object.values(G.bids).reduce((s, b) => s + (b || 0), 0);
      need(sum + n !== G.round, `The dealer can't bid ${n}: bids would add up to ${G.round}.`);
    }
    G.bids[pid] = n;
    log(G, `${nameOf(G, pid)} bids ${n}.`);
    if (isLast) {
      G.phase = "play";
      const lead = (G.dealer + 1) % G.players.length;
      G.turn = lead; G.trick = { leader: lead, plays: [] }; G.trickNo = 1;
    } else G.turn = (G.turn + 1) % G.players.length;
  },

  play(G, pid, a) {
    need(G.phase === "play" && pidAt(G, G.turn) === pid, "It isn't your turn.");
    need(legalCards(G, pid).includes(a.id), "You must follow suit.");
    const h = G.hands[pid];
    h.splice(h.indexOf(a.id), 1);
    const base = card(a.id);
    const play = { pid, id: a.id, kind: base.kind, decl: {}, eff: null };
    G.trick.plays.push(play);
    const needs = [];
    if (base.kind === "vampire") {
      if (G.indicator && card(G.indicator).kind === "werewolf") {
        const fresh = G.pile.shift();
        if (fresh) {
          G.indicator = fresh;
          log(G, `${nameOf(G, pid)}'s Vampire copies the Werewolf: a new trump card is turned up, ${cardLabel(fresh)}.`);
          const t = indicatorTrump(fresh);
          if (t.choose) needs.push("trump"); else G.trump = t.suit || null;
        }
      }
      play.copy = G.indicator;
      play.kind = G.indicator && card(G.indicator).kind !== "werewolf" ? card(G.indicator).kind : "jester";
      play.copyBase = G.indicator ? card(G.indicator) : null;
      log(G, `${nameOf(G, pid)} plays the Vampire, copying ${G.indicator ? cardLabel(G.indicator) : "nothing (acts as a Jester)"}.`);
    } else log(G, `${nameOf(G, pid)} plays ${cardLabel(a.id)}.`);
    if (play.kind === "shapeshifter") needs.push("mode");
    if (play.kind === "juggler" || play.kind === "cloud") needs.push("suit");
    if (needs.length) { G.phase = "declare"; G.pending = { type: "declare", pid, needs }; return; }
    finishPlay(G, play);
  },

  declare(G, pid, a) {
    need(G.phase === "declare" && G.pending.pid === pid, "Nothing to declare.");
    const play = G.trick.plays[G.trick.plays.length - 1];
    for (const k of G.pending.needs) {
      if (k === "mode") need(a.mode === "wizard" || a.mode === "jester", "Choose Wizard or Jester.");
      if (k === "suit") need(validSuit(a.suit), "Choose a suit.");
      if (k === "trump") need(validSuit(a.trump), "Choose a trump suit.");
    }
    if (G.pending.needs.includes("trump")) { G.trump = a.trump; log(G, `${nameOf(G, pid)} names ${SUIT_NAME[a.trump]} as trump.`); }
    if (G.pending.needs.includes("mode")) play.decl.mode = a.mode;
    if (G.pending.needs.includes("suit")) play.decl.suit = a.suit;
    const what = play.decl.mode ? `as a ${play.decl.mode === "wizard" ? "Wizard" : "Jester"}` : play.decl.suit ? `as ${SUIT_NAME[play.decl.suit]}` : "";
    if (what) log(G, `${nameOf(G, pid)} declares it ${what}.`);
    G.pending = null; G.phase = "play";
    finishPlay(G, play);
  },

  // Host-driven: after the trick has been shown for a moment.
  resolve(G) {
    need(G.phase === "trickShow", "No trick to resolve.");
    const r = G.trickResult;
    if (!r.bombed && r.winnerPid) G.won[r.winnerPid] += 1;
    const last = G.players.every(p => G.hands[p.id].length === 0);
    G.fx = [];
    for (const p of G.trick.plays) if (p.kind === "juggler" && !last) G.fx.push({ type: "juggler" });
    for (const p of G.trick.plays) if (p.kind === "cloud" && !r.bombed && r.winnerPid) G.fx.push({ type: "cloud", pid: r.winnerPid });
    for (const p of G.trick.plays) if (p.kind === "witch" && G.hands[p.pid].length) G.fx.push({ type: "witch", pid: p.pid });
    nextEffect(G);
  },

  cloud(G, pid, a) {
    need(G.phase === "cloud" && G.pending.pid === pid, "It isn't your Cloud.");
    need(a.delta === 1 || a.delta === -1, "Change your bid by +1 or −1.");
    need(G.bids[pid] + a.delta >= 0, "Your bid can't go below 0.");
    G.bids[pid] += a.delta;
    log(G, `Cloud: ${nameOf(G, pid)} changes their bid to ${G.bids[pid]}.`);
    nextEffect(G);
  },

  pass(G, pid, a) {
    need(G.phase === "juggler", "No Juggler pass right now.");
    need(G.hands[pid].includes(a.id), "Pass a card from your hand.");
    G.pending.picks[pid] = a.id;
    if (G.players.every(p => G.pending.picks[p.id])) {
      const picks = G.pending.picks, n = G.players.length;
      G.players.forEach((p, i) => {
        const to = pidAt(G, i + 1);
        const h = G.hands[p.id];
        h.splice(h.indexOf(picks[p.id]), 1);
        G.hands[to].push(picks[p.id]);
      });
      log(G, `Juggler: everyone passed one card to the left.`);
      nextEffect(G);
    }
  },

  witch(G, pid, a) {
    need(G.phase === "witch" && G.pending.pid === pid, "It isn't your Witch.");
    need(G.hands[pid].includes(a.give), "Put a card from your hand into the trick.");
    const tp = G.lastTrick.cards;
    need(tp.includes(a.take) && a.take !== "sp-witch", "Take a card from the trick (not the Witch).");
    const h = G.hands[pid];
    h.splice(h.indexOf(a.give), 1, a.take);
    tp.splice(tp.indexOf(a.take), 1, a.give);
    log(G, `Witch: ${nameOf(G, pid)} swaps a card with the trick, taking ${cardLabel(a.take)}.`);
    nextEffect(G);
  },

  nextRound(G) {
    need(G.phase === "roundEnd", "The round isn't over.");
    if (G.round >= G.totalRounds) { G.phase = "gameOver"; G.pending = null; log(G, "Game over."); return; }
    startRound(G);
  },
};

function finishPlay(G, play) {
  // A Vampire takes on the copied card's identity (suit/rank for a number card).
  play.eff = effective(play.kind, play.copy ? card(play.copy) : card(play.id), play.decl);
  continuePlay(G);
}

function continuePlay(G) {
  if (G.trick.plays.length < G.players.length) { G.turn = (G.turn + 1) % G.players.length; return; }
  const plays = G.trick.plays;
  const wi = winnerIndex(plays, G.trump);
  const bombed = plays.some(p => p.kind === "bomb");
  const leaderPid = pidAt(G, G.trick.leader);
  const winnerPid = wi >= 0 ? plays[wi].pid : leaderPid;
  G.trickResult = { winnerPid, bombed };
  G.lastTrick = { plays: plays.map(p => ({ pid: p.pid, id: p.id, decl: p.decl, copy: p.copy || null })), cards: plays.map(p => p.id), ...G.trickResult };
  log(G, bombed ? `Bomb! Nobody wins trick ${G.trickNo}. ${nameOf(G, winnerPid)} leads next.` : `${nameOf(G, winnerPid)} wins trick ${G.trickNo}.`);
  G.phase = "trickShow"; G.pending = null;
}

function nextEffect(G) {
  const fx = G.fx.shift();
  if (!fx) return finishTrick(G);
  if (fx.type === "juggler") { G.phase = "juggler"; G.pending = { type: "juggler", picks: {} }; return; }
  if (fx.type === "cloud") {
    if (G.bids[fx.pid] === 0) { G.bids[fx.pid] = 1; log(G, `Cloud: ${nameOf(G, fx.pid)}'s bid rises to 1.`); return nextEffect(G); }
    G.phase = "cloud"; G.pending = { type: "cloud", pid: fx.pid }; return;
  }
  if (fx.type === "witch") {
    if (!G.hands[fx.pid].length) return nextEffect(G);
    G.phase = "witch"; G.pending = { type: "witch", pid: fx.pid }; return;
  }
  nextEffect(G);
}

function finishTrick(G) {
  G.pending = null;
  const lead = idxOf(G, G.trickResult.winnerPid);
  if (G.players.every(p => G.hands[p.id].length === 0)) return scoreRound(G);
  G.trickNo += 1;
  G.turn = lead; G.trick = { leader: lead, plays: [] }; G.phase = "play";
}

export function roundPoints(bid, won, penalty) {
  if (bid === won) return 20 + 10 * won;
  const off = Math.abs(bid - won);
  return penalty === "house" ? -10 - 10 * off : -10 * off;
}

function scoreRound(G) {
  const rows = {};
  for (const p of G.players) {
    const pts = roundPoints(G.bids[p.id], G.won[p.id], G.settings.penalty);
    rows[p.id] = { bid: G.bids[p.id], won: G.won[p.id], pts };
    G.total[p.id] += pts;
  }
  G.scores.push({ round: G.round, rows });
  G.phase = "roundEnd"; G.trick = null;
  log(G, `Round ${G.round} scored.`);
}

// ---------- helpers for the host ----------

// Who the game is waiting on (array of pids).
export function waitingOn(G) {
  switch (G.phase) {
    case "bid": case "play": return [pidAt(G, G.turn)];
    case "werewolf": case "trump": case "declare": case "cloud": case "witch": return [G.pending.pid];
    case "juggler": return G.players.map(p => p.id).filter(id => !G.pending.picks[id]);
    default: return [];
  }
}

// A sensible default move, used for "play for a disconnected player" and in tests.
export function autoAction(G, pid, rnd = Math.random) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  switch (G.phase) {
    case "werewolf": return { type: "werewolf", suit: pick([...SUITS, null]) };
    case "trump": return { type: "trump", suit: pick(SUITS) };
    case "bid": {
      const opts = [];
      for (let n = 0; n <= G.round; n++) {
        try { const c = structuredClone(G); ACTIONS.bid(c, pid, { n }); opts.push(n); } catch { /* not allowed */ }
      }
      return { type: "bid", n: pick(opts) };
    }
    case "play": return { type: "play", id: pick(legalCards(G, pid)) };
    case "declare": return { type: "declare", mode: pick(["wizard", "jester"]), suit: pick(SUITS), trump: pick(SUITS) };
    case "cloud": return { type: "cloud", delta: G.bids[pid] > 0 ? pick([1, -1]) : 1 };
    case "juggler": return { type: "pass", id: pick(G.hands[pid]) };
    case "witch": return { type: "witch", give: pick(G.hands[pid]), take: pick(G.lastTrick.cards.filter(c => c !== "sp-witch")) };
  }
  return null;
}

// What one player is allowed to see.
export function viewFor(G, pid) {
  const me = idxOf(G, pid);
  return {
    seq: G.seq, me, phase: G.phase, round: G.round, totalRounds: G.totalRounds, dealer: G.dealer, turn: G.turn,
    settings: G.settings, indicator: G.indicator, trump: G.trump, trickNo: G.trickNo,
    players: G.players.map(p => ({ id: p.id, name: p.name, cards: G.hands[p.id]?.length || 0, bid: G.bids[p.id], won: G.won[p.id], total: G.total[p.id] })),
    hand: G.hands[pid] || [],
    legal: legalCards(G, pid),
    trick: G.trick ? { leader: G.trick.leader, plays: G.trick.plays.map(p => ({ pid: p.pid, id: p.id, decl: p.decl, copy: p.copy || null })) } : null,
    lastTrick: G.lastTrick, trickResult: G.phase === "trickShow" ? G.trickResult : null,
    pending: G.pending && G.pending.type === "juggler"
      ? { type: "juggler", done: Object.keys(G.pending.picks) }
      : G.pending,
    waiting: waitingOn(G),
    scores: G.scores, log: G.log.slice(-14),
    dealerBlocked: dealerBlocked(G, pid),
  };
}

function dealerBlocked(G, pid) {
  if (G.phase !== "bid" || !G.settings.dealerRule || G.turn !== G.dealer || pidAt(G, G.turn) !== pid) return null;
  const sum = Object.values(G.bids).reduce((s, b) => s + (b || 0), 0);
  const x = G.round - sum;
  return x >= 0 && x <= G.round ? x : null;
}
