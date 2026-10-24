// 6 Nimmt! table: four rows across the middle, your hand in the dock, everyone picks at once.
import * as E from "./engine.js";
import { startTable, esc } from "../shared/kit.js";
import { RULES } from "./rules.js";

import { cardSvg, headIcon } from "./cards.js";
const card = (num, cls = "", attrs = "") => `<div class="ncard ${cls}" data-card="${num}" ${attrs}>${cardSvg(num)}</div>`;

let picking = null, pickTurn = null;   // the card I just tapped (and on which turn), shown lifted until the server confirms
const placed = new Set();   // cards already animated onto the rows

const T = startTable({
  path: "nimmt", letter: "6", engine: E, hook: "__nim", title: "6 Nimmt!", prefix: "nim-", min: E.MIN_PLAYERS, max: E.MAX_PLAYERS,
  defaults: { target: 66 }, rules: RULES, eyebrow: "Table Night · Don't take the sixth card",
  blurb: "Everyone picks a card at the same time; they slide into four rows from lowest to highest. Put the sixth card on a row and you take all five — and their bull heads. Fewest bull heads wins. 2–10 players.",
  confetti: ["#ffd34d", "#ff6b5e", "#6fd3ff", "#c9b8ff", "#fff"],
  hero: () => `<div class="fan">${[55, 6, 77].map((n, i) => `<div class="c" style="--r:${(i - 1) * 12}deg;--y:${Math.abs(i - 1) * 10}px;--d:${i * .1}s">${cardSvg(n)}</div>`).join("")}</div>`,
  welcomeFan: () => [11, 55, 6, 104, 33, 66].map(cardSvg),
  preload: ["art/nimmt-hero@2x.webp?v=1"],
  lobby: (L, host, ctx) => `<div class="row" style="justify-content:space-between"><span>Game length</span>${ctx.seg("target", [[0, "One round"], [66, "To 66"], [100, "To 100"]], L.settings.target ?? 66, host)}</div>
    <p class="muted" style="margin:0;font-size:14px">The game ends after the round in which someone reaches the target. Fewest bull heads wins.</p>`,
  game, scores, podium, effect, onAct, onView,
});

// clear it once the pick is confirmed, or once the turn moves on (the last picker's cards are revealed at once)
function onView(v) { if (v.myPick != null || v.phase !== "pick" || `${v.round}.${v.turn}` !== pickTurn) picking = null; }

function leader(v) {
  const min = Math.min(...v.players.map(p => p.score)), top = v.players.filter(p => p.score === min);
  return top.length === 1 && v.players.some(p => p.score > min) ? top[0].id : null;
}

