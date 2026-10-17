import * as E from "./engine.js";
import { DATA } from "./data.js";
import { createRoom } from "../shared/room.js";
import { preload } from "../shared/preload.js";
import { alerts, soundRow, inAppHint } from "../shared/alert.js";
import { hscroll } from "../shared/hscroll.js";
import { RULES, setupTable, powerText } from "./rules.js";

const $app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SEAT = ["#f3d48a", "#7fb0ff", "#5fd39a", "#ff8a73", "#c6a2ff", "#f5a8d6", "#9fe3e8"];
const ROMAN = ["I", "II", "III"];
const COLORS = ["brown", "grey", "yellow", "blue", "red", "green", "purple"];
const COLOR_NAME = { brown: "Raw materials", grey: "Goods", blue: "Civic", yellow: "Commerce", red: "Military", green: "Science", purple: "Guilds" };
const ic = k => `<svg class="ic" aria-hidden="true"><use href="#i-${k}"/></svg>`;
const artSet = id => `image-set(url('art/${id}.webp') 1x, url('art/${id}@2x.webp') 2x)`;
const CROWN = `<svg class="crown" viewBox="0 0 30 22" aria-label="Leader"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".55" stop-color="#f2c14e"/><stop offset="1" stop-color="#b7832a"/></linearGradient></defs><path d="M2 7l6.5 5L15 2l6.5 10L28 7l-2.6 12H4.6z" fill="url(#cg)" stroke="#7a5418" stroke-width="1.2" stroke-linejoin="round"/><rect x="4.4" y="17.6" width="21.2" height="3.4" rx="1.2" fill="url(#cg)" stroke="#7a5418" stroke-width="1"/><circle cx="15" cy="2.6" r="1.8" fill="#ff5a6e"/><circle cx="2.4" cy="7" r="1.5" fill="#7fd0ff"/><circle cx="27.6" cy="7" r="1.5" fill="#7fd0ff"/></svg>`;
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

const ui = { overlay: null, tab: "basics", card: null, player: null, leader: null, shown: null };
let dragging = null, queued = false;

const room = createRoom({
  prefix: "mar-", engine: E, minPlayers: 3, maxPlayers: 7, defaults: { timer: 60, side: "A" },
  onUpdate: prev => onUpdate(prev), toast: m => toast(esc(m)),
});
const S = room.S;

// ---------------------------------------------------------------- helpers
const V = () => S.view;
const me = () => V()?.players[V().me];
const nameOf = pid => (pid === S.me ? "You" : V()?.players.find(p => p.id === pid)?.name || S.lobby?.players.find(p => p.id === pid)?.name || "?");
const seatOf = pid => V()?.players.findIndex(p => p.id === pid);
const pidAt = k => { const v = V(), n = v.players.length; return v.players[((v.me + k) % n + n) % n].id; };
const leftPid = () => pidAt(-1), rightPid = () => pidAt(1);
const mustPick = () => { const v = V(); return v && (v.phase === "pick" || v.phase === "extra") && v.waiting.includes(S.me); };
const canPick = () => { const v = V(); return v && ((v.phase === "pick" && v.hand?.length) || (v.phase === "extra" && v.waiting.includes(S.me))); };
const cardOf = E.cardOf;
const cid = inst => inst.split("~")[0];

function leaderOf(v) {
  if (!v) return null;
  const max = Math.max(...v.players.map(p => p.points));
  const top = v.players.filter(p => p.points === max);
  return top.length === 1 && max > 0 ? top[0].id : null;
}

// ---------------------------------------------------------------- describing cards
const resIc = r => ic(r);
function unitHtml(u) {
  if (u.length === 1) return resIc(u[0]);
  return u.map(resIc).join("<b style='opacity:.6'>/</b>");
}
function costHtml(cost) {
  const out = [];
  if (cost.coins) out.push(`<span>${ic("coin")}${cost.coins > 1 ? cost.coins : ""}</span>`);
  for (const r of E.RES) for (let i = 0; i < (cost[r] || 0); i++) out.push(resIc(r));
  return out.join("");
}
function effectIcons(c) {
  const h = [];
  if (c.produce) h.push(c.produce.map(unitHtml).join(" "));
  if (c.vp) h.push(`${ic("vp")}${c.vp}`);
  if (c.coins) h.push(`${ic("coin")}${c.coins}`);
  if (c.shields) h.push(ic("shield").repeat(c.shields));
  if (c.science) h.push(ic(c.science));
  if (c.trade?.raw) h.push(`${c.trade.raw.includes("left") ? "◀" : ""}${ic("coin")}1${c.trade.raw.includes("right") ? "▶" : ""}`);
  if (c.trade?.goods) h.push(`◀${ic("coin")}1▶`);
  if (c.earn) {
    const what = c.earn.stages ? "▲" : `<i style="display:inline-block;width:.8em;height:.8em;border-radius:2px;background:var(--${c.earn.colors[0]})"></i>`;
    h.push(`${c.earn.coins ? `${ic("coin")}${c.earn.coins}` : ""}${c.earn.vp ? `${ic("vp")}${c.earn.vp}` : ""}/${what}${c.earn.who.length > 1 ? "◀▶" : ""}`);
  }
  if (c.guild) {
    if (c.guild.science) h.push(ic("wild"));
    else {
      const what = c.guild.stages ? "▲" : c.guild.defeats ? "−1" : c.guild.colors.map(k => `<i style="display:inline-block;width:.7em;height:.8em;border-radius:2px;background:var(--${k})"></i>`).join("");
      h.push(`${ic("vp")}${c.guild.vp}/${what}${c.guild.who.includes("self") ? "" : "◀▶"}`);
    }
  }
  return h.join(" ");
}
const chainNames = ids => ids.map(id => DATA.cards.find(c => c.id === id)?.name).join(" or ");
const leadsTo = id => DATA.cards.filter(c => c.chain.includes(id)).map(c => c.name);
const RAWS = "Wood, Stone, Clay and Ore", GOODS_T = "Glass, Cloth and Papyrus";
function describe(c) {
  const s = [];
  if (c.produce) {
    if (c.private) s.push(`Produces one ${c.produce[0].length === 4 ? "raw resource" : "good"} of your choice every turn. Your neighbours can't buy it.`);
    else if (c.produce.length === 2) s.push(`Produces 2 ${E.RES_NAME[c.produce[0][0]]} every turn.`);
    else if (c.produce[0].length === 2) s.push(`Produces ${E.RES_NAME[c.produce[0][0]]} or ${E.RES_NAME[c.produce[0][1]]} (one of them) every turn.`);
    else s.push(`Produces 1 ${E.RES_NAME[c.produce[0][0]]} every turn.`);
  }
  if (c.vp) s.push(`Worth ${c.vp} points.`);
  if (c.coins) s.push(`Take ${c.coins} coins when you build it.`);
  if (c.shields) s.push(`${plural(c.shields, "shield")} for the battles.`);
  if (c.science) s.push(`Science symbol: ${c.science[0].toUpperCase() + c.science.slice(1)}.`);
  if (c.trade?.raw) s.push(`Buy ${RAWS} from your ${c.trade.raw[0]} neighbour for 1 coin each.`);
  if (c.trade?.goods) s.push(`Buy ${GOODS_T} from both neighbours for 1 coin each.`);
  if (c.earn) {
    const who = c.earn.who.length > 1 ? "in your city and both neighbours' cities" : "in your city";
    const what = c.earn.stages ? "Marvel stage you've built" : `${c.earn.colors.map(k => COLOR_NAME[k].toLowerCase()).join("/")} (${c.earn.colors.join("/")}) card ${who}`;
    if (c.earn.coins && !c.earn.vp) s.push(`Take ${c.earn.coins} coin${c.earn.coins > 1 ? "s" : ""} for each ${what} when you build it.`);
    else s.push(`Take ${c.earn.coins} coin${c.earn.coins > 1 ? "s" : ""} now and score ${c.earn.vp} point${c.earn.vp > 1 ? "s" : ""} at the end for each ${what}.`);
  }
  if (c.guild) {
    const g = c.guild;
    if (g.science) s.push("A science symbol of your choice (chosen for the best score at the end).");
    else if (g.stages) s.push(`${g.vp} point for each Marvel stage built by you and both neighbours.`);
    else if (g.defeats) s.push(`${g.vp} point for each defeat token your neighbours hold.`);
    else s.push(`${g.vp} point${g.vp > 1 ? "s" : ""} for each ${g.colors.join(", ")} card ${g.who.includes("self") ? "in your own city" : "your two neighbours have built"}.`);
  }
  return s.join(" ");
}

