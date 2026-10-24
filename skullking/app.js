// Skull King table: bids at once, then tricks; specials are paintings, suit cards are drawn.
import * as E from "./engine.js";
import { startTable, esc } from "../shared/kit.js";
import { RULES } from "./rules.js";

const SUIT_COL = { g: "#2fa84f", y: "#f2b21c", p: "#8d4fe0", k: "#1b1b22" };
const SUIT_ICON = {
  g: `<path d="M12 3c5 0 8 4 8 8 0 3-2 5-4 6l1 4-4-3c-4 0-8-3-8-8 0-4 3-7 7-7z" fill="#fff"/><circle cx="15" cy="9" r="1.6" fill="#1b1b22"/><path d="M19 10l4 1-4 2z" fill="#ffb02e"/>`,
  y: `<rect x="3" y="9" width="18" height="11" rx="2" fill="#fff"/><path d="M3 9q9-9 18 0z" fill="#fff"/><rect x="10" y="11" width="4" height="4" rx="1" fill="#1b1b22"/><path d="M3 12h18" stroke="#1b1b22" stroke-width="1.2"/>`,
  p: `<path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z" fill="#fff"/><path d="M9 3v16M15 5v16" stroke="#8d4fe0" stroke-width="1.2"/><path d="M11 10l3 3m0-3l-3 3" stroke="#e5322d" stroke-width="1.6"/>`,
  k: `<circle cx="12" cy="10" r="6" fill="#fff"/><circle cx="9.8" cy="9.5" r="1.6" fill="#1b1b22"/><circle cx="14.2" cy="9.5" r="1.6" fill="#1b1b22"/><rect x="9" y="14" width="6" height="3" rx="1" fill="#fff"/><path d="M3 20l18-6M3 14l18 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
};
const NAME = { pirate: "Pirate", king: "Skull King", mermaid: "Mermaid", escape: "Escape", tigress: "Tigress" };
const ART = id => (id.startsWith("pir") ? `sk-pirate${id.slice(4)}` : id === "sk" ? "sk-skullking" : id.startsWith("mer") ? "sk-mermaid" : id.startsWith("esc") ? "sk-escape" : "sk-tigress");
const label = id => { const c = E.cardOf(id); return c.kind === "suit" ? `${E.SUIT_NAME[c.suit]} ${c.rank}` : c.kind === "pirate" ? E.PIRATE_NAME[id] : NAME[c.kind]; };

export function cardHtml(id, cls = "", attrs = "", as) {
  const c = E.cardOf(id);
  if (c.kind !== "suit") {
    return `<div class="skc sp ${c.kind} ${cls}" data-id="${id}" ${attrs}><img src="art/${ART(id)}.webp?v=1" srcset="art/${ART(id)}@2x.webp?v=1 2x" alt="${esc(label(id))}" draggable="false">
      <span class="lbl">${esc(c.kind === "tigress" && as ? `Tigress · ${as}` : label(id))}</span>${c.kind === "pirate" || c.kind === "king" ? `<span class="pip">${c.kind === "king" ? "♛" : "☠"}</span>` : c.kind === "escape" ? `<span class="pip">⚑</span>` : c.kind === "mermaid" ? `<span class="pip">≈</span>` : `<span class="pip">?</span>`}</div>`;
  }
  const col = SUIT_COL[c.suit];
  return `<div class="skc ${cls}" data-id="${id}" ${attrs}><svg viewBox="0 0 100 150" role="img" aria-label="${esc(label(id))}">
    <rect x="1.5" y="1.5" width="97" height="147" rx="10" fill="#fbf6ea" stroke="${col}" stroke-width="3"/>
    <rect x="8" y="8" width="84" height="134" rx="7" fill="${col}"/>
    <g transform="translate(26 40) scale(2)">${SUIT_ICON[c.suit]}</g>
    <text x="50" y="128" text-anchor="middle" font-size="40" font-weight="800" fill="#fff" font-family="Bricolage Grotesque,system-ui" paint-order="stroke" stroke="rgba(0,0,0,.35)" stroke-width="3">${c.rank}</text>
    <text x="16" y="28" font-size="18" font-weight="800" fill="#fff" font-family="Bricolage Grotesque,system-ui">${c.rank}</text>
    ${c.rank === 14 ? `<text x="84" y="28" text-anchor="end" font-size="13" font-weight="800" fill="#fff" font-family="Bricolage Grotesque,system-ui">+${c.suit === "k" ? 20 : 10}</text>` : ""}</svg></div>`;
}

const ui2 = { tig: null, sent: null };
const T = startTable({
  path: "skullking", letter: "K", engine: E, hook: "__sk", title: "Skull King", prefix: "sk-", min: E.MIN_PLAYERS, max: E.MAX_PLAYERS, defaults: { rounds: 0 },
  rules: RULES, eyebrow: "Table Night · Bid your tricks, matey",
  blurb: "Bid exactly how many tricks you'll take, then fight for them with Pirates, Mermaids and the Skull King himself. Hit your bid for points and bonuses; miss and you pay. 2–8 players.",
  confetti: ["#f2b21c", "#2fa84f", "#8d4fe0", "#e5322d", "#fff"],
  hero: () => `<div class="fan">${["mer-1", "sk", "pir-2"].map((id, i) => `<div class="c" style="--r:${(i - 1) * 12}deg;--y:${Math.abs(i - 1) * 10}px;--d:${i * .1}s">${cardHtml(id)}</div>`).join("")}</div>`,
  welcomeFan: () => ["pir-1", "mer-2", "k-14", "sk", "tig", "pir-5"].map(id => cardHtml(id)),
  preload: ["sk-skullking", "sk-pirate1", "sk-pirate2", "sk-pirate3", "sk-pirate4", "sk-pirate5", "sk-mermaid", "sk-escape", "sk-tigress"].map(a => `art/${a}${devicePixelRatio > 1.5 ? "@2x" : ""}.webp?v=1`),
  lobby: (L, host, ctx) => { const n = Math.max(2, L.players.length), most = E.roundsFor(n);
    return `<div class="row" style="justify-content:space-between"><span>Rounds</span>${ctx.seg("rounds", [[0, `Full (${most})`], [5, "5"], [3, "3"]].filter(([r]) => !r || r < most), L.settings.rounds || 0, host)}</div>
    <p class="muted" style="margin:0;font-size:14px">Round <i>n</i> deals <i>n</i> cards. ${n >= 8 ? "With 8 players the deck allows 8 rounds." : "Ten rounds in a full game."}</p>`; },
  game, scores, podium, effect, onAct, overlay,
  scoresTitle: "Scoreboard",
});

function leader(v) {
  const max = Math.max(...v.players.map(p => p.score)), top = v.players.filter(p => p.score === max);
  return top.length === 1 && v.players.some(p => p.score < max) ? top[0].id : null;
}
function game(ctx) {
  const v = ctx.V(), { S } = ctx, lead = leader(v);
  const order = [];
  for (let k = 1; k < v.players.length; k++) order.push(v.players[(v.me + k) % v.players.length]);
  const chips = [v.players[v.me], ...order].map(p => {
    const i = v.players.indexOf(p), bot = S.bots?.includes(p.id);
    const bidTxt = v.phase === "bid" ? (p.hasBid ? "bid ✓" : "bidding…") : `bid ${p.bid} · won ${p.won}`;
    return `<div class="chip ${v.waiting.includes(p.id) ? "turn" : ""} ${p.id === S.me ? "me" : ""}" data-pid="${p.id}">${p.id === lead ? ctx.CROWN : ""}
      <span class="av" style="background:${ctx.SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span class="nm">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}<span class="sub">${p.score} pts</span></span>
      <span class="val ${v.phase !== "bid" && p.bid != null ? (p.won === p.bid ? "hit" : p.won > p.bid ? "over" : "") : ""}">${bidTxt}</span>${bot ? `<span class="badge bot">BOT</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></div>`;
  }).join("");
  const trick = v.trick.map((t, i) => `<div class="tp ${v.phase === "trickDone" && v.last?.winner === t.pid && i === v.trick.length - 1 ? "" : ""} ${v.last?.kind === "trick" && v.phase !== "play" && v.last.winner === t.pid ? "won" : ""}" style="--i:${i}">${cardHtml(t.id, "", "", t.as)}<span>${esc(ctx.nameOf(t.pid))}</span></div>`).join("");
  return `<div id="table">${ctx.topBar(`<span class="rnd"><small>ROUND</small>${v.round}/${v.totalRounds}</span>${v.lead ? `<span class="leadsuit" style="--c:${SUIT_COL[v.lead]}">${E.SUIT_NAME[v.lead]} led</span>` : ""}`)}
    <div class="scroll"><div class="chips">${chips}</div>
    <div class="trick">${trick || `<span class="muted">${v.phase === "bid" ? `Round ${v.round}: ${v.round} card${v.round === 1 ? "" : "s"} each — bid how many tricks you'll take` : `${esc(ctx.nameOf(v.turn))} leads`}</span>`}</div></div>
    ${dock(v, ctx)}</div>`;
}
function dock(v, ctx) {
  const mine = ctx.myTurn(), timer = mine ? ` <span class="tmr big" data-tmr="${ctx.S.me}"></span>` : "";
  let status = "", actions = "";
  if (v.phase === "bid") {
    if (mine) { status = "How many tricks will you take?"; actions = `<div class="bids">${Array.from({ length: v.round + 1 }, (_, n) => `<button class="bidbtn" data-act="bid" data-n="${n}">${n}</button>`).join("")}</div>`; }
    else status = v.myBid != null ? `You bid ${v.myBid} · waiting for ${v.waiting.length} more` : "Waiting…";
  } else if (v.phase === "play") status = mine ? (v.lead && v.legal.length < v.hand.length ? `Follow ${E.SUIT_NAME[v.lead]} if you can — specials always allowed` : "Your turn · play any card") : `${esc(ctx.nameOf(v.turn))} is playing`;
  else if (v.phase === "trickDone") status = `${esc(ctx.nameOf(v.last?.winner))} ${v.last?.winner === ctx.S.me ? "take" : "takes"} the trick`;
  else if (v.phase === "roundOver") status = "Round over · next round in a moment";
  else { const w = v.result.winners; status = w.includes(ctx.S.me) ? "You win!" : `${esc(w.map(ctx.plainName).join(" & "))} win${w.length === 1 ? "s" : ""}`; actions = `<button class="btn big" data-act="over">Results</button>`; }
  const legal = new Set(v.legal);
  const hand = v.hand.slice().sort((a, b) => a.localeCompare(b)).map(id => cardHtml(id, `${mine && v.phase === "play" ? (legal.has(id) ? "ok" : "no") : ""}`, `data-act="card" data-id="${id}" role="button"`)).join("");
  return `<div class="dock ${mine ? "mine" : ""}"><div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${timer}</span></div>${actions ? `<div class="actions">${actions}</div>` : ""}<div class="hand">${hand || `<span class="muted">No cards</span>`}</div></div>`;
}
function overlay(ctx) {
  if (ctx.ui.overlay !== "tigress") return "";
  return ctx.sheet("Play the Tigress as…", `<div class="sheetbody"><div class="tigpick"><button class="btn big" data-act="tig" data-as="pirate">☠ A Pirate<small>beats suits &amp; mermaids</small></button><button class="btn big ghost" data-act="tig" data-as="escape">⚑ An Escape<small>loses the trick</small></button></div></div>`);
}
function onAct(a, el, ctx) {
  const v = ctx.V();
  if (a === "bid") { ctx.room.act({ type: "bid", n: +el.dataset.n }); el.closest(".bids")?.classList.add("sent"); return true; }
  if (a === "card") {
    if (!ctx.myTurn() || v.phase !== "play") return true;
    const id = el.dataset.id;
    if (!v.legal.includes(id)) { el.classList.remove("nope"); void el.offsetWidth; el.classList.add("nope"); ctx.toast(`Follow ${E.SUIT_NAME[v.lead]} — or play a special`); return true; }
    if (id === "tig") { ui2.tig = id; ctx.ui.overlay = "tigress"; ctx.render(); return true; }
    el.classList.add("going"); ctx.room.act({ type: "play", card: id }); return true;
  }
  if (a === "tig") { ctx.ui.overlay = null; ctx.room.act({ type: "play", card: "tig", as: el.dataset.as }); return true; }
  return undefined;
}
function effect(last, v, prev, ctx) {
  if (last.kind === "bids") ctx.showFx(`<div class="t">Bids are in</div><div class="bidrow">${v.players.map(p => `<span><b>${p.bid}</b>${esc(ctx.nameOf(p.id))}</span>`).join("")}</div>`, 2000);
  if (last.kind === "trick") {
    const w = last.trick.find(t => t.pid === last.winner), k = E.cardOf(w.id).kind;
    setTimeout(() => {
      ctx.flash(`.chip[data-pid="${last.winner}"]`, "pop");
      if (last.bonus) ctx.tag(ctx.rectOf(`.chip[data-pid="${last.winner}"]`), `+${last.bonus} bonus`, "good");
    }, 250);
    if (k === "king" && last.trick.some(t => E.cardOf(t.id).kind === "pirate")) ctx.showFx(`<div class="big">${cardHtml("sk")}</div><div class="t">The Skull King strikes!</div><div class="l">${esc(ctx.nameOf(last.winner))} +${last.bonus}</div>`, 1800, "boom");
    else if (k === "mermaid" && last.trick.some(t => t.id === "sk")) ctx.showFx(`<div class="big">${cardHtml(w.id)}</div><div class="t">The Mermaid takes the King!</div><div class="l">${esc(ctx.nameOf(last.winner))} +${last.bonus}</div>`, 1800, "boom");
    if (last.roundEnd) {
      const r = last.roundEnd;
      ctx.showFx(`<div class="t">Round ${v.phase === "gameOver" ? v.totalRounds : v.round} scored</div><div class="bidrow">${v.players.map(p => `<span class="${r.pts[p.id] >= 0 ? "pos" : "neg"}"><b>${r.pts[p.id] >= 0 ? "+" : ""}${r.pts[p.id]}</b>${esc(ctx.nameOf(p.id))} ${r.won[p.id]}/${r.bids[p.id]}</span>`).join("")}</div>`, 2800);
    }
  }
  if (last.kind === "deal" && prev && prev.round !== v.round) ctx.showFx(`<div class="t">Round ${v.round}</div><div class="l">${v.round} card${v.round === 1 ? "" : "s"} each</div>`, 1300);
}
function scores(ctx) {
  const v = ctx.V();
  const rows = v.history.map(h => `<tr><td>${h.round}</td>${v.players.map(p => `<td class="${h.pts[p.id] >= 0 ? "pos" : "neg"}">${h.won[p.id]}/${h.bids[p.id]} <b>${h.pts[p.id] >= 0 ? "+" : ""}${h.pts[p.id]}</b></td>`).join("")}</tr>`).join("");
  return `<div class="tbl"><table><tr><th>R</th>${v.players.map(p => `<th>${esc(ctx.nameOf(p.id))}</th>`).join("")}</tr>${rows}<tr><td>Σ</td>${v.players.map(p => `<td><b>${p.score}</b></td>`).join("")}</tr></table></div>
    <p class="muted" style="font-size:13px">Exact bid: 20 per trick plus bonuses. Missed: −10 per trick off. Bid zero: ±10 × the round number.</p>`;
}
function podium(ctx) {
  const v = ctx.V(), r = v.result;
  return `<div class="hist">${r.rows.map((row, i) => { const p = v.players.find(x => x.id === row.pid), win = r.winners.includes(row.pid); return `<div class="h" style="${win ? "border:1px solid var(--gold);background:linear-gradient(90deg,rgba(242,193,78,.25),var(--bg2))" : ""}">
    <span class="av" style="background:${ctx.SEAT[v.players.indexOf(p)]}">${i + 1}</span><b style="flex:1">${esc(ctx.nameOf(row.pid))}</b>${win ? ctx.CROWN : ""}<b style="font-size:20px">${row.points}</b></div>`; }).join("")}</div>`;
}
window.__skT = T; void ui2;
