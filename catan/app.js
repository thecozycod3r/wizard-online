// Catan table: the 3D island fills the screen; the kit's HTML (bar, player rail, dock, sheets) floats on top.
import * as E from "./engine.js";
import { startTable, esc } from "../shared/kit.js";
import { alerts } from "../shared/alert.js";
import { createWorld } from "./world.js";
import { createDice } from "./dice.js";
import { rules } from "./rules.js";

const V_ART = "?v=1";
const icon = (r, cls = "") => `<img class="ri ${cls}" src="art/r-${r === "grain" ? "grain" : r}.webp${V_ART}" alt="${r}" draggable="false">`;
const NAME = { timber: "Timber", stone: "Stone", flax: "Flax", grain: "Grain", copper: "Copper", fish: "Fish", silver: "Silver" };
const SEASON_ICON = ["🌱", "☀️", "🍂", "❄️"];
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };

// ---------------------------------------------------------------- world
const canvas = document.getElementById("world");
let T = null;
const world = createWorld(canvas, {
  quality: LS.get("tide-gfx") || undefined,
  soundOn: () => alerts.on,
  onTile: k => onWorldTile(k),
  onShip: id => onWorldShip(id),
});
const dice = createDice(world);
let demoShown = false;
function demo() {
  if (demoShown) return; demoShown = true;
  const G = E.newGame([{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }], { sea: true, raiders: true, seed: 7 });
  for (let i = 0; i < 6; i++) E.act(G, E.cur(G), E.smartAction(G, E.cur(G)));
  world.sync(E.viewFor(G, null), { instant: true }); world.home(10);
}
demo();

// ---------------------------------------------------------------- local UI state
let mode = null;        // { kind: "setup"|"build"|"sail"|"play", ... } — something armed on the board
let sheet = null;       // "build" | "market" | "trade" | "charters" | "beacon"
let draft = { give: {}, want: {} };
let gameSeen = null, holdSync = 0, pendingView = null;

const pseudoG = v => ({ tiles: v.tiles, builds: v.builds, trails: v.trails, ships: v.ships, sea: v.sea, raiders: v.raiders, winds: v.winds, sailed: v.sailed });
const myId = v => v.players[v.me]?.id;
const isMine = v => v.cur === myId(v);
const afford = (v, cost) => E.canPay(v.hand, cost);
const costHtml = c => Object.entries(c).map(([r, n]) => `<span class="cost">${n > 1 ? `<b>${n}</b>` : ""}${icon(r)}</span>`).join("") || `<span class="muted">free</span>`;

T = startTable({
  path: "catan", letter: "T", engine: E, hook: "__tide", title: "Catan", prefix: "tide-", min: E.MIN_PLAYERS, max: E.MAX_PLAYERS,
  defaults: { sea: 1, raiders: 1, timer: 120 }, rules, eyebrow: "Table Night · Settle the island",
  timers: [[60, "1 min"], [120, "2 min"], [180, "3 min"]],
  blurb: "Roll the tides, harvest the island, haggle with friends and race to fill the contracts that make you famous. Sail into the fog for new isles; light the beacon together when raiders come. 2–6 players.",
  confetti: ["#ffd76a", "#7fd3c8", "#f3efe2", "#e8834a", "#9fc6ff"],
  hero: () => `<div class="heroart"><img src="art/hero.webp${V_ART}" alt=""></div>`,
  welcomeFan: () => ["timber", "stone", "flax", "grain", "copper", "fish"].map(r => `<img src="art/r-${r}.webp${V_ART}" alt="">`),
  preload: ["art/hero.webp" + V_ART, ...["timber", "stone", "flax", "grain", "copper", "silver"].map(r => `art/r-${r}.webp${V_ART}`)],
  hscroll: ".rail,.resbar,.tabs,.tbl",
  lobby: (L, host, ctx) => {
    const st = L.settings, sea = !!(st.sea ?? 1), raid = !!(st.raiders ?? 1), t = E.targetFor({ sea, raiders: raid }, L.players.length);
    return `<div class="row" style="justify-content:space-between"><span>Seafarers <small class="muted">fog, ships, isles</small></span>${ctx.seg("sea", [[1, "On"], [0, "Off"]], sea ? 1 : 0, host)}</div>
    <div class="row" style="justify-content:space-between"><span>Cities &amp; Knights <small class="muted">defend the coast together</small></span>${ctx.seg("raiders", [[1, "On"], [0, "Off"]], raid ? 1 : 0, host)}</div>
    <p class="muted" style="margin:0;font-size:14px">First to <b>${t} renown</b> on their own turn wins. About ${20 + 10 * L.players.length + (sea ? 10 : 0) + (raid ? 10 : 0)} minutes.</p>
    <div class="row" style="justify-content:space-between"><span>Graphics on this device</span><span class="seg"><button aria-pressed="${gfx() === "low"}" data-act="gfx" data-v="low">Smooth</button><button aria-pressed="${gfx() === "high"}" data-act="gfx" data-v="high">Beautiful</button></span></div>`;
  },
  game, scores, podium, effect, onAct, onView, afterRender, overlay,
});
const gfx = () => LS.get("tide-gfx") || (matchMedia("(pointer:coarse)").matches ? "low" : "high");
document.body.dataset.mode = "landing";

