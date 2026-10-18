import * as E from "./engine.js";
import { createRoom } from "../shared/room.js";
import { alerts, soundRow, inAppHint } from "../shared/alert.js";
import { hscroll } from "../shared/hscroll.js";
import { RULES, setupTable } from "./rules.js";
import { crest, questCard, LADY } from "./art.js";

const $app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SEAT = ["#f3d48a", "#7fb0ff", "#5fd39a", "#ff8a73", "#c6a2ff", "#f5a8d6", "#7fe3e0", "#ffc27a", "#b8e07a", "#e0a0ff"];
const CROWN = `<svg class="crown" viewBox="0 0 30 22" aria-label="Leader"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".55" stop-color="#f2c14e"/><stop offset="1" stop-color="#b7832a"/></linearGradient></defs><path d="M2 7l6.5 5L15 2l6.5 10L28 7l-2.6 12H4.6z" fill="url(#cg)" stroke="#7a5418" stroke-width="1.2" stroke-linejoin="round"/><rect x="4.4" y="17.6" width="21.2" height="3.4" rx="1.2" fill="url(#cg)" stroke="#7a5418" stroke-width="1"/></svg>`;
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };
const ROLE_TEXT = {
  merlin: "You know who serves Evil (except Mordred). Guide the Good side with hints — if the Assassin works out who you are, Evil wins.",
  percival: "You see Merlin — and Morgana, if she's in the game — but not which is which. Protect Merlin.",
  servant: "You know nothing but your own loyalty. Watch the votes and the quests, and trust carefully.",
  assassin: "You serve Mordred. Fail quests without being caught. If Good completes three quests, you name Merlin — get it right and Evil wins.",
  morgana: "You serve Mordred, and to Percival you look just like Merlin. Use it.",
  mordred: "You serve Mordred, and Merlin can't see you.",
  oberon: "You serve Mordred, but alone: you don't know the other Evil players and they don't know you.",
  minion: "You serve Mordred. Fail quests without being caught.",
};

const ui = { overlay: null, tab: "basics", pick: [], target: null, shownLast: null, ladyShown: null };
let fxHold = 0;

const room = createRoom({
  prefix: "ava-", engine: E, minPlayers: 5, maxPlayers: 10,
  defaults: { timer: 180, percival: false, morgana: false, mordred: false, oberon: false, lady: false },
  onUpdate: prev => onUpdate(prev), toast: m => toast(esc(m)),
});
const S = room.S;

// ---------------------------------------------------------------- helpers
const V = () => S.view;
const nameOf = pid => (pid === S.me ? "You" : V()?.players.find(p => p.id === pid)?.name || S.lobby?.players.find(p => p.id === pid)?.name || "?");
const plainName = pid => V()?.players.find(p => p.id === pid)?.name || "?";
const seatOf = pid => V()?.players.findIndex(p => p.id === pid);
const waitingMe = () => V()?.waiting.includes(S.me);
const knowsOf = pid => V()?.knows?.find(k => k.id === pid);
const list = ids => ids.map(plainName).join(", ");

let tt;
function toast(html) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.innerHTML = html;
  document.body.append(t); clearTimeout(tt); tt = setTimeout(() => t.remove(), 2800);
}

// ---------------------------------------------------------------- update + effects
function onUpdate(prev) {
  const v = V();
  if (v) {
    if (v.phase !== "propose" || v.leader !== S.me) ui.pick = [];
    if (!["lady", "assassin"].includes(v.phase) || !waitingMe()) ui.target = null;
    const key = v.last ? JSON.stringify([v.last.kind, v.last.quest, v.last.attempt, v.last.target]) : null;
    if (prev && key && key !== ui.shownLast) effect(v.last, v);
    if (key) ui.shownLast = key;
    if (v.phase === "gameOver" && prev?.phase !== "gameOver") setTimeout(() => { ui.overlay = "over"; render(); burst(v.result.winner === "good" ? GOOD_COLS : EVIL_COLS); }, fxHold + 300);
    // the Lady's answer, privately, to whoever asked
    const mine = v.ladyChecks.filter(c => c.by === S.me && c.side).at(-1);
    if (mine && ui.ladyShown !== mine.target + mine.quest) { ui.ladyShown = mine.target + mine.quest; if (prev) setTimeout(() => { ui.overlay = "ladyres"; render(); }, 400); }
    const mineNow = waitingMe() && v.phase !== "gameOver" && v.phase !== "reveal";
    const minePrev = prev ? prev.waiting.includes(S.me) && prev.phase === v.phase && prev.attempt === v.attempt && prev.quest === v.quest : false;
    if (mineNow && !minePrev) alerts.yourTurn();
    document.title = mineNow ? "● Your move · Avalon" : "Avalon · Games4free";
    const wk = "ava-welcome-" + v.gameId;
    if (v.gameId && v.phase === "reveal" && !LS.get(wk)) { LS.set(wk, 1); setTimeout(welcome, 200); }
  }
  // where the crown was, before the screen changes
  const oldLead = v && prev && prev.leader !== v.leader && prev.phase !== "reveal" ? document.querySelector(`.knight[data-pid="${prev.leader}"]`)?.getBoundingClientRect() : null;
  render();
  if (v && prev && v.seq !== prev.seq) { const wait = fxHold; requestAnimationFrame(() => setTimeout(() => motion(v, prev, oldLead), wait)); }
}

