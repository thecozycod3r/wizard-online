import * as E from "./engine.js";
import { againButton, initAgain } from "../shared/again.js";
import { createRoom } from "../shared/room.js";
import { alerts, soundRow, inAppHint } from "../shared/alert.js";
import { hscroll } from "../shared/hscroll.js";
import { RULES } from "./rules.js";
import { preload } from "../shared/preload.js";
import { GEM, hazard, artifact, TORCH, CAMP, TEMPLE, TREASURE, ALL_ART, artUrl } from "./art.js";

const $app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SEAT = ["#f3d48a", "#7fb0ff", "#5fd39a", "#ff8a73", "#c6a2ff", "#f5a8d6", "#7fe3e0", "#ffc27a"];
const CROWN = `<svg class="crown" viewBox="0 0 30 22" aria-label="Carrying the most"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".55" stop-color="#f2c14e"/><stop offset="1" stop-color="#b7832a"/></linearGradient></defs><path d="M2 7l6.5 5L15 2l6.5 10L28 7l-2.6 12H4.6z" fill="url(#cg)" stroke="#7a5418" stroke-width="1.2" stroke-linejoin="round"/><rect x="4.4" y="17.6" width="21.2" height="3.4" rx="1.2" fill="url(#cg)" stroke="#7a5418" stroke-width="1"/></svg>`;
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };

const ui = { overlay: null, tab: "basics", shownLast: null, dealt: new Set(), dealtRound: 0 };
let fxHold = 0;

const room = createRoom({ letter: "I",
  prefix: "inc-", engine: E, minPlayers: 3, maxPlayers: 8, defaults: { timer: 30 }, timers: G => E.pause(G),
  onUpdate: prev => onUpdate(prev), toast: m => toast(esc(m)),
});
const S = room.S;
initAgain(room, "incan");

// ---------------------------------------------------------------- helpers
const V = () => S.view;
const me = () => V()?.players[V().me];
const nameOf = pid => (pid === S.me ? "You" : V()?.players.find(p => p.id === pid)?.name || "?");
const plainName = pid => V()?.players.find(p => p.id === pid)?.name || "?";
const waitingMe = () => V()?.waiting.includes(S.me);
function carrier(v) {
  const max = Math.max(...v.players.map(p => p.carry));
  const top = v.players.filter(p => p.carry === max && p.inside);
  return top.length === 1 && max > 0 ? top[0].id : null;
}

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
    // seq also ticks when a single player chooses; only a new turn/round result (a new `last`) gets effects
    const key = v.last ? JSON.stringify([v.gameId, v.last.kind, v.last.round, v.round, v.path.length, v.phase, v.last.leavers || null]) : null;
    ui.fresh = !!(prev && key && key !== ui.shownLast && (v.last.kind === "round" ? prev.round !== v.round : true));
    if (ui.fresh) effect(v.last, v, prev);
    if (key) ui.shownLast = key;
    if (v.phase === "gameOver" && prev?.phase !== "gameOver") setTimeout(() => { ui.overlay = "over"; render(); burst(); }, fxHold + 400);
    const mineNow = waitingMe();
    const minePrev = prev ? prev.waiting.includes(S.me) && prev.path.length === v.path.length && prev.round === v.round : false;
    if (mineNow && !minePrev) alerts.yourTurn();
    document.title = mineNow ? "● Your move · Incan Gold" : "Incan Gold · Table Night";
    const wk = "inc-welcome-" + v.gameId;
    if (v.gameId && v.round === 1 && !LS.get(wk)) { LS.set(wk, 1); setTimeout(welcome, 200); }
  }
  render();
  if (ui.fresh && v?.last) { const last = v.last, wait = fxHold; requestAnimationFrame(() => setTimeout(() => motion(last, v, prev), wait)); }
}

