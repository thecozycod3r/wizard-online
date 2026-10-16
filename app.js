import * as E from "./engine.js";
import { openBus, newCode } from "./net.js";
import { SPECIAL_CARDS } from "./specials.js";
import { playFx, burst, welcome } from "./fx.js";

const CROWN = `<svg class="crown" viewBox="0 0 30 22" aria-label="Leader"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".55" stop-color="#f2c14e"/><stop offset="1" stop-color="#b7832a"/></linearGradient></defs><path d="M2 7l6.5 5L15 2l6.5 10L28 7l-2.6 12H4.6z" fill="url(#cg)" stroke="#7a5418" stroke-width="1.2" stroke-linejoin="round"/><rect x="4.4" y="17.6" width="21.2" height="3.4" rx="1.2" fill="url(#cg)" stroke="#7a5418" stroke-width="1"/><circle cx="15" cy="2.6" r="1.8" fill="#ff5a6e"/><circle cx="2.4" cy="7" r="1.5" fill="#7fd0ff"/><circle cx="27.6" cy="7" r="1.5" fill="#7fd0ff"/></svg>`;

// ---------------------------------------------------------------- utils
const $app = document.getElementById("app");
const params = new URLSearchParams(location.search);
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage off */ } },
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
const SEAT_COLORS = ["#e3c375", "#6fa0ff", "#45c983", "#f0675d", "#b48cff", "#f19ad2"];
const SUIT_HEX = { blue: "var(--blue)", green: "var(--green)", red: "var(--red)", yellow: "var(--yellow)" };
const img = (id, cls = "") => `<img class="${cls}" src="cards/${id}.webp" srcset="cards/${id}.webp 1x, cards/${id}@2x.webp 2x" alt="${esc(E.cardLabel(id))}" draggable="false">`;
const linkFor = code => `${location.origin}${location.pathname}?g=${code}`;
const DEFAULT_SETTINGS = { specials: [...E.SPECIALS], dealerRule: true, penalty: "house", rounds: 0 };

// ---------------------------------------------------------------- state
const S = {
  mode: "landing", role: null, code: params.get("g"), me: null,
  lobby: null, view: null, online: {}, status: "", error: "",
  fxQueue: [], seenPlays: new Set(), leader: null,
  ui: { sel: null, overlay: null, guideTab: "specials", decl: {}, witchGive: null, witchTake: null, zoom: null, lastToastSeq: -1 },
};
let H = null;       // set while THIS device runs the table: { code, epoch, n, me, players:[{id,name,token}], settings, G }
let BUS = null;     // shared realtime channel
let ME = null;      // { token, name } for this device at this table
let lastState = null, lastStateAt = 0, pendingAct = null, wasSeated = false;
let dragging = null, renderQueued = false;
const meKey = () => "wiz-me-" + S.code, stateKey = () => "wiz-state-" + S.code;
S.onlineSet = new Set(); S.net = true;
const isOnline = pid => pid === S.me ? S.net : S.onlineSet.has(pid);
const seatIdx = (st, pid) => st.players.findIndex(p => p.id === pid);

// ---------------------------------------------------------------- table runner ("host")
function snapshot() { return { code: H.code, epoch: H.epoch, n: H.n, hostPid: H.me, players: H.players, settings: H.settings, G: H.G }; }
function hostSave() { LS.set(stateKey(), snapshot()); }

function hostBroadcast(bump = true) {
  if (!H) return;
  if (bump) H.n += 1;
  const st = structuredClone(snapshot());
  hostSave();
  BUS?.send("state", st);
  applyState(st);
}

function lobbyState() { return S.lobby; }

function hostApply(pid, a, quiet) {
  if (!H?.G) return;
  if (["resolve", "nextRound"].includes(a?.type) && pid !== H.me) return;
  try { E.act(H.G, pid, a); }
  catch (e) { if (!quiet) hostSendErr(pid, e.message); return; }
  if (H.G.phase === "trickShow") scheduleResolve();
  hostBroadcast();
}

function hostSendErr(pid, m) {
  if (pid === H.me) return toast(m);
  const p = H.players.find(p => p.id === pid);
  if (p) BUS?.send("err", { token: p.token, msg: m });
}

let resolveTimer = null;
function scheduleResolve() {
  clearTimeout(resolveTimer);
  const seq = H.G.seq;
  resolveTimer = setTimeout(() => { if (H?.G?.phase === "trickShow" && H.G.seq === seq) hostApply(H.me, { type: "resolve" }); }, 2100);
}

function hostStart() {
  if (H.players.length < 3) return toast("You need at least 3 players.");
  try { H.G = E.newGame(H.players, H.settings); } catch (e) { return toast(e.message); }
  hostBroadcast();
}

function onHello(m) {
  if (!H || !m?.token) return;
  const name = String(m.name || "").trim().slice(0, 18) || "Player";
  let p = H.players.find(p => p.token === m.token);
  if (!p && !H.G) {
    // Same name as a player who isn't connected: give them their seat back (new device / new browser).
    p = H.players.find(x => x.name.toLowerCase() === name.toLowerCase() && !isOnline(x.id) && x.id !== H.me);
    if (p) p.token = String(m.token).slice(0, 40);
  }
  if (!p) {
    if (H.G) return hostBroadcast(); // they'll see the "which player are you?" screen
    if (H.players.length >= 6) return BUS.send("err", { token: m.token, msg: "The table is full (6 players)." });
    p = { id: "p" + rid().slice(0, 6), token: String(m.token).slice(0, 40), name };
    H.players.push(p);
  } else if (!H.G) p.name = name;
  hostBroadcast();
}

function onClaim(m) {
  if (!H || !m?.token) return;
  const p = H.players.find(p => p.id === m.pid);
  if (!p) return;
  p.token = String(m.token).slice(0, 40);
  hostBroadcast();
}

function onAct(m) {
  if (!H || !m?.token) return;
  const p = H.players.find(p => p.token === m.token);
  if (p) hostApply(p.id, m.a, m.retry);
}

// Become the device that runs the table (after the previous one went quiet).
function takeOver(from, why) {
  H = { ...structuredClone(from), me: S.me, epoch: from.epoch + 1 };
  delete H.hostPid;
  if (why) toast(why);
  if (H.G?.phase === "trickShow") scheduleResolve();
  hostBroadcast();
}

function stopHosting(msg) {
  H = null; clearTimeout(resolveTimer);
  if (msg) toast(msg);
}

// ---------------------------------------------------------------- everyone
function onState(st) {
  if (!st || st.code !== S.code) return;
  if (H && st.hostPid !== H.me) {
    // Two devices think they run the table: newer epoch wins, then the lower seat.
    if (st.epoch > H.epoch || (st.epoch === H.epoch && seatIdx(st, st.hostPid) < seatIdx(st, H.me))) stopHosting("Back online. Another player kept the game going.");
    else return;
  }
  if (lastState && st.epoch === lastState.epoch && st.n === lastState.n) { lastStateAt = Date.now(); return; } // heartbeat
  if (lastState && !H && (st.epoch < lastState.epoch || (st.epoch === lastState.epoch && st.n < lastState.n))) return; // stale
  applyState(st);
}

