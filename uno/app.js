// Shared phone UI for UNO Flip and UNO No Mercy. Each game's page calls start({ variant, ... }).
import * as E from "./engine.js";
import { againButton, initAgain } from "../shared/again.js";
import { createRoom } from "../shared/room.js";
import { alerts, soundRow, inAppHint } from "../shared/alert.js";
import { hscroll } from "../shared/hscroll.js";
import { preload } from "../shared/preload.js";
import { cardHtml, cardSvg, backHtml, HEX } from "./cards.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SEAT = ["#f3d48a", "#7fb0ff", "#5fd39a", "#ff8a73", "#c6a2ff", "#f5a8d6", "#7fe3e0", "#ffc27a", "#b5e36b", "#ff9fb0"];
const CROWN = `<svg class="crown" viewBox="0 0 30 22" aria-label="Leader"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".55" stop-color="#f2c14e"/><stop offset="1" stop-color="#b7832a"/></linearGradient></defs><path d="M2 7l6.5 5L15 2l6.5 10L28 7l-2.6 12H4.6z" fill="url(#cg)" stroke="#7a5418" stroke-width="1.2" stroke-linejoin="round"/><rect x="4.4" y="17.6" width="21.2" height="3.4" rx="1.2" fill="url(#cg)" stroke="#7a5418" stroke-width="1"/></svg>`;
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };
const ORDER = { r: 0, y: 1, g: 2, b: 3, o: 0, p: 1, t: 2, v: 3, w: 9 };
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function start(cfg) {
  const { variant, title, eyebrow, blurb, prefix } = cfg;
  const V = E.VARIANTS[variant];
  const $app = document.getElementById("app");
  const ui = { overlay: null, tab: "basics", pick: null, uno: false, shownLast: null };
  let fxHold = 0;

  const room = createRoom({ letter: variant === "flip" ? "F" : "N",
    prefix, engine: E, minPlayers: V.min, maxPlayers: V.max, defaults: { timer: 30, variant, target: variant === "flip" ? 0 : 0 }, timers: G => E.pause(G),
    onUpdate: prev => onUpdate(prev), toast: m => toast(esc(m)),
  });
  const S = room.S;
initAgain(room, `${variant === "flip" ? "unoflip" : "nomercy"}`);
  const Vw = () => S.view;
  const nameOf = pid => (pid === S.me ? "You" : Vw()?.players.find(p => p.id === pid)?.name || "?");
  const plainName = pid => Vw()?.players.find(p => p.id === pid)?.name || "?";
  const myTurn = () => Vw()?.waiting.includes(S.me);
  const cname = c => E.COLOR_NAME[c] || "";
  const kname = f => (/^\d$/.test(f.k) ? `${cname(f.c)} ${f.k}` : `${f.c === "w" ? "" : cname(f.c) + " "}${E.KIND_NAME[f.k]}`);

  let tt;
  function toast(html) {
    document.querySelector(".toast")?.remove();
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.innerHTML = html;
    document.body.append(t); clearTimeout(tt); tt = setTimeout(() => t.remove(), 2600);
  }

  // ---------------------------------------------------------------- update + effects
  function onUpdate(prev) {
    const v = Vw();
    if (v) {
      document.body.classList.toggle("darkside", v.side === "dark");
      const key = v.last ? JSON.stringify([v.round, v.seq]) : null;
      if (prev && key && v.seq !== prev.seq && key !== ui.shownLast) effect(v.last, v, prev);
      if (key) ui.shownLast = key;
      if (v.phase === "gameOver" && prev?.phase !== "gameOver") setTimeout(() => { ui.overlay = "over"; render(); burst(); }, fxHold + 900);
      const mineNow = myTurn();
      const minePrev = prev ? prev.waiting.includes(S.me) && prev.seq === v.seq : false;
      if (mineNow && !minePrev && prev?.turn !== S.me) alerts.yourTurn();
      document.title = mineNow ? `● Your turn · ${title}` : `${title} · Table Night`;
      const wk = prefix + "welcome-" + v.gameId;
      if (v.gameId && v.round === 1 && !LS.get(wk)) { LS.set(wk, 1); setTimeout(welcome, 200); }
      if (!myTurn()) { ui.pick = null; if (ui.overlay === "color" || ui.overlay === "target") ui.overlay = null; }
      if (!myTurn() || v.hand.length !== 2) ui.uno = false;
    }
    const rects = snapRects();
    render();
    if (prev && v?.last && v.seq !== prev.seq) { const last = v.last; requestAnimationFrame(() => motion(last, v, prev, rects)); }
  }

  const rectOf = sel => document.querySelector(sel)?.getBoundingClientRect();
  function snapRects() {
    const r = {};
    for (const el of document.querySelectorAll(".hand .card[data-id]")) r["h" + el.dataset.id] = el.getBoundingClientRect();
    return r;
  }
  const chipOf = pid => (pid === S.me ? rectOf(".dock .hand") || rectOf(".dock") : rectOf(`.opp[data-pid="${pid}"]`));
  function fly(html, from, to, { size = 64, delay = 0, rot = 0, cls = "" } = {}) {
    if (!from || !to || still()) return;
    const d = document.createElement("div"); d.className = "fly " + cls; d.innerHTML = html;
    const w = size, h = size * 1.5;
    const x0 = from.left + from.width / 2 - w / 2, y0 = from.top + from.height / 2 - h / 2;
    d.style.cssText = `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;opacity:0;transform:rotate(${rot * -1}deg)`;
    document.body.append(d);
    setTimeout(() => {
      d.style.opacity = "1";
      d.style.transform = `translate(${to.left + to.width / 2 - w / 2 - x0}px,${to.top + to.height / 2 - h / 2 - y0}px) rotate(${rot}deg) scale(${(to.width / w) > 1.4 ? 1 : 1})`;
    }, 20 + delay);
    setTimeout(() => { d.style.opacity = "0"; }, 520 + delay);
    setTimeout(() => d.remove(), 760 + delay);
  }
  function flash(sel, cls, delay = 0) {
    setTimeout(() => { const el = document.querySelector(sel); if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }, delay);
  }
  function tag(pid, text, cls = "", delay = 0) {
    const r = chipOf(pid); if (!r) return;
    setTimeout(() => {
      const d = document.createElement("div"); d.className = "tagfx " + cls; d.textContent = text;
      d.style.left = r.left + r.width / 2 + "px"; d.style.top = r.top + (pid === S.me ? 0 : r.height / 2) + "px";
      document.body.append(d); setTimeout(() => d.remove(), 1500);
    }, delay);
  }

  function motion(last, v, prev, rects) {
    if (S.mode !== "game") return;
    const pile = rectOf(".discard .top"), drawp = rectOf(".drawpile");
    if (last.kind === "play") {
      const from = last.pid === S.me ? rects["h" + last.card] || chipOf(S.me) : chipOf(last.pid);
      fly(cardSvg(last.face), from, pile, { size: 70, rot: (Math.random() - .5) * 24, cls: "card" });
      for (const [i, id] of (last.discarded || []).entries()) fly(`<div class="back plain"></div>`, chipOf(last.pid), pile, { size: 50, delay: 120 + i * 80 });
      flash(".discard .top", "slam", 420);
      if (last.color) flash(".ring", "pulse", 450);
      if (last.dir) flash(".dir", "spin", 300);
      if (last.flipped) flash("#table", "flipping", 100);
    }
    if (last.drew) {
      let k = 0;
      for (const [pid, n] of Object.entries(last.drew)) for (let i = 0; i < Math.min(n, 8); i++, k++) fly(`<div class="back ${variant === "mercy" ? "" : "plain"}">${variant === "mercy" ? `<img src="../uno/art/mercy-back.webp?v=1" alt="">` : ""}</div>`, drawp, chipOf(pid), { size: 44, delay: 380 + k * 70, rot: (Math.random() - .5) * 30 });
    }
    flash(`.opp[data-pid="${v.turn}"]`, "nudge", 500);
  }

  function effect(last, v, prev) {
    if (last.kind === "play") {
      const f = last.face, who = esc(nameOf(last.pid));
      if (last.flipped) showFx(`<div class="flipfx">${cardSvg(v.topFace)}</div><div class="t">${last.flipped === "dark" ? "The dark side!" : "Back to the light"}</div><div class="l">${who} flipped everything over</div>`, 1900);
      else if (["wd6", "wd10", "d5", "wdc", "wrd4"].includes(f.k) || (last.pend && last.pend >= 6)) showFx(`<div class="big">${cardSvg(f)}</div><div class="t">${last.pend ? `+${last.pend}` : "Ouch"}!</div><div class="l">${who} played ${esc(E.KIND_NAME[f.k])}${last.color ? ` · ${cname(last.color)}` : ""}</div>`, 1500, f.k === "wd10" ? "boom" : "");
      else if (f.k === "roul") showFx(`<div class="big spinwheel">${cardSvg(f)}</div><div class="t">Colour Roulette</div><div class="l">${esc(nameOf(v.turn))} ${v.turn === S.me ? "pick" : "picks"} a colour and draws until it shows</div>`, 1700);
      else if (f.k === "skipall") tag(last.pid, "Skip everyone!", "warn", 300);
      else if (f.k === "skip") tag(v.players.find(p => p.id === prevNext(prev, last.pid))?.id || v.turn, "Skipped!", "warn", 350);
      else if (f.k === "discall" && last.discarded?.length) tag(last.pid, `Discard all · ${last.discarded.length + 1} cards`, "", 300);
      if (last.swap) showFx(`<div class="t">Swap!</div><div class="l">${who} ${last.pid === S.me ? "swap" : "swaps"} hands with ${esc(nameOf(last.swap))}</div>`, 1500);
      if (last.rotate) showFx(`<div class="t">Pass it on!</div><div class="l">Everyone hands their cards to the next player</div>`, 1500);
      if (last.uno) tag(last.pid, "UNO!", "uno", 200);
    }
    if (last.kind === "draw" && last.penalty) { const n = Object.values(last.drew || {})[0] || 0; tag(last.pid, `+${n}`, "bad", 300); if (n >= 8) shake(); }
    if (last.kind === "roulette") showFx(`<div class="t" style="color:${HEX[last.color]}">${esc(nameOf(last.pid))} ${last.pid === S.me ? "draw" : "draws"} ${Object.values(last.drew || {})[0] || 0}</div><div class="l">looking for ${cname(last.color)}</div>`, 1500);
    if (last.kind === "caught") showFx(`<div class="t">Caught!</div><div class="l">${esc(nameOf(last.pid))} caught ${esc(nameOf(last.victim))} without UNO · +2</div>`, 1500);
    if (last.kind === "uno") tag(last.pid, "UNO!", "uno");
    for (const k of last.knocked || []) showFx(`<div class="t">${esc(nameOf(k))} ${k === S.me ? "are" : "is"} out!</div><div class="l">25 cards · no mercy</div>`, 1800, "boom");
    if (last.end) {
      const w = last.end.winner;
      showFx(`<div class="t">${w === S.me ? "You win" : esc(plainName(w)) + " wins"} the ${variant === "flip" && v.phase !== "gameOver" ? "round" : "game"}!</div><div class="l">${last.end.how === "last" ? "Last one standing" : "Out of cards"}${last.end.points ? ` · +${last.end.points} points` : ""}</div>`, 2600);
      setTimeout(burst, 300);
    }
    if (last.kind === "deal" && prev && prev.round !== v.round) showFx(`<div class="t">Round ${v.round}</div><div class="l">Seven cards each · ${esc(nameOf(last.pid))} ${last.pid === S.me ? "start" : "starts"}</div>`, 1600);
  }
  function prevNext(prev, pid) {
    if (!prev) return null;
    const act = prev.players.filter(p => !p.out), i = act.findIndex(p => p.id === pid);
    return act[(i + prev.dir + act.length) % act.length]?.id;
  }

  const fxQ = []; let fxBusy = false;
  function showFx(html, ms, cls = "") { fxQ.push([html, ms, cls]); fxHold = fxQ.reduce((s, [, m]) => s + m, 0); if (!fxBusy) nextFx(); }
  function nextFx() {
    const it = fxQ.shift();
    if (!it) { fxBusy = false; fxHold = 0; return; }
    fxBusy = true;
    const [html, ms, cls] = it, d = document.createElement("div");
    d.className = "fx-banner " + cls; d.style.animationDuration = ms + "ms"; d.innerHTML = html;
    document.body.append(d);
    if (cls === "boom") shake();
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
      p.vx *= .985; p.vy = p.vy * .985 + .06; p.x += p.vx; p.y += p.vy;
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.c;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.age / 7); ctx.fillRect(-p.s / 2, -p.s * .75, p.s, p.s * 1.5); ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function burst(cols = variant === "flip" && Vw()?.side === "dark" ? ["#ff3d9a", "#12b5b0", "#ff7a1a", "#7d3cff"] : ["#e5322d", "#f6c21c", "#2fa84f", "#1f6fd1", "#fff"]) {
    if (still()) return;
    ensureFx();
    for (let i = 0; i < 140; i++) { const a = rnd(0, 6.28), s = rnd(2, 10); parts.push({ x: innerWidth / 2, y: innerHeight * .4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, age: 0, life: rnd(60, 110), s: rnd(5, 10), c: cols[i % cols.length] }); }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function welcome() {
    const words = `Welcome to Dhruv's Vibe Coded ${title}`.split(" ");
    const d = document.createElement("div"); d.className = "fx-welcome";
    const fanFaces = variant === "flip"
      ? [{ c: "r", k: "7" }, { c: "b", k: "flip" }, { c: "w", k: "wd2" }, { c: "p", k: "d5" }, { c: "v", k: "skipall" }, { c: "w", k: "wdc" }]
      : [{ c: "r", k: "d4" }, { c: "w", k: "wd10" }, { c: "g", k: "skipall" }, { c: "w", k: "roul" }, { c: "b", k: "discall" }, { c: "w", k: "wd6" }];
    d.innerHTML = `<div class="wl-fan">${fanFaces.map((f, i) => `<div class="c" style="--i:${i - 2.5}">${cardSvg(f)}</div>`).join("")}</div>
      <h1>${words.map((w, i) => `<span style="animation-delay:${.5 + i * .16}s">${esc(w)}</span>`).join(" ")}</h1><p>Manifest his greatness and you may win</p><small>Tap to start</small>`;
    document.body.append(d);
    const shownAt = Date.now();
    const close = () => { if (Date.now() - shownAt < 3000 || d.classList.contains("out")) return; d.classList.add("out"); setTimeout(() => d.remove(), 500); };
    d.addEventListener("pointerdown", close); setTimeout(close, 5200); setTimeout(() => burst(), 500);
  }

  // ---------------------------------------------------------------- views
  const HS = hscroll(".hand,.opps,.tabs,.tbl");
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
  const heroFan = () => {
    const faces = variant === "flip" ? [{ c: "y", k: "d1" }, { c: "w", k: "w" }, { c: "t", k: "flip" }] : [{ c: "r", k: "d2" }, { c: "w", k: "wd10" }, { c: "b", k: "7" }];
    return `<div class="fan">${faces.map((f, i) => `<div class="c" style="--r:${(i - 1) * 12}deg;--y:${Math.abs(i - 1) * 10}px;--d:${i * .1}s">${cardSvg(f)}</div>`).join("")}</div>`;
  };
  function viewLanding() {
    return `<div class="page">${inAppHint()}<div class="hero">${heroFan()}
        <div class="eyebrow">${esc(eyebrow)}</div><h1 class="title">${esc(title)}</h1>
        <p class="muted" style="max-width:40ch;margin:0">${blurb}</p></div>
      <form class="panel" data-form="create"><label for="nm" class="eyebrow">Your name</label>
        <div class="row"><input id="nm" type="text" maxlength="18" autocomplete="nickname" placeholder="e.g. Dhruv" value="${esc(room.lastName())}" required><button class="btn" type="submit">Start a game</button></div>
        <div class="err">${esc(S.error)}</div></form>
      <div class="row" style="justify-content:center">${rulesBtn()}<a class="btn ghost small" href="../">All games</a></div></div>`;
  }
  function viewJoin() {
    const busy = S.mode === "connecting";
    return `<div class="page">${inAppHint()}<div class="hero">${heroFan()}
        <div class="eyebrow">You're invited to a game of</div><h1 class="title">${esc(title)}</h1></div>
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
      <p class="muted" style="margin:0;font-size:15px">Your hand comes with you. If that seat is open on another device, it moves here.</p><div class="err">${esc(S.error || S.status)}</div></section>
      <div class="row" style="justify-content:center">${rulesBtn()}</div></div>`;
  }
  function viewLobby() {
    const L = S.lobby; if (!L) return "";
    const host = room.isHost, n = L.players.length, link = room.linkFor(L.code);
    const seg = (key, opts, val) => `<span class="seg">${opts.map(([v, l]) => `<button aria-pressed="${val === v}" ${host ? `data-act="set" data-k="${key}" data-v="${v}"` : "disabled"}>${l}</button>`).join("")}</span>`;
    return `<div class="page"><div class="hero" style="gap:4px"><div class="eyebrow">Room code</div><h1 class="title" style="font-size:52px;letter-spacing:.14em;margin:0">${esc(L.code)}</h1><p class="muted" style="margin:0;font-size:14px;text-align:center">Friends can open <b>${location.host}</b>, tap <b>Join a game</b> and type this code — or use the link below.</p></div>
      <section class="panel"><div class="eyebrow">Invite players</div>
        <div class="share"><code id="link">${esc(link)}</code><button class="btn small" data-act="share">Share link</button><button class="btn ghost small" data-act="copy">Copy</button></div>
        <p class="muted" style="margin:0;font-size:15px">Anyone with the link types a name and joins. ${V.min}–${V.max} players. If someone drops out, the game keeps going and they can rejoin from any device.</p></section>
      <section class="panel"><div class="eyebrow">Players · ${n}/${V.max}</div><ul class="plist">${L.players.map((p, i) => `<li><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
        <span style="flex:1">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}${p.id === L.hostId ? " <span class='badge'>HOST</span>" : ""}</span>
        <span class="dot ${p.online ? "" : "off"}"></span>${host && p.id !== S.me ? `<button class="btn ghost small" data-act="kick" data-pid="${p.id}">Remove</button>` : ""}</li>`).join("")}</ul>
        ${n < V.min ? `<p class="muted" style="margin:0">Waiting for ${V.min - n} more player${V.min - n === 1 ? "" : "s"}…</p>` : ""}</section>
      <section class="panel"><div class="eyebrow">House rules</div>
        ${variant === "flip" ? `<div class="row" style="justify-content:space-between"><span>Game length</span>${seg("target", [[0, "One round"], [250, "To 250"], [500, "To 500"]], +(L.settings.target || 0))}</div>
          <p class="muted" style="margin:0;font-size:14px">Stacking: a Draw card can be passed on with the <b>same</b> card — Draw One on Draw One, Draw Five on Draw Five, Wild Draw Two on Wild Draw Two, Wild Draw Color on Wild Draw Color.</p>`
          : `<p class="muted" style="margin:0;font-size:14px">Official No Mercy: stack any Draw card of the <b>same or higher</b> value · 7 swaps hands · 0 passes every hand on · 25 cards and you're out.</p>`}
        <div class="row" style="justify-content:space-between"><span>Turn timer</span>${seg("timer", [[20, "20 s"], [30, "30 s"], [60, "1 min"]], L.settings.timer || 30)}</div>
        <p class="muted" style="margin:0;font-size:14px">If someone runs out of time, the game plays for them.</p></section>
      ${soundRow()}
      <div class="row" style="justify-content:center">${host ? `<button class="btn" data-act="start" ${n < V.min ? "disabled" : ""}>Start game</button>` : `<span class="muted">Waiting for the host to start…</span>`}${rulesBtn()}</div>
      <div class="err" style="text-align:center">${esc(S.error || S.status)}</div></div>`;
  }

  function leader(v) {
    if (variant === "flip" && v.target) {
      const max = Math.max(...v.players.map(p => p.score)); const top = v.players.filter(p => p.score === max);
      return max > 0 && top.length === 1 ? top[0].id : null;
    }
    const live = v.players.filter(p => !p.out), min = Math.min(...live.map(p => p.count)), top = live.filter(p => p.count === min);
    return top.length === 1 ? top[0].id : null;
  }

  function viewGame() {
    const v = Vw(), lead = leader(v), meI = v.me;
    // opponents in play order, starting after me
    const opps = [];
    for (let k = 1; k < v.players.length; k++) opps.push(v.players[(meI + k * 1 + v.players.length) % v.players.length]);
    const oppHtml = opps.map(p => {
      const i = v.players.indexOf(p), bot = S.bots?.includes(p.id), off = !S.online[p.id];
      const fanN = Math.min(p.count, 7);
      const backs = p.backs ? p.backs.slice(0, 7).map((f, j) => `<span class="mini" style="--j:${j - (fanN - 1) / 2}">${cardSvg(f)}</span>`).join("")
        : Array.from({ length: fanN }, (_, j) => `<span class="mini ${variant === "mercy" ? "mb" : "pb"}" style="--j:${j - (fanN - 1) / 2}"></span>`).join("");
      return `<div class="opp ${p.id === v.turn && v.phase !== "gameOver" ? "turn" : ""} ${p.out ? "out" : ""}" data-pid="${p.id}">${p.id === lead ? CROWN : ""}
        <div class="minis">${backs}</div>
        <div class="who"><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span><span class="nm">${esc(p.name)}</span></div>
        <div class="cnt">${p.out ? "OUT" : `${p.count} card${p.count === 1 ? "" : "s"}`}${p.count === 1 && !p.out ? ` <b class="unotag">UNO</b>` : ""}${variant === "flip" && v.target ? ` · ${p.score}` : ""}</div>
        ${bot ? `<span class="badge bot">BOT</span>` : off ? `<span class="badge off">AWAY</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></div>`;
    }).join("");
    const under = v.under.map((u, i) => `<div class="card u" style="--r:${(i - 1) * 9 + (u.id % 7) - 3}deg">${cardSvg(u.face)}</div>`).join("");
    const pend = v.pend ? (v.pend.color ? `<div class="pend">Draw until ${cname(v.pend.color)}${v.pend.times > 1 ? ` ×${v.pend.times}` : ""}</div>` : `<div class="pend">+${v.pend.n}</div>`) : "";
    const drawFace = variant === "flip" && v.nextBack ? `<div class="card drawpile ${canDraw(v) ? "can" : ""}" data-act="draw">${cardSvg(v.nextBack)}<span class="dl">${v.drawLeft}</span></div>`
      : `<div class="drawpile ${canDraw(v) ? "can" : ""}" data-act="draw">${backHtml(variant)}<span class="dl">${v.drawLeft}</span></div>`;
    const catchBtn = v.unoRisk && v.unoRisk !== S.me ? `<button class="btn catch" data-act="catch">Catch ${esc(plainName(v.unoRisk))}!</button>` : "";
    const lateUno = v.unoRisk === S.me ? `<button class="btn unobtn pulse" data-act="uno">UNO!</button>` : "";
    return `<div id="table" class="${variant}">
      <div class="bar"><div class="info">${variant === "flip" ? `<span class="side ${v.side}">${v.side === "dark" ? "DARK SIDE" : "LIGHT SIDE"}</span>` : `<span class="side mercy">NO MERCY</span>`}
          <span class="dir" title="Direction of play">${v.dir === 1 ? "↻" : "↺"}</span>${v.round > 1 || v.target ? `<span class="rnd">R${v.round}</span>` : ""}${S.net ? "" : `<span class="badge off">OFFLINE</span>`}</div>
        <button class="btn ghost small" data-act="leave-ask" aria-label="Leave the game"><span aria-hidden="true">🚪</span><span class="lvt">Leave</span></button>
        <button class="btn ghost small" data-act="scores" aria-label="Scores"><span class="sci" aria-hidden="true">🏆</span><span class="sct">Scores</span></button>${rulesBtn("small")}</div>
      <div class="opps">${oppHtml}</div>
      <div class="center">
        ${drawFace}
        <div class="discard"><div class="ring" style="--rc:${HEX[v.color]}"></div>${under}<div class="card top">${cardSvg(v.topFace)}</div>${pend}</div>
      </div>
      <div class="floaters">${catchBtn}${lateUno}</div>
      ${dock(v)}</div>`;
  }
  const canDraw = v => myTurn() && v.phase === "play" && v.drawn == null && (variant === "flip" || v.pend || !v.hand.some(c => c.ok));

  function dock(v) {
    const mine = myTurn(), timer = mine ? ` <span class="tmr big" data-tmr="${S.me}"></span>` : "";
    let status = "", actions = "";
    if (v.phase === "play") {
      if (mine) {
        if (v.pend) status = v.pend.color ? `Wild Draw Color on you — stack one, or draw until ${cname(v.pend.color)}` : `+${v.pend.n} coming your way — ${variant === "mercy" ? "stack a Draw card worth the same or more" : "stack the same card"}, or take it`;
        else if (v.drawn != null) status = variant === "mercy" ? "You drew a card that fits — play it" : "You drew a playable card — play it or pass";
        else status = v.hand.some(c => c.ok) ? `Your turn · play on ${cname(v.color)} or match the card` : "Nothing fits — draw";
        if (v.pend) actions += `<button class="btn take" data-act="draw">${v.pend.color ? "Draw until colour" : `Take +${v.pend.n}`}</button>`;
        else if (v.drawn != null && variant === "flip") actions += `<button class="btn ghost" data-act="pass">Pass</button>`;
        else if (canDraw(v)) actions += `<button class="btn ghost" data-act="draw">${variant === "mercy" ? "Draw till it fits" : "Draw"}</button>`;
        if (v.hand.length === 2 && v.hand.some(c => c.ok)) actions += `<button class="btn unobtn ${ui.uno ? "on" : ""}" data-act="unoarm" aria-pressed="${ui.uno}">${ui.uno ? "UNO ✓" : "UNO!"}</button>`;
      } else status = `${esc(nameOf(v.turn))}'s turn${v.pend ? ` · facing ${v.pend.color ? "Draw Color" : "+" + v.pend.n}` : ""}`;
    } else if (v.phase === "color") status = mine ? "The flip turned up a Wild — pick the colour" : `${esc(nameOf(v.turn))} is picking a colour`;
    else if (v.phase === "roulette") status = mine ? "Colour Roulette! Pick a colour — you draw until it shows" : `${esc(nameOf(v.turn))} is spinning the roulette`;
    else if (v.phase === "roundOver") status = `Round over · next round in a moment`;
    else if (v.phase === "gameOver") {
      const w = v.result.winners;
      status = w.includes(S.me) ? "You win!" : `${esc(w.map(plainName).join(" & "))} wins`;
      actions = `<button class="btn big" data-act="over">Results</button>`;
    }
    const picker = mine && (v.phase === "color" || v.phase === "roulette") ? colorRow("pickphase") : "";
    const hand = v.hand.slice().sort((a, b) => ORDER[a.face.c] - ORDER[b.face.c] || String(a.face.k).localeCompare(String(b.face.k)))
      .map(c => cardHtml(c.id, c.face, `${c.ok ? "ok" : mine && v.phase === "play" ? "no" : ""} ${c.id === v.drawn ? "drawn" : ""}`, `data-act="card" data-id="${c.id}" role="button" aria-label="${esc(kname(c.face))}${c.ok ? ", playable" : ""}"`)).join("");
    return `<div class="dock ${mine ? "mine" : ""}" id="dock"><div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${timer}</span>${actions ? `<span class="acts">${actions}</span>` : ""}</div>
      ${picker}<div class="hand" style="--n:${v.hand.length}">${hand || `<span class="muted">No cards</span>`}</div></div>`;
  }
  const colorRow = act => `<div class="colors">${E.colorsNow({ variant, side: Vw().side }).map(c => `<button class="cbtn" style="--c:${HEX[c]}" data-act="${act}" data-c="${c}">${cname(c)}</button>`).join("")}</div>`;

  // ---------------------------------------------------------------- overlays
  const sheet = (title2, body, foot = "") => `<div class="overlay" data-act="closebg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title2)}">
    <div class="sheethead"><h2>${esc(title2)}</h2><button class="btn ghost small" data-act="close">Close</button></div>${body}${foot}</div></div>`;
  function viewOverlay() {
    const v = Vw();
    if (ui.overlay === "leave" && v) return sheet("Leave the game?", `<div class="sheetbody"><p style="margin-top:0">A bot will play your seat for the rest of this game, so everyone else can finish. Changed your mind? Open the same link and tap <b>This is me</b> to take your seat back.</p><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="leave">Leave the game</button><button class="btn ghost" data-act="close">Stay</button></div></div>`);
    if (ui.overlay === "rules") return sheet("Rules", rulesTabs() + `<div class="sheetbody guide">${soundRow()}${cfg.rules[ui.tab] || cfg.rules.basics}</div>`);
    if (ui.overlay === "scores" && v) return sheet("Players", `<div class="sheetbody">${scores()}</div>`);
    if (ui.overlay === "color" && v && ui.pick != null) return sheet("Pick a colour", `<div class="sheetbody"><div class="pickcard">${cardSvg(v.hand.find(c => c.id === ui.pick)?.face || v.topFace)}</div>${colorRow("pickcolor")}</div>`);
    if (ui.overlay === "target" && v && ui.pick != null) return sheet("Swap hands with…", `<div class="sheetbody"><div class="targets">${v.players.filter(p => p.id !== S.me && !p.out).map(p => `<button class="btn ghost tbtn" data-act="picktarget" data-pid="${p.id}">${esc(p.name)} <small>${p.count} card${p.count === 1 ? "" : "s"}</small></button>`).join("")}</div></div>`);
    if (ui.overlay === "over" && v?.phase === "gameOver") return sheet("Game over", `<div class="sheetbody">${podium()}</div>`, `<div class="row" style="justify-content:center;padding:6px 16px 16px">${room.isHost ? `<button class="btn" data-act="again">Play again</button>${againButton(true)}` : `<span class="muted">The host can start a new game.</span>`}</div>`);
    return "";
  }
  function rulesTabs() {
    const t = [["basics", "How to play"], ["cards", "Cards"], ["full", "Full rules"]];
    return `<div class="tabs" role="tablist">${t.map(([k, l]) => `<button role="tab" aria-selected="${ui.tab === k}" data-act="tab" data-k="${k}">${l}</button>`).join("")}</div>`;
  }
  function scores() {
    const v = Vw();
    const rounds = v.log.length ? `<p class="muted" style="font-size:13px">${v.log.map(l => `R${l.round}: ${esc(nameOf(l.winner))}${l.points ? ` +${l.points}` : ""}`).join(" · ")}</p>` : "";
    return `<div class="tbl"><table><tr><th>Player</th><th>Cards</th>${variant === "flip" ? "<th>Points</th>" : ""}</tr>${v.players.map(p => `<tr><td>${esc(nameOf(p.id))}</td><td>${p.out ? "out" : p.count}</td>${variant === "flip" ? `<td>${p.score}</td>` : ""}</tr>`).join("")}</table></div>
      ${variant === "flip" ? `<p class="muted" style="font-size:13px">${v.target ? `First to ${v.target} points wins.` : "One round: first out wins."} Points are the cards left in everyone else's hands, on the side the round ends on.</p>` : `<p class="muted" style="font-size:13px">First out — or last one standing — wins. 25 cards and you're out.</p>`}${rounds}`;
  }
  function podium() {
    const v = Vw(), r = v.result;
    return `<div class="hist">${r.rows.map((row, i) => { const p = v.players.find(x => x.id === row.pid); const win = r.winners.includes(row.pid); return `<div class="h" style="${win ? "border:1px solid var(--gold);background:linear-gradient(90deg,rgba(242,193,78,.25),var(--bg2))" : ""}">
        <span class="av" style="background:${SEAT[v.players.indexOf(p)]}">${i + 1}</span><b style="flex:1">${esc(nameOf(row.pid))}</b>${win ? CROWN : ""}
        <span class="muted">${row.out ? "knocked out" : `${row.cards} card${row.cards === 1 ? "" : "s"} left`}</span>${variant === "flip" ? `<b style="font-size:20px">${row.points}</b>` : ""}</div>
        ${p.cards?.length ? `<div class="left">${p.cards.slice(0, 14).map(f => `<span class="mini">${cardSvg(f)}</span>`).join("")}</div>` : ""}`; }).join("")}</div>`;
  }

  // ---------------------------------------------------------------- input
  function playCard(id, extra = {}) {
    const v = Vw(), c = v.hand.find(x => x.id === id);
    const el = document.querySelector(`.hand .card[data-id="${id}"]`);
    if (el) el.classList.add("going");
    if (!c) return;
    ui.pick = null; ui.overlay = null;
    room.act({ type: "play", card: id, uno: ui.uno || undefined, ...extra });
    ui.uno = false;
  }
  $app.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const a = el.dataset.act, v = Vw();
    switch (a) {
      case "sound": alerts.toggle(); break;
      case "rules": ui.overlay = "rules"; break;
      case "scores": ui.overlay = "scores"; break;
      case "over": ui.overlay = "over"; break;
      case "leave-ask": ui.overlay = "leave"; break;
      case "leave": ui.overlay = null; room.leave(); return;
      case "rejoin": room.rejoin(); return;
      case "close": ui.overlay = null; ui.pick = null; break;
      case "closebg": if (e.target !== el) return; ui.overlay = null; ui.pick = null; break;
      case "tab": ui.tab = el.dataset.k; break;
      case "share": share(); return;
      case "copy": copy(); return;
      case "start": room.start(); return;
      case "kick": room.kick(el.dataset.pid); return;
      case "claim": room.claim(el.dataset.pid); return;
      case "again": ui.overlay = null; room.backToLobby(); return;
      case "set": room.settings({ [el.dataset.k]: +el.dataset.v }); return;
      case "draw": if (!canDraw(v) && !(myTurn() && v.pend)) return; room.act({ type: "draw" }); return;
      case "pass": room.act({ type: "pass" }); return;
      case "catch": room.act({ type: "catch" }); return;
      case "uno": room.act({ type: "uno" }); return;
      case "unoarm": ui.uno = !ui.uno; break;
      case "pickphase": room.act({ type: "color", color: el.dataset.c }); return;
      case "pickcolor": {
        const f = v.hand.find(c => c.id === ui.pick)?.face;
        if (!f) break;
        if (variant === "mercy" && f.k === "7") break;
        playCard(ui.pick, { color: el.dataset.c }); return;
      }
      case "picktarget": playCard(ui.pick, { target: el.dataset.pid }); return;
      case "card": {
        const id = +el.dataset.id, c = v.hand.find(x => x.id === id);
        if (!c) return;
        if (!c.ok) { el.classList.remove("nope"); void el.offsetWidth; el.classList.add("nope"); return; }
        const f = c.face;
        if (E.isWild(f.k) && f.k !== "roul") { ui.pick = id; ui.overlay = "color"; break; }
        if (variant === "mercy" && f.k === "7" && v.players.some(p => p.id !== S.me && !p.out)) { ui.pick = id; ui.overlay = "target"; break; }
        playCard(id); return;
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
  document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.overlay) { ui.overlay = null; ui.pick = null; render(); } });

  async function share() {
    const url = room.linkFor(S.code);
    if (navigator.share) { try { await navigator.share({ title, text: `Join my game of ${title}:`, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
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
      if (el.dataset.tmr === S.me && sec <= 10 && buzzed !== Vw()?.seq) { buzzed = Vw()?.seq; alerts.hurry(); }
    }
  }, 250);

  async function wake() { try { await navigator.wakeLock?.request("screen"); } catch { /* not allowed */ } }
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && S.mode === "game" && wake());
  addEventListener("resize", () => S.mode === "game" && render());
  if (variant === "mercy") preload(["../uno/art/mercy-back.webp?v=1", "../uno/art/mercy-back@2x.webp?v=1"]);

  (function boot() {
    if (S.code) { const n = room.savedName(); if (n) { wake(); return room.join(n); } S.mode = "join"; }
    render();
  })();

  window.__uno = { S, room, ui, E };
}