function cardHtml(inst, extra = "", badge = "") {
  const c = cardOf(inst);
  return `<div class="hc c-${c.color} ${extra}" data-card="${inst}" role="button" tabindex="0" aria-label="${esc(c.name)}">
    <div class="art" style="background-image:${artSet(c.id)}"></div>
    <div class="band">${effectIcons(c)}</div>
    ${Object.keys(c.cost).length ? `<div class="cost">${costHtml(c.cost)}</div>` : ""}
    ${c.chain.length ? `<div class="ch" title="Free with ${esc(chainNames(c.chain))}">${ic("chain")}</div>` : ""}
    ${badge}<div class="nm">${esc(c.name)}</div></div>`;
}
function badgeFor(o) {
  if (!o) return "";
  if (o.build.ok && (o.build.chain || o.build.total === 0)) return `<span class="ok y">${o.build.chain ? "⛓ free" : "free"}</span>`;
  if (o.build.ok) return `<span class="ok p">${ic("coin")}${o.build.total}</span>`;
  if (o.free) return `<span class="ok y">free★</span>`;
  return `<span class="ok n">✕</span>`;
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
  let reveal = null, battle = null;
  if (v) {
    if (v.phase === "gameOver" && prev?.phase !== "gameOver") setTimeout(() => { ui.overlay = "over"; render(); }, v.last?.battles ? 3200 : 600);
    const key = v.last ? JSON.stringify([v.last.kind, v.last.age, v.last.turn, v.last.plays?.map(p => p.pid + p.how + (p.card || ""))]) : null;
    if (prev && key && key !== ui.shown) { reveal = v.last; if (v.last.battles && v.last.battles.age !== prev.last?.battles?.age) battle = v.last.battles; }
    if (key) ui.shown = key;
    const mineNow = (v.phase === "pick" || v.phase === "extra" || v.phase === "salvage") && v.waiting.includes(S.me);
    const minePrev = prev ? prev.waiting.includes(S.me) && prev.phase === v.phase && prev.turn === v.turn && prev.age === v.age : false;
    if (mineNow && !minePrev) alerts.yourTurn();
    document.title = mineNow ? "● Your move · Seven Marvels" : "Seven Marvels · Games4free";
    const wk = "mar-welcome-" + v.gameId;
    if (v.gameId && v.age === 1 && v.turn === 1 && !LS.get(wk)) { LS.set(wk, 1); setTimeout(welcome, 200); }
    if (v.phase === "salvage" && v.waiting.includes(S.me) && !(prev?.phase === "salvage" && prev.waiting.includes(S.me))) ui.overlay = "salvage";
    if (ui.overlay === "salvage" && !(v.phase === "salvage" && v.waiting.includes(S.me))) ui.overlay = null;
    if (ui.overlay === "card" && ui.card && !(v.hand || []).includes(ui.card) && !(v.salvage || []).includes(ui.card)) ui.overlay = null;
  }
  const before = reveal ? captureMine(reveal) : null;
  render();
  if (reveal) requestAnimationFrame(() => animate(reveal, before));
  if (battle) setTimeout(() => showBattles(battle), reveal ? 900 : 100);
}

function captureMine(last) {
  const mine = last.plays?.find(p => p.pid === S.me);
  if (!mine) return null;
  const el = document.querySelector(`.hand [data-card="${mine.card || ""}"]`) || document.querySelector(".hand .hc.chosen");
  return el?.getBoundingClientRect() || null;
}
function chipRect(pid) { return document.querySelector(`.opp[data-pid="${pid}"]`)?.getBoundingClientRect(); }

function fly(html, from, to, w, h, delay = 0) {
  if (!from || !to) return;
  const d = document.createElement("div");
  d.className = "fly"; d.innerHTML = html;
  d.style.cssText = `left:${from.left}px;top:${from.top}px;width:${w}px;height:${h}px`;
  document.body.append(d);
  const dx = to.left + to.width / 2 - (from.left + w / 2), dy = to.top + to.height / 2 - (from.top + h / 2);
  setTimeout(() => { d.style.transform = `translate(${dx}px,${dy}px) scale(.35)`; d.style.opacity = ".15"; }, 30 + delay);
  setTimeout(() => d.remove(), 800 + delay);
}
// What a neighbour just played floats up over their chip (fixed to the screen so the chip strip can't clip it).
function popOn(pid, html, delay = 0) {
  const r = chipRect(pid); if (!r) return;
  const p = document.createElement("div"); p.className = "pop"; p.innerHTML = html;
  p.style.left = r.left + r.width / 2 + "px"; p.style.top = r.top + r.height * .55 + "px"; p.style.animationDelay = delay + "ms";
  document.body.append(p);
  setTimeout(() => p.remove(), 2400 + delay);
}

