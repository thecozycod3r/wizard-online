// Kings Cup table: the cup in the middle with a ring of face-down cards; draw, read the rule, pass it on.
import * as E from "./engine.js";
import { startTable, esc } from "../shared/kit.js";
import { cardHtml, rankOf, RANK_TXT, cardName } from "../drinks/cards.js";
import { RULES } from "./rules.js";

const ROLE_ICON = { thumb: "👍", question: "❓" };
const T = startTable({
  path: "kingscup", letter: "C", engine: E, hook: "__kc", title: "Kings Cup", prefix: "kc-", min: E.MIN_PLAYERS, max: E.MAX_PLAYERS, defaults: { jack: "thumb", queen: "question", timer: 60 },
  timers: [[30, "30 s"], [60, "1 min"], [120, "2 min"]],
  rules: RULES, eyebrow: "Table Night · Drinking game · 18+",
  blurb: "Take turns drawing from the ring of cards around the cup. Every card has a rule — Waterfall, Mate, Rhyme, Categories… Whoever draws the fourth King drinks the King's Cup. 3–12 players.",
  note: "Drink responsibly. Sips count, water counts, and nobody has to drink.",
  confetti: ["#f2c14e", "#fff1b0", "#e5322d", "#16161c", "#fff"],
  hero: () => `<div class="fan">${["13H", "1S", "8D"].map((id, i) => `<div class="c" style="--r:${(i - 1) * 12}deg;--y:${Math.abs(i - 1) * 10}px;--d:${i * .1}s">${cardHtml(id)}</div>`).join("")}</div>`,
  welcomeFan: () => ["13S", "1H", "8C", "13D", "11S", "13H"].map(id => cardHtml(id)),
  preload: ["../drinks/art/kings-cup@2x.webp?v=1", "../drinks/art/drink-back@2x.webp?v=1"],
  lobby: (L, host, ctx) => `<div class="row" style="justify-content:space-between"><span>Jack</span>${ctx.seg("jack", [["thumb", "Thumb Master"], ["rule", "Make a Rule"]], L.settings.jack || "thumb", host)}</div>
    <div class="row" style="justify-content:space-between"><span>Queen</span>${ctx.seg("queen", [["question", "Question Master"], ["never", "Never Have I Ever"]], L.settings.queen || "question", host)}</div>`,
  game, scores, podium, effect, onAct,
});