// ---------------------------------------------------------------- motion on the table
const rectOf = sel => document.querySelector(sel)?.getBoundingClientRect();
// an explorer's chip, only while it's actually visible in the scrolling table (not hidden under the dock or the top bar)
function chip(pid) {
  const r = rectOf(`.ex[data-pid="${pid}"]`), box = rectOf(".scroll");
  if (!r || !box) return r;
  return r.top >= box.top - 4 && r.bottom <= box.bottom + 4 ? r : null;
}
function fly(html, from, to, size = 22, delay = 0) {
  if (!from || !to) return;
  const d = document.createElement("div"); d.className = "fly"; d.innerHTML = html;
  const x0 = from.left + from.width / 2 - size / 2 + (Math.random() - .5) * 14, y0 = from.top + from.height / 2 - size / 2;
  d.style.cssText = `left:${x0}px;top:${y0}px;width:${size}px;height:${size}px;opacity:0`;
  document.body.append(d);
  setTimeout(() => {
    d.style.opacity = "1";
    d.style.transform = `translate(${to.left + to.width / 2 - size / 2 - x0}px,${to.top + to.height / 2 - size / 2 - y0}px) scale(.8)`;
  }, 30 + delay);
  setTimeout(() => { d.style.opacity = "0"; }, 650 + delay);
  setTimeout(() => d.remove(), 900 + delay);
}
function flash(sel, cls, delay = 0) {
  setTimeout(() => { const el = document.querySelector(sel); if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }, delay);
}
function badge(pid, icon, delay = 0) {
  const r = chip(pid); if (!r) return;
  setTimeout(() => {
    const d = document.createElement("div"); d.className = "badgefx"; d.innerHTML = icon;
    d.style.left = r.left + r.width - 40 + "px"; d.style.top = r.top - 14 + "px";
    document.body.append(d); setTimeout(() => d.remove(), 1300);
  }, delay);
}
function motion(last, v) {
  if (S.mode !== "game") return;
  const path = rectOf("#path"), gemIcon = GEM.turq;
  // everyone's Torch / Camp pops up over their name
  if (last.kind === "turn") Object.entries(last.choices).forEach(([pid, go], i) => badge(pid, go ? TORCH : CAMP, i * 60));
  // campers carry their gems home: from the path to them, then (for me) into my tent
  for (const [i, pid] of (last.leavers || []).entries()) {
    const n = Math.min(6, Math.max(1, last.split?.carried?.[pid] || 0));
    for (let k = 0; k < n; k++) fly(gemIcon, path, chip(pid), 20, 300 + i * 120 + k * 70);
    flash(`.ex[data-pid="${pid}"]`, "glow", 500 + i * 120);
    if (pid === S.me) for (let k = 0; k < n; k++) fly(gemIcon, chip(pid), rectOf(".mine"), 20, 900 + k * 70);
  }
  for (const a of last.artifacts || []) fly(artifact(a.id), path, chip(last.leavers[0]), 40, 350);
  // new cards: treasure is shared out — gems fly from the card to everyone inside
  let t = (last.leavers || []).length ? 900 : 200;
  for (const c of last.cards || []) {
    const card = E.cardOf(c.id), from = rectOf(`.pc[data-id="${c.id}"]`);
    if (card.kind === "treasure" && from) setTimeout(() => burstAt(from.left + from.width / 2, from.top + from.height / 2, 26, ["#2ec4b6", "#8ff3e6", "#f2c14e", "#ffe39a"]), t + 150);
    if (card.kind === "treasure" && c.each) {
      c.to.forEach((pid, i) => { for (let k = 0; k < Math.min(4, c.each); k++) fly(gemIcon, from, chip(pid), 18, t + i * 90 + k * 60); flash(`.ex[data-pid="${pid}"] .carry`, "pop", t + 700 + i * 90); });
    }
    if (card.kind === "hazard" && !c.disaster) { flash(`.hz [data-hz="${card.hazard}"]`, "pop", t); flash(`.hz [data-hz="${card.hazard}"]`, "glow", t); }
    if (card.kind === "artifact") flash(`.pc[data-id="${c.id}"]`, "glow", t);
    if (c.disaster) { Object.keys(c.disaster.lost).forEach(pid => flash(`.ex[data-pid="${pid}"]`, "hurt", 0)); vignette(); }
    t += 450;
  }
}