function animate(last) {
  const v = V(); if (!v) return;
  for (const p of last.plays || []) {
    if (p.pid === S.me) {
      const target = p.how === "stage" ? document.querySelector(".marvel") : p.how === "sell" ? document.querySelector(".coins-me") : document.querySelector(".city");
      const from = document.querySelector(".dock")?.getBoundingClientRect();
      if (from && target && p.card) fly(`<div style="--hw:84px">${cardHtml(p.card)}</div>`, { left: from.left + from.width / 2 - 42, top: from.top + 10, width: 84, height: 124 }, target.getBoundingClientRect(), 84, 124);
      if (p.how === "stage") setTimeout(() => stageBanner(S.me, p.stage), 300);
      if (p.coins) setTimeout(() => sparkle(document.querySelector(".coins-me")?.getBoundingClientRect(), "#e9b52e", p.coins > 0 ? 20 : 8), 500);
      continue;
    }
    const what = p.how === "sell" ? `<span class="coinpop">${ic("coin")} +3</span>`
      : p.how === "stage" ? `<span class="coinpop">▲ Stage ${p.stage}</span>`
      : `<div style="--hw:58px">${cardHtml(p.card)}</div>`;
    popOn(p.pid, what, 120 * (seatOf(p.pid) || 0));
    if (p.how === "stage" && (p.pid === leftPid() || p.pid === rightPid())) setTimeout(() => stageBanner(p.pid, p.stage), 350);
    else if (p.card && cardOf(p.card).color === "purple") sparkle(chipRect(p.pid), "#c7a2f2", 30);
  }
  if (last.kind === "salvage") { const p = last.plays[0]; banner(`art/${cid(p.card)}@2x.webp`, cardOf(p.card).name, `${nameOf(p.pid)} rebuilt it from the discard pile`); }
}

let lastBanner = 0;
function stageBanner(pid, n) {
  const P = V()?.players.find(p => p.id === pid); if (!P) return;
  const m = E.marvelOf(P.marvel), st = m[P.side][n - 1];
  const wait = Math.max(0, lastBanner + 1900 - Date.now()); lastBanner = Date.now() + wait;
  setTimeout(() => {
    banner(`art/${m.id}@2x.webp`, pid === S.me ? `Stage ${n} built!` : `${nameOf(pid)}: stage ${n}`, `${m.name} · ${[st.vp && `+${st.vp} points`, st.coins && `+${st.coins} coins`, st.shields && `+${st.shields} shields`, st.power && powerText(st.power)].filter(Boolean).join(" · ")}`);
    if (pid === S.me) burst();
  }, wait);
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
function sparkle(r, color, n = 36) {
  if (!r) return;
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  emit(n, () => { const a = rnd(0, 6.28), s = rnd(1.5, 5); return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, age: 0, life: rnd(30, 55), s: rnd(3, 7), c: color }; });
}
function burst() {
  const cols = ["#f7d98a", "#e9b52e", "#7aa2ff", "#7fd6a2", "#ff8a7a", "#c7a2f2"];
  emit(120, i => { const a = rnd(0, 6.28), s = rnd(2, 9); return { x: innerWidth / 2, y: innerHeight * .4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, age: 0, life: rnd(50, 100), s: rnd(4, 9), c: cols[i % 6] }; });
}
function banner(img, title, line) {
  const d = document.createElement("div"); d.className = "fx-banner";
  d.innerHTML = `${img ? `<img src="${img}" alt="">` : ""}<div class="t">${esc(title)}</div>${line ? `<div class="l">${esc(line)}</div>` : ""}`;
  document.body.append(d); setTimeout(() => d.remove(), 2400);
}
function welcome() {
  const words = "Welcome to Dhruv's Vibe Coded Seven Marvels".split(" ");
  const d = document.createElement("div"); d.className = "fx-welcome";
  const pics = ["kyros", "lumen", "selene", "khepri", "ishtara", "thalos", "mausra"];
  d.innerHTML = `<div class="wl-fan">${pics.map((m, i) => `<img src="art/${m}.webp" alt="" style="--i:${i - 3}">`).join("")}</div>
    <h1>${words.map((w, i) => `<span style="animation-delay:${.5 + i * .16}s">${w}</span>`).join(" ")}</h1><p>Manifest his greatness and you may win</p><small>Tap to start</small>`;
  document.body.append(d);
  // Always on screen for at least 3 whole seconds; after that a tap skips it.
  const shownAt = Date.now();
  const close = () => { if (Date.now() - shownAt < 3000 || d.classList.contains("out")) return; d.classList.add("out"); setTimeout(() => d.remove(), 500); };
  d.addEventListener("pointerdown", close); setTimeout(close, 5200); setTimeout(burst, 500);
}
function showBattles(b) {
  ui.overlay = "battle"; ui.battle = b; render();
  const mine = b.res.filter(r => r.pid === S.me);
  if (mine.some(r => r.token > 0)) setTimeout(() => sparkle(document.querySelector(".battle")?.getBoundingClientRect(), "#f7d98a", 50), 300);
  if (mine.some(r => r.token < 0)) { $app.classList.add("shake"); setTimeout(() => $app.classList.remove("shake"), 520); }
  setTimeout(() => { if (ui.overlay === "battle") { ui.overlay = V()?.phase === "gameOver" ? "over" : null; render(); } }, 4200);
}

// ---------------------------------------------------------------- views
const HS = hscroll(".hand,.opps,.tabs,.tbl");
let hsT = null;
function render() {
  if (dragging) { queued = true; return; }
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
  const dock = document.querySelector(".dock");
  if (dock) document.documentElement.style.setProperty("--dockh", dock.offsetHeight + "px");
}

const rulesBtn = (cls = "ghost small") => `<button class="btn ${cls}" data-act="rules">Rules</button>`;
const fan = ids => `<div class="fan">${ids.map((id, i) => `<img src="art/${id}.webp" alt="" style="transform:rotate(${(i - (ids.length - 1) / 2) * 9}deg) translateY(${Math.abs(i - (ids.length - 1) / 2) * 8}px)">`).join("")}</div>`;