function game(ctx) {
  const v = ctx.V(), { S } = ctx, lead = leader(v);
  const fresh = new Set((v.last?.steps || []).map(s => s.card).filter(c => !placed.has(c)));
  const rows = v.rows.map((r, i) => {
    const b = E.rowBulls(r), full = r.length >= 5, chooseMe = v.phase === "row" && v.chooser === S.me;
    return `<div class="nrow ${full ? "full" : ""} ${chooseMe ? "pickable" : ""}" ${chooseMe ? `data-act="takerow" data-row="${i}" role="button"` : ""} data-row="${i}">
      ${r.map((c, k) => card(c, `${fresh.has(c) ? "drop" : ""}`, `style="--k:${k}"`)).join("")}
      ${Array.from({ length: 5 - r.length }, (_, k) => `<div class="slot ${r.length + k === 4 ? "danger" : ""}"></div>`).join("")}
      <span class="rb">${b}${E.bulls ? headIcon(b >= 7 ? 7 : b >= 5 ? 5 : b >= 3 ? 3 : b >= 2 ? 2 : 1) : ""}${chooseMe ? `<b class="takeit">Take</b>` : ""}</span></div>`;
  }).join("");
  for (const c of fresh) placed.add(c);
  const chips = v.players.map((p, i) => {
    const bot = S.bots?.includes(p.id), waiting = v.waiting.includes(p.id);
    return `<div class="chip ${waiting ? "turn" : ""} ${p.id === S.me ? "me" : ""}" data-pid="${p.id}">${p.id === lead ? ctx.CROWN : ""}
      <span class="av" style="background:${ctx.SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span class="nm">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}<span class="sub">${v.phase === "pick" ? (p.picked ? "picked ✓" : "choosing…") : v.phase === "row" && v.chooser === p.id ? "taking a row" : ""}${p.taken ? ` · +${p.taken} this round` : ""}</span></span>
      <span class="val">${p.score}${headIcon(1)}</span>${bot ? `<span class="badge bot">BOT</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></div>`;
  }).join("");
  return `<div id="table">${ctx.topBar(`<span class="rnd"><small>ROUND ${v.round}</small>Turn ${Math.min(v.turn + (v.phase === "pick" ? 1 : 0), 10)}/10</span>`)}
    <div class="scroll"><div class="rows">${rows}</div>${pendingStrip(v, ctx)}<div class="chips">${chips}</div></div>
    ${dock(v, ctx)}</div>`;
}
function pendingStrip(v, ctx) {
  if (v.phase !== "row") return "";
  return `<div class="waitrow">${v.pending.map(q => `<span class="wq">${card(q.card, "tiny")}<small>${esc(ctx.nameOf(q.pid))}</small></span>`).join("")}<span class="muted">waiting to be placed</span></div>`;
}
function dock(v, ctx) {
  const mine = ctx.myTurn(), timer = mine ? ` <span class="tmr big" data-tmr="${ctx.S.me}"></span>` : "";
  let status;
  if (v.phase === "pick") status = v.myPick != null || picking != null ? `You picked ${v.myPick ?? picking} · waiting for ${v.waiting.length} more` : "Pick a card — everyone reveals at once";
  else if (v.phase === "row") status = v.chooser === ctx.S.me ? `Your ${v.pending[0]?.card} is lower than every row — tap a row to take it` : `${esc(ctx.nameOf(v.chooser))} is choosing a row to take`;
  else if (v.phase === "roundOver") status = "Round over · next round in a moment";
  else { const w = v.result.winners; status = w.includes(ctx.S.me) ? "You win!" : `${esc(w.map(ctx.plainName).join(" & "))} win${w.length === 1 ? "s" : ""}`; }
  const hand = v.hand.map(c => card(c, `${c === (v.myPick ?? picking) ? "chosen" : ""} ${v.phase === "pick" && v.myPick == null && picking == null ? "ok" : ""}`, `data-act="pick" data-card="${c}" role="button"`)).join("");
  const over = v.phase === "gameOver" ? `<div class="actions"><button class="btn big" data-act="over">Results</button></div>` : "";
  return `<div class="dock ${mine ? "mine" : ""}"><div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${timer}</span></div>${over}<div class="hand">${hand || `<span class="muted">No cards left</span>`}</div></div>`;
}

function onAct(a, el, ctx) {
  const v = ctx.V();
  if (a === "pick") {
    if (v.phase !== "pick" || v.myPick != null || picking != null) return true;
    picking = +el.dataset.card; pickTurn = `${v.round}.${v.turn}`; ctx.render();
    ctx.room.act({ type: "pick", card: picking });
    return true;
  }
  if (a === "takerow") { ctx.room.act({ type: "row", row: +el.dataset.row }); return true; }
  return undefined;
}

function effect(last, v, prev, ctx) {
  if (last.kind === "reveal") {
    ctx.showFx(`<div class="t" style="font-size:clamp(22px,6vw,30px)">Cards revealed</div><div class="reveal">${last.reveals.map((r, i) => `<div class="rv" style="animation-delay:${i * .08}s">${card(r.card)}<span>${esc(ctx.nameOf(r.pid))}</span></div>`).join("")}</div>`, Math.min(2600, 1200 + last.reveals.length * 150));
  }
  for (const s of last.steps || []) if (s.took) {
    setTimeout(() => {
      const chip = ctx.rectOf(`.chip[data-pid="${s.pid}"]`);
      ctx.tag(chip, `+${s.bulls} 🐮`, s.bulls >= 5 ? "bad" : "", 0);
      ctx.flash(`.chip[data-pid="${s.pid}"]`, "pop");
      if (s.bulls >= 7) ctx.shake();
    }, ctx.fxHold);
  }
  if (last.roundEnd && v.phase !== "gameOver") {
    const t = last.roundEnd.taken;
    ctx.showFx(`<div class="t">Round ${v.round} over</div><div class="l">${v.players.map(p => `${esc(ctx.nameOf(p.id))} +${t[p.id]}`).join(" · ")}</div>`, 2400);
  }
  if (last.kind === "deal" && prev && prev.round !== v.round) { placed.clear(); ctx.showFx(`<div class="t">Round ${v.round}</div><div class="l">Ten new cards each</div>`, 1500); }
}

function scores(ctx) {
  const v = ctx.V();
  return `<div class="tbl"><table><tr><th>Player</th><th>This round</th><th>Total 🐮</th></tr>${v.players.slice().sort((a, b) => a.score - b.score).map(p => `<tr><td>${esc(ctx.nameOf(p.id))}</td><td>${p.taken}</td><td><b>${p.score}</b></td></tr>`).join("")}</table></div>
    <p class="muted" style="font-size:13px">Bull heads: 55 has 7 · multiples of 11 have 5 · multiples of 10 have 3 · multiples of 5 have 2 · everything else 1. ${v.target ? `The game ends after a round where someone reaches ${v.target}.` : "One round."}</p>`;
}
function podium(ctx) {
  const v = ctx.V(), r = v.result;
  return `<div class="hist">${r.rows.map((row, i) => { const p = v.players.find(x => x.id === row.pid), win = r.winners.includes(row.pid); return `<div class="h" style="flex-direction:row;align-items:center;gap:10px;${win ? "border:1px solid var(--gold);background:linear-gradient(90deg,rgba(242,193,78,.25),var(--bg2))" : ""}">
    <span class="av" style="background:${ctx.SEAT[v.players.indexOf(p)]}">${i + 1}</span><b style="flex:1">${esc(ctx.nameOf(row.pid))}</b>${win ? ctx.CROWN : ""}<b style="font-size:20px">${row.points} 🐮</b></div>`; }).join("")}</div>`;
}
window.__nimT = T;
