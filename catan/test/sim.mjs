import assert from 'node:assert/strict';
import * as E from '../engine.js';
const seeds=+(process.argv[2]||2);let games=0,steps=0;
for(let n=3;n<=6;n++)for(const sea of [false,true])for(const raiders of [false,true])for(let seed=0;seed<seeds;seed++){
 const G=E.newGame(Array.from({length:n},(_,i)=>({id:'p'+i,name:'Player '+i})),{sea,raiders,seed:901+n+seed*977});
 for(let step=0;G.phase!=='gameOver';step++){
  assert.ok(step<15000,`Game stalled: ${JSON.stringify({n,sea,raiders,seed})}`);
  const p=E.waitingOn(G)[0],a=E.botAction(G,p);try{E.act(G,p,a);}catch(e){e.message+=` ${JSON.stringify({n,sea,raiders,seed,step,p,a})}`;throw e;}steps++;
  for(const r of E.GOODS){const total=E.RES.includes(r)?n>4?24:19:raiders?n>4?18:12:0;assert.equal(G.bank[r]+G.players.reduce((s,p)=>s+G.hands[p.id][r],0),total);assert.ok(G.bank[r]>=0);for(const p of G.players)assert.ok(G.hands[p.id][r]>=0&&Number.isInteger(G.hands[p.id][r]));}
  const occupied=new Set(G.builds.map(b=>b.v));assert.equal(occupied.size,G.builds.length);for(const b of G.builds)assert.ok(!E.vNbrs(b.v).some(v=>occupied.has(v)));
  assert.equal(new Set([...G.trails,...G.ships].map(r=>r.k)).size,G.trails.length+G.ships.length);
  for(const p of G.players)for(const kind of ['road','ship','settlement','city','wall','knight'])assert.ok(E.supply(G,p.id,kind)>=0);
 }
 assert.equal(G.result.winners.length,1);assert.ok(E.points(G,G.result.winners[0])>=G.target);games++;
}
console.log(`Completed ${games} full games (${steps} legal actions), all 3–6-player module combinations; inventories and placement invariants passed.`);
