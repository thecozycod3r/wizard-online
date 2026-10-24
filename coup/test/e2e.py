"""Coup end-to-end on emulated phones through the real UI (driver: shared/test/kit_e2e.py).

    python3 coup/test/e2e.py <base_url> <players> [max_minutes]
"""
from pathlib import Path

HOOK, MAX = "__coup", 10
# What a player would do now, from what their own screen knows. Shared tests read this too.
PLAN = """() => {
  const c = window.__coup, v = c.V(); if (!v || !c.S.me || !v.waiting.includes(c.S.me)) return null;
  const me = v.players[v.me], t = v.T, R = Math.random(), live = v.mine.map((x, i) => [x, i]).filter(([x]) => !x.up);
  const sides = new Set(v.players.filter(p => p.alive).map(p => p.faction));
  const foes = v.players.filter(p => p.alive && p.id !== me.id && !(v.settings.factions === 'on' && sides.size > 1 && p.faction === me.faction));
  const has = r => live.some(([x]) => x.r === r);
  const go = (type, target) => target ? { a: { type, target }, taps: [`[data-act="do"][data-a="${type}"]`, `[data-act="tgt"][data-t="${target}"]`] } : { a: { type }, taps: [`[data-act="do"][data-a="${type}"]`] };
  if (v.phase === 'action') {
    const f = foes.sort((a, b) => b.coins - a.coins)[0];
    if (me.coins >= 7 && f) return go('coup', f.id);
    if (me.coins >= 3 && f && (has('assassin') || R < .15)) return go('assassinate', f.id);
    if (f && f.coins >= 2 && (has('captain') || R < .1)) return go('steal', f.id);
    if (has('duke') || R < .25) return go('tax');
    if (R < .35) return go('exchange');
    return go(R < .7 ? 'aid' : 'income');
  }
  if (v.phase === 'respond' || v.phase === 'blockRespond') {
    const can = v.can || { blocks: [] }, real = can.blocks.find(r => has(r));
    if (real) return { a: { type: 'block', as: real }, taps: [`[data-act="block"][data-as="${real}"]`] };
    if (can.challenge && R < .12) return { a: { type: 'challenge' }, taps: ['[data-act="challenge"]'] };
    return { a: { type: 'pass' }, taps: ['[data-act="pass"]'] };
  }
  if (v.phase === 'lose') { const i = live[0][1]; return { a: { type: 'lose', card: i }, taps: [`[data-act="lose"][data-i="${i}"]`] }; }
  if (v.phase === 'examineShow') { const i = live[0][1]; return { a: { type: 'show', card: i }, taps: [`[data-act="show"][data-i="${i}"]`] }; }
  if (v.phase === 'examineDecide') return { a: { type: 'decide', force: false }, taps: ['[data-act="decide"][data-f="0"]'] };
  if (v.phase === 'exchange') { const k = live.map((_, i) => i); return { a: { type: 'keep', keep: k }, taps: [...k.map(i => `[data-act="keepi"][data-i="${i}"]`), '[data-act="keep"]'] }; }
  return null;
}"""

exec(open(Path(__file__).resolve().parents[2] / "shared/test/kit_e2e.py").read())
