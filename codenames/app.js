// Codenames table: pick teams and spymasters, then the 5×5 board. Spymasters see the key and type the clue; operatives tap a word
// to mark it for their team, then confirm the guess.
import * as E from "./engine.js";
import { startTable, esc } from "../shared/kit.js";
import { RULES } from "./rules.js";

const ART = n => `art/cn-${n}@2x.webp?v=1`;
const TILE = { red: "red", blue: "blue", neutral: "bystander", assassin: "assassin" };
const TEAM = { red: "Red", blue: "Blue" };
const ui = { sel: null, word: "", n: 1, turnNo: null };
const T = startTable({
  path: "codenames", letter: "D", engine: E, hook: "__cn", title: "Codenames", prefix: "cn-", min: E.MIN_PLAYERS, max: E.MAX_PLAYERS,
  defaults: { timer: 120 }, timers: [[60, "1 min"], [120, "2 min"], [180, "3 min"]],
  rules: RULES, eyebrow: "Table Night · Word game · 4–12 players",
  blurb: "Two teams, twenty-five words, one secret key. Your spymaster links your words with a single clever clue — you find them before the other team does, and never, ever touch the assassin.",
  confetti: ["#e5484d", "#3e7bfa", "#f2e8d5", "#ffffff"],
  hero: () => `<div class="fan">${["red", "assassin", "blue"].map((k, i) => `<div class="c" style="--r:${(i - 1) * 12}deg;--y:${Math.abs(i - 1) * 10}px;--d:${i * .1}s"><div class="tcard"><img src="${ART(k)}" alt=""></div></div>`).join("")}</div>`,
  welcomeFan: () => ["red", "blue", "bystander", "assassin", "red", "blue"].map(k => `<div class="tcard"><img src="${ART(k)}" alt=""></div>`),
  preload: ["red", "blue", "bystander", "assassin", "hero"].map(ART),
  lobby: () => `<p class="muted" style="margin:0;font-size:14px">You'll pick teams and spymasters at the table. The timer below is per clue and per guessing turn — when the guessers run out of time, the turn passes.</p>`,
  game, scores, podium, effect, onAct,
  onView: v => { if (v.clue == null || ui.turnNo !== v.clues.length) { ui.sel = null; ui.turnNo = v.clues.length; } if (v.open[ui.sel]) ui.sel = null; },
  afterRender: () => { const i = document.getElementById("clue"); if (i && ui.focus) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } },
});