// ---------------------------------------------------------------- view hooks
function onView(v, prev) {
  if (gameSeen !== v.gameId) { gameSeen = v.gameId; world.reset(); mode = null; sheet = null; world.sync(v, { instant: true }); world.home(1); world.setMode("game"); navTip(); return; }
  if (mode?.kind === "setup" && v.phase !== "setup") mode = null;
  if (holdSync) { pendingView = v; return; }
  world.sync(v);
  if (mode && (!isMine(v) || v.phase === "gameOver")) mode = null;
  if (prev?.cur !== v.cur && isMine(v)) { mode = null; sheet = null; }
}
// First game on a phone: a one-time card on how to move around the 3D island.
function navTip(waited) {
  if (!matchMedia("(pointer:coarse)").matches || LS.get("tide-navtip") || document.getElementById("navtip")) return;
  if (!waited || document.querySelector(".fx-welcome")) return void setTimeout(() => navTip(true), waited ? 400 : 1500); // let the welcome splash come and go
  const el = document.createElement("div");
  el.id = "navtip";
  el.innerHTML = `<div class="card"><h3>Moving around the island</h3><ul>
    <li><b>☝️</b><span><b>Drag one finger</b> to turn the island</span></li>
    <li><b>🤏</b><span><b>Pinch</b> to zoom in and out</span></li>
    <li><b>✌️</b><span><b>Drag two fingers</b> to slide the map</span></li>
    <li><b>✨</b><span><b>Tap a glowing spot</b> to place or build there</span></li>
    <li><b>⌖</b><span>The button on the right <b>snaps back</b> to the whole island</span></li></ul>
    <p>Tap a contract or a player for details. This is also in Rules.</p><button class="btn big">Got it</button></div>`;
  el.addEventListener("click", () => { LS.set("tide-navtip", 1); el.remove(); });
  document.body.appendChild(el);
}
function afterRender(ctx) {
  const S = ctx.S, v = ctx.V();
  document.body.dataset.mode = S.mode;
  if (S.mode !== "game" || !v) { world.setMode("backdrop"); world.arm(null); return; }
  armBoard(v);
}
function armBoard(v) {
  const me = myId(v), G = pseudoG(v);
  if (!isMine(v) || v.phase === "gameOver") return world.arm(null);
  if (v.phase === "setup") {
    const opts = E.legal(G, me, "setup");
    if (!mode || mode.kind !== "setup") mode = { kind: "setup" };
    // picks hold on to this setup step, so a quick second tap before the board refreshes can't land on a cleared mode
    const m = mode;
    if (!m.v) return world.arm({ kind: "corner", targets: [...new Set(opts.map(o => o.v))].map(c => ({ v: c })), onPick: t => { if (mode !== m) return; m.v = t.v; T.render(); } });
    return world.arm({ kind: "link", targets: opts.filter(o => o.v === m.v), onPick: t => { if (mode !== m) return; mode = null; world.arm(null); T.room.act({ type: "place", v: m.v, a: t.a, b: t.b }); } });
  }
  if (!mode) return world.arm(null);
  if (mode.kind === "build") {
    const w = mode.what, opts = E.legal(G, me, w);
    if (w === "trail") return world.arm({ kind: "link", targets: opts, onPick: t => { mode = null; T.room.act({ type: "build", kind: "trail", a: t.a, b: t.b }); } });
    if (w === "ship") return world.arm({ kind: "sea", targets: opts.map(o => ({ k: o.at })), onPick: t => { mode = null; T.room.act({ type: "build", kind: "ship", at: t.k }); } });
    return world.arm({ kind: "corner", targets: opts, onPick: t => { mode = null; T.room.act({ type: "build", kind: w, v: t.v }); } });
  }
  if (mode.kind === "sail") {
    const to = E.sailable(G, me, mode.ship);
    if (!to.length) { mode = null; return world.arm(null); }
    return world.arm({ kind: "sea", targets: to.map(k => ({ k })), onPick: t => T.room.act({ type: "sail", ship: mode.ship, to: t.k }) });
  }
  if (mode.kind === "play") {
    if (mode.card === "seam") return world.arm({ kind: "tile", targets: [...new Set(v.builds.filter(b => b.pid === me).flatMap(b => E.vHexes(b.v)).filter(k => v.tiles[k]?.land && v.tiles[k].terrain !== "ruins"))].map(k => ({ k })), onPick: t => { mode = null; T.room.act({ type: "play", card: "seam", tile: t.k }); } });
    if (mode.card === "surveyor") {
      const marks = Object.keys(v.tiles).filter(k => v.tiles[k].land && v.tiles[k].mark && k !== mode.a).map(k => ({ k }));
      return world.arm({ kind: "tile", targets: marks, onPick: t => { if (!mode.a) { mode.a = t.k; T.render(); } else { const a = mode.a; mode = null; T.room.act({ type: "play", card: "surveyor", a, b: t.k }); } } });
    }
  }
  world.arm(null);
}
function onWorldTile() { /* taps on unarmed land do nothing for now */ }
function onWorldShip(id) {
  const v = T.V(); if (!v || v.phase !== "act" || !isMine(v)) return;
  const s = v.ships.find(x => x.id === id); if (!s || s.pid !== myId(v)) return;
  mode = { kind: "sail", ship: id }; T.render();
}

