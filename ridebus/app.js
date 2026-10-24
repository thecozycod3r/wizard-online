// Ride the Bus table: stage 1 guesses, then the pyramid, then one unlucky rider on the bus.
import * as E from "./engine.js";
import { startTable, esc } from "../shared/kit.js";
import { cardHtml, rankOf, RANK_NAME, SUIT_GLYPH, SUIT_NAME, cardName } from "../drinks/cards.js";
import { RULES } from "./rules.js";

const OPT_LABEL = { red: "🟥 Red", black: "⬛ Black", higher: "⬆ Higher", lower: "⬇ Lower", inside: "↔ Inside", outside: "⇹ Outside", S: "♠ Spades", H: "♥ Hearts", D: "♦ Diamonds", C: "♣ Clubs" };
const pick = { card: null };
const T = startTable({
  path: "ridebus", letter: "R", engine: E, hook: "__rb", title: "Ride the Bus", prefix: "rb-", min: E.MIN_PLAYERS, max: E.MAX_PLAYERS,
  rules: RULES, eyebrow: "Table Night · Drinking game · 18+",
  blurb: "Four rounds of guesses — red or black, higher or lower, inside or outside, the suit — then the pyramid hands out drinks, and whoever's holding the most cards rides the bus. 2–10 players.",
  note: "Drink responsibly. Sips count, water counts, and nobody has to drink.",
  confetti: ["#ffd23f", "#ff3d7f", "#3dd6ff", "#fff"],
  hero: () => `<div class="fan">${["1H", "13S", "7D"].map((id, i) => `<div class="c" style="--r:${(i - 1) * 12}deg;--y:${Math.abs(i - 1) * 10}px;--d:${i * .1}s">${cardHtml(id)}</div>`).join("")}</div>`,
  welcomeFan: () => ["1S", "12H", "7C", "13D", "10H", "2S"].map(id => cardHtml(id)),
  preload: ["../drinks/art/bus-hero@2x.webp?v=1", "../drinks/art/drink-back@2x.webp?v=1"],
  game, scores, podium, effect, onAct, overlay,
  onView: (v, prev) => { if (!prev || prev.flipped !== v.flipped || v.phase !== "match") pick.card = null; },
});

