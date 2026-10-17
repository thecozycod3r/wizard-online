import * as E from "./engine.js";
import { DATA } from "./data.js";
import { createRoom } from "../shared/room.js";
import { RULES, setupTable } from "./rules.js";

const $app = document.getElementById("app");
const ORES = E.ORES, ALL = E.ALL, NAME = E.ORE_NAME;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SEAT = ["#f3d48a", "#7fb0ff", "#5fd39a", "#ff8a73", "#c6a2ff", "#f5a8d6"];
const base = id => id.replace(/b$/, "");
const artSet = id => `image-set(url('art/${base(id)}.webp') 1x, url('art/${base(id)}@2x.webp') 2x)`;
const tokImg = o => `<img src="art/tok-${o}.webp" alt="${NAME[o]}" draggable="false">`;
const pip = (o, n) => `<i style="background:var(--${o})${o === "silver" ? ";color:#20242c;text-shadow:none" : ""}">${n}</i>`;
const CROWN = `<svg class="crown" viewBox="0 0 30 22" aria-label="Leader"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".55" stop-color="#f2c14e"/><stop offset="1" stop-color="#b7832a"/></linearGradient></defs><path d="M2 7l6.5 5L15 2l6.5 10L28 7l-2.6 12H4.6z" fill="url(#cg)" stroke="#7a5418" stroke-width="1.2" stroke-linejoin="round"/><rect x="4.4" y="17.6" width="21.2" height="3.4" rx="1.2" fill="url(#cg)" stroke="#7a5418" stroke-width="1"/><circle cx="15" cy="2.6" r="1.8" fill="#ff5a6e"/><circle cx="2.4" cy="7" r="1.5" fill="#7fd0ff"/><circle cx="27.6" cy="7" r="1.5" fill="#7fd0ff"/></svg>`;
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };

const ui = { sel: [], overlay: null, tab: "basics", card: null, from: null, player: null, discard: {}, zoom: null, leader: null };
let dragging = null, queued = false;

const room = createRoom({
  prefix: "lode-", engine: E, minPlayers: 2, maxPlayers: 6, defaults: { timer: 60 },
  onUpdate: prev => onUpdate(prev), toast: m => toast(esc(m)),
});
const S = room.S;

// ---------------------------------------------------------------- helpers
const V = () => S.view;
const me = () => V()?.players[V().me];
const myTurn = () => V()?.phase === "turn" && V().waiting.includes(S.me);
const nameOf = pid => (pid === S.me ? "You" : V()?.players.find(p => p.id === pid)?.name || "?");
const seatOf = pid => V()?.players.findIndex(p => p.id === pid);
const colorsLeft = () => ORES.filter(o => V().bank[o] > 0);

function leaderOf(v) {
  if (!v) return null;
  const max = Math.max(...v.players.map(p => p.points));
  const top = v.players.filter(p => p.points === max);
  return top.length === 1 && max > 0 ? top[0].id : null;
}

function selValid() {
  const s = ui.sel, v = V();
  if (s.length === 2 && s[0] === s[1]) return v.bank[s[0]] >= 4;
  if (new Set(s).size !== s.length || !s.length) return false;
  return s.length === Math.min(3, colorsLeft().length);
}

// ---------------------------------------------------------------- toast
let tt;
function toast(html) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.innerHTML = html;
  document.body.append(t); clearTimeout(tt); tt = setTimeout(() => t.remove(), 2600);
}

// ---------------------------------------------------------------- update + effects
function onUpdate(prev) {
  const v = V();
  // remember where things were before the screen changes, for the fly-in animations
  const before = v && prev && v.last && v.seq !== prev.seq ? capture(v.last) : null;
  if (v) {
    if (!myTurn()) ui.sel = [];
    if (v.phase === "gameOver" && prev?.phase !== "gameOver") ui.overlay = "over";
    if (prev && v.final && !prev.final) setTimeout(() => banner(null, "Final round!", "Someone reached 15 points. Everyone finishes this round."), 900);
    const mineNow = v.waiting.includes(S.me) && v.phase !== "gameOver";
    const minePrev = prev ? prev.waiting.includes(S.me) && prev.phase === v.phase && prev.turn === v.turn : false;
    if (mineNow && !minePrev) navigator.vibrate?.([18, 40, 18]);
    document.title = mineNow ? "● Your turn · Splendor" : "Splendor · Games4free";
    const wk = "lode-welcome-" + v.gameId;
    if (v.gameId && v.round === 1 && !LS.get(wk)) { LS.set(wk, 1); setTimeout(welcome, 200); }
  }
  render();
  if (before) requestAnimationFrame(() => animate(v.last, before, prev));
}

function capture(last) {
  const r = {};
  if (last.type === "take") r.from = last.ores.map(o => document.querySelector(`.tok[data-ore="${o}"]`)?.getBoundingClientRect());
  if (last.type === "buy" || (last.type === "reserve" && last.id)) r.card = document.querySelector(`[data-card="${last.id}"]`)?.getBoundingClientRect();
  if (last.type === "reserve" && !last.id) r.card = document.querySelector(`.deck[data-level="${last.level}"]`)?.getBoundingClientRect();
  if (last.gold) r.gold = document.querySelector(`.tok[data-ore="gold"]`)?.getBoundingClientRect();
  return r;
}

function targetFor(pid) {
  if (pid === S.me) return document.querySelector(".mine")?.getBoundingClientRect();
  return document.querySelector(`.opp[data-pid="${pid}"]`)?.getBoundingClientRect();
}