function cardHtml(id, left = 0, extra = "") {
  const c = E.cardOf(id);
  // a treasure card shows only what's still lying on it (the pot), not its face value
  if (c.kind === "treasure") return `<div class="pc t ${left ? "" : "empty"} ${extra}" data-id="${id}">${TREASURE}${left ? `<span class="v">${left}</span>` : ""}</div>`;
  if (c.kind === "hazard") return `<div class="pc h ${extra}" data-id="${id}">${hazard(c.hazard)}</div>`;
  return `<div class="pc a ${extra}" data-id="${id}">${artifact(id)}</div>`;
}

function effect(last, v, prev) {
  if (last.kind === "turn") {
    const order = Object.keys(last.choices);
    let html = `<div class="t" style="font-size:clamp(22px,6vw,32px)">${last.leavers.length === 1 ? `${esc(nameOf(last.leavers[0]))} ${last.leavers[0] === S.me ? "head" : "heads"} back to camp` : last.leavers.length ? `${last.leavers.length} head back to camp` : "Everyone pushes on"}</div>
      <div class="choices">${order.map((pid, i) => `<div class="c" style="animation-delay:${i * .07}s"><div class="i">${last.choices[pid] ? TORCH : CAMP}</div><span>${esc(nameOf(pid))}</span></div>`).join("")}</div>`;
    if (last.split?.each) html += `<div class="l">Each camper also picks up ${last.split.each} from the path</div>`;
    if (last.artifacts?.length) html += `<div class="l">${esc(nameOf(last.leavers[0]))} ${last.leavers[0] === S.me ? "grab" : "grabs"} ${last.artifacts.length === 1 ? "an artifact" : last.artifacts.length + " artifacts"} (+${last.artifacts.reduce((s, a) => s + a.value, 0)})!</div>`;
    if (last.leavers.length) showFx(html, 2400);
  }
  if (last.kind === "round" && prev) showFx(`<div class="img gate">${TEMPLE}</div><div class="t">Temple ${last.round}</div><div class="l">The ${esc(E.artifactOf(last.artifact).name)} is rumoured to be inside</div>`, 2200);
  for (const c of last.cards || []) {
    const card = E.cardOf(c.id);
    if (c.disaster) {
      const lost = Object.entries(c.disaster.lost).filter(([, n]) => n > 0);
      showFx(`<div class="bigcard">${cardHtml(c.id, 0, "deadly")}</div><div class="t">${esc(E.HAZARD_NAME[c.disaster.hazard])}!</div>
        <div class="l">${Object.keys(c.disaster.lost).length ? `${esc(Object.keys(c.disaster.lost).map(nameOf).join(", "))} flee${lost.length ? " and lose " + lost.map(([p, n]) => `${esc(nameOf(p))} ${n}`).join(", ") : ""}` : "The temple collapses"}</div>`, 3000);
      setTimeout(shake, fxHold - 2600);
    }
  }
  if (last.end && !last.end.disaster && v.phase !== "gameOver" && last.kind === "turn") showFx(`<div class="t">Everyone's back at camp</div><div class="l">Next temple in a moment…</div>`, 1600);
}
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
    ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(p.s * .8, 0); ctx.lineTo(0, p.s); ctx.lineTo(-p.s * .8, 0); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
