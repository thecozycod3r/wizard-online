// Coup table: everyone's coins and influence round the table, the claim in play in the middle, your two cards and your moves in the dock.
import * as E from "./engine.js";
import { startTable, esc } from "../shared/kit.js";
import { RULES } from "./rules.js";

const ART = r => `art/coup-${r}@2x.webp?v=1`;
const RN = r => E.ROLE[r]?.name || r;
const pick = { type: null, keep: [] };
const T = startTable({
  path: "coup", letter: "U", engine: E, hook: "__coup", title: "Coup", prefix: "coup-", min: E.MIN_PLAYERS, max: E.MAX_PLAYERS,
  defaults: { deck: "classic", factions: "off", window: 12, timer: 30 },
  rules: RULES, eyebrow: "Table Night · Bluffing · 2–10 players",
  blurb: "Two secret characters, a pile of coins, and a court full of liars. Claim any character's power — true or not — and call out everyone else's bluffs. Lose both cards and you're out. Last one standing rules.",
  confetti: ["#f2c14e", "#fff1b0", "#b3202a", "#1b0d10", "#fff"],
  hero: () => `<div class="fan">${["duke", "assassin", "contessa"].map((r, i) => `<div class="c" style="--r:${(i - 1) * 12}deg;--y:${Math.abs(i - 1) * 10}px;--d:${i * .1}s">${card(r)}</div>`).join("")}</div>`,
  welcomeFan: () => ["duke", "assassin", "captain", "ambassador", "contessa", "inquisitor"].map(r => card(r)),
  preload: ["duke", "assassin", "captain", "ambassador", "contessa", "inquisitor", "back"].map(ART),
  lobby: (L, host, ctx) => `<div class="row" style="justify-content:space-between"><span>Characters</span>${ctx.seg("deck", [["classic", "Ambassador"], ["inquisitor", "Inquisitor"]], L.settings.deck || "classic", host)}</div>
    <div class="row" style="justify-content:space-between"><span>Factions <span class="muted" style="font-size:13px">(Reformation)</span></span>${ctx.seg("factions", [["off", "Off"], ["on", "On"]], L.settings.factions || "off", host)}</div>
    <div class="row" style="justify-content:space-between"><span>Time to react</span>${ctx.seg("window", [[8, "8 s"], [12, "12 s"], [20, "20 s"]], L.settings.window || 12, host)}</div>
    <p class="muted" style="margin:0;font-size:14px">${L.players.length > 6 ? `${L.players.length} players: ${L.players.length > 8 ? 5 : 4} of each character in the deck.` : "Up to 6 players: 3 of each character. 7–8 use 4 of each, 9–10 use 5."} With factions on you can't attack your own side until only one side is left.</p>`,
  game, scores, podium, effect, onAct,
  onView: (v, prev) => { if (!prev || prev.turns !== v.turns || prev.phase !== v.phase) { pick.type = null; pick.keep = []; } },
});

function card(r, cls = "", attrs = "") {
  if (!r) return `<div class="cc back ${cls}" ${attrs}><img src="${ART("back")}" alt="Face-down card"></div>`;
  return `<div class="cc ${cls}" ${attrs}><img src="${ART(r)}" alt="${RN(r)}"><span class="cn">${RN(r)}</span></div>`;
}
const coin = n => `<span class="coin">${n}</span>`;
const fac = f => (f ? `<span class="fac ${f}" title="${f === "L" ? "Loyalist" : "Reformist"}">${f === "L" ? "♛" : "⚑"}</span>` : "");
// can I aim this action at pid (mirrors the engine: alive, not me, not my side while two sides remain)?
function aimable(v, me, pid, type) {
  const p = v.players.find(x => x.id === pid);
  if (!p?.alive || pid === me.id) return false;
  if (type === "convert") return true;
  if (v.settings.factions === "on") { const sides = new Set(v.players.filter(x => x.alive).map(x => x.faction)); if (sides.size > 1 && p.faction === me.faction) return false; }
  return true;
}
// "You" at the start of a sentence, "you" inside one, and verbs that agree with either
const who = (ctx, p, mid) => (p === ctx.S.me ? (mid ? "you" : "You") : esc(ctx.plainName(p)));
const vb = (ctx, p, verb) => (p === ctx.S.me ? verb : verb.replace(/^(\w+?)(y)?$/, (m, a, y) => (y ? a + "ies" : /(s|sh|ch)$/.test(a) ? a + "es" : a + "s")));
function claimText(v, ctx, t) {
  const tg = t.target ? who(ctx, t.target, true) : "", tgs = t.target === ctx.S.me ? "your" : `${tg}'s`, V = w => vb(ctx, t.actor, w);
  const what = { aid: `${V("take")} Foreign Aid`, tax: `${V("claim")} the Duke to take 3 coins`, assassinate: `${V("claim")} the Assassin to kill one of ${tgs} cards`, steal: `${V("claim")} the Captain to steal from ${tg}`,
    exchange: `${V("claim")} the ${RN(t.claim)} to exchange cards`, examine: `${V("claim")} the Inquisitor to examine ${tg}`, embezzle: `${V("claim")} NOT to have the Duke and ${V("embezzle")} the reserve`, coup: `${V("launch")} a Coup on ${tg}`, income: `${V("take")} Income`, convert: V("convert") }[t.type] || E.ACT[t.type].label;
  return `${who(ctx, t.actor)} ${what}`;
}

