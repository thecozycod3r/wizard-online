// On-screen effects for special cards. Purely visual: a fixed, click-through layer above the table
// (a canvas for particles + DOM for banners), never touched by the app's re-renders.

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let layer, canvas, ctx, parts = [], running = false, W = 0, H = 0, dpr = 1;

function ensure() {
  if (layer) return;
  layer = document.createElement("div");
  layer.id = "fx";
  layer.setAttribute("aria-hidden", "true");
  canvas = document.createElement("canvas");
  layer.append(canvas);
  document.body.append(layer);
  ctx = canvas.getContext("2d");
  const size = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size(); addEventListener("resize", size);
}

// ---------------- particles ----------------
const rand = (a, b) => a + Math.random() * (b - a);
function emit(n, f) { for (let i = 0; i < n; i++) parts.push(f(i)); if (!running) { running = true; requestAnimationFrame(tick); } }

function tick(t) {
  ctx.clearRect(0, 0, W, H);
  parts = parts.filter(p => (p.age += 1) < p.life);
  for (const p of parts) {
    if (p.delay && p.age < p.delay) continue;
    p.vx *= p.drag ?? 0.985; p.vy = p.vy * (p.drag ?? 0.985) + (p.g ?? 0);
    p.x += p.vx; p.y += p.vy;
    if (p.spin) p.rot = (p.rot || 0) + p.spin;
    const k = 1 - p.age / p.life;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.fade === false ? 1 : k * 1.4));
    ctx.save(); ctx.translate(p.x, p.y); if (p.rot) ctx.rotate(p.rot);
    if (p.text) { ctx.font = `${p.size}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.text, 0, 0); }
    else if (p.line) { ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * p.line, -p.vy * p.line); ctx.stroke(); }
    else if (p.star) { ctx.fillStyle = p.color; star(p.size * (0.6 + 0.4 * Math.sin(p.age / 3))); }
    else { const r = p.size * (p.grow ? 1 + (1 - k) * p.grow : k * 0.7 + 0.3); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, p.color); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, W, H); }
}
function star(r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.3 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

// ---------------- DOM pieces ----------------
function el(cls, html = "", ms = 1800) {
  const d = document.createElement("div"); d.className = cls; d.innerHTML = html;
  layer.append(d); setTimeout(() => d.remove(), ms); return d;
}
function shake(strength = 1) {
  if (reduce) return;
  const a = document.getElementById("app");
  a.style.setProperty("--shake", strength * 9 + "px");
  a.classList.remove("shake"); void a.offsetWidth; a.classList.add("shake");
  setTimeout(() => a.classList.remove("shake"), 650);
}
function flash(color, ms = 500) { el("fx-flash", "", ms).style.background = color; }
function vignette(color, ms = 1600) { el("fx-vig", "", ms).style.setProperty("--vc", color); }

// Big card swoop + caption. `from` = rect of the played card (or null → centre).
function banner(id, title, line, color, from) {
  const d = el("fx-banner", `<img src="cards/${id}@2x.webp" alt=""><div class="fx-title" style="--fc:${color}">${title}</div>${line ? `<div class="fx-line">${line}</div>` : ""}`, reduce ? 1300 : 1700);
  if (from && !reduce) {
    const cx = from.left + from.width / 2 - innerWidth / 2, cy = from.top + from.height / 2 - innerHeight / 2;
    d.style.setProperty("--fx", cx + "px"); d.style.setProperty("--fy", cy + "px");
  }
}

const centre = r => r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: W / 2, y: H / 2 };

// ---------------- per-card effects ----------------
const EFFECTS = {
  dragon(r) {
    const c = centre(r);
    shake(1.4); flash("rgba(255,120,30,.28)", 450); vignette("rgba(160,30,0,.55)");
    emit(reduce ? 20 : 140, () => ({ x: c.x, y: c.y, vx: rand(-7, 7), vy: rand(-9, 2), g: 0.12, life: rand(45, 85), size: rand(10, 26), color: ["#ffcc55", "#ff7a1a", "#ff3b1f", "#ffe9a8"][Math.floor(rand(0, 4))], grow: 1.2 }));
    emit(reduce ? 0 : 40, () => ({ x: rand(0, W), y: H + 10, vx: rand(-.5, .5), vy: rand(-6, -3), life: rand(60, 100), size: rand(3, 7), color: "#ffb347" }));
  },
  fairy(r) {
    const c = centre(r);
    vignette("rgba(255,170,240,.25)", 1400);
    emit(reduce ? 15 : 90, i => { const a = rand(0, 6.28), s = rand(1, 4.5);
      return { x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: -0.02, life: rand(50, 95), size: rand(4, 9), star: true, color: ["#fff6b0", "#ffc4f2", "#b7f3ff", "#ffffff"][i % 4] }; });
  },
  bomb(r) { // played: fizzing fuse
    const c = centre(r);
    emit(reduce ? 8 : 50, () => ({ x: c.x, y: c.y - (r ? r.height * 0.3 : 30), vx: rand(-3, 3), vy: rand(-5, -1), g: 0.18, life: rand(18, 40), size: 2, line: 3, color: "#ffd36b" }));
  },
  boom(r) { // the bombed trick resolves
    const c = centre(r);
    flash("rgba(255,255,255,.9)", 380); shake(2.2);
    el("fx-ring", "", 900).style.cssText += `left:${c.x}px;top:${c.y}px`;
    emit(reduce ? 25 : 180, () => { const a = rand(0, 6.28), s = rand(3, 13);
      return { x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.15, drag: 0.96, life: rand(30, 70), size: rand(8, 24), color: ["#fff1b8", "#ffb03a", "#ff5a1f", "#7a7a7a"][Math.floor(rand(0, 4))], grow: 0.8 }; });
    el("fx-word", "BOOM!", 1200).style.setProperty("--fc", "#ff9b3d");
  },
  werewolf() {
    vignette("rgba(10,20,60,.75)", 2000);
    el("fx-moon", "", 2000);
    el("fx-word", "Awooo!", 1700).style.setProperty("--fc", "#d8e4ff");
    emit(reduce ? 0 : 50, () => ({ x: rand(0, W), y: rand(H * .3, H), vx: rand(-.3, .3), vy: rand(-1.2, -.4), life: rand(60, 110), size: rand(2, 4), color: "#cfe0ff" }));
  },
  juggler(r) {
    const c = centre(r), cols = ["#4c86ee", "#2fb36a", "#e2493f", "#eeb52b"];
    if (reduce) return;
    for (let k = 0; k < 4; k++) {
      const o = document.createElement("div"); o.className = "fx-orb"; o.style.background = cols[k];
      o.style.left = c.x + "px"; o.style.top = c.y + "px"; o.style.animationDelay = k * 0.12 + "s";
      layer.append(o); setTimeout(() => o.remove(), 1700);
    }
  },
  pass() { // everyone just passed a card left
    el("fx-pass", `<span>↺</span><b>Cards passed left</b>`, 1500);
  },
  cloud(r) {
    vignette("rgba(20,24,40,.7)", 1700);
    const bolt = () => { flash("rgba(220,230,255,.75)", 160); el("fx-bolt", `<svg viewBox="0 0 60 200"><path d="M34 0 L8 110 L28 110 L14 200 L52 76 L32 76 L48 0Z"/></svg>`, 420).style.left = rand(15, 75) + "%"; };
    bolt(); if (!reduce) setTimeout(bolt, 380);
    emit(reduce ? 0 : 160, () => ({ x: rand(-40, W), y: rand(-H * .4, 0), vx: 1.6, vy: rand(9, 14), g: 0, drag: 1, life: rand(40, 70), size: 1.4, line: 2.2, color: "rgba(170,195,255,.8)", fade: false }));
  },
  cloudBid() { el("fx-word", "Bid ±1", 1300).style.setProperty("--fc", "#b8c8ff"); },
  witch(r) {
    const c = centre(r);
    vignette("rgba(30,90,30,.45)", 1600);
    emit(reduce ? 15 : 90, i => ({ x: c.x + rand(-30, 30), y: c.y + rand(-10, 30), vx: Math.sin(i) * rand(.5, 2.4), vy: rand(-3.2, -1), g: -0.01, life: rand(55, 100), size: rand(14, 34), color: i % 3 ? "rgba(120,255,140,.55)" : "rgba(190,120,255,.5)", grow: 1.6 }));
  },
  swap(r) { // the Witch swap happens
    const c = centre(r);
    emit(reduce ? 10 : 60, i => { const a = (i / 60) * 6.28; return { x: c.x + Math.cos(a) * 60, y: c.y + Math.sin(a) * 60, vx: -Math.sin(a) * 3, vy: Math.cos(a) * 3, drag: 0.97, life: 50, size: 5, star: true, color: "#9dffb0" }; });
    el("fx-word", "Swapped!", 1100).style.setProperty("--fc", "#9dffb0");
  },
  vampire(r) {
    vignette("rgba(130,0,20,.55)", 1800);
    emit(reduce ? 4 : 22, i => { const left = i % 2 === 0; return { x: left ? -30 : W + 30, y: rand(H * .1, H * .7), vx: (left ? 1 : -1) * rand(5, 9), vy: rand(-1.5, 1.5), g: 0, drag: 1, life: 110, size: rand(22, 38), text: "🦇", fade: false, delay: rand(0, 25) }; });
  },
  shapeshifter(r) {
    const c = centre(r);
    if (!reduce) el("fx-morph", "", 1100).style.cssText += `left:${c.x}px;top:${c.y}px`;
    emit(reduce ? 10 : 70, i => { const a = rand(0, 6.28), s = rand(1, 5); return { x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(30, 60), size: rand(6, 14), color: i % 2 ? "rgba(162,114,255,.8)" : "rgba(255,210,120,.7)" }; });
  },
  wizard(r) { // a Wizard (or Shapeshifter-as-Wizard) is played: quick arcane burst
    const c = centre(r);
    emit(reduce ? 6 : 36, () => { const a = rand(0, 6.28), s = rand(2, 6); return { x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(20, 40), size: 2, line: 3, color: "#a8ccff" }; });
  },
};

const INFO = {
  dragon: ["Dragon!", "Beats every Wizard — unless the Fairy is here", "#ff7a2a"],
  fairy: ["Fairy", "The only card that beats the Dragon", "#ffc4f2"],
  bomb: ["Bomb", "Nobody will win this trick", "#ffb03a"],
  juggler: ["Juggler", "7½ · everyone passes a card left after this trick", "#eeb52b"],
  cloud: ["Cloud", "9¾ · the trick's winner must change their bid", "#b8c8ff"],
  witch: ["Witch", "Will swap a card with the trick", "#7dff9a"],
  vampire: ["Vampire", "Copies the trump card", "#ff4d5e"],
  shapeshifter: ["Shapeshifter", "Wizard or Jester — its player decides", "#c9a7ff"],
  werewolf: ["Werewolf!", "Swapped for the trump card — new trump called", "#d8e4ff"],
};

// Public: the special card `kind` was played (rect = its card on the table, if visible).
export function playFx(kind, id, rect, who, extra = "") {
  ensure();
  const info = INFO[kind];
  if (info) banner(id, info[0], [who, extra || info[1]].filter(Boolean).join(" · "), info[2], rect);
  (EFFECTS[kind] || (() => {}))(rect);
}

// Public: an effect with no banner (boom, pass, cloudBid, swap, wizard).
export function burst(kind, rect) { ensure(); (EFFECTS[kind] || (() => {}))(rect); }

// Public: game-start welcome on every screen. Tap to skip.
export function welcome() {
  ensure();
  const words = "Welcome to Dhruv's Vibe Coded Wizard".split(" ");
  const d = document.createElement("div");
  d.className = "fx-welcome";
  d.innerHTML = `<div class="wl-fan">${["blue-wizard", "sp-dragon", "red-wizard", "sp-fairy", "green-wizard", "sp-witch", "yellow-wizard"]
      .map((id, i) => `<img src="cards/${id}@2x.webp" alt="" style="--i:${i - 3}">`).join("")}</div>
    <h1>${words.map((w, i) => `<span style="animation-delay:${0.5 + i * 0.16}s">${w}</span>`).join(" ")}</h1>
    <p>Manifest his greatness and you may win</p><small>Tap to start</small>`;
  document.body.append(d);
  const close = () => { d.classList.add("out"); setTimeout(() => d.remove(), 500); };
  d.addEventListener("pointerdown", close);
  setTimeout(close, reduce ? 3000 : 5200);
  if (!reduce) {
    setTimeout(() => emit(160, i => { const a = rand(0, 6.28), sp = rand(2, 9);
      return { x: W / 2, y: H * 0.42, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.05, life: rand(60, 120), size: rand(4, 10), star: true,
        color: ["#ffe9a8", "#e3c375", "#ffffff", "#b7d2ff", "#ffc4f2"][i % 5] }; }), 450);
    setTimeout(() => emit(70, () => ({ x: rand(0, W), y: -10, vx: rand(-.6, .6), vy: rand(1.5, 3.5), g: 0.01, drag: 1, life: rand(110, 170), size: rand(3, 7), star: true, color: "#e3c375" })), 1400);
  }
}