// ---------------------------------------------------------------- motion on the table
function fly(html, from, to, size = 28, delay = 0) {
  if (!from || !to) return;
  const d = document.createElement("div"); d.className = "fly"; d.innerHTML = html;
  const x0 = from.left + from.width / 2 - size / 2, y0 = from.top + from.height / 2 - size / 2;
  d.style.cssText = `left:${x0}px;top:${y0}px;width:${size}px;height:${size}px`;
  document.body.append(d);
  setTimeout(() => { d.style.transform = `translate(${to.left + to.width / 2 - size / 2 - x0}px,${to.top + to.height / 2 - size / 2 - y0}px) scale(1.1)`; }, 30 + delay);
  setTimeout(() => d.remove(), 850 + delay);
}
function flash(sel, cls, delay = 0) {
  setTimeout(() => { const el = document.querySelector(sel); if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }, delay);
}
function motion(v, prev, oldLead) {
  if (S.mode !== "game") return;
  // the leader's crown travels to the next leader
  if (oldLead) {
    const to = document.querySelector(`.knight[data-pid="${v.leader}"] .crown`) || document.querySelector(`.knight[data-pid="${v.leader}"]`);
    const toR = to?.getBoundingClientRect();
    if (toR) { to.style.visibility = "hidden"; fly(CROWN, oldLead, toR, 30); setTimeout(() => { to.style.visibility = ""; flash(`.knight[data-pid="${v.leader}"]`, "glow"); }, 800); }
  }
  // a proposed team lights up, one knight at a time
  if (v.phase === "vote" && prev.phase !== "vote") v.team.forEach((pid, i) => { flash(`.knight[data-pid="${pid}"]`, "pop", i * 120); flash(`.knight[data-pid="${pid}"]`, "glow", i * 120); });
  // a finished quest drops into the track
  if (v.results.length > prev.results.length) { const i = v.results.length - 1; flash(`.quests .q:nth-child(${i + 1})`, "pop"); flash(`.quests .q:nth-child(${i + 1})`, "glow"); }
  // someone readies up / votes / plays a card: their tile nods
  for (const p of v.players) {
    const q = prev.players.find(x => x.id === p.id);
    if (q && ((p.ready && !q.ready) || (p.voted && !q.voted) || (p.played && !q.played))) flash(`.knight[data-pid="${p.id}"] .av`, "pop");
  }
}

function effect(last, v) {
  if (last.kind === "vote") {
    const order = v.players.map(p => p.id);
    showFx(`<div class="t">${last.approved ? "Team approved" : "Team rejected"}</div>
      <div class="reveal">${order.map((pid, i) => `<div class="rv" style="animation-delay:${i * .08}s"><div class="tk ${last.votes[pid] ? "y" : "n"}">${last.votes[pid] ? "✓" : "✗"}</div><span>${esc(nameOf(pid))}</span></div>`).join("")}</div>
      ${!last.approved && last.attempt >= 4 && v.phase !== "gameOver" ? `<div class="l">Next rejection makes it 5 — Evil would win</div>` : ""}`, 2600);
    if (!last.approved) shake();
  }
  if (last.kind === "quest") {
    const cards = Array.from({ length: last.team.length }, (_, i) => i < last.fails);
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    showFx(`<div class="qreveal">${cards.map((f, i) => `<div class="c" style="animation-delay:${.2 + i * .25}s">${questCard(!f)}</div>`).join("")}</div>
      <div class="t" style="animation:wlword .6s ${.4 + cards.length * .25}s both">Quest ${last.quest} ${last.success ? "succeeded" : "failed"}</div>
      <div class="l">${last.fails} Fail card${last.fails === 1 ? "" : "s"}${last.twoFails && last.fails === 1 ? " — this quest needed two" : ""}</div>`, 3200);
    setTimeout(() => burst(last.success ? GOOD_COLS : EVIL_COLS), 600 + cards.length * 250);
  }
  if (last.kind === "lady") showFx(`<div class="img" style="width:min(26vw,110px)">${LADY}</div><div class="t">Lady of the Lake</div><div class="l">${esc(nameOf(last.by))} looked into ${esc(last.target === S.me ? "your" : plainName(last.target) + "'s")} heart</div>`, 2200);
  if (last.kind === "assassin") showFx(`<div class="img">${crest("assassin", "evil")}</div><div class="t">${esc(nameOf(last.target))}…</div><div class="l">The Assassin names ${esc(last.target === S.me ? "you" : plainName(last.target))} as Merlin</div>`, 2400);
  if (last.kind === "start") showFx(`<div class="t">The quests begin</div><div class="l">${esc(nameOf(last.leader))} ${last.leader === S.me ? "are" : "is"} the first leader</div>`, 2000);
}
// One reveal at a time: a vote reveal and the quest that follows it play one after the other, never on top of each other.
const fxQ = [];
let fxBusy = false;
function showFx(html, ms) { fxQ.push([html, ms]); fxHold = fxQ.reduce((s, [, m]) => s + m, 0); if (!fxBusy) nextFx(); }
function nextFx() {
  const it = fxQ.shift();
  if (!it) { fxBusy = false; fxHold = 0; return; }
  fxBusy = true;
  const [html, ms] = it, d = document.createElement("div");
  d.className = "fx-banner"; d.style.animationDuration = ms + "ms"; d.innerHTML = html;
  document.body.append(d);
  setTimeout(() => { d.remove(); fxHold = fxQ.reduce((s, [, m]) => s + m, 0); nextFx(); }, ms);
}
function shake() { $app.classList.remove("shake"); void $app.offsetWidth; $app.classList.add("shake"); setTimeout(() => $app.classList.remove("shake"), 520); }