function viewLanding() {
  return `<div class="page">${inAppHint()}<div class="hero">${fan(["herostatue", "kyros", "startower", "citadel"])}
      <div class="eyebrow">Games4free · 7 Wonders rules</div><h1 class="title">Seven Marvels</h1>
      <p class="muted" style="max-width:40ch;margin:0">Lead an ancient city through three Ages. Trade with your neighbours, raise armies, chase science and build your Marvel. 3–7 players, everyone plays at once.</p></div>
    <form class="panel" data-form="create"><label for="nm" class="eyebrow">Your name</label>
      <div class="row"><input id="nm" type="text" maxlength="18" autocomplete="nickname" placeholder="e.g. Dhruv" value="${esc(room.lastName())}" required><button class="btn" type="submit">Start a game</button></div>
      <div class="err">${esc(S.error)}</div></form>
    <div class="row" style="justify-content:center">${rulesBtn()}<a class="btn ghost small" href="../">All games</a></div></div>`;
}

function viewJoin() {
  const busy = S.mode === "connecting";
  return `<div class="page">${inAppHint()}<div class="hero">${fan(["lumen", "khepri", "selene"])}
      <div class="eyebrow">You're invited to a game of</div><h1 class="title">Seven Marvels</h1></div>
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
    <p class="muted" style="margin:0;font-size:15px">Your city, hand and coins come with you. If that seat is open on another device, it moves here.</p><div class="err">${esc(S.error || S.status)}</div></section>
    <div class="row" style="justify-content:center">${rulesBtn()}</div></div>`;
}

function viewLobby() {
  const L = S.lobby; if (!L) return "";
  const host = room.isHost, n = L.players.length, st = E.setupFor(Math.max(3, Math.min(7, n)));
  const link = room.linkFor(L.code), side = L.settings.side || "A";
  return `<div class="page"><div class="hero" style="gap:4px"><div class="eyebrow">Table ${esc(L.code)}</div><h1 class="title" style="font-size:44px">Lobby</h1></div>
    <section class="panel"><div class="eyebrow">Invite players</div>
      <div class="share"><code id="link">${esc(link)}</code><button class="btn small" data-act="share">Share link</button><button class="btn ghost small" data-act="copy">Copy</button></div>
      <p class="muted" style="margin:0;font-size:15px">Anyone with the link types a name and joins. 3–7 players. If someone drops out, the game keeps going and they can rejoin from any device.</p></section>
    <section class="panel"><div class="eyebrow">Players · ${n}/7</div><ul class="plist">${L.players.map((p, i) => `<li><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span style="flex:1">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}${p.id === L.hostId ? " <span class='badge'>HOST</span>" : ""}</span>
      <span class="dot ${p.online ? "" : "off"}"></span>${host && p.id !== S.me ? `<button class="btn ghost small" data-act="kick" data-pid="${p.id}">Remove</button>` : ""}</li>`).join("")}</ul>
      ${n < 3 ? `<p class="muted" style="margin:0">Waiting for at least ${3 - n} more player${3 - n > 1 ? "s" : ""}…</p>` : ""}</section>
    <section class="panel"><div class="eyebrow">This table</div>
      <dl class="setup"><dt>Cards each Age</dt><dd>${st.cardsPerAge} (7 each)</dd><dt>Guilds in Age III</dt><dd>${st.guilds}</dd><dt>Starting coins</dt><dd>3</dd><dt>Cities</dt><dd>Dealt at random</dd></dl>
      <div class="row" style="justify-content:space-between"><span>Marvel side</span><span class="seg">${[["A", "A · simpler"], ["B", "B"], ["random", "Random"]].map(([v, l]) => `<button aria-pressed="${side === v}" ${host ? `data-act="side" data-v="${v}"` : "disabled"}>${l}</button>`).join("")}</span></div>
      <div class="row" style="justify-content:space-between"><span>Turn timer</span><span class="seg">${[[30, "30 s"], [60, "1 min"], [120, "2 min"]].map(([v, l]) => `<button aria-pressed="${(L.settings.timer || 60) === v}" ${host ? `data-act="timer" data-v="${v}"` : "disabled"}>${l}</button>`).join("")}</span></div>
      <p class="muted" style="margin:0;font-size:14px">When time runs out, the game picks the best card it can find for whoever hasn't chosen.</p></section>
    ${soundRow()}
    <div class="row" style="justify-content:center">${host ? `<button class="btn" data-act="start" ${n < 3 ? "disabled" : ""}>Start game</button>` : `<span class="muted">Waiting for the host to start…</span>`}${rulesBtn()}</div>
    <div class="err" style="text-align:center">${esc(S.error || S.status)}</div></div>`;
}

function prodHtml(units, max = 99) {
  const counts = {};
  for (const u of units) { const k = u.join("/"); counts[k] = (counts[k] || 0) + 1; }
  return Object.entries(counts).slice(0, max).map(([k, n]) => {
    const u = k.split("/");
    return u.length === 1 ? `<span class="grp">${resIc(u[0]).repeat(n)}</span>` : `<span class="grp or">${n > 1 ? n + "×" : ""}${u.length === 4 ? "any raw" : u.length === 3 ? "any good" : unitHtml(u)}</span>`;
  }).join("");
}

