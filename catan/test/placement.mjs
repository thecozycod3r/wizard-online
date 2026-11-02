import assert from 'node:assert/strict';
import * as E from '../engine.js';

const centre = k => { const [q, r] = E.unkey(k); return [Math.sqrt(3) * (q + r / 2), 1.5 * r]; };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
let boards = 0;
for (const n of [3, 4, 5, 6]) for (const sea of [false, true]) for (const raiders of [false, true]) {
  const G = E.newGame(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), { seed: 42, sea, raiders });
  const land = Object.keys(G.tiles).filter(k => G.tiles[k].land);
  const vertices = new Set(land.flatMap(E.cornersOf));
  if (n <= 4 && !sea) assert.equal(vertices.size, 54);
  for (const k of land) {
    const [cx, cz] = centre(k);
    for (const v of E.cornersOf(k)) {
      const [x, z] = E.vXY(v);
      near(Math.hypot(x - cx, z - cz), 1);
      // The intersection must be an actual pointy-top hex vertex.
      near(Math.cos(6 * Math.atan2(z - cz, x - cx)), -1);
      for (const h of E.vHexes(v)) {
        const [hx, hz] = centre(h);
        near(Math.hypot(x - hx, z - hz), 1);
      }
    }
    for (const other of E.nbrs(k)) {
      const ends = E.sideEnds(k, other);
      assert.equal(ends.length, 2);
      assert.ok(ends.every(v => E.cornersOf(k).includes(v) && E.cornersOf(other).includes(v)));
      const [a, b] = ends.map(E.vXY), [ox, oz] = centre(other);
      near(Math.hypot(a[0] - b[0], a[1] - b[1]), 1);
      near((a[0] + b[0]) / 2, (cx + ox) / 2);
      near((a[1] + b[1]) / 2, (cz + oz) / 2);
    }
  }
  while (G.phase === 'setup') {
    const pid = E.cur(G), before = structuredClone(G);
    const spot = E.legal(G, pid, 'setup')[0];
    assert.throws(() => E.act(G, pid, { type: 'place', ...spot, v: '0,0' }));
    assert.deepEqual(G, before, 'tile-centre placement must be refused without changing state');
    E.act(G, pid, { type: 'place', ...spot });
    for (const b of G.builds) {
      assert.ok(vertices.has(b.v));
      assert.ok(!E.vNbrs(b.v).some(v => G.builds.some(other => other.v === v)));
    }
    for (const t of G.trails) assert.ok(E.sideEnds(t.a, t.b).some(v => G.builds.some(b => b.pid === t.pid && b.v === v)));
  }
  assert.equal(G.builds.length, n * 2);
  boards++;
}
console.log(`Placement passed: ${boards} boards, all player counts and module combinations.`);