function burst(cols = ["#2ec4b6", "#f2c14e", "#ffe39a", "#8ff3e6", "#3a3a48"]) {
  ensureFx();
  for (let i = 0; i < 120; i++) { const a = rnd(0, 6.28), s = rnd(2, 9); parts.push({ x: innerWidth / 2, y: innerHeight * .4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, age: 0, life: rnd(50, 100), s: rnd(4, 9), c: cols[i % cols.length] }); }
  if (!running) { running = true; requestAnimationFrame(tick); }
}
function burstAt(x, y, n = 30, cols) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  ensureFx();
  for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(1.5, 5); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2.5, age: 0, life: rnd(30, 60), s: rnd(2.5, 5), c: cols[i % cols.length] }); }
  if (!running) { running = true; requestAnimationFrame(tick); }
}
function vignette() {
  const d = document.createElement("div"); d.className = "vign"; document.body.append(d); setTimeout(() => d.remove(), 1600);
}
function welcome() {
  const words = "Welcome to Dhruv's Vibe Coded Incan Gold".split(" ");
  const d = document.createElement("div"); d.className = "fx-welcome";
  const fanArt = [artifact("a1"), hazard("snakes"), artifact("a3"), hazard("fire"), artifact("a4"), TORCH];
  d.innerHTML = `<div class="wl-fan">${fanArt.map((a, i) => `<div class="c" style="--i:${i - 2.5}">${a}</div>`).join("")}</div>
    <h1>${words.map((w, i) => `<span style="animation-delay:${.5 + i * .16}s">${w}</span>`).join(" ")}</h1><p>Manifest his greatness and you may win</p><small>Tap to start</small>`;
  document.body.append(d);
  const shownAt = Date.now();
  const close = () => { if (Date.now() - shownAt < 3000 || d.classList.contains("out")) return; d.classList.add("out"); setTimeout(() => d.remove(), 500); };
  d.addEventListener("pointerdown", close); setTimeout(close, 5200); setTimeout(() => burst(), 500);
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
  if (S.mode === "game") sizePath();
}

const rulesBtn = (cls = "ghost small") => `<button class="btn ${cls}" data-act="rules">Rules</button>`;
const fan = arts => `<div class="fan">${arts.map((a, i) => `<div class="c" style="transform:rotate(${(i - (arts.length - 1) / 2) * 10}deg) translateY(${Math.abs(i - (arts.length - 1) / 2) * 8}px)">${a}</div>`).join("")}</div>`;

function viewLanding() {
  return `<div class="page">${inAppHint()}<div class="hero">${fan([artifact("a1"), TEMPLE, artifact("a4")])}
      <div class="eyebrow">Table Night · Push your luck</div><h1 class="title">Incan Gold</h1>
      <p class="muted" style="max-width:40ch;margin:0">Explore five temples for gold. Every turn: go deeper, or run back to camp with your treasure — before the spiders, snakes and mummies get you. 3–8 players.</p></div>
    <form class="panel" data-form="create"><label for="nm" class="eyebrow">Your name</label>
      <div class="row"><input id="nm" type="text" maxlength="18" autocomplete="nickname" placeholder="e.g. Dhruv" value="${esc(room.lastName())}" required><button class="btn" type="submit">Start a game</button></div>
      <div class="err">${esc(S.error)}</div></form>
    <div class="row" style="justify-content:center">${rulesBtn()}<a class="btn ghost small" href="../">All games</a></div></div>`;
}
function viewJoin() {
  const busy = S.mode === "connecting";
  return `<div class="page">${inAppHint()}<div class="hero">${fan([hazard("spiders"), artifact("a3"), hazard("mummies")])}
      <div class="eyebrow">You're invited to a game of</div><h1 class="title">Incan Gold</h1></div>
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
    <p class="muted" style="margin:0;font-size:15px">Your tent, gems and artifacts come with you. If that seat is open on another device, it moves here.</p><div class="err">${esc(S.error || S.status)}</div></section>
    <div class="row" style="justify-content:center">${rulesBtn()}</div></div>`;
}
function viewLobby() {
  const L = S.lobby; if (!L) return "";
  const host = room.isHost, n = L.players.length, link = room.linkFor(L.code);
  return `<div class="page"><div class="hero" style="gap:4px"><div class="eyebrow">Room code</div><h1 class="title" style="font-size:52px;letter-spacing:.14em;margin:0">${esc(L.code)}</h1><p class="muted" style="margin:0;font-size:14px;text-align:center">Friends can open <b>${location.host}</b>, tap <b>Join a game</b> and type this code — or use the link below.</p></div>
    <section class="panel"><div class="eyebrow">Invite players</div>
      <div class="share"><code id="link">${esc(link)}</code><button class="btn small" data-act="share">Share link</button><button class="btn ghost small" data-act="copy">Copy</button></div>
      <p class="muted" style="margin:0;font-size:15px">Anyone with the link types a name and joins. 3–8 players. If someone drops out, the game keeps going and they can rejoin from any device.</p></section>
    <section class="panel"><div class="eyebrow">Players · ${n}/8</div><ul class="plist">${L.players.map((p, i) => `<li><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span style="flex:1">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}${p.id === L.hostId ? " <span class='badge'>HOST</span>" : ""}</span>
      <span class="dot ${p.online ? "" : "off"}"></span>${host && p.id !== S.me ? `<button class="btn ghost small" data-act="kick" data-pid="${p.id}">Remove</button>` : ""}</li>`).join("")}</ul>
      ${n < 3 ? `<p class="muted" style="margin:0">Waiting for ${3 - n} more player${3 - n === 1 ? "" : "s"}… (Incan Gold needs at least 3)</p>` : ""}</section>
    <section class="panel"><div class="eyebrow">This expedition</div>
      <dl class="setup"><dt>Temples</dt><dd>5</dd><dt>Treasure cards</dt><dd>15 (1 to 17 gems)</dd><dt>Hazards</dt><dd>3 each of spiders, snakes, mummies, fire, rockfall</dd><dt>Artifacts</dt><dd>One more each temple · 5 or 10 points</dd></dl>
      <div class="row" style="justify-content:space-between"><span>Turn timer</span><span class="seg">${[[20, "20 s"], [30, "30 s"], [60, "1 min"]].map(([v, l]) => `<button aria-pressed="${(L.settings.timer || 30) === v}" ${host ? `data-act="timer" data-v="${v}"` : "disabled"}>${l}</button>`).join("")}</span></div>
      <p class="muted" style="margin:0;font-size:14px">If someone runs out of time, the game decides for them, weighing the danger against what they'd lose.</p></section>
    ${soundRow()}
    <div class="row" style="justify-content:center">${host ? `<button class="btn" data-act="start" ${n < 3 ? "disabled" : ""}>Start game</button>` : `<span class="muted">Waiting for the host to start…</span>`}${rulesBtn()}</div>
    <div class="err" style="text-align:center">${esc(S.error || S.status)}</div></div>`;
}