// particles
const GOOD_COLS = ["#8fb3ff", "#f6dfa0", "#ffffff", "#3d6fe0"], EVIL_COLS = ["#ff7d8c", "#c8364a", "#f6dfa0", "#5a0f1c"];
let fxLayer, ctx, parts = [], running = false;
function ensureFx() {
  if (fxLayer) return;
  fxLayer = document.createElement("div"); fxLayer.id = "fx";
  const c = document.createElement("canvas"); fxLayer.append(c); document.body.append(fxLayer);
  ctx = c.getContext("2d");
  const size = () => { const d = Math.min(devicePixelRatio || 1, 2); c.width = innerWidth * d; c.height = innerHeight * d; c.style.width = innerWidth + "px"; c.style.height = innerHeight + "px"; ctx.setTransform(d, 0, 0, d, 0, 0); };
  size(); addEventListener("resize", size);
}
const rnd = (a, b) => a + Math.random() * (b - a);
function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => ++p.age < p.life);
  for (const p of parts) {
    p.vx *= .985; p.vy = p.vy * .985 + .05; p.x += p.vx; p.y += p.vy;
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.c;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.age / 8);
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? p.s * .35 : p.s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
function burst(cols) {
  ensureFx();
  for (let i = 0; i < 110; i++) { const a = rnd(0, 6.28), s = rnd(2, 9); parts.push({ x: innerWidth / 2, y: innerHeight * .4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, age: 0, life: rnd(50, 100), s: rnd(4, 9), c: cols[i % cols.length] }); }
  if (!running) { running = true; requestAnimationFrame(tick); }
}
function welcome() {
  const words = "Welcome to Dhruv's Vibe Coded Avalon".split(" ");
  const d = document.createElement("div"); d.className = "fx-welcome";
  const fanRoles = [["percival", "good"], ["merlin", "good"], ["servant", "good"], ["assassin", "evil"], ["morgana", "evil"], ["mordred", "evil"]];
  d.innerHTML = `<div class="wl-fan">${fanRoles.map(([r, s], i) => `<div class="c" style="--i:${i - 2.5}">${crest(r, s)}</div>`).join("")}</div>
    <h1>${words.map((w, i) => `<span style="animation-delay:${.5 + i * .16}s">${w}</span>`).join(" ")}</h1><p>Manifest his greatness and you may win</p><small>Tap to start</small>`;
  document.body.append(d);
  const shownAt = Date.now();
  const close = () => { if (Date.now() - shownAt < 3000 || d.classList.contains("out")) return; d.classList.add("out"); setTimeout(() => d.remove(), 500); };
  d.addEventListener("pointerdown", close); setTimeout(close, 5200); setTimeout(() => burst(GOOD_COLS), 500);
}

// ---------------------------------------------------------------- views
const HS = hscroll(".tabs,.tbl");
let hsT = null;
function render() {
  clearTimeout(hsT);
  if (S.mode === "game" && HS.busy()) { hsT = setTimeout(render, 150); return; }
  const sc = document.querySelector(".scroll")?.scrollTop, sb = document.querySelector(".sheetbody")?.scrollTop, hs = HS.save();
  let h = "";
  if (S.mode === "landing") h = viewLanding();
  else if (S.mode === "join" || S.mode === "connecting") h = viewJoin();
  else if (S.mode === "claim") h = viewClaim();
  else if (S.mode === "left") h = viewLeft();
  else if (S.mode === "lobby") h = viewLobby();
  else if (S.mode === "game") h = viewGame();
  h += viewOverlay();
  $app.innerHTML = h;
  if (sc) { const e = document.querySelector(".scroll"); if (e) e.scrollTop = sc; }
  if (sb) { const e = document.querySelector(".sheetbody"); if (e) e.scrollTop = sb; }
  HS.restore(hs);
}

const rulesBtn = (cls = "ghost small") => `<button class="btn ${cls}" data-act="rules">Rules</button>`;
const fan = roles => `<div class="fan">${roles.map(([r, s], i) => `<div class="c" style="transform:rotate(${(i - (roles.length - 1) / 2) * 10}deg) translateY(${Math.abs(i - (roles.length - 1) / 2) * 8}px)">${crest(r, s)}</div>`).join("")}</div>`;

function viewLanding() {
  return `<div class="page">${inAppHint()}<div class="hero">${fan([["merlin", "good"], ["percival", "good"], ["assassin", "evil"], ["morgana", "evil"]])}
      <div class="eyebrow">Games4free · The Resistance</div><h1 class="title">Avalon</h1>
      <p class="muted" style="max-width:40ch;margin:0">Loyal knights of Arthur against the hidden servants of Mordred. Pick teams, vote, and go on secret quests. 5–10 players, best with friends you can talk to.</p></div>
    <form class="panel" data-form="create"><label for="nm" class="eyebrow">Your name</label>
      <div class="row"><input id="nm" type="text" maxlength="18" autocomplete="nickname" placeholder="e.g. Dhruv" value="${esc(room.lastName())}" required><button class="btn" type="submit">Start a game</button></div>
      <div class="err">${esc(S.error)}</div></form>
    <div class="row" style="justify-content:center">${rulesBtn()}<a class="btn ghost small" href="../">All games</a></div></div>`;
}