function applyState(st) {
  lastState = st; lastStateAt = Date.now(); S.status = "";
  LS.set(stateKey(), st);
  const mine = st.players.find(p => p.token === ME?.token);
  S.me = mine?.id || null;
  if (mine) { wasSeated = true; if (ME.pid !== mine.id) { ME.pid = mine.id; LS.set(meKey(), ME); BUS?.track({ pid: mine.id }); } }
  S.lobby = { code: st.code, hostId: st.hostPid, settings: st.settings, players: st.players.map(p => ({ id: p.id, name: p.name, online: isOnline(p.id) })) };
  S.online = Object.fromEntries(st.players.map(p => [p.id, isOnline(p.id)]));
  if (pendingAct && st.n > pendingAct.n) pendingAct = null;
  preloadCards();
  if (!mine) {
    S.view = null;
    if (st.G) { S.mode = "claim"; S.error = wasSeated ? "You're now playing on another device. Pick your seat to move back here." : ""; }
    else if (wasSeated) { S.mode = "join"; S.error = "The host removed you from the table."; }
    else S.mode = "connecting";
    return render();
  }
  S.role = H ? "host" : "client";
  if (st.G) { const prev = S.view; S.view = E.viewFor(st.G, S.me); S.mode = "game"; onNewView(prev, S.view); }
  else { S.view = null; S.mode = "lobby"; }
  render();
}

function onNewView(prev, v) {
  queueFx(prev, v);
  const mineNow = v.waiting.includes(S.me) && !["trickShow", "roundEnd", "gameOver"].includes(v.phase);
  const minePrev = prev ? prev.waiting.includes(S.me) && prev.phase === v.phase : false;
  if (mineNow && !minePrev) navigator.vibrate?.([18, 40, 18]);
  document.title = mineNow ? "● Your turn · Wizard" : "Wizard Online";
  // Clear selections that no longer apply.
  if (!v.hand.includes(S.ui.sel)) S.ui.sel = null;
  if (!prev || prev.phase !== v.phase) { S.ui.decl = {}; S.ui.witchGive = null; S.ui.witchTake = null; }
  if (v.phase === "trickShow" && v.trickResult && S.ui.lastToastSeq !== v.seq) {
    S.ui.lastToastSeq = v.seq;
    const w = v.players.find(p => p.id === v.trickResult.winnerPid);
    toast(v.trickResult.bombed ? `💥 Bomb! Nobody wins this trick.` : `${w?.id === S.me ? "You win" : esc(w?.name) + " wins"} the trick`);
  }
  if (v.phase === "roundEnd" && prev?.phase !== "roundEnd") S.ui.overlay = "round";
  if (v.phase === "gameOver") S.ui.overlay = "over";
  if (prev?.phase === "roundEnd" && v.phase !== "roundEnd" && S.ui.overlay === "round") S.ui.overlay = null;
}

function onErr(m) {
  if (m?.token !== ME?.token) return;
  toast(esc(m.msg));
  if (S.mode === "connecting") { S.mode = "join"; S.error = m.msg; render(); }
}

async function connect() {
  BUS = await openBus(S.code);
  BUS.on("state", onState); BUS.on("hello", onHello); BUS.on("act", onAct); BUS.on("err", onErr);
  BUS.on("claim", onClaim);
  BUS.onPresence(set => {
    S.onlineSet = set;
    if (lastState) { S.online = Object.fromEntries(lastState.players.map(p => [p.id, isOnline(p.id)])); if (S.lobby) S.lobby.players.forEach(p => (p.online = isOnline(p.id))); render(); }
  });
  BUS.onStatus(okNow => {
    S.net = okNow;
    if (okNow && !H && ME) BUS.send("hello", { token: ME.token, name: ME.name });
    render();
  });
  if (ME.pid) BUS.track({ pid: ME.pid });
}

// Create a new table on this device.
async function hostCreate(name) {
  S.code = newCode();
  ME = { token: rid(), name, pid: "p" + rid().slice(0, 6) };
  LS.set(meKey(), ME); LS.set("wiz-name", name);
  history.replaceState(null, "", `?g=${S.code}`);
  S.mode = "connecting"; S.status = "Opening the table…"; render();
  try { await connect(); } catch (e) { S.mode = "landing"; S.error = e.message; return render(); }
  H = { code: S.code, epoch: 1, n: 0, me: ME.pid, players: [{ id: ME.pid, name, token: ME.token }], settings: structuredClone(DEFAULT_SETTINGS), G: null };
  S.status = "";
  hostBroadcast();
  keepAwake();
}

// Join (or rejoin) an existing table.
async function clientJoin(name) {
  ME = LS.get(meKey()) || { token: rid() };
  ME.name = name; LS.set(meKey(), ME); LS.set("wiz-name", name);
  S.mode = "connecting"; S.error = ""; S.status = "Connecting…"; render();
  try { await connect(); } catch (e) { S.mode = "join"; S.error = e.message; S.status = ""; return render(); }
  S.status = "Finding the table…"; render();
  BUS.send("hello", { token: ME.token, name });
  keepAwake();
  // Nobody answering? If this device remembers the table and holds a seat, run it from here.
  setTimeout(() => {
    if (lastState || H) return;
    const saved = LS.get(stateKey());
    if (saved?.players?.some(p => p.token === ME.token)) {
      applyState(saved);
      takeOver(saved, "Nobody else was running this table, so your device has picked it up.");
    } else { S.status = "Waiting for the table… ask a player to open the game."; render(); }
  }, 5000);
}

function claimSeat(pid) {
  if (H) { const p = H.players.find(p => p.id === pid); if (p) { p.token = ME.token; hostBroadcast(); } return; }
  BUS.send("claim", { token: ME.token, pid });
  S.status = "Taking your seat…"; render();
}

function sendAct(a) {
  if (H) return hostApply(H.me, a);
  BUS?.send("act", { token: ME.token, a });
  pendingAct = { a, n: lastState?.n ?? 0, at: Date.now(), tries: 0 };
}

// Heartbeat, resend and takeover watchdog.
setInterval(() => {
  if (!BUS) return;
  const now = Date.now();
  if (H) { if (S.net) BUS.send("state", snapshot()); return; }
  if (pendingAct && now - pendingAct.at > 2500 && pendingAct.tries < 4) {
    pendingAct.tries += 1; pendingAct.at = now;
    BUS.send("act", { token: ME.token, a: pendingAct.a, retry: true });
  }
  if (!lastState || !S.me || !S.net) return;
  const order = lastState.players.filter(p => p.id !== lastState.hostPid && isOnline(p.id)).map(p => p.id);
  const rank = order.indexOf(S.me);
  if (rank < 0) return;
  if (now - lastStateAt > 7000 + rank * 3500) {
    const host = lastState.players.find(p => p.id === lastState.hostPid)?.name || "The host";
    takeOver(lastState, `${esc(host)} lost connection. Your device is keeping the game going.`);
  }
}, 1000);


// ---------------------------------------------------------------- toast
let toastTimer;
function toast(html) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.innerHTML = html;
  document.body.append(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2400);
}