function fly(html, from, to, size, delay = 0) {
  if (!from || !to) return;
  const d = document.createElement("div");
  d.className = "fly"; d.innerHTML = html;
  d.style.cssText = `left:${from.left}px;top:${from.top}px;width:${size?.w ?? from.width}px;height:${size?.h ?? from.height}px`;
  document.body.append(d);
  const dx = to.left + to.width / 2 - (from.left + (size?.w ?? from.width) / 2), dy = to.top + to.height / 2 - (from.top + (size?.h ?? from.height) / 2);
  setTimeout(() => { d.style.transform = `translate(${dx}px,${dy}px) scale(.45)`; d.style.opacity = ".2"; }, 30 + delay);
  setTimeout(() => d.remove(), 800 + delay);
}

function animate(last, b, prev) {
  const to = targetFor(last.pid);
  if (last.type === "take") last.ores.forEach((o, i) => fly(`<div style="width:100%;height:100%;border-radius:50%;overflow:hidden">${tokImg(o).replace("<img", '<img style="width:100%;height:100%;object-fit:cover;transform:scale(1.22)"')}</div>`, b.from?.[i], to, null, i * 90));
  if (last.type === "buy" && b.card) { fly(`<div class="dcard" style="--cw:${b.card.width}px;width:100%;height:auto">${cardInner(last.id)}</div>`, b.card, to); sparkle(to, "#f3d48a"); }
  if (last.type === "reserve" && b.card) fly(last.id ? `<div class="dcard" style="--cw:${b.card.width}px;width:100%">${cardInner(last.id)}</div>` : `<img src="art/back${last.level}.webp" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`, b.card, to);
  if (last.gold && b.gold) fly(`<div style="width:100%;height:100%;border-radius:50%;overflow:hidden">${tokImg("gold").replace("<img", '<img style="width:100%;height:100%;object-fit:cover;transform:scale(1.22)"')}</div>`, b.gold, to, null, 150);
  if (last.noble) {
    const nb = E.nobleOf(last.noble);
    setTimeout(() => { banner(`art/${base(last.noble)}@2x.webp`, nb.name, `${nb.title} visits ${nameOf(last.pid)} · +3`); burst(); }, 500);
  }
}

// ---------------------------------------------------------------- particles + banners
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
function emit(n, f) { ensureFx(); for (let i = 0; i < n; i++) parts.push(f(i)); if (!running) { running = true; requestAnimationFrame(tick); } }
function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => ++p.age < p.life);
  for (const p of parts) {
    p.vx *= .985; p.vy = p.vy * .985 + (p.g ?? .05); p.x += p.vx; p.y += p.vy;
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.c;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.age / 8);
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? p.s * .35 : p.s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
function sparkle(r, color) {
  if (!r) return;
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  emit(36, () => { const a = rnd(0, 6.28), s = rnd(1.5, 5); return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, age: 0, life: rnd(30, 55), s: rnd(3, 7), c: color }; });
}
function burst() {
  const cols = ["#f3d48a", "#e8edf4", "#3d73e6", "#25a467", "#d8382d", "#e9b52e"];
  emit(120, i => { const a = rnd(0, 6.28), s = rnd(2, 9); return { x: innerWidth / 2, y: innerHeight * .4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, age: 0, life: rnd(50, 100), s: rnd(4, 9), c: cols[i % 6] }; });
}
function banner(img, title, line) {
  const d = document.createElement("div"); d.className = "fx-banner";
  d.innerHTML = `${img ? `<img src="${img}" alt="">` : ""}<div class="t">${esc(title)}</div>${line ? `<div class="l">${esc(line)}</div>` : ""}`;
  document.body.append(d); setTimeout(() => d.remove(), 2100);
}
function welcome() {
  const words = "Welcome to Dhruv's Vibe Coded Splendor".split(" ");
  const d = document.createElement("div"); d.className = "fx-welcome";
  d.innerHTML = `<div class="wl-fan">${ALL.map((o, i) => `<img src="art/tok-${o}@2x.webp" alt="" style="--i:${i - 2.5}">`).join("")}</div>
    <h1>${words.map((w, i) => `<span style="animation-delay:${.5 + i * .16}s">${w}</span>`).join(" ")}</h1><p>Manifest his greatness and you may win</p><small>Tap to start</small>`;
  document.body.append(d);
  // Always on screen for at least 3 whole seconds; after that a tap skips it.
  const shownAt = Date.now();
  const close = () => { if (Date.now() - shownAt < 3000 || d.classList.contains("out")) return; d.classList.add("out"); setTimeout(() => d.remove(), 500); };
  d.addEventListener("pointerdown", close); setTimeout(close, 5200); setTimeout(burst, 500);
}

// ---------------------------------------------------------------- views
function render() {
  if (dragging) { queued = true; return; }
  const sc = document.querySelector(".scroll")?.scrollTop, sb = document.querySelector(".sheetbody")?.scrollTop;
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
  if (S.mode === "game") sizeCards();
}

const rulesBtn = (cls = "ghost small") => `<button class="btn ${cls}" data-act="rules">Rules</button>`;
const fan = ids => `<div class="fan">${ids.map((id, i) => `<img src="art/${id}.webp" alt="" style="transform:rotate(${(i - (ids.length - 1) / 2) * 10}deg) translateY(${Math.abs(i - (ids.length - 1) / 2) * 8}px)">`).join("")}</div>`;