// ---------------------------------------------------------------- HUD
function leader(v) {
  const top = Math.max(...v.players.map(p => p.renown)), who = v.players.filter(p => p.renown === top);
  return who.length === 1 && top > 0 ? who[0].id : null;
}
function rail(v, ctx) {
  const lead = leader(v);
  return `<div class="rail">${v.players.map((p, i) => {
    const turn = v.cur === p.id, bot = ctx.S.bots?.includes(p.id);
    return `<div class="pchip ${turn ? "turn" : ""} ${p.id === ctx.S.me ? "me" : ""}" data-pid="${p.id}" style="--pc:${ctx.SEAT[i]}">${p.id === lead ? ctx.CROWN : ""}
      <span class="av" style="background:${ctx.SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span class="nm">${esc(p.id === ctx.S.me ? "You" : p.name)}<span class="sub">🂠 ${p.cards} · ${p.silver}◎${p.charters ? ` · ✉${p.charters}` : ""}</span></span>
      <span class="rv">${p.renown}<small>/${v.target}</small></span>${bot ? `<span class="badge bot">BOT</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></div>`;
  }).join("")}</div>`;
}
function resbar(v) {
  if (!v.hand) return "";
  const goods = [...E.RES, ...(v.sea ? ["fish"] : []), "silver"];
  return `<div class="resbar">${goods.map(r => `<span class="res ${v.hand[r] ? "" : "zero"}" data-r="${r}" title="${NAME[r]}">${icon(r)}<b>${v.hand[r]}</b></span>`).join("")}</div>`;
}
function game(ctx) {
  const v = ctx.V(), me = myId(v), mine = isMine(v);
  const info = `<span class="rnd"><small>ROUND ${v.round}</small>${SEASON_ICON[v.season]} ${E.SEASONS[v.season]}</span>
    ${v.fleet && v.phase !== "setup" ? `<button class="raid ${v.fleet.eta <= 2 ? "near" : ""}" data-act="sheet" data-k="beacon" title="Raider fleet and the shared beacon"><span>⛵ ${v.fleet.eta}d</span><span>🔥 ${v.beacon.def}/${v.fleet.strength}</span></button>` : ""}
    ${v.dice ? `<span class="dd">${v.dice.map(d => `<b>${d}</b>`).join("")}</span>` : ""}`;
  return `<div id="table" class="tide">${ctx.topBar(info)}${rail(v, ctx)}
    <div class="spacer"></div>${v.phase !== "setup" ? contractsRow(v, ctx) : ""}
    <div class="cam"><button class="btn ghost small" data-act="home" aria-label="Recentre the island">⌖</button></div>
    ${dock(v, ctx, me, mine)}</div>`;
}
function dock(v, ctx, me, mine) {
  let status = "", btns = "";
  const curName = esc(ctx.nameOf(v.cur));
  if (v.phase === "setup") {
    const round2 = v.setupStep >= v.players.length;
    status = mine ? (mode?.v ? "Now tap a glowing side for its trail" : `Place your ${round2 ? "second" : "first"} outpost — tap a glowing corner${round2 ? " (it pays 1 of each good it touches)" : ""}`) : `${curName} is choosing a spot…`;
    if (mine && mode?.v) btns = `<button class="btn ghost" data-act="unarm">Back</button>`;
  } else if (v.phase === "roll") {
    status = mine ? "Your turn — roll the tides" : `${curName} is rolling…`;
    if (mine) btns = `<button class="btn big rollbtn" data-act="roll">🎲 Roll</button>`;
  } else if (v.phase === "act") {
    if (mine) {
      status = mode ? armedText(v) : `Build, deliver, trade${v.sea ? ", sail" : ""} — then end your turn${v.rush ? " · Rush order: one good may be missing" : ""}`;
      btns = mode ? `<button class="btn ghost" data-act="unarm">Cancel</button>` :
        `<button class="btn" data-act="sheet" data-k="build">🔨 Build</button><button class="btn ghost" data-act="sheet" data-k="market">⚖️ Market</button><button class="btn ghost" data-act="sheet" data-k="trade">🤝 Trade${v.offer ? " •" : ""}</button>
         <button class="btn ghost" data-act="sheet" data-k="charters">📜 ${v.charters.length || ""}</button>${v.fleet ? `<button class="btn ghost" data-act="sheet" data-k="beacon">🔥</button>` : ""}
         ${v.sea && v.ships.some(s => s.pid === me) ? `<button class="btn ghost" data-act="ships">⛵</button>` : ""}<button class="btn endbtn" data-act="end">End turn ➜</button>`;
    } else status = `${curName} is building and trading…`;
  } else if (v.phase === "gameOver") {
    const w = v.result.winners; status = w.includes(ctx.S.me) ? "You win the island!" : `${esc(w.map(ctx.plainName).join(" & "))} win${w.length === 1 ? "s" : ""}`;
    btns = `<button class="btn big" data-act="over">Results</button>`;
  }
  const offer = v.offer && v.offer.from !== me && v.phase === "act" ? offerCard(v, ctx) : "";
  return `<div class="dock ${mine ? "mine" : ""}">${offer}<div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${mine ? ` <span class="tmr big" data-tmr="${ctx.S.me}"></span>` : ""}</span></div>
    ${resbar(v)}${btns ? `<div class="actions">${btns}</div>` : ""}</div>`;
}
function armedText(v) {
  if (mode.kind === "build") return { trail: "Tap a glowing side to lay a trail", outpost: "Tap a glowing corner for your outpost", repair: "Tap a burned outpost to rebuild it", ship: "Tap a glowing hex of sea to launch" }[mode.what];
  if (mode.kind === "sail") { const used = v.sailed[mode.ship] || 0; return `Sail: tap a glowing hex (moves used ${used})`; }
  if (mode.kind === "play") return mode.card === "seam" ? "Tap a tile you're on to refill it" : mode.a ? "Now the second tile to swap with" : "Tap the first tile to swap";
  return "";
}
const goodsText = o => Object.entries(o).map(([r, n]) => `${n}×${icon(r, "sm")}`).join(" ");
function offerCard(v, ctx) {
  const o = v.offer, me = myId(v), yes = o.yes.includes(me), no = o.no.includes(me), can = Object.entries(o.want).every(([r, n]) => v.hand[r] >= n);
  return `<div class="offer"><span><b>${esc(ctx.nameOf(o.from))}</b> offers ${goodsText(o.give)} for ${goodsText(o.want)}</span>
    <span class="row" style="gap:6px">${yes ? `<span class="badge">Accepted · waiting</span>` : `<button class="btn small" data-act="accept" ${can ? "" : "disabled"}>Accept</button>`}${no ? "" : `<button class="btn ghost small" data-act="decline">No</button>`}</span></div>`;
}

// ---------------------------------------------------------------- contracts (public, always on screen)
function contractsRow(v, ctx) {
  const mine = isMine(v) && v.phase === "act";
  return `<div class="contracts">${v.contracts.map((c, i) => {
    const miss = v.hand ? E.shortfall(v.hand, c.need) : 9, ok = mine && !v.delivered && miss <= (v.rush ? 1 : 0);
    return `<button class="contract ${ok ? "ok" : ""}" data-act="contract" data-i="${i}" ${ok ? "" : "aria-disabled=\"true\""}>
      <span class="cn">${esc(c.name)}</span><span class="cneed">${Object.entries(c.need).map(([r, n]) => `<span class="cq ${v.hand && (r === "grain" ? v.hand.grain + v.hand.fish : v.hand[r]) >= n ? "have" : ""}">${n}${icon(r, "sm")}</span>`).join("")}</span>
      <span class="crw">★${c.renown}${c.silver ? ` +${c.silver}◎` : ""}</span></button>`;
  }).join("")}</div>`;
}

// ---------------------------------------------------------------- sheets
const GOODS_OF = v => [...E.RES, ...(v.sea ? ["fish"] : [])];
function overlay(ctx) {
  const v = ctx.V(); if (!sheet || !v || ctx.S.mode !== "game") return "";
  const me = myId(v), mineAct = isMine(v) && v.phase === "act";
  if (sheet === "beacon" && v.fleet) {
    const F = v.fleet, by = v.beacon.by, exposed = v.builds.filter(b => !b.burned && E.sectorOfV(b.v) === F.sector);
    const mine = exposed.filter(b => b.pid === me).length;
    return ctx.sheet("Cities & Knights", `<div class="sheetbody"><img class="sheetart" src="art/beacon.webp${V_ART}" alt="" onerror="this.remove()">
      <p style="margin-top:0">A raider fleet lands in <b>${F.eta} day${F.eta === 1 ? "" : "s"}</b> (end of round) on the <b>${["east", "south-east", "south-west", "west", "north-west", "north-east"][F.sector]}</b> coast, where <b>${exposed.length}</b> outpost${exposed.length === 1 ? " stands" : "s stand"}${mine ? ` — ${mine} of them yours` : ""}.</p>
      <div class="meter"><i style="width:${Math.min(100, v.beacon.def / Math.max(1, F.strength) * 100)}%"></i><span>Beacon ${v.beacon.def} / strength ${F.strength}</span></div>
      <p class="muted" style="font-size:14px">Anyone can feed the shared beacon on their turn (timber 1, stone 1, copper 2; up to ${E.MUSTER_MAX} a turn). If it holds, the biggest giver earns <b>+2 renown</b> (tied givers +1 each) and others who gave 2+ get 2 silver. If it fails, every player loses one outpost on that coast to fire until they repair it.</p>
      <div class="plist">${v.players.map(p => `<div class="tr"><b>${esc(ctx.nameOf(p.id))}</b><span>${by[p.id] || 0} 🔥</span></div>`).join("")}</div>
      ${mineAct ? `<div class="row" style="justify-content:center;margin-top:12px">${Object.entries(E.MUSTER).map(([r, d]) => `<button class="btn small" data-act="muster" data-r="${r}" ${v.hand[r] > 0 && v.mustered < E.MUSTER_MAX ? "" : "disabled"}>Give ${icon(r, "sm")} (+${d})</button>`).join("")}</div><p class="muted" style="text-align:center;font-size:13px">${E.MUSTER_MAX - v.mustered} left this turn</p>` : ""}</div>`);
  }
  if (!mineAct) { if (sheet !== "beacon") sheet = null; return ""; }
  if (sheet === "build") {
    const G = pseudoG(v), cnt = k => k === "trail" ? v.trails.filter(t => t.pid === me).length : k === "ship" ? v.ships.filter(s => s.pid === me).length : v.builds.filter(b => b.pid === me).length;
    const items = [["trail", "Trail", "Runs along a tile's side; reach new corners"], ["outpost", "Outpost", "+1 renown · harvests every tile it touches"],
      ...(v.builds.some(b => b.pid === me && b.burned) ? [["repair", "Repair", "Rebuild a burned outpost"]] : []),
      ...(v.sea ? [["ship", "Ship", "Explore the fog, fish the shoals, reach isles"]] : []), ["charter", "Charter", `Draw a secret charter (${v.deck} left)`]];
    return ctx.sheet("Build", `<div class="sheetbody"><div class="blist">${items.map(([k, n, d]) => {
      const cost = v.costs[k], left = E.LIMIT[k] ? E.LIMIT[k] - cnt(k) : null, spots = k === "charter" ? (v.deck ? 1 : 0) : E.legal(G, me, k).length;
      const ok = afford(v, cost) && spots > 0 && (left == null || left > 0);
      return `<button class="bitem" data-act="pickbuild" data-k="${k}" ${ok ? "" : "disabled"}><span class="bn">${n}${left != null ? ` <small>${left} left</small>` : ""}</span><span class="bc">${costHtml(cost)}</span><span class="bd">${d}${!spots ? " · nowhere to build" : ""}</span></button>`;
    }).join("")}</div><p class="muted" style="font-size:13px">Fish can stand in for grain anywhere.</p></div>`);
  }
  if (sheet === "market") {
    const left = v.maxMoves - v.moves;
    return ctx.sheet("Market", `<div class="sheetbody"><p class="muted" style="margin-top:0">Buy at the price, sell for 1 less. Buying pushes a price up, selling pulls it down; prices drift back each day. You can't buy and sell the same good in one turn. <b>${left}</b> move${left === 1 ? "" : "s"} left · you have <b>${v.hand.silver}◎</b></p>
      <div class="mkt">${GOODS_OF(v).map(r => { const bp = v.prices[r], sp = Math.max(1, v.prices[r] - 1); return `<div class="mrow">${icon(r)}<span class="mn">${NAME[r]}<small>you have ${v.hand[r]}</small></span>
        <span class="track">${[1, 2, 3, 4, 5, 6].map(p => `<i class="${p === v.prices[r] ? "on" : ""}">${p}</i>`).join("")}</span>
        <button class="btn small" data-act="buy" data-r="${r}" ${left > 0 && v.hand.silver >= bp ? "" : "disabled"}>Buy ${bp}◎</button>
        <button class="btn ghost small" data-act="sell" data-r="${r}" ${left > 0 && v.hand[r] > 0 ? "" : "disabled"}>Sell ${sp}◎</button></div>`; }).join("")}</div></div>`);
  }
  if (sheet === "trade") {
    const o = v.offer;
    if (o && o.from === me) {
      return ctx.sheet("Your offer", `<div class="sheetbody"><p>You give ${goodsText(o.give)} and want ${goodsText(o.want)}.</p>
        <div class="plist">${v.players.filter(p => p.id !== me).map(p => `<div class="tr"><b>${esc(p.name)}</b><span>${o.yes.includes(p.id) ? `<button class="btn small" data-act="confirm" data-pid="${p.id}">Trade with ${esc(p.name)}</button>` : o.no.includes(p.id) ? `<span class="muted">said no</span>` : `<span class="muted">thinking…</span>`}</span></div>`).join("")}</div>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn ghost" data-act="cancel">Withdraw offer</button></div></div>`);
    }
    const goods = [...GOODS_OF(v), "silver"];
    const step = (side, r) => `<span class="step"><button data-act="dstep" data-s="${side}" data-r="${r}" data-d="-1" aria-label="less">−</button><b>${draft[side][r] || 0}</b><button data-act="dstep" data-s="${side}" data-r="${r}" data-d="1" aria-label="more" ${side === "give" && (draft.give[r] || 0) >= v.hand[r] ? "disabled" : ""}>+</button></span>`;
    const ready = Object.values(draft.give).some(n => n > 0) && Object.values(draft.want).some(n => n > 0);
    return ctx.sheet("Offer a trade", `<div class="sheetbody"><div class="tgrid"><span></span><b>You give</b><b>You want</b>${goods.map(r => `<span class="tg">${icon(r)}<small>${v.hand[r]}</small></span>${step("give", r)}${step("want", r)}`).join("")}</div>
      <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" data-act="sendoffer" ${ready ? "" : "disabled"}>Offer to the table</button><button class="btn ghost" data-act="dclear">Clear</button></div></div>`);
  }
  if (sheet === "charters") {
    const C = E.CHARTERS;
    return ctx.sheet("Your charters", `<div class="sheetbody">${v.charters.length ? `<div class="clist">${v.charters.map(c => {
      const can = !c.fresh && !v.played, pickRes = c.card === "requisition" || c.card === "windfall";
      return `<div class="ccard"><img src="art/c-${c.card}.webp${V_ART}" alt="" onerror="this.remove()"><div><b>${C[c.card].name}</b><p>${C[c.card].text}</p>
        ${pickRes && can ? `<div class="reqs">${(c.card === "windfall" ? E.RES : GOODS_OF(v)).map(r => `<button class="btn ghost small" data-act="play" data-c="${c.card}" data-r="${r}" aria-label="${r}">${icon(r, "sm")}</button>`).join("")}</div>`
          : `<button class="btn small" data-act="play" data-c="${c.card}" ${can ? "" : "disabled"}>${c.fresh ? "Next turn" : v.played ? "One per turn" : "Play"}</button>`}</div></div>`;
    }).join("")}</div>` : `<p class="muted">No charters yet. Build → Charter costs ${costHtml(E.COST.charter)}.</p>`}</div>`);
  }
  return "";
}