function oppChip(p, lead, pop) {
  const v = V(), i = seatOf(p.id), w = v.waiting.includes(p.id), off = S.online[p.id] === false;
  const isNb = p.id === leftPid() || p.id === rightPid();
  const m = E.marvelOf(p.marvel), stTot = m[p.side].length;
  const tok = p.tokens.reduce((s, t) => s + t, 0);
  const pickTxt = v.phase === "pick" ? (p.picked ? `<span class="pk ok">✓ picked</span>` : `<span class="pk">choosing…</span>`) : w ? `<span class="pk">${v.phase === "salvage" ? "searching the discard…" : "playing 7th card…"}</span>` : "";
  return `<div class="opp ${isNb ? "nb" : ""} ${w ? "wait" : ""}" data-pid="${p.id}" data-act="player">
    ${p.id === lead ? CROWN.replace('class="crown"', `class="crown${pop ? " pop2" : ""}"`) : ""}
    <div class="side">${p.id === leftPid() ? "◀ Left" : p.id === rightPid() ? "Right ▶" : esc(m.city)}${isNb ? ` · ${esc(m.city)}` : ""}</div>
    <div class="nm"><span class="av" style="background:${SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span><span class="pn">${esc(p.name)}</span>${S.bots?.includes(p.id) ? `<span class="badge bot" title="Left the game: a bot is playing">BOT</span>` : off ? `<span class="badge off">OFF</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span><span class="pts">${p.points}</span></div>
    <div class="stat"><span>${ic("coin")}${p.coins}</span><span>${ic("shield")}${p.shields}</span><span>▲${p.stages}/${stTot}</span>${tok ? `<span>${tok > 0 ? "+" : ""}${tok}⚔</span>` : ""}</div>
    <div class="prod">${prodHtml(p.produce.slice(0, p.trade), 6)}</div>${pickTxt}</div>`;
}

function marvelHtml(p, mine) {
  const m = E.marvelOf(p.marvel), stages = m[p.side];
  return `<div class="marvel" id="marvel" style="background-image:${artSet(m.id)}"><div class="stages">${stages.map((s, i) => `<div class="stg ${i < p.stages ? "done" : i === p.stages ? "next" : ""}">
      <div class="c">${i < p.stages ? "✓ built" : costHtml(s.cost)}</div>
      <div class="g">${[s.vp && `${ic("vp")}${s.vp}`, s.coins && `${ic("coin")}${s.coins}`, s.shields && ic("shield").repeat(s.shields), s.power && powerShort(s.power)].filter(Boolean).join(" ")}</div></div>`).join("")}</div></div>`;
}
function powerShort(p) {
  return { anyRaw: `${ic("wood")}/${ic("stone")}/${ic("clay")}/${ic("ore")}`, anyGoods: `${ic("glass")}/${ic("cloth")}/${ic("papyrus")}`, science: ic("wild"), freeBuild: "free ★", tradeRaw: `◀${ic("coin")}1▶`, copyGuild: "copy guild", salvage: "discard ↺", seventh: "7th card" }[p] || "";
}

function stacksHtml(p) {
  const by = {};
  for (const b of p.built) (by[cardOf(b).color] ||= []).push(b);
  return COLORS.filter(k => by[k]).map(k => by[k].map(b => `<span class="stk" style="background:var(--${k})" data-card-info="${b}">${esc(cardOf(b).name)}</span>`).join("")).join("") || `<span class="muted" style="font-size:14px">No buildings yet. Drag a card up to build.</span>`;
}

function viewGame() {
  const v = V(), P = me(), lead = leaderOf(v);
  const pop = lead && lead !== ui.leader; ui.leader = lead;
  const n = v.players.length;
  const order = Array.from({ length: n - 1 }, (_, k) => pidAt(-(k + 1))).map(id => v.players.find(p => p.id === id));
  const passName = nameOf(v.passTo);
  const sci = P.science, tok = P.tokens.reduce((s, t) => s + t, 0);
  const city = `<section class="city" id="city">
      <div class="cityhead">${P.id === lead ? `<span style="position:relative;width:28px;height:20px">${CROWN.replace('class="crown"', 'class="crown" style="top:0"')}</span>` : ""}
        <h2><small>Your city · side ${P.side}</small>${esc(E.marvelOf(P.marvel).city)} — ${esc(E.marvelOf(P.marvel).name)}</h2>
        <span class="tmr big" data-tmr="${S.me}"></span><span class="pts">${P.points}<small> pts</small></span></div>
      ${marvelHtml(P, true)}
      <div class="stats"><span class="coins-me">${ic("coin")}${P.coins}</span><span>${ic("shield")}${P.shields}</span>
        <span>${ic("compass")}${sci.compass} ${ic("gear")}${sci.gear} ${ic("tablet")}${sci.tablet}</span>${P.tokens.length ? `<span>⚔ ${tok > 0 ? "+" : ""}${tok}</span>` : ""}
        ${P.freeReady ? `<span style="color:var(--good)">★ free build ready</span>` : ""}</div>
      <div class="res">${prodHtml(P.produce)}</div>
      <div class="stacks">${stacksHtml(P)}</div></section>`;
  return `<div id="table">
    <div class="bar"><div class="info"><span class="agebox"><small>AGE</small>${ROMAN[v.age - 1]}</span>
      <span style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="turnpips">${[1, 2, 3, 4, 5, 6].map(t => `<i class="${t < v.turn ? "on" : t === v.turn ? "now" : ""}"></i>`).join("")}</span>
      <span class="passdir">${v.age === 2 ? "Hands pass right ▶" : "◀ Hands pass left"} · to ${esc(passName)}</span></span>${S.net ? "" : `<span class="badge off">OFFLINE</span>`}</div>
      <button class="btn ghost small" data-act="leave-ask" aria-label="Leave the game"><span aria-hidden="true">🚪</span><span class="lvt">Leave</span></button><button class="btn ghost small" data-act="scores">Scores</button>${rulesBtn("small")}</div>
    <div class="scroll"><div class="opps">${order.map(p => oppChip(p, lead, pop)).join("")}</div>${city}</div>
    ${dockHtml()}
    <div class="zones" id="zones">${["build", "stage", "sell"].map(h => `<div class="zone" data-how="${h}"><b>${{ build: "Build", stage: "Marvel stage", sell: "Sell" }[h]}</b><span></span></div>`).join("")}</div></div>`;
}

function dockHtml() {
  const v = V();
  let head = "", hand = "";
  if (v.phase === "gameOver") head = `<span class="status">Game over</span><button class="btn small" data-act="final">Final scores</button>`;
  else if (v.phase === "salvage") head = v.waiting.includes(S.me) ? `<span class="status you">Royal Tomb: build one card from the discard pile, free</span><button class="btn small" data-act="open-salvage">Open discard pile</button>` : `<span class="status">${esc(nameOf(v.waiting[0]))} is searching the discard pile…</span>`;
  else if (v.phase === "extra") head = v.waiting.includes(S.me) ? `<span class="status you">Hanging Terraces: play your 7th card too</span>` : `<span class="status">${esc(nameOf(v.waiting[0]))} is playing their 7th card…</span>`;
  else if (v.pick) {
    const c = cardOf(v.pick.card);
    const left = v.waiting.filter(x => x !== S.me);
    head = `<span class="status you">${{ build: "Build", free: "Build free", stage: "Marvel stage with", sell: "Sell" }[v.pick.how]} <b>${esc(c.name)}</b>. ${left.length ? `Waiting for ${esc(left.map(nameOf).join(", "))}…` : ""}</span><button class="btn ghost small" data-act="unpick">Change</button>`;
  } else if (v.phase === "pick") head = `<span class="status you">${v.turn === 6 ? "Last turn of the Age: pick 1 of your 2 cards" : "Drag a card up, or tap it, to choose"}</span>`;
  const showHand = (v.phase === "pick" || v.phase === "extra") && v.hand?.length;
  if (showHand) hand = v.hand.map(c => cardHtml(c, v.pick ? (v.pick.card === c ? "chosen" : "dim") : "", badgeFor(v.options[c]))).join("");
  return `<div class="dock" id="dock"><div class="dockhead">${head}</div><div class="hand">${hand}</div></div>`;
}

// ---------------------------------------------------------------- overlays
const sheet = (title, body, foot = "", lock = false) => `<div class="overlay" ${lock ? "" : `data-act="closebg"`}><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
  <div class="sheethead"><h2>${esc(title)}</h2>${lock ? "" : `<button class="btn ghost small" data-act="close">Close</button>`}</div>${body}${foot}</div></div>`;

function viewOverlay() {
  const v = V();
  let h = "";
  if (ui.overlay === "leave" && v) h = sheet("Leave the game?", `<div class="sheetbody"><p style="margin-top:0">A bot will play your seat for the rest of this game, so everyone else can finish. Your score stays on the board. Changed your mind? Open the same link and tap <b>This is me</b> to take your seat back.</p><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="leave">Leave the game</button><button class="btn ghost" data-act="close">Stay</button></div></div>`);
  else if (ui.overlay === "rules") h = sheet("Rules", rulesTabs() + `<div class="sheetbody guide">${soundRow()}${rulesBody()}</div>`);
  else if (ui.overlay === "card" && v) h = sheet(cardOf(ui.card).name, `<div class="sheetbody">${cardDetail()}</div>`);
  else if (ui.overlay === "info" && v) h = sheet(cardOf(ui.card).name, `<div class="sheetbody">${cardInfo(ui.card)}</div>`);
  else if (ui.overlay === "player" && v) h = sheet(ui.player === S.me ? "Your city" : `${nameOf(ui.player)}'s city`, `<div class="sheetbody">${playerDetail()}</div>`);
  else if (ui.overlay === "scores" && v) h = sheet("Scores so far", `<div class="sheetbody">${scoreTable(false)}</div>`);
  else if (ui.overlay === "salvage" && v?.salvage) h = sheet("Royal Tomb", `<div class="sheetbody"><p style="margin-top:0">Build one card from the discard pile for free.</p><div class="cardgrid">${v.salvage.map(c => cardHtml(c, "", "")).join("")}</div>
      <div class="row" style="margin-top:14px">${v.salvage.map(c => `<button class="btn small" data-act="salvage" data-card="${c}">Build ${esc(cardOf(c).name)}</button>`).join("")}<button class="btn ghost small" data-act="salvage-skip">Take nothing</button></div></div>`, "", true);
  else if (ui.overlay === "battle" && v && ui.battle) h = sheet(`Battles of Age ${ROMAN[ui.battle.age - 1]}`, `<div class="sheetbody">${battleBody(ui.battle)}</div>`);
  else if (ui.overlay === "over" && v?.phase === "gameOver") h = sheet("Final scores", `<div class="sheetbody">${podium()}${scoreTable(true)}</div>`, `<div class="row" style="justify-content:center;padding:6px 16px 16px">${room.isHost ? `<button class="btn" data-act="again">Play again</button>` : `<span class="muted">The host can start a new game.</span>`}</div>`);
  return h;
}