function viewLanding() {
  return `<div class="page"><div class="hero">${fan(["sil11", "nob06", "cin32", "iro34"])}
      <div class="eyebrow">Games4free · Ore edition</div><h1 class="title">Splendor</h1>
      <p class="muted" style="max-width:40ch;margin:0">Gather ores, build mines and guilds, and win the favour of nobles. 2–6 players; 5–6 play the twin-deck variant.</p></div>
    <form class="panel" data-form="create"><label for="nm" class="eyebrow">Your name</label>
      <div class="row"><input id="nm" type="text" maxlength="18" autocomplete="nickname" placeholder="e.g. Dhruv" value="${esc(room.lastName())}" required><button class="btn" type="submit">Start a game</button></div>
      <div class="err">${esc(S.error)}</div></form>
    <div class="row" style="justify-content:center">${rulesBtn()}<a class="btn ghost small" href="../">All games</a></div></div>`;
}

function viewJoin() {
  const busy = S.mode === "connecting";
  return `<div class="page"><div class="hero">${fan(["tok-silver", "tok-gold", "tok-cinnabar"])}
      <div class="eyebrow">You're invited to a game of</div><h1 class="title">Splendor</h1></div>
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
    <p class="muted" style="margin:0;font-size:15px">Your ores, cards and points come with you. If that seat is open on another device, it moves here.</p><div class="err">${esc(S.error || S.status)}</div></section>
    <div class="row" style="justify-content:center">${rulesBtn()}</div></div>`;
}

function viewLobby() {
  const L = S.lobby; if (!L) return "";
  const host = room.isHost, n = L.players.length, st = E.setupFor(Math.max(2, Math.min(6, n)));
  const link = room.linkFor(L.code);
  return `<div class="page"><div class="hero" style="gap:4px"><div class="eyebrow">Table ${esc(L.code)}</div><h1 class="title" style="font-size:44px">Lobby</h1></div>
    <section class="panel"><div class="eyebrow">Invite players</div>
      <div class="share"><code id="link">${esc(link)}</code><button class="btn small" data-act="share">Share link</button><button class="btn ghost small" data-act="copy">Copy</button></div>
      <p class="muted" style="margin:0;font-size:15px">Anyone with the link types a name and joins. 2–6 players. If someone drops out, the game keeps going and they can rejoin from any device.</p></section>
    <section class="panel"><div class="eyebrow">Players · ${n}/6</div><ul class="plist">${L.players.map((p, i) => `<li><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span style="flex:1">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}${p.id === L.hostId ? " <span class='badge'>HOST</span>" : ""}</span>
      <span class="dot ${p.online ? "" : "off"}"></span>${host && p.id !== S.me ? `<button class="btn ghost small" data-act="kick" data-pid="${p.id}">Remove</button>` : ""}</li>`).join("")}</ul>
      ${n < 2 ? `<p class="muted" style="margin:0">Waiting for at least 1 more player…</p>` : ""}</section>
    <section class="panel"><div class="eyebrow">This table ${n >= 5 ? "· twin-deck variant" : ""}</div>
      <dl class="setup"><dt>Each ore</dt><dd>${st.tokensPer} tokens</dd><dt>Gold</dt><dd>5</dd><dt>Nobles</dt><dd>${st.nobles}</dd>
      <dt>Face-up cards</dt><dd>${st.display[1]} / ${st.display[2]} / ${st.display[3]}</dd><dt>Decks</dt><dd>${st.twin ? "Two full sets (180 cards)" : "One set (90 cards)"}</dd><dt>Win</dt><dd>15 points, then finish the round</dd></dl>
      <div class="row" style="justify-content:space-between"><span>Turn timer</span><span class="seg">${[[30, "30 s"], [60, "1 min"], [120, "2 min"]].map(([v, l]) => `<button aria-pressed="${(L.settings.timer || 60) === v}" ${host ? `data-act="timer" data-v="${v}"` : "disabled"}>${l}</button>`).join("")}</span></div>
      <p class="muted" style="margin:0;font-size:14px">When time runs out, the game makes the best move it can find for that player.</p></section>
    <div class="row" style="justify-content:center">${host ? `<button class="btn" data-act="start" ${n < 2 ? "disabled" : ""}>Start game</button>` : `<span class="muted">Waiting for the host to start…</span>`}${rulesBtn()}</div>
    <div class="err" style="text-align:center">${esc(S.error || S.status)}</div></div>`;
}

function cardInner(id) {
  const c = E.cardOf(id);
  return `<div class="art" style="background-image:${artSet(id)}"></div>
    <div class="top"><span class="pt">${c.points || ""}</span><span class="bonus" style="background:var(--${c.ore})"></span></div>
    <div class="cost">${ORES.filter(o => c.cost[o]).map(o => pip(o, c.cost[o])).join("")}</div>
    <div class="lv">${"<span></span>".repeat(c.level)}</div>`;
}
function cardHtml(id, from) {
  const v = V(), can = myTurn() && v.pay[id]?.ok;
  return `<div class="dcard ${can ? "can" : ""}" data-card="${id}" data-from="${from}" role="button" tabindex="0" aria-label="${esc(E.cardOf(id).scene)}">${cardInner(id)}</div>`;
}