// ---------------------------------------------------------------- rendering
function render() {
  if (dragging) { renderQueued = true; return; }
  const scroll = document.querySelector(".sheetbody")?.scrollTop;
  let html = "";
  if (S.mode === "landing") html = viewLanding();
  else if (S.mode === "join" || S.mode === "connecting") html = viewJoin();
  else if (S.mode === "lobby") html = viewLobby();
  else if (S.mode === "claim") html = viewClaim();
  else if (S.mode === "game") html = viewGame();
  html += viewOverlay();
  $app.innerHTML = html;
  if (scroll) { const b = document.querySelector(".sheetbody"); if (b) b.scrollTop = scroll; }
  if (S.mode === "game") sizeHand();
  if (S.fxQueue.length) requestAnimationFrame(runFx);
}

// The single top scorer; nobody when two or more share the top.
function leaderOf(v) {
  if (!v) return null;
  const max = Math.max(...v.players.map(p => p.total));
  const top = v.players.filter(p => p.total === max);
  return top.length === 1 ? top[0].id : null;
}

function queueFx(prev, v) {
  const q = S.fxQueue;
  const wk = "wiz-welcome-" + v.gameId;
  if (v.gameId && v.round === 1 && !v.scores.length && !LS.get(wk)) { LS.set(wk, 1); q.push({ welcome: true }); }
  const plays = ["play", "declare"].includes(v.phase) ? v.trick?.plays || []
    : ["trickShow", "juggler", "cloud", "witch"].includes(v.phase) ? v.lastTrick?.plays || [] : [];
  const fresh = !prev || prev.gameId !== v.gameId;
  for (const p of plays) {
    const key = `${v.gameId}.${v.round}.${v.trickNo}.${p.pid}`;
    if (S.seenPlays.has(key)) continue;
    S.seenPlays.add(key);
    if (fresh) continue; // joining or reloading mid-trick: don't replay old cards
    const kind = E.card(p.id).kind;
    const who = p.pid === S.me ? "You" : v.players.find(x => x.id === p.pid)?.name;
    if (E.SPECIALS.includes(kind) && kind !== "werewolf") q.push({ kind, id: p.id, who, extra: kind === "vampire" && p.copy ? `copies ${E.cardLabel(p.copy)}` : "" });
    else if (kind === "wizard") q.push({ burst: "wizard", id: p.id });
  }
  if (fresh) return;
  if (v.phase === "trickShow" && v.trickResult?.bombed && prev.phase !== "trickShow") q.push({ burst: "boom", zone: true });
  if (prev.phase === "juggler" && v.phase !== "juggler") q.push({ burst: "pass" });
  if (prev.phase === "cloud" && v.phase !== "cloud") q.push({ burst: "cloudBid" });
  if (prev.phase === "witch" && v.phase !== "witch") q.push({ burst: "swap", zone: true });
  if (prev.phase === "werewolf" && v.phase !== "werewolf") {
    const pid = prev.pending?.pid;
    q.push({ kind: "werewolf", id: "sp-werewolf", who: pid === S.me ? "You" : v.players.find(x => x.id === pid)?.name, extra: v.trump ? `${E.SUIT_NAME[v.trump]} is trump` : "No trump" });
  }
}

function runFx() {
  const q = S.fxQueue.splice(0);
  q.forEach((f, i) => setTimeout(() => {
    if (f.welcome) return welcome();
    const at = f.id ? document.querySelector(`.tcard[data-id="${f.id}"]`) : f.zone ? document.getElementById("zone") : null;
    const rect = at?.getBoundingClientRect() || null;
    if (f.kind) playFx(f.kind, f.id, rect, f.who, f.extra);
    else burst(f.burst, rect);
  }, i * 380));
}

const guideBtn = (cls = "ghost small") => `<button class="btn ${cls}" data-act="guide">Guide</button>`;

function viewLanding() {
  const name = esc(LS.get("wiz-name") || "");
  return `<div class="page">
    <div class="hero">
      <div class="fan">${["blue-wizard", "sp-dragon", "sp-witch", "red-jester"].map((id, i) => `<img src="cards/${id}.webp" alt="" style="transform:rotate(${(i - 1.5) * 9}deg) translateY(${Math.abs(i - 1.5) * 8}px)">`).join("")}</div>
      <div class="eyebrow">30th-anniversary rules · all 9 special cards</div>
      <h1 class="title">Wizard</h1>
      <p class="muted" style="max-width:40ch;margin:0">Start a table, send the link to your friends, and play from any phone or laptop. No accounts.</p>
    </div>
    <form class="panel" data-form="create">
      <label for="nm" class="eyebrow">Your name</label>
      <div class="row"><input id="nm" type="text" maxlength="18" autocomplete="nickname" placeholder="e.g. Dhruv" value="${name}" required><button class="btn" type="submit">Start a game</button></div>
      <div class="err">${esc(S.error)}</div>
    </form>
    <div class="row" style="justify-content:center">${guideBtn()}</div>
  </div>`;
}

function viewJoin() {
  const name = esc(LS.get("wiz-name") || "");
  const busy = S.mode === "connecting";
  return `<div class="page">
    <div class="hero">
      <div class="fan">${["green-wizard", "sp-fairy", "sp-vampire"].map((id, i) => `<img src="cards/${id}.webp" alt="" style="transform:rotate(${(i - 1) * 10}deg) translateY(${Math.abs(i - 1) * 8}px)">`).join("")}</div>
      <div class="eyebrow">You're invited to a game of</div>
      <h1 class="title">Wizard</h1>
    </div>
    <form class="panel" data-form="join">
      <label for="nm" class="eyebrow">Your name</label>
      <div class="row"><input id="nm" type="text" maxlength="18" autocomplete="nickname" placeholder="Your name" value="${name}" required ${busy ? "disabled" : ""}>
        <button class="btn" type="submit" ${busy ? "disabled" : ""}>${busy ? "Joining…" : "Join game"}</button></div>
      <div class="err">${esc(S.error || S.status)}</div>
    </form>
    <div class="row" style="justify-content:center">${guideBtn()}<a class="btn ghost small" href="${location.pathname}">Start my own game</a></div>
  </div>`;
}

function viewClaim() {
  const L = S.lobby;
  const seats = (L?.players || []).map((p, i) => `<li><span class="av" style="background:${SEAT_COLORS[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span style="flex:1">${esc(p.name)} <span class="muted" style="font-size:14px">${p.online ? "· playing now" : "· away"}</span></span>
      <button class="btn small" data-act="claim" data-pid="${p.id}">This is me</button></li>`).join("");
  return `<div class="page">
    <div class="hero" style="gap:6px"><div class="eyebrow">Game in progress</div><h1 class="title" style="font-size:44px">Rejoin</h1></div>
    <section class="panel"><div class="eyebrow">Which player are you?</div><ul class="plist">${seats}</ul>
      <p class="muted" style="margin:0;font-size:15px">Your cards, bid and score come with you. If that seat is open on another device, it moves here.</p>
      <div class="err">${esc(S.error || S.status)}</div></section>
    <div class="row" style="justify-content:center">${guideBtn()}</div></div>`;
}