function rulesTabs() {
  const t = [["basics", "How to play"], ["cards", "Cards"], ["marvels", "Marvels"], ["scoring", "Scoring"], ["full", "Full rules"]];
  return `<div class="tabs" role="tablist">${t.map(([k, l]) => `<button role="tab" aria-selected="${ui.tab === k}" data-act="tab" data-k="${k}">${l}</button>`).join("")}</div>`;
}
function rulesBody() {
  const n = V()?.players.length || S.lobby?.players.length || 4;
  if (ui.tab === "full") return RULES.full.replace("<!--SETUP-->", setupTable(n));
  return RULES[ui.tab] || RULES.basics;
}

function payText(o, verb = "Pay") {
  if (o.chain) return "Free: you own the chain building ⛓";
  if (!o.total) return "Free";
  const bits = [];
  if (o.coins) bits.push(`${o.coins} to the bank`);
  if (o.left) bits.push(`${o.left} to ${nameOf(leftPid())} (left)`);
  if (o.right) bits.push(`${o.right} to ${nameOf(rightPid())} (right)`);
  return `${verb} ${o.total} coin${o.total > 1 ? "s" : ""}: ${bits.join(", ")}`;
}
const whyNot = o => o.why || (o.missing?.length ? (o.missing[0] === "coins" ? "Not enough coins" : `Nobody nearby makes ${[...new Set(o.missing)].map(r => E.RES_NAME[r] || r).join(", ")}`) : "Can't afford it");

function choicesFor(inst) {
  const v = V(), o = v.options[inst], P = me(), m = E.marvelOf(P.marvel), st = m[P.side][P.stages];
  const go = canPick();
  const row = (how, title, sub, ok) => `<div class="choice ${ok ? "" : "no"}"><div class="what"><b>${title}</b><span>${esc(sub)}</span></div>
    <button class="btn small" data-act="pick" data-how="${how}" data-card="${inst}" ${ok && go ? "" : "disabled"}>${{ build: "Build", free: "Build free", stage: "Build stage", sell: "Sell" }[how]}</button></div>`;
  let h = row("build", `Build ${cardOf(inst).name}`, o.build.ok ? payText(o.build) : whyNot(o.build), o.build.ok);
  if (o.free) h += row("free", "Build it free (Sky Father's power)", "Once per Age", true);
  h += st ? row("stage", `Marvel stage ${P.stages + 1}`, o.stage.ok ? `${payText(o.stage)}. Gives ${[st.vp && `${st.vp} points`, st.coins && `${st.coins} coins`, st.shields && `${st.shields} shields`, st.power && powerText(st.power)].filter(Boolean).join(", ")}` : whyNot(o.stage), o.stage.ok)
    : `<div class="choice no"><div class="what"><b>Marvel complete</b><span>Every stage is built.</span></div></div>`;
  h += row("sell", "Sell for 3 coins", "The card goes face down to the discard pile", true);
  return `<div class="choices">${h}</div>${go ? "" : `<p class="muted" style="margin:0;font-size:14px">${v.pick ? "You've already chosen. Tap Change to pick again." : "Wait for your next pick."}</p>`}`;
}