function viewJoin() {
  const busy = S.mode === "connecting";
  return `<div class="page">${inAppHint()}<div class="hero">${fan([["servant", "good"], ["merlin", "good"], ["minion", "evil"]])}
      <div class="eyebrow">You're invited to a game of</div><h1 class="title">Avalon</h1></div>
    <form class="panel" data-form="join"><label for="nm" class="eyebrow">Your name</label>
      <div class="row"><input id="nm" type="text" maxlength="18" autocomplete="nickname" placeholder="Your name" value="${esc(room.lastName())}" required ${busy ? "disabled" : ""}>
      <button class="btn" type="submit" ${busy ? "disabled" : ""}>${busy ? "Joining…" : "Join game"}</button></div>
      <div class="err">${esc(S.error || S.status)}</div></form>
    <div class="row" style="justify-content:center">${rulesBtn()}<a class="btn ghost small" href="./">Start my own game</a></div></div>`;
}

function viewLeft() {
  return `<div class="page"><div class="hero"><div class="eyebrow">You left the game</div><h1 class="title" style="font-size:44px">See you soon</h1>
    <p class="muted" style="max-width:40ch;margin:0">A bot is playing your seat so the others can finish. Want back in? Rejoin and pick your seat.</p></div>
    <div class="row" style="justify-content:center"><button class="btn" data-act="rejoin">Rejoin the game</button><a class="btn ghost small" href="../">All games</a>${rulesBtn()}</div></div>`;
}
function viewClaim() {
  const seats = (S.lobby?.players || []).map((p, i) => `<li><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span style="flex:1">${esc(p.name)} <span class="muted" style="font-size:14px">${S.bots?.includes(p.id) ? "· a bot is playing" : p.online ? "· playing now" : "· away"}</span></span>
      <button class="btn small" data-act="claim" data-pid="${p.id}">This is me</button></li>`).join("");
  return `<div class="page"><div class="hero"><div class="eyebrow">Game in progress</div><h1 class="title" style="font-size:44px">Rejoin</h1></div>
    <section class="panel"><div class="eyebrow">Which player are you?</div><ul class="plist">${seats}</ul>
    <p class="muted" style="margin:0;font-size:15px">Your role and everything you know come with you. If that seat is open on another device, it moves here.</p><div class="err">${esc(S.error || S.status)}</div></section>
    <div class="row" style="justify-content:center">${rulesBtn()}</div></div>`;
}

const OPT = [
  ["percival", "good", "Percival", "Good · sees Merlin (and Morgana)"],
  ["morgana", "evil", "Morgana", "Evil · looks like Merlin to Percival"],
  ["mordred", "evil", "Mordred", "Evil · hidden from Merlin"],
  ["oberon", "evil", "Oberon", "Evil · works alone, unknown to Evil"],
];
function viewLobby() {
  const L = S.lobby; if (!L) return "";
  const host = room.isHost, n = L.players.length, st = L.settings, link = room.linkFor(L.code);
  const nn = Math.max(5, Math.min(10, n)), rs = E.rolesFor(nn, st);
  return `<div class="page"><div class="hero" style="gap:4px"><div class="eyebrow">Table ${esc(L.code)}</div><h1 class="title" style="font-size:44px">Lobby</h1></div>
    <section class="panel"><div class="eyebrow">Invite players</div>
      <div class="share"><code id="link">${esc(link)}</code><button class="btn small" data-act="share">Share link</button><button class="btn ghost small" data-act="copy">Copy</button></div>
      <p class="muted" style="margin:0;font-size:15px">Anyone with the link types a name and joins. 5–10 players. Talk on a call or sit together — your phone keeps your role secret.</p></section>
    <section class="panel"><div class="eyebrow">Players · ${n}/10</div><ul class="plist">${L.players.map((p, i) => `<li><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span style="flex:1">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}${p.id === L.hostId ? " <span class='badge'>HOST</span>" : ""}</span>
      <span class="dot ${p.online ? "" : "off"}"></span>${host && p.id !== S.me ? `<button class="btn ghost small" data-act="kick" data-pid="${p.id}">Remove</button>` : ""}</li>`).join("")}</ul>
      ${n < 5 ? `<p class="muted" style="margin:0">Waiting for ${5 - n} more player${5 - n === 1 ? "" : "s"}… (Avalon needs at least 5)</p>` : ""}</section>
    <section class="panel"><div class="eyebrow">Characters ${host ? "" : "· the host chooses"}</div>
      <div class="toggles">
        <div class="toggle"><span class="c">${crest("merlin", "good")}</span><span>Merlin &amp; the Assassin<small>Always in the game</small></span></div>
        ${OPT.map(([k, s, nm, d]) => `<div class="toggle"><span class="c">${crest(k, s)}</span><span>${nm}<small>${d}</small></span>
          <button class="sw" role="switch" aria-checked="${!!st[k]}" aria-label="${nm}" ${host ? `data-act="opt" data-k="${k}"` : "disabled"}></button></div>`).join("")}
        <div class="toggle"><span class="c">${LADY}</span><span>Lady of the Lake<small>Check someone's loyalty after quests 2–4 · best with 7+</small></span>
          <button class="sw" role="switch" aria-checked="${!!st.lady}" aria-label="Lady of the Lake" ${host ? `data-act="opt" data-k="lady"` : "disabled"}></button></div>
      </div>
      <dl class="setup"><dt>At ${nn} players</dt><dd><span class="good-t">${rs.good.length} Good</span> · <span class="evil-t">${rs.evil.length} Evil</span></dd>
        <dt>Good</dt><dd>${rs.good.map(r => E.ROLES[r].name.replace("Loyal Servant of Arthur", "Servant")).join(", ")}</dd>
        <dt>Evil</dt><dd>${rs.evil.map(r => E.ROLES[r].name.replace("Minion of Mordred", "Minion")).join(", ")}</dd>
        <dt>Quests</dt><dd>${E.QUEST_SIZES[nn].map((q, i) => q + (i === 3 && nn >= 7 ? "★" : "")).join(" · ")}</dd></dl>
      ${st.percival && nn === 5 && !st.morgana && !st.mordred ? `<p class="muted" style="margin:0;font-size:14px">With Percival at 5 players, the rules suggest adding Morgana or Mordred too.</p>` : ""}
      <div class="row" style="justify-content:space-between"><span>Turn timer</span><span class="seg">${[[60, "1 min"], [180, "3 min"], [300, "5 min"]].map(([v, l]) => `<button aria-pressed="${(st.timer || 180) === v}" ${host ? `data-act="timer" data-v="${v}"` : "disabled"}>${l}</button>`).join("")}</span></div>
      <p class="muted" style="margin:0;font-size:14px">Avalon is a talking game. If someone runs out of time, the game makes a sensible move for them.</p></section>
    ${soundRow()}
    <div class="row" style="justify-content:center">${host ? `<button class="btn" data-act="start" ${n < 5 ? "disabled" : ""}>Start game</button>` : `<span class="muted">Waiting for the host to start…</span>`}${rulesBtn()}</div>
    <div class="err" style="text-align:center">${esc(S.error || S.status)}</div></div>`;
}

