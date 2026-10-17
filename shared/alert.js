// "Your turn" alerts for every game. Android buzzes; iPhones can't vibrate from a web page, so there's a short
// chime too (on by default, switchable per device). iOS only lets a page make sound after the person has tapped
// it once, so the audio is unlocked on the first tap anywhere.
const KEY = "g4f-sound";
let ac = null;
let on = (() => { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } })();

function unlock() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
  } catch { ac = null; }
}
addEventListener("pointerdown", unlock, { capture: true, passive: true });
addEventListener("touchend", unlock, { capture: true, passive: true });

function tone(freqs, dur = 0.12, vol = 0.16) {
  if (!on || !ac || document.visibilityState !== "visible") return;
  try {
    if (ac.state === "suspended") ac.resume();
    const t0 = ac.currentTime + 0.01;
    freqs.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = t0 + i * dur;
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.9);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur * 2);
    });
  } catch { /* no sound on this device */ }
}

export const alerts = {
  yourTurn() { navigator.vibrate?.([18, 40, 18]); tone([660, 880]); },
  hurry() { navigator.vibrate?.(60); tone([520], 0.08, 0.1); },
  get on() { return on; },
  toggle() {
    on = !on;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* storage off */ }
    if (on) { unlock(); tone([880], 0.08); }
    return on;
  },
};

// The switch, for the lobby and the Rules sheet.
export const soundRow = () => `<div class="row sndrow" style="justify-content:space-between;align-items:center;gap:10px">
  <span>Turn sound on this phone</span>
  <button class="btn ghost small" data-act="sound" aria-pressed="${on}">${on ? "🔔 On" : "🔕 Off"}</button></div>`;

// Links opened inside Instagram / Facebook / TikTok etc. run in that app's own browser, which forgets the game when
// it closes. Nudge people to open the game in their real browser so they can get back in later.
const UA = navigator.userAgent;
export const inApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Snapchat|musical_ly|TikTok|Twitter|LinkedInApp|Pinterest/.test(UA) || (/Android/.test(UA) && /; wv\)/.test(UA));
export const inAppHint = () => inApp
  ? `<div class="iabhint" role="note">Opened inside another app? Tap <b>⋯</b> and choose <b>Open in ${/iPhone|iPad|iPod/.test(UA) ? "Safari" : "Chrome"}</b> so you can always get back into this game.</div>`
  : "";