function setup(v, ctx) {
  const { S } = ctx, mine = v.team[S.me];
  const col = t => `<div class="tpanel ${t}"><div class="th">${TEAM[t]} team</div><ul>${v.players.filter(p => p.team === t).map(p => `<li>${p.spymaster ? "🕶️" : "🔎"} ${esc(p.name)}${p.id === S.me ? " <span class='muted'>(you)</span>" : ""}<small>${p.spymaster ? "spymaster" : "operative"}</small></li>`).join("")}</ul>
    ${mine !== t ? `<button class="btn ghost small" data-act="team" data-t="${t}">Join ${TEAM[t]}</button>` : !v.players.find(p => p.id === S.me).spymaster ? `<button class="btn ghost small" data-act="spymaster">Be spymaster</button>` : ""}</div>`;
  return `<div class="setup-cn"><h2>Pick your teams</h2><p class="muted">Each team needs a spymaster (sees the key, gives clues) and at least one operative. ${TEAM[v.start]} goes first with 9 words.</p>
    <div class="teams">${col("red")}${col("blue")}</div></div>`;
}
function board(v, ctx) {
  const { S } = ctx, opTurn = v.phase === "guess" && v.team[S.me] === v.turn && !v.players.find(p => p.id === S.me)?.spymaster;
  return `<div class="board ${v.spyView ? "spyv" : ""}">${v.words.map((w, i) => {
    const k = v.key[i], open = v.open[i], marks = (v.marks[i] || []).map(p => esc(v.players.find(x => x.id === p)?.name[0] || "")).join("");
    return `<button class="w ${open ? `open ${TILE[k]}` : k ? `k-${TILE[k]}` : ""} ${ui.sel === i ? "sel" : ""}" ${opTurn && !open ? `data-act="card" data-i="${i}"` : "disabled"}>
      ${open ? `<img src="${ART(TILE[k])}" alt="">` : ""}<span>${esc(w)}</span>${marks && !open ? `<em>${marks}</em>` : ""}</button>`;
  }).join("")}</div>`;
}
// who's on which team, under the board (spymaster first, BOT badge on seats a bot is playing)
function roster(v, ctx) {
  const { S } = ctx;
  return `<div class="roster">${["red", "blue"].map(t => `<div class="rt ${t}">${v.players.filter(p => p.team === t).sort((a, b) => b.spymaster - a.spymaster).map(p => `<span class="rp ${v.waiting.includes(p.id) ? "on" : ""}" data-pid="${p.id}">${p.spymaster ? "🕶️" : "🔎"} ${esc(p.name)}${p.id === S.me ? " (you)" : ""}${S.bots?.includes(p.id) ? ` <span class="badge bot">BOT</span>` : ""}<span class="tmr" data-tmr="${p.id}"></span></span>`).join("")}</div>`).join("")}</div>`;
}
function game(ctx) {
  const v = ctx.V();
  const sc = `<span class="rnd red"><small>RED</small>${v.left.red}</span><span class="rnd blue"><small>BLUE</small>${v.left.blue}</span>`;
  const clue = v.clue ? `<div class="clue ${v.clue.team}"><span class="cw">${esc(v.clue.word)}</span><span class="cn">${v.clue.n || "∞"}</span><span class="muted">${v.guesses} guessed${v.clue.n ? ` · up to ${v.clue.n + 1}` : ""}</span></div>` : "";
  return `<div id="table" class="turn-${v.turn}">${ctx.topBar(sc)}<div class="scroll">${v.phase === "setup" ? setup(v, ctx) : clue + board(v, ctx) + roster(v, ctx)}</div>${dock(v, ctx)}</div>`;
}
function dock(v, ctx) {
  const { S } = ctx, mine = ctx.myTurn(), me = v.players.find(p => p.id === S.me), timer = mine ? ` <span class="tmr big" data-tmr="${S.me}"></span>` : "";
  const T_ = `<b class="${v.turn}">${TEAM[v.turn]}</b>`;
  let status = "", actions = "";
  if (v.phase === "setup") {
    status = v.ready ? "Teams are set — anyone can start" : "Waiting for a spymaster and an operative on each team";
    actions = `<button class="btn big" data-act="begin" ${v.ready ? "" : "disabled"}>Start the game</button>`;
  } else if (v.phase === "clue") {
    if (mine) {
      status = "Your clue: one word and a number";
      actions = `<div class="cluebox"><input id="clue" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="One word" value="${esc(ui.word)}">
        <span class="seg nums">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button aria-pressed="${ui.n === n}" data-act="num" data-n="${n}">${n || "∞"}</button>`).join("")}</span>
        <button class="btn" data-act="giveclue" ${ui.word.trim() ? "" : "disabled"}>Give clue</button></div>`;
    } else status = `${T_} spymaster ${esc(ctx.nameOf(v.spy[v.turn]))} is thinking of a clue…`;
  } else if (v.phase === "guess") {
    const myTeam = v.team[S.me] === v.turn && !me?.spymaster;
    if (myTeam) {
      status = ui.sel != null ? `Guess “${esc(v.words[ui.sel])}”?` : "Tap a word to mark it — your team sees your marks";
      actions = `<div class="opts">${ui.sel != null ? `<button class="btn approve" data-act="guess">Guess ${esc(v.words[ui.sel])}</button>` : ""}${v.guesses ? `<button class="btn ghost" data-act="end">End turn</button>` : ""}</div>`;
    } else status = `${T_} team is guessing${me?.spymaster && v.team[S.me] === v.turn ? " — no hints!" : ""}`;
  } else { const r = v.result; status = `${TEAM[r.winner]} team wins${r.how === "assassin" ? " — the assassin was found" : "!"}`; actions = `<button class="btn big" data-act="over">Results</button>`; }
  const role = me ? `<span class="myrole ${v.team[S.me]}">${TEAM[v.team[S.me]]} · ${me.spymaster ? "spymaster" : "operative"}</span>` : "";
  return `<div class="dock ${mine ? "mine" : ""}"><div class="dockhead"><span class="status ${mine ? "you" : ""}">${status}${timer}</span>${role}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
}
function onAct(a, el, ctx) {
  const v = ctx.V();
  if (a === "team") { ctx.room.act({ type: "team", team: el.dataset.t }); return true; }
  if (a === "spymaster") { ctx.room.act({ type: "spymaster" }); return true; }
  if (a === "begin") { ctx.room.act({ type: "begin" }); return true; }
  if (a === "num") { ui.n = +el.dataset.n; ctx.render(); return true; }
  if (a === "giveclue") { const word = ui.word.trim(); ctx.room.act({ type: "clue", word, n: ui.n }); ui.focus = false; return true; }
  if (a === "card") { const i = +el.dataset.i; if (ui.sel !== i) { ui.sel = i; ctx.room.act({ type: "mark", i }); } ctx.render(); return true; }
  if (a === "guess") { const i = ui.sel; ui.sel = null; ctx.room.act({ type: "guess", i }); return true; }
  if (a === "end") { ctx.room.act({ type: "end" }); return true; }
  void v; return undefined;
}
// keep the typed clue across re-renders, and submit with Enter
document.addEventListener("input", e => { if (e.target.id === "clue") { ui.word = e.target.value.replace(/\s+/g, ""); if (e.target.value !== ui.word) e.target.value = ui.word; ui.focus = true; const b = document.querySelector('[data-act="giveclue"]'); if (b) b.disabled = !ui.word; } });
document.addEventListener("focusout", e => { if (e.target.id === "clue") setTimeout(() => { if (document.activeElement?.id !== "clue") ui.focus = false; }, 0); });
document.addEventListener("keydown", e => { if (e.target.id === "clue" && e.key === "Enter" && ui.word) document.querySelector('[data-act="giveclue"]')?.click(); });

