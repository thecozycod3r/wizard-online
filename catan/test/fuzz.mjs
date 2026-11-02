import assert from 'node:assert/strict';
import * as E from '../engine.js';
const N=+(process.argv[2]||8);let refused=0,applied=0;
for(let i=0;i<N;i++){
 const n=3+i%4,G=E.newGame(Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i})),{seed:370+i,sea:i%2===0,raiders:i%3!==0});
 for(let step=0;step<10000&&G.phase!=='gameOver';step++){
  const p=E.waitingOn(G)[0];
  const candidates=[null,{type:'build',kind:'city',v:'0,0'},{type:'choose',value:'invalid'},{type:'bank',give:'wood',get:'wood'},{type:'offer',give:{wood:-1},want:{ore:1}},{type:'improve',track:'__proto__'},{type:'moveShip',id:-1},{type:'play',id:-1},{type:'place',a:0,b:null,v:'broken'},{type:'roll',dice:[6,6]},{type:'end'}];
  const a=candidates[(step*17+i)%candidates.length],before=structuredClone(G);
  try{E.act(G,step%7===0?'unseated':p,a);applied++;}catch{refused++;assert.deepEqual(G,before,'Refused action changed state');}
  if(G.phase!=='gameOver'){const who=E.waitingOn(G)[0];E.act(G,who,E.botAction(G,who));applied++;}
  for(const r of E.GOODS){const total=E.RES.includes(r)?n>4?24:19:G.raiders?n>4?18:12:0;assert.equal(G.bank[r]+G.players.reduce((s,p)=>s+G.hands[p.id][r],0),total);}
 }
 assert.equal(G.phase,'gameOver');
}
console.log({games:N,refused,applied});
