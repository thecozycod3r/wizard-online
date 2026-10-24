// Spyfall table: your secret card (tap to peek), the round clock, who's asking, the location list, and the accuse / vote / guess moves.
import * as E from "./engine.js";
import { startTable, esc } from "../shared/kit.js";
import { LOCATIONS, LOC } from "./locations.js";
import { RULES } from "./rules.js";

const ART = n => `art/spy-${n}@2x.webp?v=1`;
const ui = { peek: false, crossed: new Set(), guess: null, pick: null, round: 0 };
const T = startTable({
  path: "spyfall", letter: "Y", engine: E, hook: "__spy", title: "Spyfall", prefix: "spy-", min: E.MIN_PLAYERS, max: E.MAX_PLAYERS,
  defaults: { rounds: 5, mins: 6, timer: 30 },
  rules: RULES, eyebrow: "Table Night · Hidden roles · 3–10 players",
  blurb: "Everyone's at the same place — a casino, a submarine, a wedding — except the spy, who has no idea. Ask each other sharp questions, give answers that prove you belong, and unmask the spy before they work out where you are.",
  confetti: ["#ffb347", "#3dd6c6", "#ffffff", "#ff5d73"],
  hero: () => `<div class="fan">${[["spy", "spy"], ["back", "back"], ["loc", "casino"]].map(([k, x], i) => `<div class="c" style="--r:${(i - 1) * 12}deg;--y:${Math.abs(i - 1) * 10}px;--d:${i * .1}s">${k === "loc" ? locCard(x) : `<div class="sc"><img src="${ART(x)}" alt=""></div>`}</div>`).join("")}</div>`,
  welcomeFan: () => ["airplane", "casino", "pirate", "submarine", "zoo", "wedding"].map(l => locCard(l)),
  preload: ["spy", "back", "hero"].map(ART),
  timers: [[20, "20 s"], [30, "30 s"], [60, "1 min"]],
  lobby: (L, host, ctx) => `<div class="row" style="justify-content:space-between"><span>Rounds</span>${ctx.seg("rounds", [[3, "3"], [5, "5"], [8, "8"]], L.settings.rounds || 5, host)}</div>
    <div class="row" style="justify-content:space-between"><span>Round length</span>${ctx.seg("mins", [[4, "4 min"], [6, "6 min"], [8, "8 min"]], L.settings.mins || 6, host)}</div>
    <p class="muted" style="margin:0;font-size:14px">The turn timer below is for votes and accusations. Play in the same room or on a call — the questions are spoken out loud.</p>`,
  game, scores, podium, effect, onAct,
  onView: v => { if (v.round !== ui.round) { ui.round = v.round; ui.peek = false; ui.crossed = new Set(); ui.guess = null; ui.pick = null; } if (v.phase !== "play") ui.pick = null; },
});

function locCard(id) { const l = LOC[id]; return `<div class="sc loc"><img src="${ART("back")}" alt=""><span class="li">${l.icon}</span><span class="ln">${esc(l.name)}</span></div>`; }
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const leftOf = v => (v.phase === "play" ? v.deadline - Date.now() : v.phase === "vote" && !v.vote?.final ? v.left ?? 0 : 0);
setInterval(() => { const v = T.V(); const el = document.querySelector(".sclock b"); if (v && el) { const l = leftOf(v); el.textContent = mmss(l); el.parentElement.classList.toggle("low", v.phase === "play" && l < 60000); } }, 250);

