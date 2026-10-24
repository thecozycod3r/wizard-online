"""Spyfall end-to-end on emulated phones through the real UI (driver: shared/test/kit_e2e.py).

    python3 spyfall/test/e2e.py <base_url> <players> [max_minutes]
"""
from pathlib import Path

HOOK, MAX = "__spy", 10
# What a player would do now, from what their own screen knows. Shared tests read this too.
PLAN = """() => {
  const c = window.__spy, v = c.V(); if (!v || !c.S.me) return null;
  const me = c.S.me, R = Math.random(), others = v.players.filter(p => p.id !== me);
  if (v.phase === 'roundOver') return R < .3 ? { a: { type: 'next' }, taps: ['[data-act="next"]'] } : null;
  if (v.phase === 'vote' && v.waiting.includes(me)) { const y = R < .6; return { a: { type: 'vote', yes: y }, taps: [`[data-act="vote"][data-y="${y ? 1 : 0}"]`] }; }
  if (v.phase === 'final' && v.waiting[0] === me) { const t = others[Math.floor(R * others.length)].id; return { a: { type: 'accuse', target: t }, taps: [`[data-act="accuse"][data-t="${t}"]`] }; }
  if (v.phase !== 'play') return null;
  if (v.you?.spy && R < .04) { const LOCS = [...document.querySelectorAll('.locs .lc')].map(b => b.dataset.l); const l = LOCS[Math.floor(Math.random() * LOCS.length)];
    return { a: { type: 'guess', loc: l }, taps: ['[data-act="guess-open"]', `[data-act="guesspick"][data-l="${l}"]`, '[data-act="guessgo"]'] }; }
  if (!v.stopped.includes(me) && R < .06) { const t = others[Math.floor(Math.random() * others.length)].id; return { a: { type: 'accuse', target: t }, taps: ['[data-act="accuse-open"]', `[data-act="accuse"][data-t="${t}"]`] }; }
  if (v.asker === me && R < .5) { const ok = others.filter(p => p.id !== v.prevAsker); const t = ok[Math.floor(Math.random() * ok.length)].id; return { a: { type: 'ask', target: t }, taps: [`[data-act="ask"][data-t="${t}"]`] }; }
  return null;
}"""

exec(open(Path(__file__).resolve().parents[2] / "shared/test/kit_e2e.py").read())
