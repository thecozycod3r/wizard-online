// Bluff table: the face-down pile and the claimed rank in the middle, players with their card counts, your hand in the dock.
import * as E from "./engine.js";
import { startTable, esc } from "../shared/kit.js";
import { faceSvg, rankOf, RANK_NAME, RANK_TXT } from "../drinks/cards.js";
import { RULES } from "./rules.js";

const V_ART = "?v=1";
const base = id => id.split(".")[0];   // extra decks' copies are "7H.2", "7H.3"; they look the same
const face = (id, cls = "", attrs = "") => `<div class="pcard ${cls}" ${attrs}>${faceSvg(base(id))}</div>`;
const back = (cls = "", attrs = "") => `<div class="pcard back ${cls}" ${attrs}><img src="art/bluff-back.webp${V_ART}" srcset="art/bluff-back@2x.webp${V_ART} 2x" alt="" draggable="false"></div>`;
const plural = r => (r === 6 ? "Sixes" : `${RANK_NAME(r)}s`);
const pick = { sel: [], rank: null };

const T = startTable({
  path: "bluff", letter: "B", engine: E, hook: "__bluff", title: "Bluff", prefix: "bluff-", min: E.MIN_PLAYERS, max: E.MAX_PLAYERS,
  rules: RULES, defaults: { decks: 0 }, eyebrow: "Table Night · Card game",
  blurb: `Lay your cards face down and say what they are — true or not. Call "Bluff!" on a liar and they take the whole pile; get it wrong and it's yours. First to empty their hand wins. ${E.MIN_PLAYERS}–${E.MAX_PLAYERS} players.`,
  confetti: ["#e3b04b", "#2fb6a3", "#b34a8c", "#fff"],
  hero: () => `<div class="fan">${["1S", null, "12H"].map((id, i) => `<div class="c" style="--r:${(i - 1) * 12}deg;--y:${Math.abs(i - 1) * 10}px;--d:${i * .1}s">${id ? face(id) : back()}</div>`).join("")}</div>`,
  welcomeFan: () => ["7S", null, "7H", null, "13D", "1C"].map(id => (id ? face(id) : back())),
  preload: [`art/bluff-hero@2x.webp${V_ART}`, `art/bluff-back@2x.webp${V_ART}`, `art/bluff-back.webp${V_ART}`],
  lobby: (L, host, ctx) => {
    const n = Math.max(L.players.length, 1), d = E.decksFor(L.settings, n), { base: each, extra } = E.dealSizes(d, n);
    return `<div class="row" style="justify-content:space-between"><span>Decks</span>${ctx.seg("decks", [[0, "Auto"], [1, "1"], [2, "2"], [3, "3"], [4, "4"]], L.settings.decks || 0, host)}</div>
      <p class="deal">${d} deck${d > 1 ? "s" : ""} · ${52 * d} cards · <b>${each} card${each === 1 ? "" : "s"} each</b>${extra ? ` (${extra} player${extra > 1 ? "s" : ""} get${extra > 1 ? "" : "s"} ${each + 1})` : ""} with ${n} player${n > 1 ? "s" : ""}</p>`;
  },
  game, scores, podium, effect, onAct,
  onView: (v, prev, ctx) => {
    if (!prev || prev.seq !== v.seq) pick.sel = pick.sel.filter(c => v.hand.includes(c));
    if (!v.waiting.includes(ctx.S.me) || v.rank !== null) pick.rank = null;
  },
});