function effect(last, v, prev, ctx) {
  const n = p => esc(ctx.nameOf(p));
  if (last.kind === "begin") ctx.showFx(`<div class="t">${TEAM[last.team]} goes first</div><div class="l">Spymasters: check the key</div>`, 1800);
  if (last.kind === "clue") { ui.word = ""; ctx.showFx(`<div class="t ${last.team}">${esc(last.word)} · ${last.n || "∞"}</div><div class="l">${TEAM[last.team]} spymaster's clue</div>`, 1800, last.team); }
  if (last.kind === "guess" || (last.i != null && last.color)) {
    ctx.flash(`.board .w:nth-child(${last.i + 1})`, "flip");
    if (last.win) return;
    if (last.color === last.team) ctx.tag(ctx.rectOf(`.board .w:nth-child(${last.i + 1})`), "✓", "good");
    else ctx.showFx(`<div class="big"><img src="${ART(TILE[last.color])}" alt=""></div><div class="t">${last.color === "neutral" ? "A bystander" : `${TEAM[last.color]} agent!`}</div><div class="l">${n(last.pid)} picked ${esc(last.word)} — turn over</div>`, 1700, "bad");
  }
  if (last.win) {
    ctx.showFx(`<div class="big"><img src="${ART(last.how === "assassin" ? "assassin" : last.win)}" alt=""></div><div class="t">${TEAM[last.win]} team wins!</div><div class="l">${last.how === "assassin" ? `${n(last.pid)} found the assassin` : "Every agent found"}</div>`, 2800, last.how === "assassin" ? "boom" : last.win);
    if (v.team[ctx.S.me] === last.win) ctx.burst();
  }
  if (last.kind === "timeout") ctx.showFx(`<div class="t">⏰ Time!</div><div class="l">${TEAM[last.next]} team's turn</div>`, 1500);
}
function scores(ctx) {
  const v = ctx.V();
  return `<div class="tbl"><table><tr><th>Clue</th><th>Team</th><th>Found</th></tr>${v.clues.slice().reverse().map(c => `<tr><td><b>${esc(c.word)}</b> ${c.n || "∞"}</td><td>${TEAM[c.team]}</td><td>${c.got.map(i => `<span class="dotk ${TILE[v.key[i]] || ""}"></span>${esc(v.words[i])}`).join(", ") || "–"}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">No clues yet</td></tr>`}</table></div>
    <p class="muted" style="font-size:13px">Left to find — Red ${v.left.red} · Blue ${v.left.blue}</p>`;
}
function podium(ctx) {
  const v = ctx.V(), r = v.result;
  const team = t => v.players.filter(p => p.team === t).map(p => `${p.spymaster ? "🕶️" : ""}${esc(ctx.nameOf(p.id))}`).join(", ");
  return `<div class="winbox ${r.winner}"><img src="${ART(r.winner)}" alt=""><div><h3>${TEAM[r.winner]} team wins</h3><p>${team(r.winner)}</p><p class="muted">${r.how === "assassin" ? "The other team found the assassin." : "Every agent found."}</p></div></div>${board(v, ctx)}${scores(ctx)}`;
}
window.__cnT = T;