// ---------------------------------------------------------------- input
function onAct(a, el, ctx, e) {
  const v = ctx.V(), act = x => ctx.room.act(x);
  switch (a) {
    case "close": if (sheet) { sheet = null; ctx.render(); return true; } return undefined;
    case "closebg": if (sheet) { if (e.target !== el) return true; sheet = null; ctx.render(); return true; } return undefined;
    case "gfx": LS.set("tide-gfx", el.dataset.v); world.setQuality(el.dataset.v); ctx.render(); return true;
    case "home": world.home(); return true;
    case "roll": act({ type: "roll" }); return true;
    case "end": mode = null; act({ type: "end" }); return true;
    case "unarm": mode = null; ctx.render(); return true;
    case "sheet": sheet = el.dataset.k; mode = null; ctx.render(); return true;
    case "contract": if (el.getAttribute("aria-disabled") === "true") { const c = v.contracts[+el.dataset.i]; ctx.toast(isMine(v) && v.phase === "act" ? (v.delivered ? "One contract a turn — this one waits" : `You're ${E.shortfall(v.hand, c.need)} short for ${esc(c.name)}`) : `${esc(c.name)}: ★${c.renown}`); return true; } act({ type: "contract", i: +el.dataset.i }); return true;
    case "ships": { const s = v.ships.find(x => x.pid === myId(v) && E.sailable(pseudoG(v), myId(v), x.id).length); if (s) { mode = { kind: "sail", ship: s.id }; world.focus(s.at, 10); } else ctx.toast("Your ships have sailed this turn"); ctx.render(); return true; }
    case "pickbuild": { const k = el.dataset.k; sheet = null; if (k === "charter") act({ type: "charter" }); else mode = { kind: "build", what: k }; ctx.render(); return true; }
    case "buy": case "sell": act({ type: a, res: el.dataset.r }); world.sfx("coin"); return true;
    case "muster": act({ type: "muster", res: el.dataset.r }); world.sfx("thunk"); return true;
    case "dstep": { const s = el.dataset.s, r = el.dataset.r, n = Math.max(0, (draft[s][r] || 0) + +el.dataset.d); draft[s][r] = n; if (!n) delete draft[s][r]; ctx.render(); return true; }
    case "dclear": draft = { give: {}, want: {} }; ctx.render(); return true;
    case "sendoffer": act({ type: "offer", give: draft.give, want: draft.want }); draft = { give: {}, want: {} }; return true;
    case "confirm": act({ type: "confirm", with: el.dataset.pid }); sheet = null; return true;
    case "cancel": act({ type: "cancel" }); return true;
    case "accept": act({ type: "accept", offer: v.offer.id }); return true;
    case "decline": act({ type: "decline", offer: v.offer.id }); return true;
    case "play": {
      const c = el.dataset.c; sheet = null;
      if (c === "seam" || c === "surveyor") { mode = { kind: "play", card: c }; ctx.render(); return true; }
      act({ type: "play", card: c, ...(el.dataset.r ? { res: el.dataset.r } : {}) }); return true;
    }
    default: return undefined;
  }
}