function viewGame() {
  const v = V(), P = me(), lead = carrier(v);
  const hz = E.HAZARDS.map(h => `<div class="h ${v.seen[h] ? "warn" : ""}" data-hz="${h}" title="${E.HAZARD_NAME[h]}">${hazard(h)}<small>${v.seen[h] ? "1 out!" : "safe"}</small>${v.gone[h] ? `<span class="gone">−${v.gone[h]}</span>` : ""}</div>`).join("");
  // a card gets the deal animation once, the first time it shows up on this phone
  if (ui.dealtRound !== `${v.gameId}.${v.round}`) { ui.dealtRound = `${v.gameId}.${v.round}`; ui.dealt = new Set(); }
  const pot = v.path.reduce((s, x) => s + x.left, 0);
  const path = `<div class="pc temple">${TEMPLE}</div>` + v.path.map((s, i) => {
    const fresh = !ui.dealt.has(s.id); ui.dealt.add(s.id);
    return cardHtml(s.id, s.left, fresh ? "new" : "");
  }).join("");
  const ex = v.players.map((p, i) => {
    const out = !p.inside, bot = S.bots?.includes(p.id), off = !S.online[p.id] && p.id !== S.me;
    const sub = v.phase === "gameOver" ? `${p.points} points` : out ? "at camp" : v.phase === "decide" ? (p.decided ? "decided" : "deciding…") : "in the temple";
    return `<div class="ex ${out ? "out" : ""} ${p.id === S.me ? "me" : ""}" data-pid="${p.id}">${p.id === lead ? CROWN : ""}${v.phase === "decide" && p.decided && p.inside ? `<span class="dec">READY</span>` : ""}
      <span class="st">${out ? CAMP : TORCH}</span><span class="nm">${esc(p.name)}${p.id === S.me ? " <span class='muted' style='font-weight:700'>(you)</span>" : ""}<span class="sub"><b class="pts">⛺${p.points ?? 0}</b> · ${esc(sub)}${bot ? "" : off ? " · away" : ""} <span class="tmr" data-tmr="${p.id}"></span></span></span>
      ${bot ? `<span class="badge bot">BOT</span>` : ""}<span class="arts">${p.artifacts.map(a => artifact(a.id)).join("")}</span>${p.inside && p.carry ? `<span class="carry">${p.carry}<i class="gem">${GEM.turq}</i></span>` : ""}</div>`;
  }).join("");
  return `<div id="table">
    <div class="bar"><div class="info"><span class="rnd"><small>TEMPLE</small>${v.round} of ${v.rounds}</span>${S.net ? "" : `<span class="badge off">OFFLINE</span>`}</div>
      <button class="btn ghost small" data-act="leave-ask" aria-label="Leave the game"><span aria-hidden="true">🚪</span><span class="lvt">Leave</span></button>
      <button class="btn ghost small" data-act="scores" aria-label="Scores"><span class="sci" aria-hidden="true">🏆</span><span class="sct">Scores</span></button>${rulesBtn("small")}</div>
    <div class="scroll"><div class="hz">${hz}</div>
      ${pot ? `<div class="pot">Pot on the path: <b>${pot}</b> gem${pot === 1 ? "" : "s"} <span class="muted">· split by whoever heads back</span></div>` : ""}
      <div class="path" id="path">${path}</div>
      <div class="exp">${ex}</div></div>
    ${dock(v, P)}</div>`;
}

