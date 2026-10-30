"""Bluff end-to-end on emulated phones through the real UI (driver: shared/test/kit_e2e.py).

    python3 bluff/test/e2e.py <base_url> <players> [max_minutes]
"""
from pathlib import Path

HOOK, MAX = "__bluff", 12
# What a player would do now, from what their own screen knows: mostly honest, a bluff now and then, calls sometimes.
PLAN = """() => {
  const c = window.__bluff, v = c.V(); if (!v || !c.S.me || !v.waiting.includes(c.S.me)) return null;
  const r = x => parseInt(x), h = v.hand, sel = cs => cs.map(x => `[data-act="card"][data-card="${x}"]`);
  if (v.rank === null) {
    const cnt = {}; for (const x of h) cnt[r(x)] = (cnt[r(x)] || 0) + 1;
    const rank = +Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0], cards = h.filter(x => r(x) === rank).slice(0, 4);
    return { a: { type: 'play', rank, cards }, taps: [`[data-act="rank"][data-r="${rank}"]`, ...sel(cards), '[data-act="play"]'] };
  }
  if (v.canCall && Math.random() < .25) return { a: { type: 'call' }, taps: ['[data-act="call"]'] };
  let cards = h.filter(x => r(x) === v.rank).slice(0, 4);
  if (!cards.length && Math.random() < .4) cards = [h[0]];
  if (!cards.length) return { a: { type: 'pass' }, taps: ['[data-act="pass"]'] };
  return { a: { type: 'play', cards }, taps: [...sel(cards), '[data-act="play"]'] };
}"""

exec(open(Path(__file__).resolve().parents[2] / "shared/test/kit_e2e.py").read())