function viewLobby() {
  const L = S.lobby;
  if (!L) return `<div class="page"><p class="muted">Loading…</p></div>`;
  const isHost = !!H;
  const link = linkFor(L.code);
  const st = L.settings;
  const maxR = E.ROUNDS_FOR[Math.max(3, Math.min(6, L.players.length))];
  const people = L.players.map((p, i) => `<li><span class="av" style="background:${SEAT_COLORS[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span style="flex:1">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}${p.id === L.hostId ? " <span class='badge'>HOST</span>" : ""}</span>
      <span class="dot ${p.online ? "" : "off"}" title="${p.online ? "Online" : "Offline"}"></span>
      ${isHost && p.id !== S.me ? `<button class="btn ghost small" data-act="kick" data-pid="${p.id}">Remove</button>` : ""}</li>`).join("");
  const spChips = SPECIAL_CARDS.map(c => {
    const k = c.id.slice(3), on = st.specials.includes(k);
    return `<button class="chipbtn" aria-pressed="${on}" ${isHost ? `data-act="sp" data-k="${k}"` : "disabled"}>${img(c.id)}<span>${esc(c.name)}</span></button>`;
  }).join("");
  return `<div class="page">
    <div class="hero" style="gap:6px"><div class="eyebrow">Table ${esc(L.code)}</div><h1 class="title" style="font-size:44px">Lobby</h1></div>
    <section class="panel">
      <div class="eyebrow">Invite players</div>
      <div class="share"><code id="link">${esc(link)}</code>
        <button class="btn small" data-act="share">Share link</button><button class="btn ghost small" data-act="copy">Copy</button></div>
      <p class="muted" style="margin:0;font-size:15px">Anyone with the link enters their name and joins. 3–6 players. If someone drops out, the game keeps going and they can rejoin from any device.</p>
    </section>
    <section class="panel">
      <div class="eyebrow">Players · ${L.players.length}/6</div>
      <ul class="plist">${people}</ul>
      ${L.players.length < 3 ? `<p class="muted" style="margin:0">Waiting for at least ${3 - L.players.length} more…</p>` : ""}
    </section>
    <section class="panel settings">
      <div class="eyebrow">Special cards in this game</div>
      <div class="spgrid">${spChips}</div>
      <div class="eyebrow" style="margin-top:4px">Table rules</div>
      <ul style="margin:0;padding-left:20px;font-size:16px"><li>Total bids can never equal the number of cards dealt (the dealer, bidding last, is blocked from that number).</li>
        <li>Exact bid: +20, plus +10 per trick bid. Missed: −10, plus −10 per trick you were off.</li></ul>
      <div class="toggle"><label for="rounds">Rounds</label>
        <select id="rounds" ${isHost ? "" : "disabled"} style="font:inherit;background:var(--felt);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 8px">
          <option value="0" ${!st.rounds ? "selected" : ""}>Full game (${maxR})</option>
          ${[3, 5, 8, 10].filter(n => n < maxR).map(n => `<option value="${n}" ${st.rounds === n ? "selected" : ""}>${n} rounds</option>`).join("")}
        </select></div>
    </section>
    <div class="row" style="justify-content:center">
      ${isHost ? `<button class="btn" data-act="start" ${L.players.length < 3 ? "disabled" : ""}>Start game</button>` : `<span class="muted">Waiting for the host to start…</span>`}
      ${guideBtn()}
    </div>
    <div class="err" style="text-align:center">${esc(S.error || S.status)}</div>
  </div>`;
}

// ---------- game table ----------
const kindOrder = { dragon: 0, wizard: 1, shapeshifter: 2, vampire: 3, cloud: 4, juggler: 5, number: 6, jester: 7, fairy: 8, bomb: 9, witch: 10, werewolf: 11 };
function sortHand(hand, trump) {
  const suitRank = s => (s === trump ? -1 : E.SUITS.indexOf(s));
  return hand.slice().sort((a, b) => {
    const A = E.card(a), B = E.card(b);
    if (kindOrder[A.kind] !== kindOrder[B.kind]) return kindOrder[A.kind] - kindOrder[B.kind];
    if (A.kind === "number") return suitRank(A.suit) - suitRank(B.suit) || B.rank - A.rank;
    return a < b ? -1 : 1;
  });
}

const nameOf = pid => S.view.players.find(p => p.id === pid)?.name || "?";
const seatOf = pid => S.view.players.findIndex(p => p.id === pid);

function declText(p) {
  const bits = [];
  if (p.copy) bits.push(`copies ${E.cardLabel(p.copy)}`);
  if (p.decl?.mode) bits.push(`as ${p.decl.mode === "wizard" ? "Wizard" : "Jester"}`);
  if (p.decl?.suit) bits.push(`as ${E.SUIT_NAME[p.decl.suit]}`);
  return bits.join(" · ");
}