function game(ctx) {
  const v = ctx.V(), { S } = ctx, t = v.T;
  const chips = v.players.map((p, i) => `<div class="chip ${v.turn === p.id ? "turn" : ""} ${p.id === S.me ? "me" : ""} ${p.alive ? "" : "out"} ${t && (t.target === p.id || t.blocker === p.id) ? "aim" : ""}" data-pid="${p.id}">
      <span class="av" style="background:${ctx.SEAT[i]}">${esc(p.name[0]?.toUpperCase())}</span>
      <span class="nm">${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""} ${fac(p.faction)}<span class="sub">${p.alive ? "" : "out · "}${coin(p.coins)}</span></span>
      <span class="mini">${p.cards.map(c => `<span class="m ${c.up ? "up" : ""}" title="${c.up ? RN(c.r) : "hidden"}">${c.up ? `<img src="${ART(c.r)}" alt="${RN(c.r)}">` : ""}</span>`).join("")}</span>
      ${S.bots?.includes(p.id) ? `<span class="badge bot">BOT</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></div>`).join("");
  let mid = `<div class="claim idle"><span class="muted">${v.phase === "gameOver" ? "" : `${esc(ctx.nameOf(v.turn))} ${v.turn === S.me ? "are" : "is"} choosing an action…`}</span></div>`;
  if (t) {
    const blk = t.blocker ? `<div class="blk">🛡 ${esc(ctx.nameOf(t.blocker))} ${t.blocker === S.me ? "block" : "blocks"} as the <b>${RN(t.blockAs)}</b></div>` : "";
    const left = v.waiting.length && (v.phase === "respond" || v.phase === "blockRespond") ? `<div class="muted wl">Waiting on ${v.waiting.map(p => esc(ctx.plainName(p))).join(", ")}</div>` : "";
    mid = `<div class="claim">${t.claim ? card(t.claim, "small") : ""}<div class="ct"><div class="eyebrow">${esc(E.ACT[t.type].label)}</div><div>${claimText(v, ctx, t)}</div>${blk}${left}</div>${t.blockAs ? card(t.blockAs, "small") : ""}</div>`;
  }
  const facts = `<span class="rnd"><small>COURT</small>${v.deckN}</span>${v.settings.factions === "on" ? `<span class="rnd"><small>RESERVE</small>${v.reserve}</span>` : ""}`;
  const log = v.log.slice(-5).reverse().map(e => `<li>${logLine(e, ctx)}</li>`).filter(x => x !== "<li></li>").join("");
  return `<div id="table">${ctx.topBar(facts)}
    <div class="scroll">${mid}<div class="chips">${chips}</div>${log ? `<ul class="log">${log}</ul>` : ""}</div>${dock(v, ctx)}</div>`;
}
function logLine(e, ctx) {
  const n = p => who(ctx, p, true), N = p => who(ctx, p);
  switch (e.k) {
    case "declare": return `${N(e.pid)}: ${esc(E.ACT[e.type].label)}${e.target ? ` → ${n(e.target)}` : ""}${e.claim ? ` <span class="muted">(${RN(e.claim)})</span>` : ""}`;
    case "challenge": return `${N(e.pid)} challenged ${n(e.on)} — ${e.proved ? (e.anti ? "no Duke there" : `had the ${RN(e.role)}`) : e.anti ? "had the Duke!" : "bluffing!"}`;
    case "block": return `${N(e.pid)} blocked as the ${RN(e.as)}`;
    case "blocked": return `Blocked.`;
    case "lose": return `${N(e.pid)} lost the ${RN(e.role)}${e.dead ? (e.pid === ctx.S.me ? " and are out" : " and is out") : ""}`;
    case "steal": return `${N(e.pid)} stole ${e.n} from ${n(e.target)}`;
    case "gain": return `${N(e.pid)} +${e.n} coin${e.n === 1 ? "" : "s"}`;
    case "convert": return `${N(e.target)} ${e.target === ctx.S.me ? "are" : "is"} now ${e.to === "L" ? "Loyalist" : "Reformist"}`;
    case "exchanged": return `${N(e.pid)} exchanged cards`;
    case "examined": return `${N(e.pid)} examined ${n(e.target)}${e.force ? " and forced a swap" : ""}`;
    default: return "";
  }
}
function dock(v, ctx) {
  const { S } = ctx, me = v.players[v.me], t = v.T, mine = ctx.myTurn(), timer = mine ? ` <span class="tmr big" data-tmr="${S.me}"></span>` : "";
  let status = "", actions = "";
  const myCards = (sel = "") => `<div class="mycards">${v.mine.map((c, i) => card(c.r, `${c.up ? "dead" : ""} ${sel && !c.up ? "pickable" : ""}`, sel && !c.up ? `data-act="${sel}" data-i="${i}" role="button" tabindex="0"` : "")).join("")}</div>`;
  let cards = me ? myCards() : "";
  if (v.phase === "action" && mine) {
    const c = me.coins;
    if (pick.type) {
      const tg = v.players.filter(p => aimable(v, me, p.id, pick.type) || (pick.type === "convert" && p.id === me.id));
      status = pick.type === "convert" ? "Convert who? (yourself: 1 coin · someone else: 2)" : `${E.ACT[pick.type].label} — pick a player`;
      actions = `<div class="targets">${tg.map(p => `<button class="btn ghost small" data-act="tgt" data-t="${p.id}">${esc(p.id === me.id ? "Me" : p.name)}${p.id === me.id ? "" : ` · ${p.coins}🪙`}</button>`).join("")}<button class="btn ghost small" data-act="unpick">Back</button></div>`;
    } else {
      status = c >= 10 ? "10 coins — you must launch a Coup" : "Your turn — pick an action (you may bluff any character)";
      const has = r => v.mine.some(x => !x.up && x.r === r);
      const anyAim = type => v.players.some(p => aimable(v, me, p.id, type));
      const B = (type, sub, ok = true) => `<button class="act ${has(E.ACT[type].claim === "SWAP" ? v.roles[3] : E.ACT[type].claim) ? "true" : ""}" data-act="do" data-a="${type}" ${ok && (c < 10 || type === "coup") ? "" : "disabled"}><b>${E.ACT[type].label}</b><small>${sub}</small></button>`;
      const swap = v.roles[3];
      actions = `<div class="acts">${[
        B("income", "+1 coin"), B("aid", "+2 · Duke blocks"), B("coup", "Pay 7", c >= 7 && anyAim("coup")),
        B("tax", "Duke · +3"), B("steal", "Captain · take 2", anyAim("steal")), B("assassinate", "Assassin · pay 3", c >= 3 && anyAim("assassinate")),
        B("exchange", `${RN(swap)} · swap ${swap === "ambassador" ? 2 : 1}`),
        swap === "inquisitor" ? B("examine", "Inquisitor · peek", anyAim("examine")) : "",
        v.settings.factions === "on" ? B("convert", "Pay 1 or 2", c >= 1) + B("embezzle", `Not Duke · take ${v.reserve}`, v.reserve > 0) : "",
      ].join("")}</div>`;
    }
  } else if ((v.phase === "respond" || v.phase === "blockRespond") && mine) {
    status = v.phase === "blockRespond" ? `${who(ctx, t.blocker)} ${vb(ctx, t.blocker, "block")} as the ${RN(t.blockAs)}. Challenge it?` : t.blockOnly ? "Block it?" : claimText(v, ctx, t);
    const can = v.can || { challenge: false, blocks: [] };
    actions = `<div class="opts"><button class="btn ghost" data-act="pass">Let it happen</button>${can.challenge ? `<button class="btn reject" data-act="challenge">Challenge!</button>` : ""}${can.blocks.map(r => `<button class="btn approve" data-act="block" data-as="${r}">Block as ${RN(r)}</button>`).join("")}</div>`;
  } else if (v.phase === "lose" && mine) {
    status = "You lose an influence — pick a card to turn face up"; cards = myCards("lose");
  } else if (v.phase === "exchange" && mine) {
    const live = v.mine.filter(c => !c.up).map(c => c.r), all = [...live, ...(t.pool || [])];
    status = `Keep ${live.length} — ${pick.keep.length}/${live.length} chosen`;
    actions = `<div class="mycards pool">${all.map((r, i) => card(r, `pickable ${pick.keep.includes(i) ? "on" : ""}`, `data-act="keepi" data-i="${i}" role="button" tabindex="0"`)).join("")}</div>
      <button class="btn" data-act="keep" ${pick.keep.length === live.length ? "" : "disabled"}>Keep these</button>`;
    cards = "";
  } else if (v.phase === "examineShow" && mine) {
    status = `${esc(ctx.nameOf(t.actor))} is examining you — show one card`; cards = myCards("show");
  } else if (v.phase === "examineDecide" && mine) {
    status = `${esc(ctx.plainName(t.target))} showed you the ${RN(t.shown)}`;
    actions = `<div class="opts">${card(t.shown, "small")}<button class="btn ghost" data-act="decide" data-f="0">Give it back</button><button class="btn" data-act="decide" data-f="1">Force a swap</button></div>`;
  } else if (v.phase === "gameOver") {
    status = `${esc(ctx.nameOf(v.result.winners[0]))} ${v.result.winners[0] === S.me ? "rule" : "rules"} the court!`; actions = `<button class="btn big" data-act="over">Results</button>`;
  } else {
    const w = v.waiting.map(p => esc(ctx.plainName(p))).join(", ");
    status = !me?.alive ? "You're out — watch the court tear itself apart" : t ? { respond: `Waiting on ${w}`, blockRespond: `Waiting on ${w}`, lose: `${w} is choosing a card to lose`, exchange: `${w} is exchanging cards`, examineShow: `${w} is picking a card to show`, examineDecide: `${w} is deciding` }[v.phase] || "" : `${esc(ctx.nameOf(v.turn))} is choosing`;
  }
  return `<div class="dock ${mine ? "mine" : ""}"><div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${timer}</span><span class="me-coins">${me ? coin(me.coins) : ""}</span></div>${actions ? `<div class="actions">${actions}</div>` : ""}${cards}</div>`;
}
function onAct(a, el, ctx) {
  const v = ctx.V();
  if (a === "do") { const type = el.dataset.a; if (E.ACT[type].target || type === "convert") { pick.type = type; ctx.render(); } else ctx.room.act({ type }); return true; }
  if (a === "tgt") { const type = pick.type; pick.type = null; ctx.room.act({ type, target: el.dataset.t }); return true; }
  if (a === "unpick") { pick.type = null; ctx.render(); return true; }
  if (a === "pass") { el.parentElement.classList.add("sent"); ctx.room.act({ type: "pass" }); return true; }
  if (a === "challenge") { el.parentElement.classList.add("sent"); ctx.room.act({ type: "challenge" }); return true; }
  if (a === "block") { el.parentElement.classList.add("sent"); ctx.room.act({ type: "block", as: el.dataset.as }); return true; }
  if (a === "lose") { ctx.room.act({ type: "lose", card: +el.dataset.i }); return true; }
  if (a === "show") { ctx.room.act({ type: "show", card: +el.dataset.i }); return true; }
  if (a === "decide") { ctx.room.act({ type: "decide", force: el.dataset.f === "1" }); return true; }
  if (a === "keepi") {
    const i = +el.dataset.i, want = v.mine.filter(c => !c.up).length;
    pick.keep = pick.keep.includes(i) ? pick.keep.filter(x => x !== i) : [...pick.keep, i].slice(-want); ctx.render(); return true;
  }
  if (a === "keep") { const k = pick.keep; pick.keep = []; ctx.room.act({ type: "keep", keep: k }); return true; }
  return undefined;
}
function effect(last, v, prev, ctx) {
  const n = p => who(ctx, p), m = p => who(ctx, p, true), chip = p => ctx.rectOf(`.chip[data-pid="${p}"]`);
  for (const e of last.items || []) {
    if (e.k === "declare" && e.type === "coup") ctx.showFx(`<div class="t">⚔ Coup!</div><div class="l">${n(e.pid)} ${vb(ctx, e.pid, "strike")} at ${m(e.target)}</div>`, 1700, "boom");
    else if (e.k === "declare" && e.type === "assassinate") ctx.showFx(`<div class="big">${card("assassin")}</div><div class="t">Assassination!</div><div class="l">${n(e.pid)} → ${m(e.target)}</div>`, 1700, "bad");
    else if (e.k === "declare" && e.claim) ctx.tag(chip(e.pid), `${RN(e.claim)}?`);
    if (e.k === "challenge") ctx.showFx(`<div class="big">${card(e.role)}</div><div class="t">${e.proved ? (e.anti ? "No Duke — fair claim!" : "The claim was true!") : "Caught bluffing!"}</div><div class="l">${n(e.pid)} challenged ${m(e.on)} — ${e.proved ? `${m(e.pid)} ${vb(ctx, e.pid, "lose")} a card` : `${m(e.on)} ${vb(ctx, e.on, "lose")} a card`}</div>`, 2200, e.proved ? "good" : "bad");
    if (e.k === "blocked") ctx.showFx(`<div class="big">${card(e.as)}</div><div class="t">Blocked!</div><div class="l">${n(e.pid)} stopped ${e.actor === ctx.S.me ? "your" : m(e.actor) + "'s"} ${esc(E.ACT[e.type].label)}</div>`, 1800);
    if (e.k === "lose") { ctx.tag(chip(e.pid), `✖ ${RN(e.role)}`, "bad", 200); if (e.dead) ctx.showFx(`<div class="t">${n(e.pid)} ${e.pid === ctx.S.me ? "are" : "is"} out</div><div class="l">Both cards are face up</div>`, 1600, "bad"); }
    if (e.k === "steal" && e.n) ctx.fly(`<span class="coin">${e.n}</span>`, chip(e.target), chip(e.pid), { w: 34 });
    if (e.k === "gain") ctx.tag(chip(e.pid), `+${e.n}🪙`, "good");
    if (e.k === "convert") ctx.tag(chip(e.target), e.to === "L" ? "♛ Loyalist" : "⚑ Reformist");
  }
}
function scores(ctx) {
  const v = ctx.V();
  return `<div class="tbl"><table><tr><th>Player</th><th>Coins</th><th>Cards left</th><th>Lost</th></tr>${v.players.map(p => `<tr><td>${esc(ctx.nameOf(p.id))} ${fac(p.faction)}</td><td>${p.coins}</td><td>${p.cards.filter(c => !c.up).length}</td><td>${p.cards.filter(c => c.up).map(c => RN(c.r)).join(", ") || "–"}</td></tr>`).join("")}</table></div>
    <p class="muted" style="font-size:13px">Court deck: ${v.copies} of each of ${v.roles.map(RN).join(", ")}.</p>`;
}
function podium(ctx) {
  const v = ctx.V(), r = v.result;
  return `<div class="hist">${r.rows.map(row => { const p = v.players.find(x => x.id === row.pid); return `<div class="h"><b style="width:26px">${row.place}</b><span class="av" style="background:${ctx.SEAT[v.players.indexOf(p)]}">${esc(p.name[0])}</span><b style="flex:1">${esc(ctx.nameOf(p.id))}${row.place === 1 ? ` ${ctx.CROWN}` : ""}</b><span class="mini">${p.cards.map(c => `<span class="m up"><img src="${ART(c.r)}" alt="${RN(c.r)}"></span>`).join("")}</span></div>`; }).join("")}</div>`;
}
window.__coupT = T;