// ---------------------------------------------------------------- effects
const resume = () => { holdSync--; if (!holdSync && pendingView) { world.sync(pendingView); pendingView = null; } };
function effect(last, v, prev, ctx) {
  const me = myId(v), who = id => esc(ctx.nameOf(id)), s = id => (id === me ? "" : "s");
  if (last.kind === "roll" && last.dice) {
    holdSync++;
    dice.roll(last.dice).then(() => {
      const total = last.dice[0] + last.dice[1];
      ctx.tag({ left: innerWidth / 2 - 1, top: innerHeight * 0.36, width: 2, height: 2 }, `${total}`, "", 0);
      for (const p of last.prod || []) {
        world.pulseTile(p.tile, p.spent || p.frozen ? 0x8a8a8a : 0xffe08a);
        if (p.spent) ctx.tag(world.screenOf(p.tile), "spent", "bad", 200);
        if (p.frozen) ctx.tag(world.screenOf(p.tile), "frozen ❄", "bad", 200);
        (p.gets || []).forEach((g, gi) => Object.entries(g.g).forEach(([r, n], ri) => {
          for (let i = 0; i < Math.min(n, 3); i++) {
            const to = g.pid === me ? ctx.rectOf(`.res[data-r="${r}"]`) : ctx.rectOf(`.pchip[data-pid="${g.pid}"]`);
            ctx.fly(`<img src="art/r-${r}.webp${V_ART}" alt="">`, world.screenOf(p.tile, 0.6), to, { w: 38, delay: 300 + gi * 120 + ri * 80 + i * 90 });
          }
          if (g.pid === me) setTimeout(() => ctx.flash(`.res[data-r="${r}"]`, "pop"), 900);
        }));
      }
      if ((last.prod || []).some(p => p.gets?.length)) world.sfx("coin");
      if (last.wages) setTimeout(() => ctx.toast(`${total}: nothing for ${last.pid === me ? "you" : who(last.pid)} — dock wages, +1 silver`), 500);
      if (last.omen) omenFx(last.omen, v, ctx);
      resume();
    });
  }
  if (last.raid) {
    holdSync++;
    const R = last.raid, names = ids => ids.map(who).join(", ");
    ctx.showFx(`<div class="t">Raiders land!</div><div class="l">Beacon ${R.defence} against strength ${R.strength}</div>`, 1800, "boom");
    world.raid(R).then(() => {
      resume();
      ctx.showFx(R.won ? `<div class="t">The beacon holds</div><div class="l">${R.honours.length ? `${names(R.honours)} +${R.honours.length === 1 ? 2 : 1} renown` : "Nobody fed it, but the raiders turned back"}${R.paid.length ? ` · ${names(R.paid)} +2 silver` : ""}</div>`
        : `<div class="t">The coast burns</div><div class="l">${R.burned.length ? `Burned: ${R.burned.map(b => who(b.pid)).join(", ")} — repair to bring them back` : "No outposts were in reach"}</div>`, 3400, R.won ? "" : "boom");
      if (last.fleet) setTimeout(() => ctx.toast(`A new fleet gathers off the ${["east", "south-east", "south-west", "west", "north-west", "north-east"][last.fleet.sector]} coast`), 3600);
    });
  } else if (last.fleet && last.begin) setTimeout(() => ctx.toast(`Raiders gather off the ${["east", "south-east", "south-west", "west", "north-west", "north-east"][last.fleet.sector]} coast — they land in ${last.fleet.eta} days`), 2400);
  if (last.season != null) { world.sfx("season"); ctx.showFx(`<div class="t">${SEASON_ICON[last.season]} ${E.SEASONS[last.season]}</div><div class="l">${["Flax meadows yield double", "Barley fields yield double", "Pinewoods yield double", "Barley freezes; copper yields double"][last.season]} · every tile refills${last.retired ? ` · “${esc(E.contract(last.retired).name)}” is withdrawn` : ""}</div>`, 2800); }
  if (last.award) ctx.showFx(`<div class="t">Cartographer</div><div class="l">${who(last.pid)} take${s(last.pid)} the award (+2)</div>`, 2400);
  if (last.reveal) for (const r of last.reveal) { if (r.sea === "isle") { world.pulseTile(r.tile, 0x9fffc9); ctx.toast("An isle rises from the fog!"); } else if (r.sea !== "open") ctx.tag(world.screenOf(r.tile, 0.3), { shoal: "shoals 🐟", wreck: "wreck!", reef: "reef!", current: "current" }[r.sea], "", 600); }
  if (last.wreck) ctx.toast(`${who(last.pid)} plunder${s(last.pid)} a wreck: ${Object.entries(last.wreck).map(([r, n]) => `${n} ${r}`).join(", ")}`);
  if (last.kind === "contract") { const c = E.contract(last.contract); world.sfx("cheer"); ctx.showFx(`<div class="omen"><img src="art/contract.webp${V_ART}" alt="" onerror="this.remove()"><div><div class="t">${esc(c.name)}</div><div class="l">${who(last.pid)} deliver${s(last.pid)} · +${c.renown} renown${c.silver ? `, +${c.silver} silver` : ""}</div></div></div>`, 2200); if (last.pid !== me) ctx.burst(undefined, innerWidth / 2, innerHeight * 0.3, 50); }
  if (last.kind === "muster") { ctx.tag(ctx.rectOf(".raid") || { left: innerWidth / 2, top: 60, width: 2, height: 2 }, `🔥 ${last.def}`, "good", 0); }
  if (last.kind === "confirm") ctx.toast(`${who(last.pid)} traded with ${who(last.with)}`);
  if (last.kind === "offer" && last.pid !== me) { alerts.hurry(); ctx.flash(".offer", "pop", 50); }
  if (last.kind === "charter" && last.pid === me) ctx.toast(`You drew <b>${E.CHARTERS[last.card].name}</b>`);
  if (last.kind === "play") ctx.showFx(`<div class="omen"><img src="art/c-${last.card}.webp${V_ART}" alt="" onerror="this.remove()"><div><div class="t">${E.CHARTERS[last.card].name}</div><div class="l">${who(last.pid)} play${s(last.pid)} a charter${last.res ? ` · ${last.res}` : ""}</div></div></div>`, 1800);
  if (last.kind === "place" && last.begin) ctx.showFx(`<div class="t">The island is claimed</div><div class="l">${who(v.cur)} roll${s(v.cur)} first</div>`, 2000);
  if (last.kind === "build" && last.v) world.pulseTile(last.v, 0xfff2c0);
  if (last.bounced) ctx.toast(last.bounced === "isle" ? "Land ho! The ship anchors off the new isle" : "A reef! The ship backs off");
  if (last.over) setTimeout(() => world.home(), 600);
}
function omenFx(o, v, ctx) {
  const O = E.OMENS[o.card];
  ctx.showFx(`<div class="omen"><img src="art/o-${o.card}.webp${V_ART}" alt="" onerror="this.remove()"><div><div class="t">Doubles · ${O.name}</div><div class="l">${O.text}${o.res ? ` (${o.res})` : ""}</div></div></div>`, 2600, o.card === "squall" || o.card === "raider" ? "boom" : "");
  if (o.card === "squall") world.storm(7000);
  if (o.card === "lode" && o.tile) world.pulseTile(o.tile, 0x9fffc9);
}