function viewGame() {
  const v = S.view, me = S.me;
  const myTurnPlay = v.phase === "play" && v.waiting.includes(me);
  const order = v.players.map((_, i) => v.players[(v.me + 1 + i) % v.players.length]);
  const lead = leaderOf(v);
  const crownPop = lead && lead !== S.leader;
  S.leader = lead;
  const opps = order.map(p => {
    const i = seatOf(p.id);
    const turn = v.waiting.includes(p.id);
    const off = S.online[p.id] === false;
    return `<div class="opp ${turn ? "turn" : ""} ${p.id === me ? "me" : ""} ${p.id === lead ? "lead" : ""}">${p.id === lead ? CROWN.replace('class="crown"', `class="crown${crownPop ? " pop" : ""}"`) : ""}
      <div class="nm"><span class="av" style="background:${SEAT_COLORS[i]}">${esc(p.name[0]?.toUpperCase())}</span><span class="pn">${p.id === me ? "You" : esc(p.name)}</span>
        ${i === v.dealer ? `<span class="badge" title="Dealer">D</span>` : ""}${off ? `<span class="badge off">OFF</span>` : ""}</div>
      <div class="st"><span class="bw" title="Tricks won / bid">${p.won}<span class="muted">/${p.bid ?? "–"}</span></span><b class="sc" title="Score">${p.total}</b></div></div>`;
  }).join("");

  const trumpChip = `<span class="rnd tr"><small>TRUMP</small><span style="color:${v.trump ? SUIT_HEX[v.trump] : "var(--ink-dim)"}">${v.trump ? E.SUIT_NAME[v.trump] : ["werewolf", "trump"].includes(v.phase) ? "…" : "None"}</span></span>`;
  const bar = `<div class="bar"><div class="info"><span class="rnd"><small>ROUND</small>${v.round}/${v.totalRounds}</span>
      <span class="trumpbox">${v.indicator ? `<button class="chipbtn" style="padding:0;border:0" data-act="zoom" data-id="${v.indicator}" aria-label="Trump card">${img(v.indicator)}</button>` : ""}${trumpChip}</span></div>
      ${S.net ? "" : `<span class="badge off" style="font-size:10px;padding:4px 7px">OFFLINE</span>`}<button class="btn ghost small" data-act="scores">Scores</button>${guideBtn("small")}</div>`;

  // Centre: current or just-finished trick.
  let plays = [], winner = null, showing = false;
  if (["play", "declare"].includes(v.phase) && v.trick) plays = v.trick.plays;
  else if (["trickShow", "juggler", "cloud", "witch"].includes(v.phase) && v.lastTrick) {
    plays = v.lastTrick.plays.map((p, i) => ({ ...p, id: v.lastTrick.cards[i] ?? p.id })); winner = v.lastTrick.bombed ? null : v.lastTrick.winnerPid; showing = true;
  }
  const witchMine = v.phase === "witch" && v.pending?.pid === me;
  const tcards = plays.map(p => {
    const sel = witchMine && p.id !== "sp-witch";
    return `<div class="tcard ${winner === p.pid && showing ? "win" : ""} ${sel ? "selectable" : ""} ${S.ui.witchTake === p.id ? "pick" : ""}" data-id="${p.id}" data-act="${sel ? "witchtake" : "zoom"}">
      ${img(p.id)}<span class="who" style="color:${SEAT_COLORS[seatOf(p.pid)]}">${p.pid === me ? "You" : esc(nameOf(p.pid))}</span>${declText(p) ? `<span class="decl">${esc(declText(p))}</span>` : ""}</div>`;
  }).join("");
  let zoneInner = tcards;
  if (!plays.length) {
    if (["bid", "werewolf", "trump"].includes(v.phase) && v.indicator) zoneInner = `<div class="tcard" style="width:calc(var(--cw)*1.15)">${img(v.indicator)}<span class="who muted">Trump card</span></div>`;
    else if (myTurnPlay) zoneInner = `<span class="muted" style="font-family:var(--caps);font-size:13px">Drag a card here to lead</span>`;
  }
  const canDrop = myTurnPlay || (v.phase === "juggler" && !v.pending.done.includes(me));
  const center = `<div class="center">
      <div class="trickzone ${canDrop ? "can" : ""}" id="zone">${zoneInner}</div>
      <div class="status ${v.waiting.includes(me) ? "you" : ""}">${statusText()}</div>
      ${promptHtml()}
    </div>`;

  // Hand
  const hand = sortHand(v.hand, v.trump);
  const juggling = v.phase === "juggler" && !v.pending.done.includes(me);
  const legal = new Set(myTurnPlay ? v.legal : juggling || witchMine ? v.hand : []);
  const interactive = myTurnPlay || juggling || witchMine;
  const cards = hand.map(id => {
    const ok = legal.has(id);
    const sel = S.ui.sel === id || S.ui.witchGive === id;
    return `<div class="hcard ${interactive && !ok ? "dim" : ""} ${sel ? "sel" : ""}" data-id="${id}" ${ok ? `data-drag="1"` : ""}>${img(id)}</div>`;
  });
  let handbar = "";
  if (myTurnPlay && S.ui.sel) handbar = `<button class="btn small" data-act="playsel">Play ${esc(E.cardLabel(S.ui.sel))}</button>`;
  if (juggling && S.ui.sel) handbar = `<button class="btn small" data-act="passsel">Pass ${esc(E.cardLabel(S.ui.sel))}</button>`;
  if (witchMine) handbar = `<button class="btn small" data-act="witchgo" ${S.ui.witchGive && S.ui.witchTake ? "" : "disabled"}>Swap cards</button>`;
  const hostHelp = S.role === "host" ? hostAssist() : "";
  return `<div id="table">${bar}<div class="opps">${opps}</div>${center}
    <div class="handbar">${handbar}${hostHelp}</div>
    <div class="hand ${myTurnPlay ? "myturn" : ""}" id="hand" data-n="${cards.length}">${cards.join("")}</div></div>`;
}

function hostAssist() {
  const v = S.view;
  const off = v.waiting.filter(pid => S.online[pid] === false);
  return off.map(pid => `<button class="btn ghost small" data-act="playfor" data-pid="${pid}">Play for ${esc(nameOf(pid))}</button>`).join("");
}

function statusText() {
  const v = S.view, me = S.me, w = v.waiting;
  const others = w.filter(p => p !== me).map(p => esc(nameOf(p)));
  const mine = w.includes(me);
  switch (v.phase) {
    case "bid": {
      const sum = v.players.reduce((s, p) => s + (p.bid || 0), 0);
      return mine ? `Your bid · ${sum} of ${v.round} bid so far` : `${others[0]} is bidding · ${sum} of ${v.round} bid so far`;
    }
    case "play": return mine ? (v.trick.plays.length ? "Your turn · drag a card to the table" : "Your lead · drag any card to the table") : `${others[0]}'s turn`;
    case "declare": return mine ? "Choose how to play your card" : `${others[0]} is choosing…`;
    case "werewolf": return mine ? "You hold the Werewolf!" : `${others[0]} holds the Werewolf and is picking trump…`;
    case "trump": return mine ? "You're the dealer: choose trump" : `${others[0]} (dealer) is choosing trump…`;
    case "trickShow": return v.trickResult?.bombed ? "Bomb! Nobody wins this trick" : `${v.trickResult?.winnerPid === me ? "You win" : esc(nameOf(v.trickResult?.winnerPid)) + " wins"} the trick`;
    case "juggler": return mine ? "Juggler: pass one card to your left" : `Waiting for ${others.join(", ")} to pass…`;
    case "cloud": return mine ? "Cloud: change your bid" : `${others[0]} must change their bid (Cloud)`;
    case "witch": return mine ? "Witch: swap one of your cards with one in the trick" : `${others[0]} is using the Witch…`;
    case "roundEnd": return `Round ${v.round} is over`;
    case "gameOver": return "Game over";
  }
  return "";
}

const suitBtns = (act, extra = "") => E.SUITS.map(s => `<button class="btn small suitbtn" style="background:${SUIT_HEX[s]}" data-act="${act}" data-suit="${s}" ${extra}>${E.SUIT_NAME[s]}</button>`).join("");

function promptHtml() {
  const v = S.view, me = S.me;
  const mine = v.waiting.includes(me);
  if (!mine) return "";
  switch (v.phase) {
    case "werewolf":
      return `<div class="prompt"><p>Swap the Werewolf for the trump card (${esc(E.cardLabel(v.indicator))}), then name trump.</p>
        <div class="btns">${suitBtns("werewolf")}<button class="btn small ghost" data-act="werewolf" data-suit="">No trump</button></div></div>`;
    case "trump":
      return `<div class="prompt"><p>${esc(E.cardLabel(v.indicator))} was turned up. Choose the trump suit.</p><div class="btns">${suitBtns("trump")}</div></div>`;
    case "bid": {
      const opts = Array.from({ length: v.round + 1 }, (_, n) => n);
      return `<div class="prompt"><p>How many tricks will you win?</p><div class="btns">${opts.map(n =>
        `<button class="btn small bidbtn" data-act="bid" data-n="${n}" ${v.dealerBlocked === n ? "disabled title='Dealer rule'" : ""}>${n}</button>`).join("")}</div>
        ${v.dealerBlocked !== null ? `<p class="muted" style="font-size:14px">You can't bid ${v.dealerBlocked}: total bids can never equal ${v.round}.</p>` : ""}</div>`;
    }
    case "declare": {
      const needs = v.pending.needs, d = S.ui.decl;
      const play = v.trick.plays.at(-1);
      const kind = play.copy ? E.card(play.copy).kind : E.card(play.id).kind;
      const parts = [];
      if (needs.includes("trump") && !d.trump) parts.push(`<p>Your Vampire turned up ${esc(E.cardLabel(v.indicator))}. Name the new trump.</p><div class="btns">${suitBtns("decl-trump")}</div>`);
      else if (needs.includes("mode") && !d.mode) parts.push(`<p>Play the Shapeshifter as…</p><div class="btns"><button class="btn small" data-act="decl-mode" data-v="wizard">Wizard</button><button class="btn small ghost" data-act="decl-mode" data-v="jester">Jester</button></div>`);
      else if (needs.includes("suit") && !d.suit) parts.push(`<p>Pick a suit for your ${kind === "cloud" ? "Cloud (counts as 9¾)" : "Juggler (counts as 7½)"}.</p><div class="btns">${suitBtns("decl-suit")}</div>`);
      return `<div class="prompt">${parts.join("")}</div>`;
    }
    case "cloud": {
      const b = v.players.find(p => p.id === me).bid;
      return `<div class="prompt"><p>You won the Cloud's trick: change your bid from ${b}.</p><div class="btns">
        <button class="btn small" data-act="cloud" data-d="1">+1 → ${b + 1}</button><button class="btn small" data-act="cloud" data-d="-1" ${b === 0 ? "disabled" : ""}>−1 → ${b - 1}</button></div></div>`;
    }
    case "juggler": {
      const left = v.players[(v.me + 1) % v.players.length];
      return `<div class="prompt"><p>Drag a card onto the table (or tap one, then Pass) to pass it to ${esc(left.name)}.</p></div>`;
    }
    case "witch":
      return `<div class="prompt"><p>Tap one card from your hand and one card in the trick, then Swap. Or drag your card onto a trick card.</p></div>`;
  }
  return "";
}