// ---------------------------------------------------------------- the table
function knightHtml(p, i) {
  const v = V(), id = p.id, me = id === S.me;
  const leader = v.leader === id && v.phase !== "gameOver";
  const onTeam = (v.phase === "propose" && v.leader === S.me ? ui.pick : v.team).includes(id);
  const pickable = (v.phase === "propose" && v.leader === S.me && waitingMe()) || (["lady", "assassin"].includes(v.phase) && waitingMe() && canTarget(id));
  const sel = onTeam || ui.target === id;
  const lastP = v.proposals.at(-1), showVote = lastP && !["vote", "reveal"].includes(v.phase);   // how everyone voted last time
  const k = knowsOf(id), endRole = v.roles?.[id];
  let sub = "";
  if (v.phase === "vote") sub = p.voted ? "voted" : "deciding…";
  else if (v.phase === "quest" && v.team.includes(id)) sub = p.played ? "card played" : "on the quest";
  else if (v.phase === "reveal") sub = p.ready ? "ready" : "reading role…";
  else if (endRole) sub = E.ROLES[endRole].name;
  const tag = k ? (k.as === "evil" ? `<span class="know">EVIL</span>` : k.as === "assassin" ? `<span class="know">ASSASSIN</span>` : `<span class="know mer">MERLIN?</span>`) : "";
  const bot = S.bots?.includes(id), off = !S.online[id] && !me;
  return `<button class="knight ${me ? "me" : ""} ${leader ? "leader" : ""} ${sel ? "picked" : ""} ${pickable ? "pickable" : ""}" data-pid="${id}" ${pickable ? `data-act="pick"` : `data-act="noop" tabindex="-1"`} aria-pressed="${sel}">
    ${tag}<span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
    <span class="nm">${esc(p.name)}<span class="sub">${esc(sub)}${off && !bot ? " · away" : ""} <span class="tmr" data-tmr="${id}"></span></span></span>
    <span class="tags">${bot ? `<span class="badge bot">BOT</span>` : ""}${showVote ? `<span class="vchip ${lastP.votes[id] ? "y" : "n"}">${lastP.votes[id] ? "✓" : "✗"}</span>` : ""}${v.lady === id ? `<span class="tok" title="Lady of the Lake">${LADY}</span>` : ""}${leader ? CROWN : ""}${endRole ? `<span class="tok">${crest(endRole, E.ROLES[endRole].side)}</span>` : ""}</span></button>`;
}
function canTarget(id) {
  const v = V();
  if (v.phase === "lady") return v.ladyTargets.includes(id);
  if (v.phase === "assassin") return id !== S.me && knowsOf(id)?.as !== "evil" && knowsOf(id)?.as !== "assassin";
  return false;
}

