"""Kings Cup end-to-end on emulated phones through the real UI (driver: shared/test/kit_e2e.py).

    python3 kingscup/test/e2e.py <base_url> <players> [max_minutes]
"""
from pathlib import Path

HOOK, MAX = "__kc", 12
# What a player would do now, from what their own screen knows. Shared tests read this too.
PLAN = """() => {
  const c = window.__kc, v = c.V(); if (!v || !c.S.me || !v.waiting.includes(c.S.me)) return null;
  if (v.phase === 'draw') return { a: { type: 'draw' }, taps: ['[data-act="draw"]'] };
  if (v.rule?.target) { const o = v.players.filter(p => p.id !== c.S.me), t = o[Math.floor(Math.random() * o.length)].id; return { a: { type: 'done', target: t }, taps: [`[data-act="done"][data-target="${t}"]`] }; }
  return { a: { type: 'done' }, taps: ['[data-act="done"]'] };
}"""

exec(open(Path(__file__).resolve().parents[2] / "shared/test/kit_e2e.py").read())