function viewGame() {
  const v = V(), P = me(), lead = leaderOf(v);
  const pop = lead && lead !== ui.leader; ui.leader = lead;
  const order = v.players.map((_, i) => v.players[(v.me + 1 + i) % v.players.length]);
  const opps = order.map(p => {
    const i = seatOf(p.id), turn = v.waiting.includes(p.id), off = S.online[p.id] === false;
    const toks = ALL.reduce((s, o) => s + p.tokens[o], 0);
    return `<div class="opp ${turn ? "turn" : ""} ${p.id === S.me ? "me" : ""}" data-pid="${p.id}" data-act="player">
      ${p.id === lead ? CROWN.replace('class="crown"', `class="crown${pop ? " pop" : ""}"`) : ""}
      <div class="nm"><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span><span class="pn">${p.id === S.me ? "You" : esc(p.name)}</span>${S.bots?.includes(p.id) ? `<span class="badge bot" title="Left the game: a bot is playing">BOT</span>` : off ? `<span class="badge off">OFF</span>` : ""}${turn ? `<span class="tmr" data-tmr="${p.id}"></span>` : ""}<span class="pts">${p.points}</span></div>
      <div class="mini">${ORES.map(o => `<i class="${p.bonuses[o] ? "" : "z"}" style="background:var(--${o})${o === "silver" ? ";color:#20242c;text-shadow:none" : ""}">${p.bonuses[o]}</i>`).join("")}</div>
      <div class="meta"><span>◉ ${toks}/10</span><span>${p.reserved.length ? `▤ ${p.reserved.length}` : ""}</span><span>${p.nobles.length ? `♔ ${p.nobles.length}` : ""}</span></div></div>`;
  }).join("");
  const myB = P.bonuses;
  const nobles = v.nobles.map(id => {
    const nb = E.nobleOf(id), can = Object.entries(nb.req).every(([o, n]) => myB[o] >= n);
    return `<div class="noble ${can ? "can" : ""}" data-act="noble-info" data-id="${id}"><img src="art/${base(id)}.webp" alt="${esc(nb.name)}"><span class="np">3</span>
      <div class="req">${Object.entries(nb.req).map(([o, n]) => pip(o, n)).join("")}</div></div>`;
  }).join("");
  const rows = [3, 2, 1].map(l => `<div class="mrow" data-level="${l}">
      <div class="deck ${v.decks[l] ? "" : "empty"}" data-level="${l}" data-act="deck"><img src="art/back${l}.webp" alt="Level ${l} deck"><b>${v.decks[l]}</b></div>
      ${v.market[l].map(id => (id ? cardHtml(id, "table") : `<div class="slot"></div>`)).join("")}</div>`).join("");
  const turnOn = myTurn();
  const bank = ALL.map(o => {
    const n = v.bank[o], picks = ui.sel.filter(x => x === o).length;
    return `<button class="tok ${picks ? "sel" : ""} ${!n ? "dim" : ""}" data-ore="${o}" data-act="tok" aria-label="${NAME[o]}: ${n} left"><span class="clip">${tokImg(o)}</span><span class="n">${n}</span>${picks ? `<span class="pick">+${picks}</span>` : ""}</button>`;
  }).join("");
  let bar = "";
  if (turnOn) {
    if (ui.sel.length) bar = `<span class="tmr big" data-tmr="${S.me}"></span><button class="btn" data-act="take" ${selValid() ? "" : "disabled"}>Take ${ui.sel.map(o => NAME[o]).join(" + ")}</button><button class="btn ghost small" data-act="clear">Clear</button>`;
    else if (v.canPass) bar = `<button class="btn" data-act="pass">No moves left: pass</button>`;
  }
  const holds = ALL.map(o => `<div class="hold"><span class="chip">${tokImg(o)}</span><span class="t">${P.tokens[o]}</span>${o === "gold" ? `<span class="b">wild</span>` : `<span class="b">+<b>${myB[o]}</b></span>`}</div>`).join("");
  const toks = ALL.reduce((s, o) => s + P.tokens[o], 0);
  const mine = `<div class="mine" id="mine">
    <div class="head"><span class="eyebrow">Your ledger</span><span class="muted" style="font-family:var(--num);font-weight:700;font-size:13px">◉ ${toks}/10</span>
      <span class="mynobles">${P.nobles.map(id => `<img src="art/${base(id)}.webp" alt="">`).join("")}</span><span class="pts">${P.points}<small> pts</small></span></div>
    <div class="holds">${holds}</div>
    <div class="myres"><span class="lab">Reserved</span>${P.reserved.length ? P.reserved.map(r => cardHtml(r.id, "reserved").replace('class="dcard', 'style="--cw:46px" class="dcard')).join("") : `<span class="muted" style="font-size:13px">none — tap a card or deck to reserve (gives a Gold)</span>`}</div></div>`;
  const board = `<div class="sec"><h3>Nobles · 3 points each</h3><div class="nobles">${nobles || `<span class="muted">All nobles have been claimed.</span>`}</div></div>
    <div class="sec"><h3>Market</h3>${rows}</div>
    <div class="sec"><h3>Bank${turnOn ? " · tap to pick" : ""}</h3><div class="bank">${bank}</div></div>
    <div class="actionbar">${bar || `<span class="status ${v.waiting.includes(S.me) ? "you" : ""}">${statusText()}${v.waiting.includes(S.me) ? ` <span class="tmr big" data-tmr="${S.me}"></span>` : ""}</span>`}</div>`;
  return `<div id="table">
    <div class="bar"><div class="info"><span class="rnd"><small>ROUND</small>${v.round}</span>${v.final ? `<span class="finalb">FINAL ROUND</span>` : ""}${S.net ? "" : `<span class="badge off">OFFLINE</span>`}</div>
      <button class="btn ghost small" data-act="leave-ask" aria-label="Leave the game"><span aria-hidden="true">🚪</span><span class="lvt">Leave</span></button><button class="btn ghost small" data-act="scores">Scores</button>${rulesBtn("small")}</div>
    <div class="scroll"><div class="layout"><div class="main">${board}</div><div class="side"><div class="opps">${opps}</div>${mine}</div></div></div></div>`;
}

function statusText() {
  const v = V(), w = v.waiting[0];
  if (v.phase === "gameOver") return "Game over";
  if (v.phase === "discard") return w === S.me ? `Return ${v.pending.n} token${v.pending.n > 1 ? "s" : ""} to stay at 10` : `${esc(nameOf(w))} is returning tokens…`;
  if (v.phase === "noble") return w === S.me ? "Choose which noble visits you" : `${esc(nameOf(w))} is choosing a noble…`;
  return w === S.me ? "Your turn: pick ores, or tap a card to build or reserve" : `${esc(nameOf(w))}'s turn`;
}

// ---------------------------------------------------------------- overlays
const sheet = (title, body, foot = "", lock = false) => `<div class="overlay" ${lock ? "" : `data-act="closebg"`}><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
  <div class="sheethead"><h2>${esc(title)}</h2>${lock ? "" : `<button class="btn ghost small" data-act="close">Close</button>`}</div>${body}${foot}</div></div>`;

function viewOverlay() {
  const v = V();
  let h = "";
  const forced = v && v.waiting.includes(S.me) && (v.phase === "discard" || v.phase === "noble");
  if (forced && v.phase === "discard") h = sheet("Too many tokens", `<div class="sheetbody">${discardBody()}</div>`, "", true);
  else if (forced && v.phase === "noble") h = sheet("A noble visits", `<div class="sheetbody">${nobleChoice()}</div>`, "", true);
  else if (ui.overlay === "leave" && v) h = sheet("Leave the game?", `<div class="sheetbody"><p style="margin-top:0">A bot will play your seat for the rest of this game, so everyone else can finish. Your score stays on the board. Changed your mind? Open the same link and tap <b>This is me</b> to take your seat back.</p><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="leave">Leave the game</button><button class="btn ghost" data-act="close">Stay</button></div></div>`);
  else if (ui.overlay === "rules") h = sheet("Rules", rulesTabs() + `<div class="sheetbody guide">${rulesBody()}</div>`);
  else if (ui.overlay === "card" && v) h = sheet(ui.from === "deck" ? `Level ${ui.card} deck` : "Card", `<div class="sheetbody">${cardDetail()}</div>`);
  else if (ui.overlay === "player" && v) h = sheet(nameOf(ui.player) === "You" ? "Your ledger" : `${nameOf(ui.player)}'s ledger`, `<div class="sheetbody">${playerDetail()}</div>`);
  else if (ui.overlay === "noble" && v) h = sheet("Noble", `<div class="sheetbody">${nobleDetail()}</div>`);
  else if (ui.overlay === "scores" && v) h = sheet("Scores", `<div class="sheetbody">${scoreTable()}</div>`);
  else if (ui.overlay === "over" && v?.phase === "gameOver") h = sheet("Final scores", `<div class="sheetbody">${podium()}</div>`, `<div class="row" style="justify-content:center;padding:6px 16px 16px">${room.isHost ? `<button class="btn" data-act="again">Play again</button>` : `<span class="muted">The host can start a new game.</span>`}</div>`);
  if (ui.zoom) h += `<div class="zoom" data-act="unzoom"><img src="${ui.zoom}" alt=""></div>`;
  return h;
}

function rulesTabs() {
  const t = [["basics", "How to play"], ["actions", "Actions"], ["nobles", "Nobles & winning"], ["setup", "Setup"], ["full", "Full rules"]];
  return `<div class="tabs" role="tablist">${t.map(([k, l]) => `<button role="tab" aria-selected="${ui.tab === k}" data-act="tab" data-k="${k}">${l}</button>`).join("")}</div>`;
}
function rulesBody() {
  const n = V()?.players.length || S.lobby?.players.length || 4;
  if (ui.tab === "setup") return `<h3>Setup by player count</h3>${setupTable(n)}<p class="muted">Highlighted: this table (${n} player${n > 1 ? "s" : ""}).</p>`;
  if (ui.tab === "full") return RULES.full.replace("<!--SETUP-->", setupTable(n));
  return RULES[ui.tab] || RULES.basics;
}

function cardDetail() {
  const v = V(), P = me();
  if (ui.from === "deck") {
    const l = ui.card, can = myTurn() && P.reserved.length < 3 && v.decks[l] > 0;
    return `<div class="detail"><img src="art/back${l}@2x.webp" alt="" style="width:min(40vw,170px);border-radius:12px"><div class="info">
      <h4>Reserve blind</h4><p class="muted" style="margin:0">Take the top level-${l} card without showing it to the others${v.bank.gold ? ", plus 1 Gold" : ""}. ${v.decks[l]} card${v.decks[l] === 1 ? "" : "s"} left.</p>
      <div class="row"><button class="btn" data-act="reserve-deck" data-level="${l}" ${can ? "" : "disabled"}>Reserve top card${v.bank.gold ? " + Gold" : ""}</button></div>
      ${P.reserved.length >= 3 ? `<p class="err" style="margin:0">You already hold 3 reserved cards.</p>` : ""}</div></div>`;
  }
  const id = ui.card, c = E.cardOf(id), pay = v.pay[id];
  const mineRes = P.reserved.some(r => r.id === id);
  const stillThere = mineRes || [1, 2, 3].some(l => v.market[l].includes(id));
  if (!stillThere) return `<p class="muted">That card is no longer on the table.</p>`;
  const payTxt = pay ? ALL.filter(o => pay.pay[o]).map(o => `<span><i style="background:var(--${o})"></i>${pay.pay[o]} ${NAME[o]}</span>`).join("") || "<span>Free with your bonuses!</span>" : "";
  const short = pay && !pay.ok ? ORES.map(o => { const need = Math.max(0, (c.cost[o] || 0) - P.bonuses[o] - P.tokens[o]); return need ? `${need} ${NAME[o]}` : ""; }).filter(Boolean).join(", ") : "";
  const turnOn = myTurn();
  return `<div class="detail"><div class="big"><div class="dcard" style="--cw:min(42vw,190px)">${cardInner(id)}</div></div><div class="info">
    <div class="eyebrow">Level ${c.level} · ${NAME[c.ore]} bonus${c.points ? ` · ${c.points} point${c.points > 1 ? "s" : ""}` : ""}</div>
    <h4>${esc(c.scene[0].toUpperCase() + c.scene.slice(1))}</h4>
    <div class="paylist"><span class="muted" style="font-weight:700">Cost:</span>${ORES.filter(o => c.cost[o]).map(o => `<span><i style="background:var(--${o})"></i>${c.cost[o]}</span>`).join("")}</div>
    ${pay?.ok ? `<div class="paylist"><span class="muted" style="font-weight:700">You pay:</span>${payTxt}</div>` : `<p class="muted" style="margin:0">You still need ${short || "more ores"}.</p>`}
    <div class="row"><button class="btn" data-act="buy" data-id="${id}" ${turnOn && pay?.ok ? "" : "disabled"}>Build it</button>
      ${mineRes ? "" : `<button class="btn ghost" data-act="reserve" data-id="${id}" ${turnOn && P.reserved.length < 3 ? "" : "disabled"}>Reserve${v.bank.gold ? " + Gold" : ""}</button>`}</div>
    ${!turnOn ? `<p class="muted" style="margin:0;font-size:14px">You can act on your turn.</p>` : ""}</div></div>`;
}

function playerDetail() {
  const v = V(), p = v.players.find(x => x.id === ui.player);
  if (!p) return "";
  const res = p.reserved.map(r => (r.hidden && !r.id ? `<img src="art/back${r.level}.webp" style="width:64px;border-radius:8px" alt="Hidden level ${r.level} card">` : `<div class="dcard" style="--cw:64px">${cardInner(r.id)}</div>`)).join("");
  return `<div class="guide"><h3>${p.points} points · ${p.cards.length} cards built</h3>
    <div class="tbl"><table><tr><th>Ore</th>${ALL.map(o => `<th>${NAME[o]}</th>`).join("")}</tr>
    <tr><td>Tokens</td>${ALL.map(o => `<td>${p.tokens[o]}</td>`).join("")}</tr><tr><td>Bonuses</td>${ORES.map(o => `<td>${p.bonuses[o]}</td>`).join("")}<td>–</td></tr></table></div>
    <h3>Reserved</h3><div class="row">${res || `<span class="muted">None</span>`}</div>
    <h3>Nobles</h3><div class="row">${p.nobles.map(id => `<img src="art/${base(id)}.webp" style="width:56px;border-radius:8px" alt="${esc(E.nobleOf(id).name)}">`).join("") || `<span class="muted">None yet</span>`}</div></div>`;
}

function nobleDetail() {
  const nb = E.nobleOf(ui.card), P = me();
  return `<div class="detail"><img src="art/${base(ui.card)}@2x.webp" alt="" style="width:min(42vw,190px);border-radius:12px"><div class="info">
    <div class="eyebrow">Noble · 3 points</div><h4>${esc(nb.name)}</h4><p class="muted" style="margin:0">${esc(nb.title)}</p>
    <div class="paylist"><span class="muted" style="font-weight:700">Visits whoever holds bonuses of:</span>${Object.entries(nb.req).map(([o, n]) => `<span><i style="background:var(--${o})"></i>${n} ${NAME[o]} <span class="muted">(you: ${P.bonuses[o]})</span></span>`).join("")}</div>
    <p class="muted" style="margin:0;font-size:14px">Only built cards count, never tokens. Checked at the end of each turn.</p></div></div>`;
}

function discardBody() {
  const v = V(), P = me(), n = v.pending.n;
  const chosen = ALL.reduce((s, o) => s + (ui.discard[o] || 0), 0);
  return `<p style="margin-top:0">You can hold at most 10 tokens. Choose <b>${n}</b> to return to the bank.</p>
    <div class="discard">${ALL.filter(o => P.tokens[o]).map(o => `<div class="d"><span class="chip">${tokImg(o)}</span><span class="muted" style="font-size:13px">${NAME[o]} · ${P.tokens[o]}</span>
      <div class="ctl"><button data-act="dminus" data-ore="${o}" aria-label="Keep one more ${NAME[o]}">−</button><span>${ui.discard[o] || 0}</span><button data-act="dplus" data-ore="${o}" aria-label="Return one ${NAME[o]}">+</button></div></div>`).join("")}</div>
    <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="discard" ${chosen === n ? "" : "disabled"}>Return ${chosen}/${n}</button></div>`;
}

function nobleChoice() {
  return `<p style="margin-top:0">You qualify for more than one noble. Only one may visit this turn. Choose:</p><div class="row">${V().pending.options.map(id => {
    const nb = E.nobleOf(id);
    return `<button class="btn ghost" data-act="choose-noble" data-id="${id}" style="flex-direction:column;padding:8px"><img src="art/${base(id)}.webp" style="width:90px;border-radius:8px" alt=""><span>${esc(nb.name)}</span></button>`;
  }).join("")}</div>`;
}

function scoreTable() {
  const v = V();
  return `<div class="tbl"><table><tr><th>Player</th><th>Points</th><th>Cards</th><th>Nobles</th><th>Tokens</th><th>Reserved</th></tr>${v.players.slice().sort((a, b) => b.points - a.points || a.cards.length - b.cards.length).map(p =>
    `<tr><td>${esc(nameOf(p.id))}</td><td><b>${p.points}</b></td><td>${p.cards.length}</td><td>${p.nobles.length}</td><td>${ALL.reduce((s, o) => s + p.tokens[o], 0)}</td><td>${p.reserved.length}</td></tr>`).join("")}</table></div>
    <p class="muted" style="font-size:13px">Ties are broken by fewer cards built.</p>`;
}

function podium() {
  const v = V(), r = v.result;
  if (!r) return "";
  const lead = leaderOf(v);
  return `<div class="podium">${r.rows.map((row, i) => `<div class="p ${r.winners.includes(row.pid) ? "win" : ""}"><span class="av" style="background:${SEAT[seatOf(row.pid)]}">${i + 1}</span>
    <span>${esc(nameOf(row.pid))}</span>${row.pid === lead ? CROWN : ""}<span class="muted" style="font-size:13px">${row.cards} cards</span><span class="pts">${row.points}</span></div>`).join("")}</div>`;
}

// ---------------------------------------------------------------- sizing
function sizeCards() {
  const main = document.querySelector(".main"); if (!main) return;
  const w = main.clientWidth;
  const desk = innerWidth >= 860;
  const shortH = innerHeight < 700 && !desk;
  const longest = desk ? Math.max(...Object.values(V()?.settings.display || { 1: 4 })) + 1 : 5;
  const cw = Math.max(52, Math.min(desk ? 118 : 96, (w - longest * 6) / (longest + 0.1), shortH ? 60 : 999));
  document.documentElement.style.setProperty("--cw", cw + "px");
  // Keep things scrolled into view clear of the pinned ledger on phones.
  const sc = document.querySelector(".scroll"), mine = document.getElementById("mine");
  if (sc && mine) sc.style.scrollPaddingBottom = (desk ? 0 : mine.offsetHeight + 10) + "px";
}
addEventListener("resize", () => S.mode === "game" && render());

// ---------------------------------------------------------------- input: taps
$app.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  const cardEl = e.target.closest(".dcard[data-card]");
  if (cardEl && !el?.dataset.act?.startsWith("buy") && !e.target.closest(".overlay")) { openCard(cardEl.dataset.card, cardEl.dataset.from); return; }
  if (!el) return;
  const a = el.dataset.act, v = V();
  switch (a) {
    case "rules": ui.overlay = "rules"; break;
    case "scores": ui.overlay = "scores"; break;
    case "leave-ask": ui.overlay = "leave"; break;
    case "leave": ui.overlay = null; room.leave(); return;
    case "rejoin": room.rejoin(); return;
    case "close": ui.overlay = null; break;
    case "closebg": if (e.target !== el) return; ui.overlay = null; break;
    case "tab": ui.tab = el.dataset.k; break;
    case "unzoom": ui.zoom = null; break;
    case "share": share(); return;
    case "copy": copy(); return;
    case "start": room.start(); return;
    case "kick": room.kick(el.dataset.pid); return;
    case "claim": room.claim(el.dataset.pid); return;
    case "again": ui.overlay = null; room.backToLobby(); return;
    case "timer": room.settings({ timer: +el.dataset.v }); return;
    case "player": ui.player = el.dataset.pid; ui.overlay = "player"; break;
    case "noble-info": ui.card = el.dataset.id; ui.overlay = "noble"; break;
    case "deck": ui.card = +el.dataset.level; ui.from = "deck"; ui.overlay = "card"; break;
    case "tok": tapToken(el.dataset.ore); return;
    case "clear": ui.sel = []; break;
    case "take": if (selValid()) { room.act({ type: "take", ores: ui.sel.slice() }); ui.sel = []; } return;
    case "pass": room.act({ type: "pass" }); return;
    case "buy": ui.overlay = null; room.act({ type: "buy", id: el.dataset.id }); return;
    case "reserve": ui.overlay = null; room.act({ type: "reserve", id: el.dataset.id }); return;
    case "reserve-deck": ui.overlay = null; room.act({ type: "reserve", level: +el.dataset.level }); return;
    case "dplus": { const o = el.dataset.ore, P = me(), tot = ALL.reduce((s, x) => s + (ui.discard[x] || 0), 0); if ((ui.discard[o] || 0) < P.tokens[o] && tot < v.pending.n) ui.discard[o] = (ui.discard[o] || 0) + 1; break; }
    case "dminus": { const o = el.dataset.ore; if (ui.discard[o]) ui.discard[o] -= 1; break; }
    case "discard": room.act({ type: "discard", tokens: { ...ui.discard } }); ui.discard = {}; return;
    case "choose-noble": room.act({ type: "noble", id: el.dataset.id }); return;
    default: return;
  }
  render();
});