// the single player holding the fewest cards gets the crown (none on a tie)
function leaderOf(v) {
  const min = Math.min(...v.players.map(p => p.cards)), top = v.players.filter(p => p.cards === min);
  return top.length === 1 ? top[0].id : null;
}
function game(ctx) {
  const v = ctx.V(), { S } = ctx, lead = leaderOf(v);
  const chips = v.players.map((p, i) => {
    const put = v.plays.filter(x => x.pid === p.id).reduce((s, x) => s + x.count, 0), last = v.lastBy === p.id;
    return `<div class="chip ${v.waiting.includes(p.id) ? "turn" : ""} ${p.id === S.me ? "me" : ""} ${last ? "lastby" : ""}" data-pid="${p.id}">${p.id === lead ? ctx.CROWN : ""}
      <span class="av" style="background:${ctx.SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span class="nm">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}<span class="sub">${put ? `${put} down` : p.caught ? `caught ${p.caught}×` : "&nbsp;"}</span></span>
      <span class="val" title="Cards in hand">🂠 ${p.cards}</span>${S.bots?.includes(p.id) ? `<span class="badge bot">BOT</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></div>`;
  }).join("");
  const claimed = v.plays.reduce((s, x) => s + x.count, 0), cap = 4 * v.decks;
  const pile = v.phase === "gameOver" ? `<div class="table-mid"><div class="claim"><small>GAME OVER</small><b>${esc(ctx.nameOf(v.result.winners[0]))} ${v.result.winners[0] === S.me ? "win" : "wins"}!</b><span class="cap">out of cards first</span></div></div>` : `<div class="table-mid">
      <div class="claim">${v.rank === null ? `<small>NEW ROUND</small><b>${v.turn === S.me ? "You name" : `${esc(ctx.nameOf(v.turn))} names`} the rank</b>` : `<small>CLAIMING</small><b>${plural(v.rank)}</b><span class="cap ${claimed > cap ? "over" : ""}">${claimed} of ${cap} claimed</span>`}</div>
      <div class="pile" id="pile">${v.pileCount ? Array.from({ length: Math.min(v.pileCount, 14) }, (_, i) => back("", `style="--i:${i};--rot:${((i * 37) % 23) - 11}deg"`)).join("") : `<span class="muted">Pile is empty</span>`}</div>
      ${v.pileCount || v.cleared ? `<div class="pilecount">${v.pileCount ? `${v.pileCount} card${v.pileCount === 1 ? "" : "s"} in the pile` : ""}${v.pileCount && v.cleared ? " · " : ""}${v.cleared ? `${v.cleared} cleared away so far` : ""}</div>` : ""}
      ${v.plays.length ? `<div class="trail">${v.plays.map(x => `<span>${esc(ctx.nameOf(x.pid))} <b>${x.count}</b></span>`).join("<i>→</i>")}</div>` : ""}
    </div>`;
  return `<div id="table">${ctx.topBar(`<span class="rnd"><small>DECKS</small>${v.decks}</span>`)}
    <div class="scroll">${pile}<div class="chips">${chips}</div></div>${dock(v, ctx)}</div>`;
}
function dock(v, ctx) {
  const mine = ctx.myTurn(), timer = mine ? ` <span class="tmr big" data-tmr="${ctx.S.me}"></span>` : "", n = pick.sel.length;
  let status, actions = "";
  if (v.phase === "gameOver") { status = `${esc(ctx.nameOf(v.result.winners[0]))} ${v.result.winners[0] === ctx.S.me ? "are" : "is"} out of cards!`; actions = `<button class="btn big" data-act="over">Results</button>`; }
  else if (!mine) status = v.rank === null ? `${esc(ctx.nameOf(v.turn))} is starting a round…` : `${esc(ctx.nameOf(v.turn))}'s turn — bluff, play or pass`;
  else if (v.rank === null) {
    const r = pick.rank;
    status = r ? `Pick 1–${E.MAX_PLAY} cards to play as ${plural(r)}` : "You start: name a rank, then pick your cards";
    actions = `<div class="ranks">${E.RANKS.map(x => `<button class="rk ${r === x ? "on" : ""}" data-act="rank" data-r="${x}">${RANK_TXT(x)}</button>`).join("")}</div>
      <button class="btn" data-act="play" ${r && n ? "" : "disabled"}>Play ${n || ""} as ${r ? plural(r) : "…"}</button>`;
  } else {
    const lp = v.plays.at(-1);
    status = v.canCall ? `${esc(ctx.nameOf(lp.pid))} put down ${lp.count} “${plural(v.rank)}”` : `${esc(ctx.nameOf(lp.pid))}'s ${lp.count} “${plural(v.rank)}” stood — play or pass`;
    actions = `${v.canCall ? `<button class="btn bluff" data-act="call">Bluff!</button>` : ""}
      <button class="btn" data-act="play" ${n ? "" : "disabled"}>Play ${n || ""} as ${plural(v.rank)}</button>
      <button class="btn ghost" data-act="pass">Pass</button>`;
  }
  const hand = v.hand.slice().sort((a, b) => rankOf(a) - rankOf(b) || (a < b ? -1 : 1));
  // the whole hand always fits: at most 10 cards a row, overlapping sideways, and the rows overlap so each card shows its corner
  const per = Math.ceil(hand.length / Math.max(1, Math.ceil(hand.length / 10)));
  const rows = Array.from({ length: Math.ceil(hand.length / per) }, (_, i) => hand.slice(i * per, (i + 1) * per));
  const cardBtn = c => `<button class="hc ${pick.sel.includes(c) ? "on" : ""} ${v.rank && rankOf(c) === v.rank ? "match" : ""}" data-act="card" data-card="${c}" ${mine ? "" : "disabled"}>${face(c)}</button>`;
  const handHtml = `<div class="hand ${mine ? "pickable" : ""}">${rows.map(r => `<div class="hrow" style="--n:${r.length}">${r.map(cardBtn).join("")}</div>`).join("")}</div>`;
  return `<div class="dock ${mine ? "mine" : ""}"><div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${timer}</span><span class="muted handn">${v.hand.length} in hand${n ? ` · ${n} picked` : ""}</span></div>${actions ? `<div class="actions">${actions}</div>` : ""}${handHtml}</div>`;
}
function onAct(a, el, ctx) {
  const v = ctx.V();
  if (a === "card") {
    const c = el.dataset.card, i = pick.sel.indexOf(c);
    if (i >= 0) pick.sel.splice(i, 1); else if (pick.sel.length < E.MAX_PLAY) pick.sel.push(c); else ctx.toast(`At most ${E.MAX_PLAY} cards a turn`);
    ctx.render(); return true;
  }
  if (a === "rank") { pick.rank = +el.dataset.r; ctx.render(); return true; }
  if (a === "play") {
    if (!pick.sel.length) return true;
    const act = { type: "play", cards: pick.sel.slice() }; if (v.rank === null) act.rank = pick.rank;
    pick.sel = []; pick.rank = null; ctx.room.act(act); return true;
  }
  if (a === "pass") { pick.sel = []; ctx.room.act({ type: "pass" }); return true; }
  if (a === "call") { pick.sel = []; ctx.room.act({ type: "call" }); return true; }
  return undefined;
}
function effect(last, v, prev, ctx) {
  const who = p => esc(ctx.nameOf(p)), chip = p => ctx.rectOf(`.chip[data-pid="${p}"]`), pileR = () => ctx.rectOf("#pile");
  if (last.kind === "play") {
    for (let i = 0; i < last.count; i++) ctx.fly(back(), chip(last.pid), pileR(), { w: 34, h: 51, delay: i * 90, rot: (i - 1) * 9 });
    setTimeout(() => ctx.tag(chip(last.pid), `${last.count} × ${RANK_TXT(last.rank)}`, ""), 120);
    if (last.lead) ctx.tag(ctx.rectOf(".claim"), plural(last.rank), "good", 200);
    if (!last.left) ctx.showFx(`<div class="t">Last cards down!</div><div class="l">${who(last.pid)} ${last.pid === ctx.S.me ? "have" : "has"} nothing left — call it or let it stand</div>`, 1800);
  }
  if (last.kind === "pass") ctx.tag(chip(last.pid), "Pass", "");
  if (last.clear) ctx.showFx(`<div class="t">Everyone passed</div><div class="l">${last.clear.count} cards cleared away · ${who(last.clear.by)} start${last.clear.by === ctx.S.me ? "" : "s"} a new round</div>`, 1700);
  if (last.kind === "call") {
    const cards = last.cards.map((c, i) => face(c, `flip ${rankOf(c) === last.rank ? "true" : "lie"}`, `style="animation-delay:${i * .12}s"`)).join("");
    const head = last.lie ? "Caught bluffing!" : "No bluff!";
    const line = last.lie ? `${who(last.liar)} lied about ${plural(last.rank)} · takes ${last.count} card${last.count === 1 ? "" : "s"}` : `${who(last.liar)} told the truth · ${who(last.pid)} take${last.pid === ctx.S.me ? "" : "s"} ${last.count} card${last.count === 1 ? "" : "s"}`;
    ctx.showFx(`<div class="reveal">${cards}</div><div class="t">${who(last.pid)}: “Bluff!”</div><div class="t sm">${head}</div><div class="l">${line}</div>`, 2600, last.lie ? "good" : "bad");
    setTimeout(() => { ctx.tag(chip(last.taker), `+${last.count} 🂠`, "bad"); if (last.taker === ctx.S.me) ctx.shake(); }, 2500);
  }
}
function scores(ctx) {
  const v = ctx.V();
  return `<div class="tbl"><table><tr><th>Player</th><th>Cards</th><th>Right calls</th><th>Wrong calls</th><th>Caught</th></tr>${v.players.map(p => `<tr><td>${esc(ctx.nameOf(p.id))}</td><td><b>${p.cards}</b></td><td>${p.right}</td><td>${p.wrong}</td><td>${p.caught}</td></tr>`).join("")}</table></div>`;
}
function podium(ctx) {
  const v = ctx.V(), r = v.result;
  return `<p style="margin-top:0">🏆 <b>${esc(ctx.nameOf(r.winners[0]))}</b> emptied ${r.winners[0] === ctx.S.me ? "your" : "their"} hand first.</p>
    <div class="hist">${r.rows.map((row, i) => `<div class="h"><b class="pl">${i + 1}</b><span class="av" style="background:${ctx.SEAT[v.players.findIndex(p => p.id === row.pid)]}">${esc(ctx.plainName(row.pid)[0])}</span><b style="flex:1">${esc(ctx.nameOf(row.pid))}</b><b style="font-size:18px">${row.points} 🂠</b></div>`).join("")}</div>`;
}
window.__bluffT = T;