function cardInfo(inst) {
  const c = cardOf(inst), lt = leadsTo(c.id);
  return `<div class="detail"><div class="big">${cardHtml(inst)}</div><div class="info">
    <div class="eyebrow">${COLOR_NAME[c.color]} · Age ${Object.keys(c.ages).map(a => ROMAN[a - 1]).join(" & ")}</div>
    <p style="margin:0">${esc(describe(c))}</p>
    <p class="muted" style="margin:0;font-size:14px">Cost: ${Object.keys(c.cost).length ? Object.entries(c.cost).map(([k, n]) => `${n} ${k === "coins" ? "coin" + (n > 1 ? "s" : "") : E.RES_NAME[k]}`).join(", ") : "free"}${c.chain.length ? ` · free if you own ${esc(chainNames(c.chain))} ⛓` : ""}${lt.length ? ` · makes ${esc(lt.join(", "))} free later` : ""}</p></div></div>`;
}
function cardDetail() { return cardInfo(ui.card).replace(/<\/div><\/div>$/, `${(V().hand || []).includes(ui.card) ? choicesFor(ui.card) : ""}</div></div>`); }

function playerDetail() {
  const v = V(), p = v.players.find(x => x.id === ui.player); if (!p) return "";
  const m = E.marvelOf(p.marvel);
  return `<div class="guide"><h3>${esc(m.city)}: ${esc(m.name)} (side ${p.side})</h3>${marvelHtml(p, false)}
    <h3>${p.points} points so far · ${ic("coin")}${p.coins} · ${ic("shield")}${p.shields} · tokens ${p.tokens.map(t => (t > 0 ? "+" : "") + t).join(" ") || "none"}</h3>
    <p class="muted" style="margin:0">Produces: </p><div class="res">${prodHtml(p.produce)}</div>
    <p class="muted" style="margin:6px 0 0">${p.id === S.me ? "" : `Your neighbours can buy only from the start resource, brown and grey cards.`}</p>
    <h3>Buildings (${p.built.length})</h3><div class="cardgrid">${p.built.map(b => cardHtml(b)).join("") || `<span class="muted">None yet</span>`}</div></div>`;
}

const sq = k => `<i style="display:inline-block;width:.9em;height:.9em;border-radius:3px;background:var(--${k});vertical-align:-.1em"></i>`;
const CATS = [["military", ic("shield"), "Battles"], ["treasury", ic("coin"), "Coins"], ["marvel", "▲", "Marvel"], ["civic", sq("blue"), "Civic"], ["science", ic("compass"), "Science"], ["commerce", sq("yellow"), "Commerce"], ["guilds", sq("purple"), "Guilds"]];
function scoreTable(final) {
  const v = V();
  const rows = final && v.result ? v.result.rows.map(r => ({ ...r, id: r.pid })) : v.players.map(p => ({ ...p.score, id: p.id, coins: p.coins })).sort((a, b) => b.total - a.total || b.coins - a.coins);
  const wins = v.result?.winners || [];
  return `<div class="tbl"><table><tr><th>Player</th>${CATS.map(([, i, l]) => `<th title="${l}" aria-label="${l}">${i}</th>`).join("")}<th>Σ</th></tr>${rows.map(r =>
    `<tr class="${final && wins.includes(r.id) ? "win" : ""}"><td>${esc(nameOf(r.id))}</td>${CATS.map(([k]) => `<td>${r[k]}</td>`).join("")}<td><b>${r.total}</b></td></tr>`).join("")}</table></div>
    <p class="muted" style="font-size:13px;margin-bottom:0">${CATS.map(([, i, l]) => `${i} ${l}`).join(" · ")} · Σ total</p>
    <p class="muted" style="font-size:13px">${final ? "Ties go to the player with more coins." : "Points so far, if the game ended now. Science counts the best use of any wildcards."}</p>`;
}
function podium() {
  const v = V(), r = v.result; if (!r) return "";
  const lead = leaderOf(v);
  return `<div class="podium" style="margin-bottom:14px">${r.rows.map((row, i) => `<div class="p ${r.winners.includes(row.pid) ? "win" : ""}"><span class="av" style="background:${SEAT[seatOf(row.pid)]}">${i + 1}</span>
    <span>${esc(nameOf(row.pid))}</span>${row.pid === lead ? CROWN : ""}<span class="muted" style="font-size:13px">${ic("coin")}${row.coins}</span><span class="pts">${row.total}</span></div>`).join("")}</div>`;
}
function battleBody(b) {
  const mine = b.res.filter(r => r.pid === S.me);
  const t = r => (r.token > 0 ? `<span class="tok w">+${r.token}</span>` : r.token < 0 ? `<span class="tok l">−1</span>` : `<span class="tok t">tie</span>`);
  return `<p style="margin-top:0">Shields are compared with each neighbour. Win: +${E.AGE_WIN[b.age]}, lose: −1.</p>
    <div class="battle">${mine.map(r => `<span>You ${ic("shield")}${r.me}</span>${t(r)}<span style="text-align:right">${esc(nameOf(r.vs))} ${ic("shield")}${r.them}</span>`).join("")}</div>
    <h3 class="eyebrow" style="margin:18px 0 6px">Whole table</h3>
    <div class="tbl"><table><tr><th>Player</th><th>Shields</th><th>Tokens this Age</th></tr>${V().players.map(p => {
      const rs = b.res.filter(r => r.pid === p.id);
      return `<tr><td>${esc(nameOf(p.id))}</td><td>${rs[0]?.me ?? 0}</td><td>${rs.map(r => (r.token > 0 ? "+" + r.token : r.token < 0 ? "−1" : "·")).join(" ")}</td></tr>`;
    }).join("")}</table></div>`;
}

// ---------------------------------------------------------------- input: taps
$app.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  const cardEl = e.target.closest(".hand .hc[data-card]");
  if (cardEl && !e.target.closest(".overlay")) { ui.card = cardEl.dataset.card; ui.overlay = "card"; render(); return; }
  const info = e.target.closest("[data-card-info], .overlay .cardgrid .hc[data-card], .pop .hc[data-card]");
  if (info && !el) { ui.card = info.dataset.cardInfo || info.dataset.card; ui.overlay = ui.overlay === "salvage" ? "salvage" : "info"; if (ui.overlay === "info") render(); return; }
  if (!el) return;
  const a = el.dataset.act;
  switch (a) {
    case "sound": alerts.toggle(); break;
    case "rules": ui.overlay = "rules"; break;
    case "scores": ui.overlay = "scores"; break;
    case "leave-ask": ui.overlay = "leave"; break;
    case "leave": ui.overlay = null; room.leave(); return;
    case "rejoin": room.rejoin(); return;
    case "final": ui.overlay = "over"; break;
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
    case "side": room.settings({ side: el.dataset.v }); return;
    case "player": ui.player = el.dataset.pid; ui.overlay = "player"; break;
    case "pick": ui.overlay = null; doPick(el.dataset.card, el.dataset.how); return;
    case "unpick": room.act({ type: "unpick" }); return;
    case "open-salvage": ui.overlay = "salvage"; break;
    case "salvage": ui.overlay = null; room.act({ type: "salvage", card: el.dataset.card }); return;
    case "salvage-skip": ui.overlay = null; room.act({ type: "salvage", card: null }); return;
    default: return;
  }
  render();
});