function viewGame() {
  const v = V();
  const quests = v.sizes.map((s, i) => {
    const r = v.results[i], now = i + 1 === v.quest && !r && v.phase !== "gameOver";
    return `<div class="q ${r ? (r.success ? "win" : "lose") : ""} ${now ? "now" : ""}" title="Quest ${i + 1}">${r ? questCard(r.success) : s}${!r ? `<small>Q${i + 1}</small>` : ""}${i === 3 && v.players.length >= 7 ? `<span class="two">2✗</span>` : ""}</div>`;
  }).join("");
  const rejected = v.phase === "gameOver" ? 0 : v.attempt - 1;
  const votes = `<div class="votes">Rejected teams <span>${[1, 2, 3, 4, 5].map(i => `<i class="${i <= rejected ? "on" : ""} ${i === 5 ? "last" : ""}"></i>`).join(" ")}</span>${rejected >= 3 ? `<b class="evil-t">${5 - rejected} left</b>` : ""}</div>`;
  return `<div id="table">
    <div class="bar"><div class="info"><span class="rnd"><small>QUEST</small>${Math.min(v.quest, 5)} of 5</span>${S.net ? "" : `<span class="badge off">OFFLINE</span>`}</div>
      <button class="btn ghost small" data-act="leave-ask" aria-label="Leave the game"><span aria-hidden="true">🚪</span><span class="lvt">Leave</span></button>
      <button class="btn ghost small" data-act="history" aria-label="History"><span class="sci" aria-hidden="true">📜</span><span class="sct">History</span></button>${rulesBtn("small")}</div>
    <div class="scroll"><div class="track"><div class="quests">${quests}</div>${votes}</div>
      <div class="knights">${v.players.map(knightHtml).join("")}</div></div>
    ${dock()}</div>`;
}