function game(ctx) {
  const v = ctx.V(), { S } = ctx;
  const chips = v.players.map((p, i) => `<div class="chip ${v.waiting.includes(p.id) ? "turn" : ""} ${p.id === S.me ? "me" : ""} ${v.rider === p.id ? "rider" : ""}" data-pid="${p.id}">
      <span class="av" style="background:${ctx.SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span class="nm">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}<span class="sub">🍺 ${p.taken} taken · ${p.given} given</span></span>
      <span class="minihand">${p.hand.map(c => cardHtml(c, "mini")).join("")}</span>${v.rider === p.id ? `<span class="badge">🚌</span>` : S.bots?.includes(p.id) ? `<span class="badge bot">BOT</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></div>`).join("");
  let mid = "";
  if (v.stage === "guess") mid = `<div class="stage"><div class="eyebrow">Round ${v.q + 1} of 4 · ${v.q + 1} drink${v.q ? "s" : ""}</div><h2>${E.QUESTIONS[v.q].q}</h2></div>`;
  else if (v.stage === "pyramid") mid = `<div class="pyr">${[3, 2, 1, 0].map(r => { const start = [0, 4, 7, 9][r], cnt = E.PYRAMID[r];
      return `<div class="prow"><span class="pv">${r + 1}🍺</span>${Array.from({ length: cnt }, (_, k) => { const i = start + k, c = v.pyramid[i]; return cardHtml(c, `${i === v.flipped - 1 ? "flip now" : ""}`, `data-i="${i}"`); }).join("")}</div>`; }).join("")}</div>`;
  else if (v.stage === "bus" || v.stage === "done") mid = `<div class="busbox"><img src="../drinks/art/bus-hero@2x.webp?v=1" alt="" class="busimg"><div class="stage"><div class="eyebrow">${esc(ctx.nameOf(v.rider))} ${v.rider === S.me ? "are" : "is"} on the bus · ${v.bus.tries} miss${v.bus.tries === 1 ? "" : "es"}</div>
      <div class="steps">${[0, 1, 2, 3].map(i => `<span class="st ${i < v.bus.step ? "done" : i === v.bus.step ? "now" : ""}">${i + 1}</span>`).join("")}</div>
      <div class="buscards">${v.bus.cards.map(c => cardHtml(c, "flip")).join("") || (v.bus.old.length ? `<span class="muted">Missed — back to the start</span>` : "")}</div>${v.phase === "bus" ? `<h2>${E.QUESTIONS[v.bus.step].q}</h2>` : ""}</div></div>`;
  return `<div id="table">${ctx.topBar(`<span class="rnd"><small>STAGE</small>${{ guess: "Guesses", pyramid: "Pyramid", bus: "The bus", done: "Done" }[v.stage]}</span>`)}
    <div class="scroll">${mid}<div class="chips">${chips}</div></div>${dock(v, ctx)}</div>`;
}
function dock(v, ctx) {
  const me = v.players[v.me], mine = ctx.myTurn(), timer = mine ? ` <span class="tmr big" data-tmr="${ctx.S.me}"></span>` : "";
  let status = "", actions = "";
  const targets = act => `<div class="targets">${v.players.filter(p => p.id !== ctx.S.me).map(p => `<button class="btn ghost small" data-act="${act}" data-target="${p.id}">${esc(p.name)}</button>`).join("")}</div>`;
  if (v.phase === "guess") {
    if (mine) { status = E.QUESTIONS[v.q].q; actions = `<div class="opts">${E.QUESTIONS[v.q].opts.map(o => `<button class="btn opt" data-act="guess" data-g="${o}">${OPT_LABEL[o]}</button>`).join("")}</div>`; }
    else status = `${esc(ctx.nameOf(v.turn))} is guessing: ${E.QUESTIONS[v.q].q.toLowerCase()}`;
  } else if (v.phase === "give") {
    if (mine) { status = `Right! Give ${v.give.n} drink${v.give.n > 1 ? "s" : ""} to…`; actions = targets("give"); }
    else status = `${esc(ctx.nameOf(v.give.pid))} got it right and is handing out ${v.give.n}`;
  } else if (v.phase === "match" || v.phase === "flip") {
    const top = v.pyramid[v.flipped - 1];
    if (mine) {
      const have = me.hand.filter(c => rankOf(c) === rankOf(top));
      status = `You hold a ${RANK_NAME(rankOf(top))}! Tap it, then pick who drinks ${E.rowOf(v.flipped - 1) + 1}`;
      actions = `<div class="opts">${have.map(c => `<button class="hc ${pick.card === c ? "on" : ""}" data-act="mcard" data-card="${c}">${cardHtml(c)}</button>`).join("")}<button class="btn ghost small" data-act="pass">Keep it</button></div>${pick.card ? targets("match") : ""}`;
    } else status = v.phase === "flip" ? (v.flipped ? "Next pyramid card coming…" : "Building the pyramid…") : `Waiting for ${v.waiting.map(ctx.nameOf).map(esc).join(", ")} to hand out drinks`;
  } else if (v.phase === "bus") {
    if (mine) { status = `Ride the bus: ${E.QUESTIONS[v.bus.step].q}`; actions = `<div class="opts">${E.QUESTIONS[v.bus.step].opts.map(o => `<button class="btn opt" data-act="ride" data-g="${o}">${OPT_LABEL[o]}</button>`).join("")}</div>`; }
    else status = `${esc(ctx.nameOf(v.rider))} is riding the bus — step ${v.bus.step + 1} of 4`;
  } else { status = `${esc(ctx.nameOf(v.result.rider))} got off the bus`; actions = `<button class="btn big" data-act="over">Results</button>`; }
  const hand = me.hand.length ? `<div class="hand">${me.hand.map(c => cardHtml(c)).join("")}</div>` : "";
  return `<div class="dock ${mine ? "mine" : ""}"><div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${timer}</span></div>${actions ? `<div class="actions">${actions}</div>` : ""}${v.stage !== "bus" && v.stage !== "done" ? hand : ""}</div>`;
}
function overlay() { return ""; }
function onAct(a, el, ctx) {
  if (a === "guess") { ctx.room.act({ type: "guess", g: el.dataset.g }); el.parentElement.classList.add("sent"); return true; }
  if (a === "ride") { ctx.room.act({ type: "ride", g: el.dataset.g }); el.parentElement.classList.add("sent"); return true; }
  if (a === "give") { ctx.room.act({ type: "give", target: el.dataset.target }); return true; }
  if (a === "mcard") { pick.card = el.dataset.card; ctx.render(); return true; }
  if (a === "match") { const card = pick.card; pick.card = null; ctx.room.act({ type: "match", card, target: el.dataset.target }); return true; }
  if (a === "pass") { pick.card = null; ctx.room.act({ type: "pass" }); return true; }
  return undefined;
}
function effect(last, v, prev, ctx) {
  const who = p => esc(ctx.nameOf(p)), chip = p => ctx.rectOf(`.chip[data-pid="${p}"]`);
  if (last.kind === "guess") {
    ctx.showFx(`<div class="big">${cardHtml(last.card, "flip")}</div><div class="t">${last.win ? "Right!" : "Wrong!"}</div><div class="l">${who(last.pid)} said ${OPT_LABEL[last.g].replace(/^\S+ /, "")} · ${esc(cardName(last.card))}${last.win ? "" : ` · drink ${last.drinks}`}</div>`, 1700, last.win ? "good" : "bad");
  }
  if (last.kind === "give" || last.kind === "match") setTimeout(() => ctx.tag(chip(last.target), `+${last.drinks} 🍺`, "bad"), 200);
  if (last.toPyramid) ctx.showFx(`<div class="t">The pyramid</div><div class="l">Hold a matching card and you hand out the row's drinks</div>`, 2000);
  if (last.kind === "flip") ctx.flash(`.pyr [data-i="${last.i}"]`, "flip");
  if (last.toBus) ctx.showFx(`<div class="t">🚌 ${who(last.rider)} ${last.rider === ctx.S.me ? "ride" : "rides"} the bus!</div><div class="l">${last.most} cards left — four right in a row to get off</div>`, 2600, "boom");
  if (last.kind === "ride") {
    if (last.off) ctx.showFx(`<div class="t">Off the bus! 🎉</div><div class="l">${who(last.pid)} made it</div>`, 2400);
    else if (!last.win) { ctx.tag(chip(last.pid), "Drink! Back to start", "bad"); ctx.shake(); }
  }
}
function scores(ctx) {
  const v = ctx.V();
  return `<div class="tbl"><table><tr><th>Player</th><th>Taken 🍺</th><th>Given</th><th>Cards</th></tr>${v.players.map(p => `<tr><td>${esc(ctx.nameOf(p.id))}</td><td><b>${p.taken}</b></td><td>${p.given}</td><td>${p.hand.length}</td></tr>`).join("")}</table></div>`;
}
function podium(ctx) {
  const v = ctx.V(), r = v.result;
  return `<p style="margin-top:0">🚌 <b>${esc(ctx.nameOf(r.rider))}</b> rode the bus${r.tries ? ` and missed ${r.tries} time${r.tries === 1 ? "" : "s"}` : " and got off first try"}.</p>
    <div class="hist">${r.rows.map(row => `<div class="h"><span class="av" style="background:${ctx.SEAT[v.players.findIndex(p => p.id === row.pid)]}">${esc(ctx.plainName(row.pid)[0])}</span><b style="flex:1">${esc(ctx.nameOf(row.pid))}</b><span class="muted">gave ${row.given}</span><b style="font-size:18px">${row.points} 🍺</b></div>`).join("")}</div>`;
}
window.__rbT = T; void SUIT_GLYPH; void SUIT_NAME;
