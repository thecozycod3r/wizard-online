"""Ride the Bus end-to-end on emulated phones through the real UI (driver: shared/test/kit_e2e.py).

    python3 ridebus/test/e2e.py <base_url> <players> [max_minutes]
"""
from pathlib import Path

HOOK, MAX = "__rb", 10
# What a player would do now, from what their own screen knows. Shared tests read this too.
PLAN = """() => {
  const c = window.__rb, v = c.V(); if (!v || !c.S.me || !v.waiting.includes(c.S.me)) return null;
  const o = v.players.filter(p => p.id !== c.S.me), t = o[Math.floor(Math.random() * o.length)].id, Q = c.E.QUESTIONS;
  if (v.phase === 'guess') { const g = Q[v.q].opts[Math.floor(Math.random() * Q[v.q].opts.length)]; return { a: { type: 'guess', g }, taps: [`[data-act="guess"][data-g="${g}"]`] }; }
  if (v.phase === 'give') return { a: { type: 'give', target: t }, taps: [`[data-act="give"][data-target="${t}"]`] };
  if (v.phase === 'match') { const top = v.pyramid[v.flipped - 1], card = v.players[v.me].hand.find(x => parseInt(x) === parseInt(top));
    if (!card || Math.random() < .2) return { a: { type: 'pass' }, taps: ['[data-act="pass"]'] };
    return { a: { type: 'match', card, target: t }, taps: [`[data-act="mcard"][data-card="${card}"]`, `[data-act="match"][data-target="${t}"]`] }; }
  if (v.phase === 'bus') { const g = Q[v.bus.step].opts[Math.floor(Math.random() * Q[v.bus.step].opts.length)]; return { a: { type: 'ride', g }, taps: [`[data-act="ride"][data-g="${g}"]`] }; }
  return null;
}"""

exec(open(Path(__file__).resolve().parents[2] / "shared/test/kit_e2e.py").read())