function openCard(id, from) { ui.card = id; ui.from = from; ui.overlay = "card"; render(); }

function tapToken(o) {
  const v = V();
  if (o === "gold") return toast("Gold is wild. You get one when you reserve a card.");
  if (!myTurn()) return toast("You can take ores on your turn.");
  if (!v.bank[o]) return toast(`No ${NAME[o]} left in the bank.`);
  const s = ui.sel;
  const double = s.length === 2 && s[0] === s[1];
  if (double && s[0] === o) ui.sel = [];
  else if (s.includes(o)) ui.sel = s.length === 1 && v.bank[o] >= 4 ? [o, o] : s.filter(x => x !== o);
  else if (double) ui.sel = [o];
  else if (s.length < 3) ui.sel = [...s, o];
  else toast("You can take 3 different ores, or 2 of the same.");
  if (s.length === 1 && s[0] === o && v.bank[o] < 4) toast(`Taking 2 ${NAME[o]} needs at least 4 in the bank.`);
  render();
}

$app.addEventListener("change", () => {});
$app.addEventListener("submit", e => {
  e.preventDefault();
  const name = e.target.querySelector("#nm")?.value.trim(); if (!name) return;
  if (e.target.dataset.form === "create") room.create(name);
  if (e.target.dataset.form === "join") room.join(name);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.overlay && !["over"].includes(ui.overlay)) { ui.overlay = null; ui.zoom = null; render(); } });