// ---------------------------------------------------------------- scores / podium
function scores(ctx) {
  const v = ctx.V();
  const row = p => `<tr><td>${esc(ctx.nameOf(p.id))}</td><td>${p.outposts}${p.burned ? ` <small class="muted">(+${p.burned}🔥)</small>` : ""}</td><td>${p.score}</td><td>${v.awards.chart === p.id ? 2 : 0}</td><td><b>${p.renown}</b></td></tr>`;
  return `<div class="tbl"><table><tr><th>Player</th><th>Outposts</th><th>Contracts &amp; honours</th><th>Award</th><th>Renown</th></tr>${v.players.slice().sort((a, b) => b.renown - a.renown).map(row).join("")}</table></div>
    <p class="muted" style="font-size:13px">First to ${v.target} on their own turn wins. Each standing outpost 1 · contracts 1–4 · ${v.raiders ? "beacon honours 1–2 · " : ""}${v.sea ? "Cartographer (most fog revealed, 4+) 2 · " : ""}burned outposts count nothing until repaired.</p>`;
}
function podium(ctx) {
  const v = ctx.V(), r = v.result;
  return `<div class="hist">${r.rows.map((row, i) => { const p = v.players.find(x => x.id === row.pid), win = r.winners.includes(row.pid); return `<div class="h" style="flex-direction:row;align-items:center;gap:10px;${win ? "border:1px solid var(--gold);background:linear-gradient(90deg,rgba(242,193,78,.25),var(--bg2))" : ""}">
    <span class="av" style="background:${ctx.SEAT[v.players.indexOf(p)]}">${i + 1}</span><b style="flex:1">${esc(ctx.nameOf(row.pid))}</b>${win ? ctx.CROWN : ""}<b style="font-size:20px">${row.points} ★</b></div>`; }).join("")}</div>`;
}
window.__tideT = T; window.__tideW = world;