function doPick(card, how) {
  room.act({ type: "pick", card, how });
  navigator.vibrate?.(12);
}

$app.addEventListener("submit", e => {
  e.preventDefault();
  const name = e.target.querySelector("#nm")?.value.trim(); if (!name) return;
  if (e.target.dataset.form === "create") room.create(name);
  if (e.target.dataset.form === "join") room.join(name);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.overlay && !["salvage"].includes(ui.overlay)) { ui.overlay = null; render(); } });

// ---------------------------------------------------------------- input: drag a card up onto Build / Marvel stage / Sell
function zoneInfo(inst) {
  const o = V().options[inst], P = me(), st = E.marvelOf(P.marvel)[P.side][P.stages];
  return {
    build: o.build.ok ? [true, payText(o.build)] : o.free ? [true, "Free with your Sky Father's power"] : [false, whyNot(o.build)],
    stage: !st ? [false, "Your Marvel is complete"] : o.stage.ok ? [true, `Stage ${P.stages + 1} · ${payText(o.stage)}`] : [false, whyNot(o.stage)],
    sell: [true, "+3 coins"],
  };
}
const zoneAt = (x, y) => [...document.querySelectorAll(".zone")].find(z => { const r = z.getBoundingClientRect(); return x > r.left && x < r.right && y > r.top && y < r.bottom; });

$app.addEventListener("pointerdown", e => {
  const el = e.target.closest(".hand .hc[data-card]");
  if (!el || e.target.closest(".overlay") || e.button > 0) return;
  dragging = { el, id: el.dataset.card, x0: e.clientX, y0: e.clientY, moved: false };
});
$app.addEventListener("pointermove", e => {
  const d = dragging; if (!d) return;
  if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 10) return;
  if (!d.moved) {
    // a sideways swipe scrolls the hand; only an upward drag picks the card up
    if (Math.abs(e.clientX - d.x0) > Math.abs(e.clientY - d.y0) * 1.2 || !canPick() || V().pick) { dragging = null; if (queued) { queued = false; render(); } return; }
    d.moved = true; e.preventDefault();
    const r = d.el.getBoundingClientRect(); d.w = r.width; d.h = r.height;
    d.g = document.createElement("div"); d.g.className = "dragghost"; d.g.style.width = r.width + "px";
    d.g.innerHTML = d.el.outerHTML; document.body.append(d.g);
    d.el.style.opacity = ".3";
    const zi = zoneInfo(d.id), zs = document.getElementById("zones");
    for (const z of zs.querySelectorAll(".zone")) { const [ok, txt] = zi[z.dataset.how]; z.classList.toggle("no", !ok); z.querySelector("span").textContent = txt; }
    zs.classList.add("on");
  }
  d.g.style.transform = `translate(${e.clientX - d.w / 2}px,${e.clientY - d.h * .6}px) rotate(${Math.max(-10, Math.min(10, (e.clientX - d.x0) / 20))}deg) scale(1.06)`;
  const z = zoneAt(e.clientX, e.clientY);
  for (const x of document.querySelectorAll(".zone")) x.classList.toggle("hot", x === z);
});
function endDrag(e) {
  const d = dragging; dragging = null; if (!d) return;
  if (d.moved) {
    d.g?.remove(); d.el.style.opacity = "";
    document.getElementById("zones")?.classList.remove("on");
    const z = e && zoneAt(e.clientX, e.clientY);
    for (const x of document.querySelectorAll(".zone")) x.classList.remove("hot");
    if (z) {
      const how = z.dataset.how, zi = zoneInfo(d.id);
      if (zi[how][0]) doPick(d.id, how === "build" && !V().options[d.id].build.ok ? "free" : how);
      else { toast(esc(zi[how][1])); ui.card = d.id; ui.overlay = "card"; queued = true; }
    }
    const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
    addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", swallow, { capture: true }), 350);
  }
  if (queued) { queued = false; render(); }
}
$app.addEventListener("pointerup", endDrag);
$app.addEventListener("pointercancel", () => { if (dragging?.g) { dragging.g.remove(); dragging.el.style.opacity = ""; document.getElementById("zones")?.classList.remove("on"); } dragging = null; if (queued) { queued = false; render(); } });

async function share() {
  const url = room.linkFor(S.code);
  if (navigator.share) { try { await navigator.share({ title: "Seven Marvels", text: "Join my game of Seven Marvels:", url }); return; } catch (e) { if (e.name === "AbortError") return; } }
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
    if (!c || !c.waiting?.includes(el.dataset.tmr) || (V()?.phase === "pick" && V().players.find(p => p.id === el.dataset.tmr)?.picked)) { el.textContent = ""; continue; }
    const sec = Math.ceil(c.left / 1000);
    el.textContent = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : `${sec}s`;
    el.classList.toggle("low", sec <= 10);
    if (el.dataset.tmr === S.me && sec <= 10 && buzzed !== V()?.seq) { buzzed = V()?.seq; alerts.hurry(); }
  }
}, 250);

// keep phones awake
async function wake() { try { await navigator.wakeLock?.request("screen"); } catch { /* not allowed */ } }
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && S.mode === "game" && wake());

// Fetch the rest of the art in the background (Age I first) so hands never show blank cards.
{
  const hi = (devicePixelRatio || 1) > 1 ? "@2x" : "";
  const age = c => Math.min(...Object.keys(c.ages || { 3: 1 }).map(Number));
  preload([...DATA.cards.slice().sort((a, b) => age(a) - age(b)).map(c => c.id), ...DATA.marvels.map(m => m.id)].map(id => `art/${id}${hi}.webp`));
}

// ---------------------------------------------------------------- boot
(function boot() {
  if (S.code) { const n = room.savedName(); if (n) { wake(); return room.join(n); } S.mode = "join"; }
  render();
})();

addEventListener("resize", () => S.mode === "game" && render());   // turning the phone changes the dock height
window.__mar = { S, room, ui, E };
