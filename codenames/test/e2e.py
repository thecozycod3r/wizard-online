"""Codenames end-to-end on emulated phones through the real UI (driver: shared/test/kit_e2e.py).

    python3 codenames/test/e2e.py <base_url> <players> [max_minutes]
"""
from pathlib import Path

HOOK, MAX = "__cn", 12
# What a player would do now, from what their own screen knows. Shared tests read this too.
# (A spymaster "types" a made-up clue straight into the box before tapping Give clue.)
PLAN = """() => {
  const c = window.__cn, v = c.V(); if (!v || !c.S.me) return null;
  const me = c.S.me, R = Math.random(), mine = v.players.find(p => p.id === me);
  if (v.phase === 'setup') return v.ready && v.me === 0 ? { a: { type: 'begin' }, taps: ['[data-act="begin"]'] } : null;
  if (!v.waiting.includes(me)) return null;
  if (v.phase === 'clue') {
    const w = 'zq' + Math.random().toString(36).slice(2, 6), n = 1 + Math.floor(R * 3), box = document.getElementById('clue');
    if (box) { box.value = w; box.dispatchEvent(new Event('input', { bubbles: true })); }
    return { a: { type: 'clue', word: w, n }, taps: [`[data-act="num"][data-n="${n}"]`, '[data-act="giveclue"]'] };
  }
  if (v.phase === 'guess') {
    if (v.guesses && R < .25) return { a: { type: 'end' }, taps: ['[data-act="end"]'] };
    const free = v.words.map((_, i) => i).filter(i => !v.open[i]), i = free[Math.floor(Math.random() * free.length)];
    return { a: { type: 'guess', i }, taps: [`[data-act="card"][data-i="${i}"]`, '[data-act="guess"]'] };
  }
  return null;
}"""

exec(open(Path(__file__).resolve().parents[2] / "shared/test/kit_e2e.py").read())
