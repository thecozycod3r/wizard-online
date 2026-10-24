"""6 Nimmt! end-to-end on emulated phones through the real UI (driver: shared/test/kit_e2e.py).

    python3 nimmt/test/e2e.py <base_url> <players> [max_minutes]
"""
from pathlib import Path

HOOK, MAX = "__nim", 10
# What a player would do now, from what their own screen knows. Shared tests read this too.
PLAN = """() => {
  const c = window.__nim, v = c.V(); if (!v || !c.S.me || !v.waiting.includes(c.S.me)) return null;
  if (v.phase === 'row') {
    const b = v.rows.map(r => r.reduce((s, x) => s + c.E.bulls(x), 0)), i = b.indexOf(Math.min(...b));
    return { a: { type: 'row', row: i }, taps: [`.nrow[data-row="${i}"]`] };
  }
  if (v.phase !== 'pick' || v.myPick != null) return null;
  const card = v.hand[Math.floor(Math.random() * v.hand.length)];
  return { a: { type: 'pick', card }, taps: [`.hand [data-card="${card}"]`] };
}"""

exec(open(Path(__file__).resolve().parents[2] / "shared/test/kit_e2e.py").read())