// ---------- overlays ----------
function viewOverlay() {
  const o = S.ui.overlay;
  let html = "";
  if (o === "guide") html = sheet("Guide", guideTabs() + `<div class="sheetbody">${guideBody()}</div>`);
  if (o === "scores") html = sheet("Scores", `<div class="sheetbody">${scoreTable()}</div>`);
  if (o === "round" && S.view?.phase === "roundEnd") html = sheet(`Round ${S.view.round} results`, `<div class="sheetbody">${roundTable()}</div>`, roundFoot());
  if (o === "over" && S.view?.phase === "gameOver") html = sheet("Final scores", `<div class="sheetbody">${podium()}${scoreTable()}</div>`, overFoot());
  if (S.ui.zoom) html += `<div class="zoom" data-act="unzoom"><img src="cards/${S.ui.zoom}@2x.webp" alt="${esc(E.cardLabel(S.ui.zoom))}"></div>`;
  return html;
}

const sheet = (title, body, foot = "") => `<div class="overlay" data-act="closebg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
  <div class="sheethead"><h2>${esc(title)}</h2><button class="btn ghost small" data-act="close">Close</button></div>${body}${foot}</div></div>`;

function guideTabs() {
  const t = [["specials", "Special cards"], ["basics", "How to play"], ["order", "Card order"], ["scoring", "Scoring"]];
  return `<div class="tabs" role="tablist">${t.map(([k, l]) => `<button role="tab" aria-selected="${S.ui.guideTab === k}" data-act="gtab" data-k="${k}">${l}</button>`).join("")}</div>`;
}

function guideBody() {
  const st = S.view?.settings || (S.role === "host" ? H?.settings : S.lobby?.settings) || DEFAULT_SETTINGS;
  if (S.ui.guideTab === "specials") {
    return `<p class="muted" style="margin-top:0">Special cards can always be played, even when you could follow suit. Tap a card to enlarge it.</p>` +
      SPECIAL_CARDS.map(c => {
        const on = st.specials.includes(c.id.slice(3));
        return `<div class="spec">${img(c.id).replace("<img", `<img data-act="zoom" data-id="${c.id}"`)}<div><h3>${esc(c.name)} <small>${esc(c.value)}</small>${on ? "" : `<span class="off">not in this game</span>`}</h3><p>${esc(c.rule)}</p></div></div>`;
      }).join("") + `<h3 class="guide" style="font-family:var(--caps);color:var(--gold);margin-top:14px">Combinations</h3><div class="guide"><ul>
        <li>Dragon and Fairy in one trick: the <b>Fairy</b> wins.</li>
        <li>Bomb in a trick: nobody wins it; the player who would have won leads next. A Cloud in a bombed trick changes no bid. A Juggler still passes.</li>
        <li>After a trick: Juggler pass first, then Cloud bid change, then Witch swap.</li>
        <li>The Witch can take any card from the trick except a Witch, even the Cloud, so a card can come back into play.</li>
        <li>Vampire copying the Werewolf: a new trump card is turned up at once and holds until the end of the round.</li>
        <li>If trump is led and you hold the Vampire, you don't have to follow suit with it.</li></ul></div>`;
  }
  if (S.ui.guideTab === "basics") return `<div class="guide">
    <h3>Goal</h3><p>Predict exactly how many tricks you'll win each round. Round 1 has 1 card each, round 2 has 2, and so on.</p>
    <h3>Each round</h3><ol>
      <li><b>Deal & trump.</b> The top card of the rest of the deck sets trump. A Wizard (or Dragon, Shapeshifter, Juggler, Cloud, Vampire) means the dealer picks trump. A Jester (or Fairy, Bomb, Witch) means no trump.</li>
      <li><b>Bid.</b> Starting left of the dealer, everyone says how many tricks they'll take. The total of all bids can never equal the number of cards dealt, so the dealer (bidding last) can't pick the number that would make it equal.</li>
      <li><b>Play.</b> The first bidder leads. Follow the led suit if you can; if you can't, play anything. Wizards, Jesters and special cards can always be played.</li>
      <li><b>Win the trick:</b> first Wizard, else highest trump, else highest card of the led suit. The winner leads next.</li></ol>
    <h3>Leading a Wizard or Jester</h3><p>Lead a Wizard (or the Dragon) and everyone may play anything. Lead a Jester and the first number card played sets the suit to follow.</p>
    <h3>On this table</h3><ul><li>Drag a card from your hand onto the table, or tap it twice.</li><li>Dimmed cards can't be played because you must follow suit.</li><li>The gold-outlined player is the one everyone is waiting on.</li><li>Each player shows tricks won / bid (e.g. <b>1</b>/2) and their score.</li><li>Press and hold any card in your hand to see it full size; tap a card on the table to enlarge it.</li></ul></div>`;
  if (S.ui.guideTab === "order") return `<div class="guide"><h3>Highest to lowest</h3><ol class="order">
    <li>Dragon (loses only to the Fairy)</li><li>Wizard: the first one played wins (Shapeshifter played as Wizard counts)</li>
    <li>Trump 13 → 1 (Cloud 9¾ and Juggler 7½ slot in when their named suit is trump)</li><li>Led suit 13 → 1</li>
    <li>Other suits: can't win</li><li>Jester (the first one wins a trick of only Jesters)</li><li>Fairy (but beats the Dragon)</li><li>Witch</li></ol>
    <p class="muted">Bomb: nobody wins the trick. Vampire: becomes a copy of the trump card.</p></div>`;
  return `<div class="guide"><h3>After each round</h3><ul>
    <li><b>Exact bid:</b> +20, plus +10 for each trick you bid. Bid 3 and win 3: +50. Bid 0 and win 0: +20.</li>
    <li><b>Missed:</b> −10, plus −10 for each trick you were off. Bid 2 and win 0: −30. Bid 1 and win 2: −20.</li></ul>
    <h3>Rounds</h3><p>3 players: 20 · 4: 15 · 5: 12 · 6: 10 (or fewer if the host chose a short game). Highest total wins.</p></div>`;
}