function secret(v) {
  if (!v.you) return `<div class="secret"><p class="muted">You're watching this round.</p></div>`;
  if (!ui.peek) return `<button class="secret closed" data-act="peek"><img src="${ART("back")}" alt=""><span>Tap to see your card<small>keep it hidden from the others</small></span></button>`;
  if (v.you.spy) return `<button class="secret open spy" data-act="peek"><img src="${ART("spy")}" alt=""><span><b>You are the SPY</b><small>Work out where everyone is — without giving yourself away</small></span></button>`;
  const l = LOC[v.you.loc];
  return `<button class="secret open" data-act="peek"><img src="${ART("back")}" alt=""><span><i>${l.icon}</i><b>${esc(l.name)}</b><small>You are: ${esc(v.you.role)}</small></span></button>`;
}
function game(ctx) {
  const v = ctx.V(), { S } = ctx, me = v.players[v.me];
  const chips = v.players.map((p, i) => `<div class="chip ${v.asker === p.id && v.phase === "play" ? "turn" : ""} ${p.id === S.me ? "me" : ""} ${v.vote?.suspect === p.id ? "aim" : ""}" data-pid="${p.id}">
      <span class="av" style="background:${ctx.SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span class="nm">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}<span class="sub">${p.score} pt${p.score === 1 ? "" : "s"}${v.stopped.includes(p.id) ? " · used their stop" : ""}</span></span>
      <span class="val">${v.asker === p.id && v.phase === "play" ? "🎤" : v.vote ? (v.vote.suspect === p.id ? "🕵️" : p.id in v.vote.votes ? (v.vote.votes[p.id] ? "👍" : "👎") : "") : ""}</span>
      ${S.bots?.includes(p.id) ? `<span class="badge bot">BOT</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></div>`).join("");
  const spyMe = v.you?.spy;
  const locs = `<div class="locs ${spyMe ? "spyview" : ""}">${LOCATIONS.map(l => `<button class="lc ${ui.crossed.has(l.id) ? "x" : ""} ${!spyMe && v.you?.loc === l.id && ui.peek ? "here" : ""}" data-act="cross" data-l="${l.id}"><i>${l.icon}</i>${esc(l.name)}</button>`).join("")}</div>`;
  let mid = "";
  if (v.phase === "roundOver" || v.phase === "gameOver") mid = reveal(v, ctx);
  return `<div id="table">${ctx.topBar(`<span class="rnd"><small>ROUND</small>${v.round}/${v.rounds}</span><span class="sclock"><small>${v.phase === "play" ? "CLOCK" : v.phase === "vote" && !v.vote?.final ? "STOPPED" : "TIME"}</small><b>${mmss(leftOf(v))}</b></span>`)}
    <div class="scroll">${mid}${v.phase !== "roundOver" && v.phase !== "gameOver" ? secret(v) : ""}<div class="chips">${chips}</div>
      <div class="eyebrow" style="margin:12px 2px 6px">Locations ${spyMe ? "· tap to cross off" : "· tap to cross off what it's not"}</div>${locs}</div>${dock(v, ctx, me)}</div>`;
}
function reveal(v, ctx) {
  const o = v.outcome; if (!o) return "";
  const l = LOC[o.loc], spy = esc(ctx.nameOf(o.spy));
  const were = o.spy === ctx.S.me ? "were" : "was";
  const line = o.how === "caught" ? `${spy} ${were} caught!`
    : o.how === "framed" ? `Wrong person! ${esc(ctx.nameOf(o.suspect))} ${o.suspect === ctx.S.me ? "weren't" : "wasn't"} the spy — ${spy} ${were}.`
    : o.how === "nobody" ? `Nobody was convicted — ${spy} ${o.spy === ctx.S.me ? "get" : "gets"} away.`
    : o.winner === "spy" ? `${spy} worked out the location!` : `${spy} guessed ${esc(LOC[o.guess]?.name || "")} — wrong!`;
  const pts = Object.entries(o.gain).map(([p, n]) => `${esc(ctx.nameOf(p))} +${n}`).join(" · ");
  return `<div class="reveal-r ${o.winner}"><img src="${ART(o.winner === "spy" ? "spy" : "back")}" alt=""><div><div class="eyebrow">${o.winner === "spy" ? "The spy wins" : "The players win"}</div>
    <h2>${l.icon} ${esc(l.name)}</h2><p>${line}</p><p class="muted">${pts}</p>
    <details><summary>Everyone's roles</summary>${Object.entries(o.roles).map(([p, r]) => `${esc(ctx.nameOf(p))}: ${esc(r)}`).join(" · ")}</details></div></div>`;
}
function dock(v, ctx, me) {
  const { S } = ctx, mine = ctx.myTurn(), timer = mine ? ` <span class="tmr big" data-tmr="${S.me}"></span>` : "";
  let status = "", actions = "";
  const others = v.players.filter(p => p.id !== S.me);
  const pickBtns = (act, list) => `<div class="targets">${list.map(p => `<button class="btn ghost small" data-act="${act}" data-t="${p.id}">${esc(p.name)}</button>`).join("")}${act === "accuse" && v.phase === "play" ? `<button class="btn ghost small" data-act="unpick">Back</button>` : ""}</div>`;
  if (v.phase === "play") {
    if (ui.pick === "accuse") { status = "Stop the clock — who's the spy?"; actions = pickBtns("accuse", others); }
    else if (ui.pick === "guess") {
      status = ui.guess ? `Guess ${esc(LOC[ui.guess].name)}? You can't take it back.` : "Where are you? Tap a location";
      actions = `<div class="locs pick">${LOCATIONS.filter(l => !ui.crossed.has(l.id)).map(l => `<button class="lc ${ui.guess === l.id ? "here" : ""}" data-act="guesspick" data-l="${l.id}"><i>${l.icon}</i>${esc(l.name)}</button>`).join("")}</div>
        <div class="row" style="justify-content:center;width:100%"><button class="btn" data-act="guessgo" ${ui.guess ? "" : "disabled"}>Reveal & guess</button><button class="btn ghost small" data-act="unpick">Back</button></div>`;
    } else {
      const asking = v.asker === S.me;
      status = asking ? "Your question — ask someone out loud, then tap who you asked" : `${esc(ctx.nameOf(v.asker))} ${v.asker === S.me ? "are" : "is"} asking a question`;
      const askable = others.filter(p => p.id !== v.prevAsker || v.players.length <= 2);
      actions = `${asking ? pickBtns("ask", askable) : ""}<div class="row" style="justify-content:center;width:100%">${v.stopped.includes(S.me) ? `<span class="muted" style="font-size:13px">You've used your clock stop this round</span>` : `<button class="btn reject" data-act="accuse-open">Stop the clock & accuse</button>`}${v.you?.spy ? `<button class="btn" data-act="guess-open">I know where we are!</button>` : ""}</div>`;
    }
  } else if (v.phase === "vote") {
    const by = esc(ctx.nameOf(v.vote.by)), sus = v.vote.suspect === S.me ? "you" : esc(ctx.nameOf(v.vote.suspect));
    status = `${by} ${v.vote.by === S.me ? "accuse" : "accuses"} ${sus} of being the spy${v.vote.final ? "" : " · clock stopped"}`;
    if (mine) actions = `<div class="opts"><button class="btn approve" data-act="vote" data-y="1">Yes, it's ${sus === "you" ? "me" : sus}</button><button class="btn reject" data-act="vote" data-y="0">No</button></div>`;
    else if (v.vote.suspect === S.me) actions = `<p class="muted" style="margin:0">Plead your case — everyone else votes. One "no" and you're safe.</p>`;
    else actions = `<p class="muted" style="margin:0">Waiting for ${v.waiting.map(p => esc(ctx.plainName(p))).join(", ")}…</p>`;
  } else if (v.phase === "final") {
    status = mine ? "Time's up! Accuse someone — everyone else must agree" : `Time's up — ${esc(ctx.nameOf(v.waiting[0]))} ${v.waiting[0] === S.me ? "accuse" : "accuses"} next`;
    if (mine) actions = pickBtns("accuse", others);
  } else if (v.phase === "roundOver") {
    status = v.round >= v.rounds ? "Last round done — final scores next" : `Round ${v.round + 1} starts in a moment`;
    actions = `<button class="btn" data-act="next">${v.round >= v.rounds ? "See the results" : "Next round now"}</button>`;
  } else { status = "Game over"; actions = `<button class="btn big" data-act="over">Results</button>`; }
  return `<div class="dock ${mine || (v.phase === "play" && v.asker === S.me) ? "mine" : ""}"><div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${timer}</span><span class="pts">${me ? `${me.score} pt${me.score === 1 ? "" : "s"}` : ""}</span></div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
}
function onAct(a, el, ctx) {
  if (a === "peek") { ui.peek = !ui.peek; ctx.render(); return true; }
  if (a === "cross") { const l = el.dataset.l; ui.crossed.has(l) ? ui.crossed.delete(l) : ui.crossed.add(l); ctx.render(); return true; }
  if (a === "ask") { ctx.room.act({ type: "ask", target: el.dataset.t }); return true; }
  if (a === "accuse-open") { ui.pick = "accuse"; ctx.render(); return true; }
  if (a === "guess-open") { ui.pick = "guess"; ui.guess = null; ctx.render(); return true; }
  if (a === "unpick") { ui.pick = null; ctx.render(); return true; }
  if (a === "accuse") { ui.pick = null; ctx.room.act({ type: "accuse", target: el.dataset.t }); return true; }
  if (a === "guesspick") { ui.guess = el.dataset.l; ctx.render(); return true; }
  if (a === "guessgo") { const loc = ui.guess; ui.pick = null; ui.guess = null; ctx.room.act({ type: "guess", loc }); return true; }
  if (a === "vote") { el.parentElement.classList.add("sent"); ctx.room.act({ type: "vote", yes: el.dataset.y === "1" }); return true; }
  if (a === "next") { ctx.room.act({ type: "next" }); return true; }
  return undefined;
}
function effect(last, v, prev, ctx) {
  const n = p => esc(ctx.nameOf(p)), chip = p => ctx.rectOf(`.chip[data-pid="${p}"]`);
  if (last.kind === "ask") ctx.fly("🎤", chip(last.pid), chip(last.target), { w: 30 });
  if (last.kind === "accuse") ctx.showFx(`<div class="t">${last.final ? "J'accuse!" : "⏸ Clock stopped!"}</div><div class="l">${n(last.pid)} ${last.pid === ctx.S.me ? "accuse" : "accuses"} ${last.target === ctx.S.me ? "you" : n(last.target)}</div>`, 1800, "bad");
  if (last.kind === "vote" && last.failed) ctx.showFx(`<div class="t">Not unanimous</div><div class="l">${last.suspect === ctx.S.me ? "You're" : `${n(last.suspect)} is`} off the hook${v.phase === "play" ? " — the clock runs again" : ""}</div>`, 1600);
  if (last.kind === "timeup") ctx.showFx(`<div class="t">⏰ Time's up!</div><div class="l">Accuse in turn — everyone else must agree</div>`, 2200, "boom");
  if (last.kind === "roundOver") {
    const o = last.outcome, l = LOC[o.loc];
    ctx.showFx(`<div class="big"><img src="${ART(o.winner === "spy" ? "spy" : "back")}" alt=""></div><div class="t">${o.winner === "spy" ? "The spy wins" : "Spy unmasked!"}</div><div class="l">${n(o.spy)} ${o.spy === ctx.S.me ? "were" : "was"} the spy · ${l.icon} ${esc(l.name)}</div>`, 2600, o.winner === "spy" ? "bad" : "good");
    if (o.winner !== "spy") ctx.burst();
  }
  if (last.kind === "round") ctx.showFx(`<div class="t">Round ${last.round}</div><div class="l">New place, new spy — tap your card to peek</div>`, 1800);
}
function scores(ctx) {
  const v = ctx.V();
  return `<div class="tbl"><table><tr><th>Player</th><th>Points</th></tr>${v.players.slice().sort((a, b) => b.score - a.score).map(p => `<tr><td>${esc(ctx.nameOf(p.id))}</td><td><b>${p.score}</b></td></tr>`).join("")}</table></div>
    ${v.history.length ? `<div class="hist">${v.history.map(h => `<div class="h"><b style="width:24px">${h.round}</b><span style="flex:1">${LOC[h.loc].icon} ${esc(LOC[h.loc].name)}</span><span class="muted">${esc(ctx.plainName(h.spy))} · ${h.winner === "spy" ? "spy won" : "caught"}</span></div>`).join("")}</div>` : ""}`;
}
function podium(ctx) {
  const v = ctx.V(), r = v.result, single = r.winners.length === 1;
  return `<div class="hist">${r.rows.map((row, i) => { const p = v.players.find(x => x.id === row.pid); return `<div class="h"><b style="width:24px">${i + 1}</b><span class="av" style="background:${ctx.SEAT[v.players.indexOf(p)]}">${esc(p.name[0])}</span><b style="flex:1">${esc(ctx.nameOf(p.id))}${single && r.winners[0] === p.id ? ` ${ctx.CROWN}` : ""}</b><b style="font-size:18px">${row.points}</b></div>`; }).join("")}</div>${scores(ctx)}`;
}
window.__spyT = T;