function dock(v, P) {
  const timer = waitingMe() ? ` <span class="tmr big" data-tmr="${S.me}"></span>` : "";
  const mine = P ? `<div class="mine"><span>Carrying <b>${P.carry}</b></span><span>Tent <b>${P.tent ?? "?"}</b></span><span>Artifacts <b>${P.artifacts.length}</b></span></div>` : "";
  let status = "", actions = "";
  const left = v.path.reduce((s, x) => s + x.left, 0);
  if (v.phase === "decide") {
    if (waitingMe()) {
      status = `Go deeper, or head back${P.carry ? ` with ${P.carry}` : ""}${left ? ` (+ a share of ${left} on the path)` : ""}?`;
      actions = `<button class="choice torch" data-act="choose" data-go="1">${TORCH}Torch<small>go deeper</small></button><button class="choice camp" data-act="choose" data-go="0">${CAMP}Camp<small>bank it</small></button>`;
    } else if (P?.inside) status = `You chose ${v.myChoice ? "the torch" : "camp"} · waiting for ${v.waiting.length} more`;
    else status = `You're safe at camp · ${v.players.filter(p => p.inside).length} still exploring`;
  } else if (v.phase === "roundOver") status = `Temple ${v.round} is over · the next one opens in a moment`;
  else if (v.phase === "gameOver") {
    const w = v.result.winners;
    status = w.includes(S.me) ? "You win!" : `${esc(w.map(plainName).join(" & "))} win${w.length === 1 ? "s" : ""}`;
    actions = `<button class="btn big" data-act="over">See the tents</button>`;
  }
  return `<div class="dock" id="dock"><div class="dockhead"><span class="status ${waitingMe() ? "you" : ""}">${status}${timer}</span></div>${mine}${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
}

function sizePath() {
  const p = document.getElementById("path"); if (!p) return;
  const n = p.children.length, w = p.clientWidth, per = Math.max(5, Math.min(n, Math.floor(w / 58)));
  const pw = Math.max(46, Math.min(innerWidth >= 700 ? 82 : 66, (w - (per - 1) * 6) / per));
  p.style.setProperty("--pw", pw + "px");
}

// ---------------------------------------------------------------- overlays
const sheet = (title, body, foot = "") => `<div class="overlay" data-act="closebg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
  <div class="sheethead"><h2>${esc(title)}</h2><button class="btn ghost small" data-act="close">Close</button></div>${body}${foot}</div></div>`;
function viewOverlay() {
  const v = V();
  if (ui.overlay === "leave" && v) return sheet("Leave the game?", `<div class="sheetbody"><p style="margin-top:0">A bot will play your seat for the rest of this game, so everyone else can finish. Changed your mind? Open the same link and tap <b>This is me</b> to take your seat back.</p><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="leave">Leave the game</button><button class="btn ghost" data-act="close">Stay</button></div></div>`);
  if (ui.overlay === "rules") return sheet("Rules", rulesTabs() + `<div class="sheetbody guide">${soundRow()}${RULES[ui.tab] || RULES.basics}</div>`);
  if (ui.overlay === "scores" && v) return sheet("Explorers", `<div class="sheetbody">${scores()}</div>`);
  if (ui.overlay === "over" && v?.phase === "gameOver") return sheet("The tents are opened", `<div class="sheetbody">${podium()}</div>`, `<div class="row" style="justify-content:center;padding:6px 16px 16px">${room.isHost ? `<button class="btn" data-act="again">Play again</button>${againButton(true)}` : `<span class="muted">The host can start a new game.</span>`}</div>`);
  return "";
}
function rulesTabs() {
  const t = [["basics", "How to play"], ["cards", "Cards"], ["full", "Full rules"]];
  return `<div class="tabs" role="tablist">${t.map(([k, l]) => `<button role="tab" aria-selected="${ui.tab === k}" data-act="tab" data-k="${k}">${l}</button>`).join("")}</div>`;
}
function scores() {
  const v = V();
  return `<div class="tbl"><table><tr><th>Explorer</th><th>Carrying</th><th>Tent</th><th>Artifacts</th><th>Points</th></tr>${v.players.slice().sort((a, b) => b.points - a.points).map(p => `<tr><td>${esc(nameOf(p.id))}</td><td>${p.inside ? p.carry : "–"}</td><td>${p.tent}</td><td>${p.artifacts.length ? p.artifacts.map(a => a.value).join(" + ") : "–"}</td><td><b>${p.points}</b></td></tr>`).join("")}</table></div>
    <p class="muted" style="font-size:13px">Tent = gems banked at camp; Points = tent plus artifacts. Artifacts: the first three out score 5, later ones 10 (${v.artifactsOut} out so far).</p>`;
}
function podium() {
  const v = V(), r = v.result;
  return `<div class="hist">${r.rows.map((row, i) => { const p = v.players.find(x => x.id === row.pid); return `<div class="h" style="flex-direction:row;align-items:center;gap:10px;${r.winners.includes(row.pid) ? "border:1px solid var(--gold);background:linear-gradient(90deg,rgba(242,193,78,.25),var(--bg2))" : ""}">
      <span class="av" style="background:${SEAT[v.players.indexOf(p)]}">${i + 1}</span><b style="flex:1">${esc(nameOf(row.pid))}</b>${r.winners.includes(row.pid) ? CROWN : ""}
      <span class="arts" style="display:flex;gap:2px">${p.artifacts.map(a => `<span style="width:22px;display:inline-block">${artifact(a.id)}</span>`).join("")}</span><b style="font-size:20px">${row.points}</b></div>`; }).join("")}</div>`;
}

// ---------------------------------------------------------------- input
$app.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act;
  switch (a) {
    case "sound": alerts.toggle(); break;
    case "rules": ui.overlay = "rules"; break;
    case "scores": ui.overlay = "scores"; break;
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
    case "choose": {
      const go = el.dataset.go === "1";
      el.classList.add("chosen"); el.parentElement.classList.add("picked");
      const r = el.getBoundingClientRect();
      burstAt(r.left + r.width / 2, r.top + r.height / 3, go ? 34 : 20, go ? ["#ff7a1a", "#ffd44d", "#fff1b0"] : ["#c9a06a", "#f2c14e", "#fff"]);
      setTimeout(() => room.act({ type: "choose", go }), 220);
      return;
    }
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
  if (navigator.share) { try { await navigator.share({ title: "Incan Gold", text: "Join my game of Incan Gold:", url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  copy();
}
async function copy() {
  try { await navigator.clipboard.writeText(room.linkFor(S.code)); toast("Link copied"); }
  catch { const c = document.getElementById("link"); if (c) { const r = document.createRange(); r.selectNodeContents(c); getSelection().removeAllRanges(); getSelection().addRange(r); } toast("Select the link and copy it"); }
}

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

preload(ALL_ART.map(id => artUrl(id, devicePixelRatio > 1.5)));

(function boot() {
  if (S.code) { const n = room.savedName(); if (n) { wake(); return room.join(n); } S.mode = "join"; }
  render();
})();

window.__inc = { S, room, ui, E };