// ---------------------------------------------------------------- input: drag a card onto your ledger to build it
$app.addEventListener("pointerdown", e => {
  const el = e.target.closest(".dcard[data-card]");
  if (!el || e.target.closest(".overlay") || e.button > 0) return;
  dragging = { el, id: el.dataset.card, x0: e.clientX, y0: e.clientY, moved: false };
});
$app.addEventListener("pointermove", e => {
  const d = dragging; if (!d) return;
  if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 10) return;
  if (!d.moved) {
    if (!myTurn()) { dragging = null; return; }
    d.moved = true; e.preventDefault();
    const r = d.el.getBoundingClientRect(); d.w = r.width; d.h = r.height;
    d.g = document.createElement("div"); d.g.className = "dragghost"; d.g.style.width = r.width + "px";
    d.g.innerHTML = `<div class="dcard" style="--cw:${r.width}px">${d.el.innerHTML}</div>`; document.body.append(d.g);
    d.el.style.opacity = ".3";
  }
  d.g.style.transform = `translate(${e.clientX - d.w / 2}px,${e.clientY - d.h * .6}px) rotate(${Math.max(-10, Math.min(10, (e.clientX - d.x0) / 20))}deg) scale(1.06)`;
  const m = document.getElementById("mine")?.getBoundingClientRect();
  document.getElementById("mine")?.classList.toggle("hot", !!m && e.clientX > m.left && e.clientX < m.right && e.clientY > m.top - 20 && e.clientY < m.bottom);
});
function endDrag(e) {
  const d = dragging; dragging = null; if (!d) return;
  if (d.moved) {
    d.g?.remove(); d.el.style.opacity = "";
    const mineEl = document.getElementById("mine"), m = mineEl?.getBoundingClientRect();
    mineEl?.classList.remove("hot");
    if (m && e.clientX > m.left && e.clientX < m.right && e.clientY > m.top - 20 && e.clientY < m.bottom) {
      if (V().pay[d.id]?.ok) room.act({ type: "buy", id: d.id });
      else openCard(d.id, d.el.dataset.from);
    }
    // swallow the click that follows a drag
    const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
    addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", swallow, { capture: true }), 350);
  }
  if (queued) { queued = false; render(); }
}
$app.addEventListener("pointerup", endDrag);
$app.addEventListener("pointercancel", () => { if (dragging?.g) { dragging.g.remove(); dragging.el.style.opacity = ""; } dragging = null; if (queued) { queued = false; render(); } });

