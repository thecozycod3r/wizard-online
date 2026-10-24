"""Skull King end-to-end on emulated phones through the real UI (driver: shared/test/kit_e2e.py).

    python3 skullking/test/e2e.py <base_url> <players> [max_minutes]
"""
from pathlib import Path

HOOK, MAX = "__sk", 8
# What a player would do now, from what their own screen knows. Shared tests read this too.
PLAN = """() => {
  const c = window.__sk, v = c.V(); if (!v || !c.S.me || !v.waiting.includes(c.S.me)) return null;
  if (v.phase === 'bid') { const n = Math.floor(Math.random() * Math.min(3, v.round + 1)); return { a: { type: 'bid', n }, taps: [`.bids [data-n="${n}"]`] }; }
  if (v.phase !== 'play' || !v.legal.length) return null;
  const id = v.legal[Math.floor(Math.random() * v.legal.length)];
  if (id === 'tig') return { a: { type: 'play', card: id, as: 'pirate' }, taps: [`.hand [data-id="tig"]`, `[data-act="tig"][data-as="pirate"]`] };
  return { a: { type: 'play', card: id }, taps: [`.hand [data-id="${id}"]`] };
}"""

exec(open(Path(__file__).resolve().parents[2] / "shared/test/kit_e2e.py").read())
