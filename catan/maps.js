import { key, unkey, nbrs, ring, cornersOf, vXY, sideEnds, linkKey } from './geometry.js';

export const TERRAIN = { pine: 'wood', quarry: 'brick', flax: 'wool', barley: 'wheat', copper: 'ore', ruins: null, gold: 'gold' };
const terrain = { w: 'pine', b: 'quarry', s: 'flax', g: 'barley', o: 'copper', d: 'ruins', G: 'gold' };
const baseMarks = [2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12];
const largeMarks = [2,2,3,3,3,4,4,4,5,5,5,6,6,6,8,8,8,9,9,9,10,10,10,11,11,11,12,12];
export function makeBoard(G, shuffle) {
  G.tiles = {}; G.ports = [];
  const put = (q,r,t,mark=0,island=0) => G.tiles[key(q,r)] = {q,r,land:t!=='.',terrain:terrain[t],mark,island,isle:island>0,sea:'open',rich:99};
  if (G.sea && G.players.length <= 4) {
    // Heading for New Shores, fixed land and number layouts (2025 rulebook pp. 4–5).
    const rows = G.players.length===3 ? [
      [-4,1,'b12 G5 . .'],[-3,0,'. . . s4 o9'],[-2,-1,'. g4 s6 . g3 .'],
      [-1,-2,'. s2 o5 w10 . G4'],[0,-2,'b8 s10 s9 w8 .'],[1,-2,'g11 o3 b11 . o8'],[2,-2,'g6 w5 . b10']
    ] : [
      [-4,1,'o8 s11 . G4'],[-3,0,'. . . . b5 o2'],[-2,-1,'. s5 w6 o4 . w9 .'],
      [-1,-2,'. g12 b11 g3 s9 . G10'],[0,-2,'b6 w10 d g11 w5 . .'],[1,-2,'o3 s4 b9 s8 . b3'],[2,-2,'g8 s2 o10 . g6']
    ];
    for(const [r,q0,row] of rows) row.split(' ').forEach((s,i)=>put(q0+i,r,s[0],+s.slice(1)||0));
    // Label connected landmasses, using the central landmass as home.
    labelIslands(G);
    G.robberStart = Object.keys(G.tiles).find(k=>G.tiles[k].terrain==='ruins') || Object.keys(G.tiles).find(k=>G.tiles[k].mark===12);
    G.pirateStart = null;
  } else {
    const large=G.players.length>4;
    const land=[];
    if(large) for(let r=-3;r<=3;r++){const len=6-Math.abs(r), q0=-Math.floor((len+r)/2); for(let i=0;i<len;i++)land.push([q0+i,r]);}
    else for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++)if(ring(q,r)<=2)land.push([q,r]);
    const bag=shuffle(Object.entries(large?{w:6,b:5,s:6,g:6,o:5,d:2}:{w:4,b:3,s:4,g:4,o:3,d:1}).flatMap(([t,n])=>Array(n).fill(t)));
    land.forEach(([q,r],i)=>put(q,r,bag[i]));
    const productive=land.map(([q,r])=>key(q,r)).filter(k=>G.tiles[k].terrain!=='ruins');
    let marks;
    for(let attempt=0;attempt<10000;attempt++){
      marks=shuffle([...(large?largeMarks:baseMarks)]);
      productive.forEach((k,i)=>G.tiles[k].mark=marks[i]);
      if(productive.every(k=>![6,8].includes(G.tiles[k].mark)||nbrs(k).every(n=>![6,8].includes(G.tiles[n]?.mark))))break;
      if(attempt===9999)throw new Error('Could not create a legal number layout.');
    }
    G.robberStart=land.map(([q,r])=>key(q,r)).find(k=>G.tiles[k].terrain==='ruins');
    if(G.sea){
      // 5–6-player scenario: four small islands surrounding the 30-hex home island.
      [[-2,-3,'G',9,1],[-3,-2,'o',11,1],[-4,-1,'s',8,1],[-5,1,'b',4,2],[-5,2,'w',2,2],[-5,3,'G',5,2],[4,-3,'o',6,3],[4,-1,'b',12,3],[3,1,'g',3,4],[1,3,'G',10,4]].forEach(([q,r,t,m,i])=>put(q,r,t,m,i));
      // Inner frame rows from the 5–6-player scenario diagram (56 hexes).
      for(const [r,q0,n] of [[-3,-2,7],[-2,-3,8],[-1,-4,9],[0,-4,8],[1,-5,9],[2,-5,8],[3,-5,7]])
        for(let q=q0;q<q0+n;q++)if(!G.tiles[key(q,r)])put(q,r,'.');
    } else {
      for(const [q,r] of land)for(const k of nbrs(key(q,r)))if(!G.tiles[k]){const [a,b]=unkey(k);put(a,b,'.');}
    }
    G.pirateStart=null;
  }
  addPorts(G,shuffle);
  G.R=G.players.length>4?4:G.sea?3:2;
}
function labelIslands(G){
  const seen=new Set(), groups=[];
  for(const k of Object.keys(G.tiles))if(G.tiles[k].land&&!seen.has(k)){
    const todo=[k], group=[];seen.add(k);
    while(todo.length){const x=todo.pop();group.push(x);for(const y of nbrs(x))if(G.tiles[y]?.land&&!seen.has(y)){seen.add(y);todo.push(y);}}
    groups.push(group);
  }
  groups.sort((a,b)=>b.length-a.length);
  groups.forEach((ks,i)=>ks.forEach(k=>{G.tiles[k].island=i;G.tiles[k].isle=i>0;}));
}
function addPorts(G,shuffle){
  if(G.sea){
    const n=G.players.length;
    const slots=n===3?[
      ['0,-2','-1,-2','wheat'],['1,-2','2,-2','any'],['-2,0','-2,-1','ore'],['-2,0','-3,1','any'],
      ['-2,2','-3,2','brick'],['-1,2','-2,3','wood'],['-1,2','0,2','any'],['1,0','2,-1','wool']
    ]:n===4?[
      ['0,-2','-1,-2','any'],['2,-2','2,-3','ore'],['2,-1','3,-2','any'],['2,0','2,1','wheat'],
      ['0,2','1,2','any'],['-1,2','-1,3','wood'],['-2,2','-3,2','any'],['-2,0','-3,1','brick'],['-2,0','-2,-1','wool']
    ]:[
      ['1,-3','2,-4'],['-1,-2','-2,-2'],['2,-2','3,-3'],['-2,-1','-3,-1'],['2,-1','3,-1'],
      ['-3,0','-4,1'],['2,0','2,1'],['0,2','1,2'],['-3,3','-4,3'],['-2,3','-3,4'],['-1,3','-1,4']
    ];
    const types=shuffle(['wood','brick','wool','wheat','ore','wool',...Array(5).fill('any')]);
    G.ports=slots.map(([a,b,res],i)=>({a,b,k:linkKey(a,b),ends:sideEnds(a,b),res:res||types[i]}));
    return;
  }
  const coast=[];
  for(const a in G.tiles)if(G.tiles[a].land&&G.tiles[a].island===0)for(const b of nbrs(a))if(!G.tiles[b]?.land){
    const ends=sideEnds(a,b), [x,z]=ends.map(vXY).reduce((s,p)=>[s[0]+p[0]/2,s[1]+p[1]/2],[0,0]);
    coast.push({a,b,k:linkKey(a,b),ends,angle:Math.atan2(z,x)});
  }
  coast.sort((a,b)=>a.angle-b.angle);
  const count=G.players.length>4?11:G.sea&&G.players.length===3?8:9;
  const types=shuffle(['wood','brick','wool','wheat','ore',...(count===11?['wool']:[]),...Array(count-(count===11?6:5)).fill('any')]);
  const used=new Set();
  for(let i=0;i<count;i++){
    const start=Math.floor(i*coast.length/count);
    const edge=Array.from({length:coast.length},(_,j)=>coast[(start+j)%coast.length]).find(e=>e.ends.every(v=>!used.has(v)));
    if(!edge)throw new Error('No space for a port.');edge.ends.forEach(v=>used.add(v));G.ports.push({...edge,res:types[i]});
  }
}
