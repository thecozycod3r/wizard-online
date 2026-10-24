// Table kit: everything a Table Night game screen has in common — landing, join, rejoin ("Which player are you?"), lobby with
// share link + timer, leave/rejoin, Rules sheet, scores sheet, game-over podium, welcome screen, banners, confetti, flying
// bits, turn chime and timers. A game supplies its engine and its own table view; see 6 Nimmt!, Skull King, Kings Cup,
// Ride the Bus. Engines tag every event they want shown with a growing number (G.last.n), so effects play once per event.
import { createRoom } from "./room.js";
import { againButton, initAgain } from "./again.js";
import { alerts, soundRow, inAppHint } from "./alert.js";
import { hscroll } from "./hscroll.js";
import { preload } from "./preload.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const SEAT = ["#f3d48a", "#7fb0ff", "#5fd39a", "#ff8a73", "#c6a2ff", "#f5a8d6", "#7fe3e0", "#ffc27a", "#b5e36b", "#ff9fb0", "#9fd0ff", "#e0c3ff"];
export const CROWN = `<svg class="crown" viewBox="0 0 30 22" aria-label="Leader"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".55" stop-color="#f2c14e"/><stop offset="1" stop-color="#b7832a"/></linearGradient></defs><path d="M2 7l6.5 5L15 2l6.5 10L28 7l-2.6 12H4.6z" fill="url(#cg)" stroke="#7a5418" stroke-width="1.2" stroke-linejoin="round"/><rect x="4.4" y="17.6" width="21.2" height="3.4" rx="1.2" fill="url(#cg)" stroke="#7a5418" stroke-width="1"/></svg>`;
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function startTable(cfg) {
  const E = cfg.engine, $app = document.getElementById("app");
  const ui = { overlay: null, tab: "basics", shown: null };
  let fxHold = 0;
  const room = createRoom({ letter: cfg.letter,
    prefix: cfg.prefix, engine: E, minPlayers: cfg.min, maxPlayers: cfg.max, defaults: { timer: 30, ...(cfg.defaults || {}) },
    timers: G => (E.pause ? E.pause(G) : null), onUpdate: prev => onUpdate(prev), toast: m => toast(esc(m)),
  });
  const S = room.S;
initAgain(room, `${cfg.path}`);
  const V = () => S.view;
  const me = () => V()?.players[V().me];
  const nameOf = pid => (pid === S.me ? "You" : V()?.players.find(p => p.id === pid)?.name || "?");
  const plainName = pid => V()?.players.find(p => p.id === pid)?.name || "?";
  const myTurn = () => !!V()?.waiting?.includes(S.me);
  const rectOf = sel => document.querySelector(sel)?.getBoundingClientRect();

  let tt;
  function toast(html) {
    document.querySelector(".toast")?.remove();
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.innerHTML = html;
    document.body.append(t); clearTimeout(tt); tt = setTimeout(() => t.remove(), 2600);
  }
  function fly(html, from, to, { w = 40, h = w, delay = 0, rot = 0, cls = "" } = {}) {
    if (!from || !to || still()) return;
    const d = document.createElement("div"); d.className = "fly " + cls; d.innerHTML = html;
    const x0 = from.left + from.width / 2 - w / 2, y0 = from.top + from.height / 2 - h / 2;
    d.style.cssText = `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;opacity:0`;
    document.body.append(d);
    setTimeout(() => { d.style.opacity = "1"; d.style.transform = `translate(${to.left + to.width / 2 - w / 2 - x0}px,${to.top + to.height / 2 - h / 2 - y0}px) rotate(${rot}deg)`; }, 20 + delay);
    setTimeout(() => { d.style.opacity = "0"; }, 560 + delay);
    setTimeout(() => d.remove(), 800 + delay);
  }
  function flash(sel, cls, delay = 0) {
    setTimeout(() => { const el = document.querySelector(sel); if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }, delay);
  }
  function tag(rect, text, cls = "", delay = 0) {
    if (!rect) return;
    setTimeout(() => {
      const d = document.createElement("div"); d.className = "tagfx " + cls; d.textContent = text;
      d.style.left = rect.left + rect.width / 2 + "px"; d.style.top = rect.top + rect.height / 2 + "px";
      document.body.append(d); setTimeout(() => d.remove(), 1500);
    }, delay);
  }
  const fxQ = []; let fxBusy = false;
  function showFx(html, ms = 1800, cls = "") { fxQ.push([html, ms, cls]); fxHold = fxQ.reduce((s, [, m]) => s + m, 0); if (!fxBusy) nextFx(); }
  function nextFx() {
    const it = fxQ.shift();
    if (!it) { fxBusy = false; fxHold = 0; return; }
    fxBusy = true;
    const [html, ms, cls] = it, d = document.createElement("div");
    d.className = "fx-banner " + cls; d.style.animationDuration = ms + "ms"; d.innerHTML = html;
    document.body.append(d);
    if (cls.includes("boom")) shake();
    setTimeout(() => { d.remove(); fxHold = fxQ.reduce((s, [, m]) => s + m, 0); nextFx(); }, ms);
  }
  function shake() { $app.classList.remove("shake"); void $app.offsetWidth; $app.classList.add("shake"); setTimeout(() => $app.classList.remove("shake"), 520); }

  let fxLayer, cx, parts = [], running = false;
  function ensureFx() {
    if (fxLayer) return;
    fxLayer = document.createElement("div"); fxLayer.id = "fx";
    const c = document.createElement("canvas"); fxLayer.append(c); document.body.append(fxLayer);
    cx = c.getContext("2d");
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); c.width = innerWidth * d; c.height = innerHeight * d; c.style.width = innerWidth + "px"; c.style.height = innerHeight + "px"; cx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener("resize", size);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function tick() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => ++p.age < p.life);
    for (const p of parts) {
      p.vx *= .985; p.vy = p.vy * .985 + .06; p.x += p.vx; p.y += p.vy;
      cx.globalAlpha = Math.max(0, 1 - p.age / p.life); cx.fillStyle = p.c;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.age / 7); cx.fillRect(-p.s / 2, -p.s * .75, p.s, p.s * 1.5); cx.restore();
    }
    cx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(tick); else { running = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function burst(cols = cfg.confetti || ["#f2c14e", "#fff1b0", "#7fb0ff", "#ff8a73", "#5fd39a"], x = innerWidth / 2, y = innerHeight * .4, n = 140) {
    if (still()) return;
    ensureFx();
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(2, 10); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, age: 0, life: rnd(60, 110), s: rnd(5, 10), c: cols[i % cols.length] }); }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function welcome() {
    const words = `Welcome to Dhruv's Vibe Coded ${cfg.title}`.split(" ");
    const d = document.createElement("div"); d.className = "fx-welcome";
    const fan = cfg.welcomeFan ? cfg.welcomeFan() : [];
    d.innerHTML = `<div class="wl-fan">${fan.map((a, i) => `<div class="c" style="--i:${i - (fan.length - 1) / 2}">${a}</div>`).join("")}</div>
      <h1>${words.map((w, i) => `<span style="animation-delay:${.5 + i * .16}s">${esc(w)}</span>`).join(" ")}</h1><p>Manifest his greatness and you may win</p><small>Tap to start</small>`;
    document.body.append(d);
    const shownAt = Date.now();
    const close = () => { if (Date.now() - shownAt < 3000 || d.classList.contains("out")) return; d.classList.add("out"); setTimeout(() => d.remove(), 500); };
    d.addEventListener("pointerdown", close); setTimeout(close, 5200); setTimeout(() => burst(), 500);
  }

  const ctx = { S, room, ui, V, me, esc, nameOf, plainName, myTurn, toast, showFx, burst, shake, fly, flash, tag, rectOf, render: () => render(), SEAT, CROWN, cfg, get fxHold() { return fxHold; } };

  // ---------------------------------------------------------------- updates
  function onUpdate(prev) {
    const v = V();
    let fresh = false;
    if (v) {
      const key = v.last ? `${v.gameId}:${v.last.n}` : null;
      fresh = !!(prev && key && key !== ui.shown);
      if (key) ui.shown = key;
      if (fresh && cfg.effect) cfg.effect(v.last, v, prev, ctx);
      if (v.phase === "gameOver" && prev?.phase !== "gameOver") setTimeout(() => { ui.overlay = "over"; render(); burst(); }, fxHold + 900);
      const mineNow = myTurn(), minePrev = prev ? prev.waiting?.includes(S.me) && prev.seq === v.seq : false;
      if (mineNow && !minePrev && !(prev && prev.waiting?.includes(S.me))) alerts.yourTurn();
      document.title = mineNow ? `● Your turn · ${cfg.title}` : `${cfg.title} · Table Night`;
      const wk = cfg.prefix + "welcome-" + v.gameId;
      if (v.gameId && !LS.get(wk)) { LS.set(wk, 1); setTimeout(welcome, 200); }
      cfg.onView?.(v, prev, ctx);
    }
    const before = cfg.snapshot ? cfg.snapshot(ctx) : null;
    render();
    if (fresh && cfg.motion) { const last = v.last; requestAnimationFrame(() => setTimeout(() => cfg.motion(last, v, prev, ctx, before), 0)); }
  }

  // ---------------------------------------------------------------- views
  const HS = hscroll(cfg.hscroll || ".tabs,.tbl,.hand,.opps");
  let hsT = null;
  function render() {
    clearTimeout(hsT);
    if (HS.busy()) { hsT = setTimeout(render, 150); return; }
    const sc = document.querySelector(".scroll")?.scrollTop, sb = document.querySelector(".sheetbody")?.scrollTop, hs = HS.save();
    let h = "";
    if (S.mode === "landing") h = viewLanding();
    else if (S.mode === "join" || S.mode === "connecting") h = viewJoin();
    else if (S.mode === "claim") h = viewClaim();
    else if (S.mode === "left") h = viewLeft();
    else if (S.mode === "lobby") h = viewLobby();
    else if (S.mode === "game") h = cfg.game(ctx);
    h += viewOverlay();
    $app.innerHTML = h;
    if (sc) { const e = document.querySelector(".scroll"); if (e) e.scrollTop = sc; }
    if (sb) { const e = document.querySelector(".sheetbody"); if (e) e.scrollTop = sb; }
    HS.restore(hs);
    cfg.afterRender?.(ctx);
  }
  const rulesBtn = (cls = "ghost small") => `<button class="btn ${cls}" data-act="rules">Rules</button>`;
  ctx.rulesBtn = rulesBtn;
  ctx.topBar = (info = "") => `<div class="bar"><div class="info">${info}${S.net ? "" : `<span class="badge off">OFFLINE</span>`}</div>
      <button class="btn ghost small" data-act="leave-ask" aria-label="Leave the game"><span aria-hidden="true">🚪</span><span class="lvt">Leave</span></button>
      <button class="btn ghost small" data-act="scores" aria-label="Scores"><span class="sci" aria-hidden="true">🏆</span><span class="sct">Scores</span></button>${rulesBtn("small")}</div>`;
  const note = cfg.note ? `<p class="note">${cfg.note}</p>` : "";
  function viewLanding() {
    return `<div class="page">${inAppHint()}<div class="hero">${cfg.hero()}
        <div class="eyebrow">${esc(cfg.eyebrow)}</div><h1 class="title">${esc(cfg.title)}</h1>
        <p class="muted" style="max-width:40ch;margin:0">${cfg.blurb}</p>${note}</div>
      <form class="panel" data-form="create"><label for="nm" class="eyebrow">Your name</label>
        <div class="row"><input id="nm" type="text" maxlength="18" autocomplete="nickname" placeholder="e.g. Dhruv" value="${esc(room.lastName())}" required><button class="btn" type="submit">Start a game</button></div>
        <div class="err">${esc(S.error)}</div></form>
      <div class="row" style="justify-content:center">${rulesBtn()}<a class="btn ghost small" href="../">All games</a></div></div>`;
  }
  function viewJoin() {
    const busy = S.mode === "connecting";
    return `<div class="page">${inAppHint()}<div class="hero">${cfg.hero()}
        <div class="eyebrow">You're invited to a game of</div><h1 class="title">${esc(cfg.title)}</h1>${note}</div>
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
      <p class="muted" style="margin:0;font-size:15px">Your seat comes with you. If it's open on another device, it moves here.</p><div class="err">${esc(S.error || S.status)}</div></section>
      <div class="row" style="justify-content:center">${rulesBtn()}</div></div>`;
  }
  const seg = (key, opts, val, host) => `<span class="seg">${opts.map(([v, l]) => `<button aria-pressed="${val === v}" ${host ? `data-act="set" data-k="${key}" data-v="${v}"` : "disabled"}>${l}</button>`).join("")}</span>`;
  ctx.seg = seg;
  function viewLobby() {
    const L = S.lobby; if (!L) return "";
    const host = room.isHost, n = L.players.length, link = room.linkFor(L.code);
    return `<div class="page"><div class="hero" style="gap:4px"><div class="eyebrow">Room code</div><h1 class="title" style="font-size:52px;letter-spacing:.14em;margin:0">${esc(L.code)}</h1><p class="muted" style="margin:0;font-size:14px;text-align:center">Friends can open <b>${location.host}</b>, tap <b>Join a game</b> and type this code — or use the link below.</p></div>
      <section class="panel"><div class="eyebrow">Invite players</div>
        <div class="share"><code id="link">${esc(link)}</code><button class="btn small" data-act="share">Share link</button><button class="btn ghost small" data-act="copy">Copy</button></div>
        <p class="muted" style="margin:0;font-size:15px">Anyone with the link types a name and joins. ${cfg.min}–${cfg.max} players. If someone drops out, the game keeps going and they can rejoin from any device.</p></section>
      <section class="panel"><div class="eyebrow">Players · ${n}/${cfg.max}</div><ul class="plist">${L.players.map((p, i) => `<li><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
        <span style="flex:1">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}${p.id === L.hostId ? " <span class='badge'>HOST</span>" : ""}</span>
        <span class="dot ${p.online ? "" : "off"}"></span>${host && p.id !== S.me ? `<button class="btn ghost small" data-act="kick" data-pid="${p.id}">Remove</button>` : ""}</li>`).join("")}</ul>
        ${n < cfg.min ? `<p class="muted" style="margin:0">Waiting for ${cfg.min - n} more player${cfg.min - n === 1 ? "" : "s"}…</p>` : ""}</section>
      <section class="panel"><div class="eyebrow">This game</div>${cfg.lobby ? cfg.lobby(L, host, ctx) : ""}
        <div class="row" style="justify-content:space-between"><span>Turn timer</span>${seg("timer", cfg.timers || [[20, "20 s"], [30, "30 s"], [60, "1 min"]], L.settings.timer || 30, host)}</div>
        <p class="muted" style="margin:0;font-size:14px">If someone runs out of time, the game plays for them.</p></section>
      ${soundRow()}
      <div class="row" style="justify-content:center">${host ? `<button class="btn" data-act="start" ${n < cfg.min ? "disabled" : ""}>Start game</button>` : `<span class="muted">Waiting for the host to start…</span>`}${rulesBtn()}</div>
      <div class="err" style="text-align:center">${esc(S.error || S.status)}</div></div>`;
  }
  const sheet = (t, body, foot = "") => `<div class="overlay" data-act="closebg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(t)}">
    <div class="sheethead"><h2>${esc(t)}</h2><button class="btn ghost small" data-act="close">Close</button></div>${body}${foot}</div></div>`;
  ctx.sheet = sheet;
  function viewOverlay() {
    const v = V();
    const extra = cfg.overlay?.(ctx); if (extra) return extra;
    if (ui.overlay === "leave" && v) return sheet("Leave the game?", `<div class="sheetbody"><p style="margin-top:0">A bot will play your seat for the rest of this game, so everyone else can finish. Changed your mind? Open the same link and tap <b>This is me</b> to take your seat back.</p><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="leave">Leave the game</button><button class="btn ghost" data-act="close">Stay</button></div></div>`);
    if (ui.overlay === "rules") {
      // rules may be a function of the table's settings and size (once a game exists, the game's; in the lobby, the lobby's)
      const g = S.mode !== "lobby" && v ? v : null;
      const R = typeof cfg.rules === "function" ? cfg.rules({ ...(cfg.defaults || {}), ...((g ? g.settings : S.lobby?.settings) || {}) }, (g || S.lobby)?.players?.length) : cfg.rules;
      const t = [["basics", "How to play"], ["cards", "Cards"], ["full", "Full rules"]].filter(([k]) => R[k]);
      return sheet("Rules", `<div class="tabs" role="tablist">${t.map(([k, l]) => `<button role="tab" aria-selected="${ui.tab === k}" data-act="tab" data-k="${k}">${l}</button>`).join("")}</div><div class="sheetbody guide">${soundRow()}${R[ui.tab] || R.basics}</div>`);
    }
    if (ui.overlay === "scores" && v) return sheet(cfg.scoresTitle || "Scores", `<div class="sheetbody">${cfg.scores(ctx)}</div>`);
    if (ui.overlay === "over" && v?.phase === "gameOver") return sheet("Game over", `<div class="sheetbody">${cfg.podium(ctx)}</div>`, `<div class="row" style="justify-content:center;padding:6px 16px 16px">${room.isHost ? `<button class="btn" data-act="again">Play again</button>${againButton(true)}` : `<span class="muted">The host can start a new game.</span>`}</div>`);
    return "";
  }

  // ---------------------------------------------------------------- input
  $app.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const a = el.dataset.act;
    if (cfg.onAct && cfg.onAct(a, el, ctx, e) !== undefined) return;
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
      case "set": room.settings({ [el.dataset.k]: isNaN(+el.dataset.v) ? el.dataset.v : +el.dataset.v }); return;
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
    if (navigator.share) { try { await navigator.share({ title: cfg.title, text: `Join my game of ${cfg.title}:`, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
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
  if (cfg.preload) preload(cfg.preload);

  (function boot() {
    if (S.code) { const n = room.savedName(); if (n) { wake(); return room.join(n); } S.mode = "join"; }
    render();
  })();
  window[cfg.hook] = ctx;
  ctx.E = E;
  return ctx;
}