function dock() {
  const v = V(), lead = v.leader, w = v.waiting, size = v.size;
  const roleBtn = v.role ? `<button class="rolebtn" data-act="role"><span class="c">${crest(v.role, v.side)}</span>Your role</button>` : "";
  const timer = waitingMe() ? ` <span class="tmr big" data-tmr="${S.me}"></span>` : "";
  let status = "", actions = "";
  switch (v.phase) {
    case "reveal":
      status = v.players.find(p => p.id === S.me)?.ready ? `Waiting for ${w.length} to read their role…` : "Look at your role — keep it secret";
      if (!v.players.find(p => p.id === S.me)?.ready) actions = `<button class="btn big" data-act="role">Show my role</button>`;
      break;
    case "propose":
      if (lead === S.me) {
        status = `You lead. Pick ${size} knight${size > 1 ? "s" : ""} for quest ${v.quest}${v.twoFails ? " (needs 2 Fails to fail)" : ""} · ${ui.pick.length}/${size}`;
        actions = `<button class="btn big" data-act="propose" ${ui.pick.length === size ? "" : "disabled"}>Send this team to a vote</button>`;
      } else status = `${esc(plainName(lead))} is choosing ${size} knights for quest ${v.quest}`;
      break;
    case "vote":
      if (w.includes(S.me)) {
        status = `${lead === S.me ? "Your" : esc(plainName(lead)) + "'s"} team: <b>${esc(list(v.team))}</b>. Approve?`;
        actions = `<button class="btn big approve" data-act="vote" data-yes="1">✓ Approve</button><button class="btn big reject" data-act="vote" data-yes="0">✗ Reject</button>`;
      } else status = `You voted ${v.myVote ? "Approve" : "Reject"} · waiting for ${w.length} more`;
      break;
    case "quest":
      if (w.includes(S.me)) {
        status = `You're on quest ${v.quest}. Play a card — nobody sees which.`;
        actions = `<div class="qcards"><button class="qcard" data-act="quest" data-ok="1">${questCard(true)}Success</button><button class="qcard" data-act="quest" data-ok="0" ${v.side === "good" ? "disabled" : ""}>${questCard(false)}${v.side === "good" ? "Loyal knights can't fail" : "Fail"}</button></div>`;
      } else if (v.team.includes(S.me)) status = `Card played · waiting for ${w.length} more`;
      else status = `The team is on the quest… ${v.team.length - w.length}/${v.team.length} cards played`;
      break;
    case "lady":
      if (w.includes(S.me)) {
        status = ui.target ? `Look into ${esc(plainName(ui.target))}'s loyalty?` : "Lady of the Lake: tap a player to learn their loyalty";
        actions = `<button class="btn big" data-act="lady" ${ui.target ? "" : "disabled"}>Use the Lady</button>`;
      } else status = `${esc(plainName(v.lady))} holds the Lady of the Lake and is choosing…`;
      break;
    case "assassin":
      if (w.includes(S.me)) {
        status = ui.target ? `Name ${esc(plainName(ui.target))} as Merlin?` : "Three quests succeeded. Talk with Evil, then tap who you think is Merlin";
        actions = `<button class="btn big reject" data-act="assassinate" ${ui.target ? "" : "disabled"}>Strike: this is Merlin</button>`;
      } else status = v.side === "evil" ? "Help the Assassin find Merlin" : "Good completed three quests — the Assassin is hunting Merlin…";
      break;
    case "gameOver":
      status = `<span class="${v.result.winner === "good" ? "good-t" : "evil-t"}">${v.result.winner === "good" ? "Good wins!" : "Evil wins!"}</span> ${esc(v.result.why)}`;
      actions = `<button class="btn big" data-act="over">See everyone's role</button>`;
      break;
  }
  return `<div class="dock" id="dock"><div class="dockhead"><span class="status ${waitingMe() ? "you" : ""}">${status}${timer}</span>${roleBtn}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
}

// ---------------------------------------------------------------- overlays
const sheet = (title, body, foot = "", lock = false) => `<div class="overlay" ${lock ? "" : `data-act="closebg"`}><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
  <div class="sheethead"><h2>${esc(title)}</h2>${lock ? "" : `<button class="btn ghost small" data-act="close">Close</button>`}</div>${body}${foot}</div></div>`;

function roleCard() {
  const v = V(), r = v.role, side = v.side, k = v.knows || [];
  const known = k.length
    ? `<p class="muted" style="font-size:14px">${r === "percival" ? "One of these is Merlin, the other may be Morgana:" : r === "merlin" ? "These serve Evil:" : "Your fellow servants of Mordred:"}</p>
       <ul>${k.map(x => `<li class="${x.as === "merlin?" ? "m" : "e"}">${esc(plainName(x.id))}${x.as === "assassin" ? " · Assassin" : ""}</li>`).join("")}</ul>`
    : r === "merlin" ? `<p class="muted" style="font-size:14px">You see no Evil players — Mordred is hiding from you.</p>` : "";
  const ready = v.phase === "reveal" && !v.players.find(p => p.id === S.me)?.ready;
  return `<div class="rolecard"><div class="crest">${crest(r, side)}</div><h3>${esc(E.ROLES[r].name)}</h3><span class="side ${side}">${side === "good" ? "Loyal to Arthur" : "Serves Mordred"}</span>
    <p>${ROLE_TEXT[r]}</p>${known}
    ${ready ? `<button class="btn big" data-act="ready" style="flex:none;min-width:220px">I've seen my role</button>` : `<button class="btn ghost" data-act="close">Hide</button>`}</div>`;
}

function viewOverlay() {
  const v = V();
  let h = "";
  if (ui.overlay === "leave" && v) h = sheet("Leave the game?", `<div class="sheetbody"><p style="margin-top:0">A bot will play your seat for the rest of this game, so everyone else can finish. Changed your mind? Open the same link and tap <b>This is me</b> to take your seat back.</p><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="leave">Leave the game</button><button class="btn ghost" data-act="close">Stay</button></div></div>`);
  else if (ui.overlay === "role" && v?.role) h = sheet("Your role", `<div class="sheetbody">${roleCard()}</div>`);
  else if (ui.overlay === "rules") h = sheet("Rules", rulesTabs() + `<div class="sheetbody guide">${soundRow()}${rulesBody()}</div>`);
  else if (ui.overlay === "history" && v) h = sheet("History", `<div class="sheetbody">${history()}</div>`);
  else if (ui.overlay === "ladyres" && v) h = sheet("Lady of the Lake", `<div class="sheetbody">${ladyResult()}</div>`);
  else if (ui.overlay === "over" && v?.phase === "gameOver") h = sheet(v.result.winner === "good" ? "Good wins" : "Evil wins", `<div class="sheetbody">${gameOver()}</div>`, `<div class="row" style="justify-content:center;padding:6px 16px 16px">${room.isHost ? `<button class="btn" data-act="again">Play again</button>` : `<span class="muted">The host can start a new game.</span>`}</div>`);
  return h;
}

function rulesTabs() {
  const t = [["basics", "How to play"], ["roles", "Characters"], ["setup", "Quests"], ["full", "Full rules"]];
  return `<div class="tabs" role="tablist">${t.map(([k, l]) => `<button role="tab" aria-selected="${ui.tab === k}" data-act="tab" data-k="${k}">${l}</button>`).join("")}</div>`;
}
function rulesBody() {
  const n = V()?.players.length || S.lobby?.players.length || 7;
  if (ui.tab === "setup") return `<h3>Team sizes</h3>${setupTable(Math.max(5, Math.min(10, n)))}`;
  if (ui.tab === "full") return RULES.full.replace("<!--SETUP-->", setupTable(Math.max(5, Math.min(10, n))));
  return RULES[ui.tab] || RULES.basics;
}

function history() {
  const v = V();
  if (!v.proposals.length) return `<p class="muted">Nothing yet. Every team vote and quest will show up here.</p>`;
  const out = [];
  for (let q = 1; q <= 5; q++) {
    const props = v.proposals.filter(p => p.quest === q), res = v.results.find(r => r.quest === q);
    if (!props.length) continue;
    out.push(`<div class="h"><b>Quest ${q}${res ? ` — <span class="${res.success ? "good-t" : "evil-t"}">${res.success ? "success" : "failed"}</span> (${res.fails} Fail${res.fails === 1 ? "" : "s"})` : ""}</b>
      ${props.map(p => `<div><span class="muted">Try ${p.attempt} · ${esc(nameOf(p.leader))} picked</span> ${esc(list(p.team))} — <b class="${p.approved ? "good-t" : "evil-t"}">${p.approved ? "approved" : "rejected"}</b>
        <div class="vl">${v.players.map(pl => `<span class="vchip ${p.votes[pl.id] ? "y" : "n"}">${esc(pl.name)} ${p.votes[pl.id] ? "✓" : "✗"}</span>`).join("")}</div></div>`).join("")}</div>`);
  }
  const lady = v.ladyChecks.map(c => `<div class="h"><b>Lady of the Lake after quest ${c.quest}</b><span>${esc(nameOf(c.by))} looked at ${esc(c.target === S.me ? "you" : plainName(c.target))}${c.side ? ` — <b class="${c.side === "good" ? "good-t" : "evil-t"}">${c.side === "good" ? "Good" : "Evil"}</b>` : ""}</span></div>`).join("");
  return `<div class="hist">${out.reverse().join("")}${lady}</div>`;
}

function ladyResult() {
  const c = V().ladyChecks.filter(x => x.by === S.me && x.side).at(-1);
  if (!c) return "";
  return `<div class="rolecard"><div class="crest" style="width:min(36vw,140px)">${crest(c.side === "good" ? "servant" : "minion", c.side)}</div>
    <h3>${esc(plainName(c.target))} is ${c.side === "good" ? "Good" : "Evil"}</h3>
    <p class="muted">Only you know this. Share it, keep it, or lie about it — your choice.</p><button class="btn ghost" data-act="close">Got it</button></div>`;
}

function gameOver() {
  const v = V(), r = v.result, win = r.winner;
  const hit = r.assassinated ? `<p>The Assassin named <b>${esc(nameOf(r.assassinated))}</b> — ${v.roles[r.assassinated] === "merlin" ? "and found Merlin." : "but Merlin was " + esc(nameOf(Object.keys(v.roles).find(k => v.roles[k] === "merlin"))) + "."}</p>` : "";
  const mySide = v.side;
  return `<div class="result"><h3 class="${win === "good" ? "good-t" : "evil-t"}">${win === "good" ? "Arthur's knights prevail" : "Mordred's servants triumph"}</h3>
    <p class="muted" style="margin:0">${esc(r.why)}${mySide ? ` ${mySide === win ? "You won!" : "Your side lost."}` : ""}</p>${hit}</div>
    <div class="roles">${v.players.map(p => { const role = v.roles[p.id], s = E.ROLES[role].side; return `<div class="r"><span class="c">${crest(role, s)}</span><span><b>${esc(nameOf(p.id))}</b><small class="${s}-t">${esc(E.ROLES[role].name)}</small></span></div>`; }).join("")}</div>`;
}

// ---------------------------------------------------------------- input
$app.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, v = V();
  switch (a) {
    case "noop": return;
    case "sound": alerts.toggle(); break;
    case "rules": ui.overlay = "rules"; break;
    case "history": ui.overlay = "history"; break;
    case "role": ui.overlay = "role"; break;
    case "over": ui.overlay = "over"; break;
    case "leave-ask": ui.overlay = "leave"; break;
    case "leave": ui.overlay = null; room.leave(); return;
    case "rejoin": room.rejoin(); return;
    case "close": ui.overlay = null; break;
    case "closebg": if (e.target !== el) return; ui.overlay = null; break;
    case "tab": ui.tab = el.dataset.k; break;
    case "share": share(); return;
    case "copy": copy(); return;
    case "start": room.start(); return;
    case "kick": room.kick(el.dataset.pid); return;
    case "claim": room.claim(el.dataset.pid); return;
    case "again": ui.overlay = null; room.backToLobby(); return;
    case "timer": room.settings({ timer: +el.dataset.v }); return;
    case "opt": room.settings({ [el.dataset.k]: !S.lobby.settings[el.dataset.k] }); return;
    case "ready": ui.overlay = null; room.act({ type: "ready" }); break;
    case "pick": {
      const id = el.dataset.pid;
      if (v.phase === "propose") {
        if (ui.pick.includes(id)) ui.pick = ui.pick.filter(x => x !== id);
        else if (ui.pick.length < v.size) ui.pick = [...ui.pick, id];
        else toast(`This quest takes ${v.size}. Tap someone to remove them first.`);
      } else ui.target = ui.target === id ? null : id;
      break;
    }
    case "propose": room.act({ type: "propose", team: ui.pick.slice() }); return;
    case "vote": room.act({ type: "vote", yes: el.dataset.yes === "1" }); return;
    case "quest": room.act({ type: "quest", ok: el.dataset.ok === "1" }); return;
    case "lady": if (ui.target) room.act({ type: "lady", target: ui.target }); return;
    case "assassinate": if (ui.target) room.act({ type: "assassinate", target: ui.target }); return;
    default: return;
  }
  render();
});
$app.addEventListener("submit", e => {
  e.preventDefault();
  const name = e.target.querySelector("#nm")?.value.trim(); if (!name) return;
  if (e.target.dataset.form === "create") room.create(name);
  if (e.target.dataset.form === "join") room.join(name);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.overlay) { ui.overlay = null; render(); } });

async function share() {
  const url = room.linkFor(S.code);
  if (navigator.share) { try { await navigator.share({ title: "Avalon", text: "Join my game of Avalon:", url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  copy();
}
async function copy() {
  try { await navigator.clipboard.writeText(room.linkFor(S.code)); toast("Link copied"); }
  catch { const c = document.getElementById("link"); if (c) { const r = document.createRange(); r.selectNodeContents(c); getSelection().removeAllRanges(); getSelection().addRange(r); } toast("Select the link and copy it"); }
}

// Turn clock: count down on screen between state updates.
let buzzed = null;
setInterval(() => {
  const c = room.clock();
  for (const el of document.querySelectorAll("[data-tmr]")) {
    if (!c || !c.waiting?.includes(el.dataset.tmr)) { el.textContent = ""; continue; }
    const sec = Math.ceil(c.left / 1000);
    el.textContent = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : `${sec}s`;
    el.classList.toggle("low", sec <= 10);
    if (el.dataset.tmr === S.me && sec <= 10 && buzzed !== V()?.seq) { buzzed = V()?.seq; alerts.hurry(); }
  }
}, 250);

async function wake() { try { await navigator.wakeLock?.request("screen"); } catch { /* not allowed */ } }
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && S.mode === "game" && wake());
addEventListener("resize", () => S.mode === "game" && render());

(function boot() {
  if (S.code) { const n = room.savedName(); if (n) { wake(); return room.join(n); } S.mode = "join"; }
  render();
})();

window.__ava = { S, room, ui, E };