function scoreTable() {
  const v = S.view;
  if (!v) return `<p class="muted">Scores appear once the game starts.</p>`;
  const head = `<tr><th>Round</th>${v.players.map(p => `<th>${p.id === S.me ? "You" : esc(p.name)}</th>`).join("")}</tr>`;
  const rows = v.scores.map(s => `<tr><td>${s.round}</td>${v.players.map(p => { const r = s.rows[p.id]; return `<td><span class="${r.pts >= 0 ? "pos" : "neg"}">${r.pts > 0 ? "+" : ""}${r.pts}</span> <span class="muted" style="font-size:12px">${r.won}/${r.bid}</span></td>`; }).join("")}</tr>`).join("");
  const tot = `<tr><th>Total</th>${v.players.map(p => `<th style="color:var(--ink);font-size:15px">${p.total}</th>`).join("")}</tr>`;
  return `<div class="tbl"><table>${head}${rows || `<tr><td colspan="${v.players.length + 1}" class="muted">No rounds finished yet.</td></tr>`}${tot}</table></div><p class="muted" style="font-size:13px">Small numbers: tricks won / bid.</p>`;
}

function roundTable() {
  const v = S.view, s = v.scores.at(-1);
  return `<div class="tbl"><table><tr><th>Player</th><th>Bid</th><th>Won</th><th>Points</th><th>Total</th></tr>${v.players.map(p => {
    const r = s.rows[p.id];
    return `<tr><td>${p.id === S.me ? "You" : esc(p.name)}</td><td>${r.bid}</td><td>${r.won}</td><td class="${r.pts >= 0 ? "pos" : "neg"}">${r.pts > 0 ? "+" : ""}${r.pts}</td><td><b>${p.total}</b></td></tr>`;
  }).join("")}</table></div>`;
}

const roundFoot = () => `<div class="row" style="justify-content:center;padding:6px 16px 16px">${S.role === "host"
  ? `<button class="btn" data-act="next">${S.view.round >= S.view.totalRounds ? "See final scores" : `Deal round ${S.view.round + 1}`}</button>`
  : `<span class="muted">Waiting for the host to deal the next round…</span>`}</div>`;

function podium() {
  const ps = S.view.players.slice().sort((a, b) => b.total - a.total);
  const lead = leaderOf(S.view);
  return `<div class="podium">${ps.map((p, i) => `<div class="p"><span class="av" style="background:${SEAT_COLORS[seatOf(p.id)]}">${i + 1}</span><span>${p.id === S.me ? "You" : esc(p.name)}</span>${p.id === lead ? CROWN : ""}<span class="pts">${p.total}</span></div>`).join("")}</div><div style="height:14px"></div>`;
}
const overFoot = () => `<div class="row" style="justify-content:center;padding:6px 16px 16px">${S.role === "host" ? `<button class="btn" data-act="again">Play again</button>` : `<span class="muted">The host can start a new game.</span>`}</div>`;

// ---------------------------------------------------------------- hand sizing
function sizeHand() {
  const hand = document.getElementById("hand");
  if (!hand) return;
  const cards = [...hand.querySelectorAll(".hcard")];
  const n = cards.length;
  if (!n) return;
  const W = hand.clientWidth - 8;
  const desk = window.innerWidth >= 760;
  const short = window.innerHeight < 500;
  const max = Math.min(desk ? 118 : 96, window.innerHeight * (short ? 0.17 : 0.13)), min = Math.min(desk ? 80 : 60, max);
  // Fewest rows (max 3) whose cards stay at least `min` wide with 58% of each card visible.
  let rows = 1, per = n, cw = max;
  for (rows = 1; rows <= 3; rows++) {
    per = Math.ceil(n / rows);
    cw = Math.min(max, W / (1 + (per - 1) * 0.58));
    if (cw >= min) break;
  }
  rows = Math.min(rows, 3);
  const ov = per > 1 ? Math.max(-0.8, Math.min(-0.04, (W - cw) / (per - 1) / cw - 1)) : 0;
  hand.style.setProperty("--cw", cw + "px");
  hand.style.setProperty("--ov", ov);
  hand.innerHTML = "";
  for (let r = 0; r < rows; r++) {
    const row = document.createElement("div"); row.className = "hrow";
    cards.slice(r * per, (r + 1) * per).forEach(c => row.append(c));
    hand.append(row);
  }
}
window.addEventListener("resize", () => S.mode === "game" && render());

// ---------------------------------------------------------------- drag & drop
$app.addEventListener("pointerdown", e => {
  const el = e.target.closest(".hcard");
  if (!el || e.button > 0) return;
  const d = dragging = { id: el.dataset.id, el, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, canDrag: !!el.dataset.drag, peek: null };
  el.setPointerCapture?.(e.pointerId);
  // Press and hold to see the card full size.
  d.lp = setTimeout(() => {
    if (dragging !== d || d.moved) return;
    d.peek = document.createElement("div"); d.peek.className = "peek";
    d.peek.innerHTML = `<img src="cards/${d.id}@2x.webp" alt="">`;
    document.body.append(d.peek);
    navigator.vibrate?.(12);
  }, 420);
});
$app.addEventListener("pointermove", e => {
  const d = dragging; if (!d) return;
  if (d.peek) return;
  if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
  if (!d.canDrag) { clearTimeout(d.lp); return; }
  if (!d.moved) {
    clearTimeout(d.lp);
    d.moved = true;
    const r = d.el.getBoundingClientRect();
    d.w = r.width; d.h = r.height;
    d.ghost = document.createElement("div"); d.ghost.className = "dragghost"; d.ghost.style.width = r.width + "px";
    d.ghost.innerHTML = d.el.innerHTML; document.body.append(d.ghost);
    d.el.style.opacity = ".25";
  }
  d.ghost.style.transform = `translate(${e.clientX - d.w / 2}px, ${e.clientY - d.h * 0.6}px) rotate(${Math.max(-12, Math.min(12, (e.clientX - d.x0) / 18))}deg) scale(1.08)`;
  const zone = document.getElementById("zone");
  const over = dropTarget(e.clientX, e.clientY);
  zone?.classList.toggle("hot", !!over);
  document.querySelectorAll(".tcard.pick").forEach(x => x.classList.remove("pick"));
  if (over?.take) document.querySelector(`.tcard[data-id="${over.take}"]`)?.classList.add("pick");
});
function endDrag(e, cancel) {
  const d = dragging; if (!d) return;
  dragging = null;
  clearTimeout(d.lp);
  if (d.peek) { d.peek.remove(); if (renderQueued) { renderQueued = false; render(); } return; }
  d.ghost?.remove(); d.el.style.opacity = "";
  document.getElementById("zone")?.classList.remove("hot");
  if (!cancel) {
    if (d.moved) { const t = dropTarget(e.clientX, e.clientY); if (t) drop(d.id, t); }
    else if (d.canDrag) tapCard(d.id);
  }
  if (renderQueued || d.moved) { renderQueued = false; render(); }
}
$app.addEventListener("pointerup", e => endDrag(e, false));
$app.addEventListener("pointercancel", e => endDrag(e, true));