async function share() {
  const url = room.linkFor(S.code);
  if (navigator.share) { try { await navigator.share({ title: "Splendor", text: "Join my game of Splendor:", url }); return; } catch (e) { if (e.name === "AbortError") return; } }
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
    if (el.dataset.tmr === S.me && sec <= 10 && buzzed !== V()?.seq) { buzzed = V()?.seq; navigator.vibrate?.(60); }
  }
}, 250);

// keep phones awake
async function wake() { try { await navigator.wakeLock?.request("screen"); } catch { /* not allowed */ } }
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && S.mode === "game" && wake());

// preload all art so the market never shows blank cards
setTimeout(() => {
  const hi = (devicePixelRatio || 1) > 1 ? "@2x" : "";
  [...DATA.cards.map(c => c.id), ...DATA.nobles.map(n => n.id), ...ALL.map(o => "tok-" + o), "back1", "back2", "back3"]
    .forEach((id, i) => setTimeout(() => { const im = new Image(); im.src = `art/${id}${hi}.webp`; }, i * 12));
}, 1500);

// ---------------------------------------------------------------- boot
(function boot() {
  if (S.code) { const n = room.savedName(); if (n) { wake(); return room.join(n); } S.mode = "join"; }
  render();
})();

window.__lode = { S, room, ui, E };