function game(ctx) {
  const v = ctx.V(), { S } = ctx;
  // the cards still in the ring, laid around a circle (gaps where cards were drawn), each turned along the circle
  const ringHtml = Array.from({ length: v.left }, (_, i) => {
    const t = (i / 52) * Math.PI * 2 - Math.PI / 2, x = 50 + 43 * Math.cos(t), y = 50 + 43 * Math.sin(t);
    return `<span class="rc" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;transform:translate(-50%,-50%) rotate(${(t * 180 / Math.PI + 90).toFixed(1)}deg)"></span>`;
  }).join("");
  const chips = v.players.map((p, i) => {
    const roles = Object.entries(v.roles).filter(([, who]) => who === p.id).map(([r]) => `<span title="${r === "thumb" ? "Thumb Master" : "Question Master"}">${ROLE_ICON[r]}</span>`).join("");
    const mate = p.mate ? `🤝 ${esc(v.players.find(x => x.id === p.mate)?.name || "")}` : "";
    return `<div class="chip ${v.turn === p.id && v.phase !== "gameOver" ? "turn" : ""} ${p.id === S.me ? "me" : ""}" data-pid="${p.id}">
      <span class="av" style="background:${ctx.SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span class="nm">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}<span class="sub">${mate || `${p.cards} card${p.cards === 1 ? "" : "s"}`}</span></span>
      <span class="val">${roles}</span>${S.bots?.includes(p.id) ? `<span class="badge bot">BOT</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></div>`;
  }).join("");
  const center = v.card ? `<div class="drawn">${cardHtml(v.card, "flip")}</div>` : "";
  return `<div id="table">${ctx.topBar(`<span class="rnd"><small>KINGS</small>${v.kings}/4</span><span class="muted" style="font-weight:700;font-size:13px">${v.left} cards left</span>`)}
    <div class="scroll"><div class="table-c"><div class="ring">${ringHtml}</div>
      <div class="cup" style="--fill:${v.kings / 4}"><img src="../drinks/art/kings-cup@2x.webp?v=1" alt="The King's Cup"><span class="lvl"></span></div>${center}</div>
      ${v.rule ? `<div class="rulecard"><div class="rn">${RANK_TXT(rankOf(v.card))} · ${esc(v.rule.name)}</div><p>${esc(v.rule.text)}</p></div>` : ""}
      <div class="chips">${chips}</div></div>
    ${dock(v, ctx)}</div>`;
}
function dock(v, ctx) {
  const mine = ctx.myTurn(), timer = mine ? ` <span class="tmr big" data-tmr="${ctx.S.me}"></span>` : "";
  let status = "", actions = "";
  if (v.phase === "draw") { status = mine ? "Your turn — draw a card from the ring" : `${esc(ctx.nameOf(v.turn))} is drawing`; if (mine) actions = `<button class="btn big" data-act="draw">Draw a card</button>`; }
  else if (v.phase === "show") {
    if (mine) {
      if (v.rule.target) { status = v.rule.target === "mate" ? "Pick your mate" : "Pick who drinks"; actions = `<div class="targets">${v.players.filter(p => p.id !== ctx.S.me).map(p => `<button class="btn ghost small" data-act="done" data-target="${p.id}">${esc(p.name)}</button>`).join("")}</div>`; }
      else { status = `${esc(v.rule.name)} — do it, then pass it on`; actions = `<button class="btn big" data-act="done">Next player →</button>`; }
    } else status = `${esc(ctx.nameOf(v.turn))} drew ${esc(cardName(v.card))} · ${esc(v.rule.name)}`;
  } else { status = v.result.cup ? `${esc(ctx.nameOf(v.result.cup))} ${v.result.cup === ctx.S.me ? "drink" : "drinks"} the King's Cup!` : "The deck's empty — game over"; actions = `<button class="btn big" data-act="over">Results</button>`; }
  return `<div class="dock ${mine ? "mine" : ""}"><div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${timer}</span></div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
}
function onAct(a, el, ctx) {
  if (a === "draw") { el.disabled = true; ctx.room.act({ type: "draw" }); return true; }
  if (a === "done") { ctx.room.act({ type: "done", ...(el.dataset.target ? { target: el.dataset.target } : {}) }); return true; }
  return undefined;
}
function effect(last, v, prev, ctx) {
  if (last.kind === "draw") {
    const r = rankOf(last.card), who = esc(ctx.nameOf(last.pid));
    if (last.cup) { ctx.showFx(`<div class="big">${cardHtml(last.card)}</div><div class="t">The 4th King!</div><div class="l">${who} ${last.pid === ctx.S.me ? "drink" : "drinks"} the King's Cup 🍺</div>`, 3200, "boom"); ctx.burst(); return; }
    ctx.showFx(`<div class="big">${cardHtml(last.card, "flip")}</div><div class="t">${esc(last.rule.name)}</div><div class="l">${who} drew ${esc(cardName(last.card))}${r === 13 ? ` · King ${last.kings} of 4 — pour some in` : ""}</div>`, 2000, r === 13 ? "king" : "");
    if (r === 13) ctx.flash(".cup", "pour", 300);
  }
  if (last.kind === "done" && last.target) {
    const t = esc(ctx.nameOf(last.target)), who = esc(ctx.nameOf(last.pid));
    ctx.showFx(last.what === "mate" ? `<div class="t">Mates! 🤝</div><div class="l">${who} + ${t} — drink together for the rest of the game</div>` : `<div class="t">${t} ${last.target === ctx.S.me ? "drink" : "drinks"}!</div><div class="l">${who} picked ${last.target === ctx.S.me ? "you" : "them"}</div>`, 1800);
  }
}
function scores(ctx) {
  const v = ctx.V();
  return `<div class="tbl"><table><tr><th>Player</th><th>Cards drawn</th><th>Mate</th><th>Role</th></tr>${v.players.map(p => `<tr><td>${esc(ctx.nameOf(p.id))}</td><td>${p.cards}</td><td>${p.mate ? esc(ctx.nameOf(p.mate)) : "–"}</td><td>${Object.entries(v.roles).filter(([, w]) => w === p.id).map(([r]) => r === "thumb" ? "Thumb Master" : "Question Master").join(", ") || "–"}</td></tr>`).join("")}</table></div>
    <p class="muted" style="font-size:13px">Kings drawn: ${v.kings} of 4 · ${v.left} cards left in the ring.</p>`;
}
function podium(ctx) {
  const v = ctx.V(), r = v.result;
  return `<div class="cupwin">${r.cup ? `<img src="../drinks/art/kings-cup@2x.webp?v=1" alt=""><h3>${esc(ctx.nameOf(r.cup))} ${r.cup === ctx.S.me ? "drink" : "drinks"} the King's Cup</h3>` : "<h3>The deck ran out</h3>"}</div>${scores(ctx)}`;
}
window.__kcT = T;