function dropTarget(x, y) {
  const v = S.view; if (!v) return null;
  const under = document.elementsFromPoint(x, y);
  if (v.phase === "witch") {
    const t = under.map(el => el.closest?.(".tcard[data-act='witchtake']")).find(Boolean);
    return t ? { take: t.dataset.id } : null;
  }
  const zone = document.getElementById("zone");
  if (!zone) return null;
  const r = zone.getBoundingClientRect();
  const pad = 30;
  return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad ? { zone: true } : null;
}

function drop(id, t) {
  const v = S.view;
  if (v.phase === "play") return sendAct({ type: "play", id });
  if (v.phase === "juggler") return sendAct({ type: "pass", id });
  if (v.phase === "witch" && t.take) return sendAct({ type: "witch", give: id, take: t.take });
}

function tapCard(id) {
  const v = S.view;
  if (v.phase === "witch") { S.ui.witchGive = S.ui.witchGive === id ? null : id; return render(); }
  if (v.phase === "play" && S.ui.sel === id) { S.ui.sel = null; return sendAct({ type: "play", id }); }
  S.ui.sel = S.ui.sel === id ? null : id;
  render();
}

// ---------------------------------------------------------------- clicks & forms
$app.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, v = S.view;
  switch (a) {
    case "guide": S.ui.overlay = "guide"; break;
    case "scores": S.ui.overlay = "scores"; break;
    case "close": S.ui.overlay = null; break;
    case "closebg": if (e.target === el && !["round", "over"].includes(S.ui.overlay)) S.ui.overlay = null; else return; break;
    case "gtab": S.ui.guideTab = el.dataset.k; break;
    case "zoom": S.ui.zoom = el.dataset.id; break;
    case "unzoom": S.ui.zoom = null; break;
    case "share": shareLink(); return;
    case "copy": copyLink(); return;
    case "sp": {
      const k = el.dataset.k, sp = new Set(H.settings.specials);
      const on = !sp.has(k);
      const pair = { dragon: "fairy", fairy: "dragon" }[k];
      for (const x of [k, pair].filter(Boolean)) on ? sp.add(x) : sp.delete(x);
      H.settings.specials = E.SPECIALS.filter(x => sp.has(x));
      hostSave(); hostBroadcast(); return;
    }
    case "dealer": H.settings.dealerRule = el.dataset.v === "on"; hostSave(); hostBroadcast(); return;
    case "penalty": H.settings.penalty = el.dataset.v; hostSave(); hostBroadcast(); return;
    case "kick": {
      const p = H.players.find(p => p.id === el.dataset.pid);
      H.players = H.players.filter(x => x !== p); hostSave(); hostBroadcast(); return;
    }
    case "start": hostStart(); return;
    case "claim": claimSeat(el.dataset.pid); return;
    case "bid": sendAct({ type: "bid", n: +el.dataset.n }); return;
    case "werewolf": sendAct({ type: "werewolf", suit: el.dataset.suit || null }); return;
    case "trump": sendAct({ type: "trump", suit: el.dataset.suit }); return;
    case "decl-trump": case "decl-mode": case "decl-suit": {
      const key = a.slice(5);
      S.ui.decl[key] = el.dataset.suit || el.dataset.v;
      const needs = v.pending.needs;
      if (needs.every(n => S.ui.decl[n])) { sendAct({ type: "declare", ...S.ui.decl }); S.ui.decl = {}; }
      break;
    }
    case "cloud": sendAct({ type: "cloud", delta: +el.dataset.d }); return;
    case "playsel": if (S.ui.sel) { const id = S.ui.sel; S.ui.sel = null; sendAct({ type: "play", id }); } return;
    case "passsel": if (S.ui.sel) { const id = S.ui.sel; S.ui.sel = null; sendAct({ type: "pass", id }); } return;
    case "witchtake": S.ui.witchTake = S.ui.witchTake === el.dataset.id ? null : el.dataset.id; break;
    case "witchgo": if (S.ui.witchGive && S.ui.witchTake) sendAct({ type: "witch", give: S.ui.witchGive, take: S.ui.witchTake }); return;
    case "playfor": { const pid = el.dataset.pid; const act = E.autoAction(H.G, pid); if (act) { try { E.act(H.G, pid, act); hostSave(); if (H.G.phase === "trickShow") scheduleResolve(); hostBroadcast(); } catch (err) { toast(err.message); } } return; }
    case "next": sendAct({ type: "nextRound" }); return;
    case "again": H.G = null; S.ui.overlay = null; S.view = null; S.mode = "lobby"; hostSave(); hostBroadcast(); return;
    default: return;
  }
  render();
});

$app.addEventListener("change", e => {
  if (e.target.id === "rounds" && S.role === "host") { H.settings.rounds = +e.target.value; hostSave(); hostBroadcast(); }
});

$app.addEventListener("submit", e => {
  e.preventDefault();
  const name = e.target.querySelector("#nm")?.value.trim();
  if (!name) return;
  if (e.target.dataset.form === "create") hostCreate(name).then(render);
  if (e.target.dataset.form === "join") clientJoin(name);
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && (S.ui.zoom || ["guide", "scores"].includes(S.ui.overlay))) { S.ui.zoom = null; if (["guide", "scores"].includes(S.ui.overlay)) S.ui.overlay = null; render(); }
});

async function shareLink() {
  const url = linkFor(S.code);
  if (navigator.share) { try { await navigator.share({ title: "Wizard", text: "Join my game of Wizard:", url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  copyLink();
}
async function copyLink() {
  const url = linkFor(S.code);
  try { await navigator.clipboard.writeText(url); toast("Link copied"); }
  catch { const r = document.createRange(); const c = document.getElementById("link"); if (c) { r.selectNodeContents(c); getSelection().removeAllRanges(); getSelection().addRange(r); } toast("Select the link and copy it"); }
}

// Fetch every card image once, so hands never show blank gaps on slow phone connections.
let preloaded = false;
function preloadCards() {
  if (preloaded) return; preloaded = true;
  const hi = (window.devicePixelRatio || 1) > 1 ? "@2x" : "";
  const ids = [];
  for (const s of E.SUITS) { for (let r = 1; r <= 13; r++) ids.push(`${s}-${String(r).padStart(2, "0")}`); ids.push(`${s}-wizard`, `${s}-jester`); }
  E.SPECIALS.forEach(k => ids.push("sp-" + k));
  ids.forEach((id, i) => setTimeout(() => { const im = new Image(); im.src = `cards/${id}${hi}.webp`; }, i * 15));
}

// Keep phones awake during a game.
let wake = null;
async function keepAwake() { try { wake = await navigator.wakeLock?.request("screen"); } catch { /* not allowed */ } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.mode !== "landing") keepAwake(); });

// ---------------------------------------------------------------- boot
(async function boot() {
  if (S.code) {
    const me = LS.get(meKey());
    if (me?.name) return clientJoin(me.name);
    S.mode = "join"; return render();
  }
  render();
})();

// Debug hook for automated tests.
window.__wiz = { S, get H() { return H; }, act: a => sendAct(a), refresh: () => hostBroadcast(), fx: { playFx, burst, welcome } };
