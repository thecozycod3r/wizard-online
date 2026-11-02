import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine.js';
const players=n=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'Player '+i}));
function game({n=4,sea=true,raiders=true,...s}={}){const G=E.newGame(players(n),{seed:41,sea,raiders,...s});G.phase='act';G.returnPhase='act';G.turn=0;G.turnNo=10;return G;}
function grant(G,p,c){for(const[r,n]of Object.entries(c)){assert.ok(G.bank[r]>=n);G.bank[r]-=n;G.hands[p][r]+=n;}}
function building(G,p,v,kind='settlement',extra={}){const b={pid:p,v,kind,wall:false,...extra};G.builds.push(b);return b;}
function knight(G,p,v,level=1,active=true){const k={id:++G.n,pid:p,v,level,active,activated:0,promoted:-1};G.knights.push(k);return k;}
function road(G,p,a,b,kind='road'){const r={id:++G.n,pid:p,a,b,k:E.linkKey(a,b),kind,built:0};(kind==='road'?G.trails:G.ships).push(r);return r;}
function addCard(G,p,card){const id=++G.n;if(G.raiders){const d=G.progressDecks[E.PROGRESS[card].track],i=d.indexOf(card);assert.notEqual(i,-1);d.splice(i,1);G.progress[p].push({id,card});}else{const i=G.devDeck.indexOf(card);G.devDeck.splice(i,1);G.dev[p].push({id,card,at:0});}return id;}
const play=(G,card)=>E.act(G,'p0',{type:'play',id:addCard(G,'p0',card)});
function choose(G,value){E.act(G,E.waitingOn(G)[0],{type:'choose',value:String(value)});}
function finish(G){let n=0;while(G.phase==='resolve'&&n++<200){const p=E.waitingOn(G)[0];E.act(G,p,E.smartAction(G,p));}assert.ok(n<200);}
function random(seed){return()=>{let t=seed=(seed+0x6d2b79f5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function forceRoll(G,total,event='science',red=null){let found=false;for(let seed=0;seed<200000;seed++){const r=random(seed),a=1+Math.floor(r()*6),b=1+Math.floor(r()*6),ev=['barbarian','barbarian','barbarian','science','trade','politics'][Math.floor(r()*6)];if(a+b===total&&(!G.raiders||ev===event)&&(!red||a===red)){G.rng=seed;found=true;break;}}assert.ok(found);G.phase='roll';G.returnPhase='roll';E.act(G,E.cur(G),{type:'roll'});}
function isolatedTile(G,terrain='pine',mark=6){for(const t of Object.values(G.tiles))t.mark=0;const k=Object.keys(G.tiles).find(k=>G.tiles[k].land&&G.tiles[k].island===0);Object.assign(G.tiles[k],{terrain,mark});G.robber=null;return k;}
function atomic(G,p,a){const before=structuredClone(G);assert.throws(()=>E.act(G,p,a));assert.deepEqual(G,before);}
function invariant(G){for(const r of E.GOODS){const expected=E.RES.includes(r)?G.players.length>4?24:19:G.raiders?G.players.length>4?18:12:0;assert.equal(G.bank[r]+G.players.reduce((n,p)=>n+G.hands[p.id][r],0),expected,r);assert.ok(Number.isInteger(G.bank[r])&&G.bank[r]>=0);for(const p of G.players)assert.ok(Number.isInteger(G.hands[p.id][r])&&G.hands[p.id][r]>=0);}assert.equal(new Set([...G.trails,...G.ships].map(r=>r.k)).size,G.trails.length+G.ships.length);}

test('official map sizes, supplies, targets and snake setup across all modes',()=>{
 for(const n of [3,4,5,6])for(const sea of [false,true])for(const raiders of [false,true]){
  const G=E.newGame(players(n),{seed:19,sea,raiders});assert.equal(G.target,sea?raiders?16:14:raiders?13:10);
  assert.equal(G.players.reduce((n,p)=>n+Object.values(G.hands[p.id]).reduce((a,b)=>a+b,0),0),0);
  assert.equal(Object.values(G.tiles).filter(t=>t.land).length,sea?n===3?22:n===4?28:40:n>4?30:19);
  if(sea)assert.equal(Object.keys(G.tiles).length,n===3?35:n===4?42:56);
  assert.ok(!Object.values(G.tiles).some(t=>t.mark===7));
  const order=[...G.setupOrder];assert.deepEqual(order.slice(n),order.slice(0,n).reverse());
  while(G.phase==='setup'){const p=E.cur(G),a=E.smartAction(G,p);E.act(G,p,a);}
  for(const p of G.players){const own=G.builds.filter(b=>b.pid===p.id);assert.equal(own.length,2);assert.equal(own.filter(b=>b.kind==='city').length,raiders?1:0);assert.equal(E.COMMODITIES.reduce((n,r)=>n+G.hands[p.id][r],0),0);assert.equal(E.RES.reduce((n,r)=>n+G.hands[p.id][r],0),E.vHexes(own[1].v).filter(k=>E.RES.includes(E.TERRAIN[G.tiles[k]?.terrain])).length);}
  invariant(G);
 }
});
test('base and C&K city production, finite bank, no seasonal depletion',()=>{
 for(const raiders of [false,true]){const G=game({raiders}),k=isolatedTile(G);building(G,'p0',E.cornersOf(k)[0],'city');forceRoll(G,6);finish(G);assert.equal(G.hands.p0.wood,raiders?1:2);assert.equal(G.hands.p0.paper,raiders?1:0);forceRoll(G,6);finish(G);forceRoll(G,6);finish(G);assert.equal(G.hands.p0.wood,raiders?3:6);invariant(G);}
});
test('resource shortage cancels shared production, lone recipient gets remaining supply',()=>{
 const G=game({raiders:false}),k=isolatedTile(G);building(G,'p0',E.cornersOf(k)[0],'city');building(G,'p1',E.cornersOf(k)[3]);grant(G,'p2',{wood:18});forceRoll(G,6);assert.equal(G.hands.p0.wood,0);assert.equal(G.hands.p1.wood,0);G.builds.pop();forceRoll(G,6);assert.equal(G.hands.p0.wood,1);invariant(G);
});
test('gold produces choices, never commodities, and Aqueduct only on no production',()=>{
 const G=game(),k=isolatedTile(G,'gold');building(G,'p0',E.cornersOf(k)[0],'city');G.improvements.p1.science=3;forceRoll(G,6,'barbarian');assert.equal(G.queue[0].reason,'Gold fields');assert.equal(G.queue[0].count,2);atomic(G,'p0',{type:'choose',value:'paper'});choose(G,'wood');choose(G,'ore');assert.equal(G.queue[0].pid,'p1');assert.equal(G.queue[0].reason,'Aqueduct');choose(G,'wool');assert.equal(G.hands.p0.wood,1);assert.equal(G.hands.p0.ore,1);assert.equal(G.hands.p1.wool,1);invariant(G);
});
test('7 discards commodities, honors city walls, and protects robber before first attack',()=>{
 const G=game();building(G,'p0',E.cornersOf('0,0')[0],'city',{wall:true});grant(G,'p0',{wood:9});grant(G,'p1',{paper:8});forceRoll(G,7);assert.equal(G.queue[0].pid,'p1');assert.equal(G.queue[0].count,4);assert.equal(G.robber,null);finish(G);assert.equal(G.hands.p0.wood,9);assert.equal(G.hands.p1.paper,4);assert.equal(G.phase,'act');invariant(G);
});
test('robber blocks production and steals only from eligible opponents',()=>{
 const G=game({raiders:false}),k=isolatedTile(G);building(G,'p1',E.cornersOf(k)[0]);grant(G,'p1',{ore:1});G.robber=k;forceRoll(G,6);assert.equal(G.hands.p1.wood,0);G.robber=Object.keys(G.tiles).find(x=>G.tiles[x].land&&x!==k);forceRoll(G,7);choose(G,'robber:'+k);assert.equal(G.hands.p0.ore,1);assert.equal(G.hands.p1.ore,0);invariant(G);
});
test('building costs, distance rule, city upgrades and piece supply',()=>{
 const G=game(),v=E.cornersOf('0,0')[0],[a,b]=E.vSides(v)[0];road(G,'p0',a,b);grant(G,'p0',{wood:1,brick:1,wool:1,wheat:3,ore:3});E.act(G,'p0',{type:'build',kind:'settlement',v});assert.equal(E.points(G,'p0'),1);atomic(G,'p0',{type:'build',kind:'settlement',v:E.vNbrs(v)[0]});E.act(G,'p0',{type:'build',kind:'city',v});assert.equal(E.points(G,'p0'),2);assert.equal(E.supply(G,'p0','settlement'),5);invariant(G);
});
test('ports and trade improvements give correct maritime ratios',()=>{
 const G=game(),port=G.ports.find(p=>p.res==='wood');building(G,'p0',port.ends[0]);assert.equal(E.tradeRate(G,'p0','wood'),2);grant(G,'p0',{wood:2});E.act(G,'p0',{type:'bank',give:'wood',get:'coin'});assert.equal(G.hands.p0.coin,1);G.improvements.p0.trade=3;assert.equal(E.tradeRate(G,'p0','paper'),2);atomic(G,'p0',{type:'bank',give:'coin',get:'coin'});invariant(G);
});
test('ships are edge pieces; road connections alone do not join shipping routes',()=>{
 const G=game(),coast=E.legal(G,'p0','setup').find(o=>o.kind==='ship');building(G,'p0',coast.v);grant(G,'p0',{wood:2,wool:2});E.act(G,'p0',{type:'build',kind:'ship',a:coast.a,b:coast.b});const s=G.ships[0];assert.ok(s.k.includes('|'));assert.equal(E.movableShips(G,'p0').length,0);atomic(G,'p0',{type:'build',kind:'road',a:s.a,b:s.b});G.turnNo++;assert.ok(E.movableShips(G,'p0').some(x=>x.id===s.id));const dest=E.shipDestinations(G,'p0',s.id)[0];assert.ok(dest);E.act(G,'p0',{type:'moveShip',id:s.id});choose(G,dest.k);assert.equal(G.ships[0].k,dest.k);assert.equal(E.movableShips(G,'p0').length,0);invariant(G);
 const F=game(),e=E.legal(F,'p0','setup').find(o=>o.kind==='ship'&&F.tiles[o.a]?.land);road(F,'p0',e.a,e.b);assert.equal(E.legal(F,'p0','ship').length,0);
});
test('closed shipping routes and pirate-adjacent ships cannot move',()=>{
 const G=game(),o=E.legal(G,'p0','setup').find(o=>o.kind==='ship'),s=road(G,'p0',o.a,o.b,'ship');const[v,u]=E.sideEnds(o.a,o.b);building(G,'p0',v);building(G,'p0',u);assert.equal(E.openRoute(G,s),false);G.builds.pop();assert.equal(E.openRoute(G,s),true);G.pirate=G.tiles[o.a]?.land?o.b:o.a;assert.equal(E.movableShips(G,'p0').length,0);
});
test('road/ship transition needs a building for longest route; enemy knights interrupt',()=>{
 const G=game(),vs=E.cornersOf('0,0');for(let i=0;i<5;i++){const pair=E.vSides(vs[i]).find(([a,b])=>E.sideEnds(a,b).includes(vs[i+1]));road(G,'p0',...pair,i<2?'road':'ship');}
 assert.equal(E.longestRoute(G,'p0'),3);building(G,'p0',vs[2]);assert.equal(E.longestRoute(G,'p0'),5);knight(G,'p1',vs[4]);assert.equal(E.longestRoute(G,'p0'),4);
});
test('first settlement on each small island gives two additional points once',()=>{
 const G=game(),o=E.legal(G,'p0','setup')[0];const island=Object.keys(G.tiles).find(k=>G.tiles[k].island>0),v=E.cornersOf(island)[0],[a,b]=E.vSides(v).find(([a,b])=>G.tiles[a]?.land||G.tiles[b]?.land);road(G,'p0',a,b);grant(G,'p0',E.COST.settlement);E.act(G,'p0',{type:'build',kind:'settlement',v});assert.equal(G.publicVP.p0,2);assert.equal(E.points(G,'p0'),3);assert.equal(G.islands.p0.length,1);invariant(G);
});
test('knights activation timing, promotion limit, politics requirement and supply',()=>{
 const G=game(),v=E.cornersOf('0,0')[0],k=knight(G,'p0',v,1,false);grant(G,'p0',{wheat:1,ore:3,wool:3});E.act(G,'p0',{type:'activate',id:k.id});atomic(G,'p0',{type:'knightMove',id:k.id});E.act(G,'p0',{type:'promote',id:k.id});assert.equal(G.knights[0].level,2);atomic(G,'p0',{type:'promote',id:k.id});G.turnNo++;atomic(G,'p0',{type:'promote',id:k.id});G.improvements.p0.politics=3;E.act(G,'p0',{type:'promote',id:k.id});assert.equal(G.knights[0].level,3);assert.equal(G.knights[0].active,true);invariant(G);
});
test('active knights chase pirate as well as robber',()=>{
 const G=game(),water=Object.keys(G.tiles).find(k=>!G.tiles[k].land),k=knight(G,'p0',E.cornersOf(water)[0]);G.attacked=true;G.pirate=water;E.act(G,'p0',{type:'chase',id:k.id,piece:'pirate'});assert.ok(E.taskOptions(G,G.queue[0]).some(o=>o.value==='pirate:frame'));choose(G,'pirate:frame');assert.equal(G.pirate,null);assert.equal(G.knights[0].active,false);
});
test('knight displacement preserves defender status and offers legal retreat',()=>{
 const G=game(),vs=E.cornersOf('0,0'),a=knight(G,'p0',vs[0],2),b=knight(G,'p1',vs[1],1);const join=(p,v,u)=>{const pair=E.vSides(v).find(([a,b])=>E.sideEnds(a,b).includes(u));road(G,p,...pair);};join('p0',vs[0],vs[1]);join('p1',vs[1],vs[2]);E.act(G,'p0',{type:'knightMove',id:a.id});choose(G,vs[1]);assert.equal(G.queue[0].pid,'p1');choose(G,vs[2]);assert.equal(G.knights.find(k=>k.id===b.id).active,true);assert.equal(G.knights.find(k=>k.id===a.id).active,false);
});
test('barbarian success, defender award, tie rewards and deactivation',()=>{
 const G=game();building(G,'p0',E.cornersOf('0,0')[0],'city');knight(G,'p0',E.cornersOf('0,0')[2],2);G.barbarian=6;forceRoll(G,5,'barbarian');assert.equal(G.defenders.p0,1);assert.ok(G.attacked);assert.equal(G.barbarian,0);assert.ok(G.knights.every(k=>!k.active));assert.equal(G.robber,G.robberStart);
 const F=game();building(F,'p0',E.cornersOf('0,0')[0],'city');knight(F,'p0',E.cornersOf('0,0')[2]);knight(F,'p1',E.cornersOf('0,0')[4]);F.barbarian=6;forceRoll(F,5,'barbarian');assert.equal(F.queue.filter(t=>t.kind==='progressReward').length,2);finish(F);assert.equal(F.defenders.p0+F.defenders.p1,0);
});
test('barbarians exclude metropolis-only players and resolve city loss before production',()=>{
 const G=game(),k=isolatedTile(G,'barley',6);building(G,'p0',E.cornersOf(k)[0],'city',{metro:'science'});building(G,'p1',E.cornersOf(k)[3],'city',{wall:true});G.barbarian=6;forceRoll(G,6,'barbarian');assert.equal(G.queue[0].pid,'p1');assert.equal(G.hands.p1.wheat,0);choose(G,G.builds[1].v);assert.equal(G.builds[1].kind,'settlement');assert.equal(G.builds[1].wall,false);assert.equal(G.hands.p1.wheat,1);assert.equal(G.hands.p0.wheat,2);invariant(G);
});
test('metropolises transfer at level 5, not on tied level 4',()=>{
 const G=game(),vs=E.cornersOf('0,0');building(G,'p0',vs[0],'city');building(G,'p1',vs[3],'city');G.improvements.p0.science=3;grant(G,'p0',{paper:4});E.act(G,'p0',{type:'improve',track:'science'});choose(G,vs[0]);assert.equal(G.metropolis.science,'p0');G.turn=1;G.improvements.p1.science=3;grant(G,'p1',{paper:9});E.act(G,'p1',{type:'improve',track:'science'});assert.equal(G.metropolis.science,'p0');E.act(G,'p1',{type:'improve',track:'science'});choose(G,vs[3]);assert.equal(G.metropolis.science,'p1');assert.equal(G.builds[0].metro,undefined);invariant(G);
});
test('event die awards progress cards using red die and improvement level',()=>{
 const G=game();G.improvements.p0.science=1;G.improvements.p1.science=2;forceRoll(G,7,'science',3);assert.equal(G.progress.p0.length+G.publicVP.p0,0);assert.equal(G.progress.p1.length+G.publicVP.p1,1);finish(G);
});
test('progress deck composition, instant VP, limits and secret views',()=>{
 const G=game();assert.equal(Object.values(G.progressDecks).reduce((n,d)=>n+d.length,0),54);for(const d of Object.values(G.progressDecks))assert.equal(d.length,18);
 G.improvements.p0.science=1;const d=G.progressDecks.science;d.splice(d.indexOf('printing'),1);d.unshift('printing');forceRoll(G,5,'science',1);assert.equal(G.publicVP.p0,1);assert.equal(G.progress.p0.length,0);
 const id=addCard(G,'p0','alchemy');const v=E.viewFor(G,'p0');assert.equal(v.cards[0].id,id);assert.equal(E.viewFor(G,'p1').cards.length,0);assert.equal('progressDecks' in v,false);assert.equal('hands' in v,false);
});
test('development freshness, one-per-turn and pre-roll play',()=>{
 const G=game({raiders:false});grant(G,'p0',E.COST.development);E.act(G,'p0',{type:'development'});const bought=G.dev.p0[0];if(bought.card!=='vp')atomic(G,'p0',{type:'play',id:bought.id});G.phase='roll';play(G,'yearOfPlenty');choose(G,'ore');choose(G,'wheat');assert.equal(G.phase,'roll');const id=addCard(G,'p0','monopoly');atomic(G,'p0',{type:'play',id});invariant(G);
});
test('5–6 paired turns, no domestic trade by player 2, then next roller',()=>{
 for(const n of [5,6]){const G=game({n});E.act(G,'p0',{type:'end'});assert.equal(E.cur(G),'p3');assert.equal(G.phase,'act');grant(G,'p3',{wood:4});atomic(G,'p3',{type:'offer',give:{wood:1},want:{wool:1}});E.act(G,'p3',{type:'bank',give:'wood',get:'wool'});E.act(G,'p3',{type:'end'});assert.equal(E.cur(G),'p1');assert.equal(G.phase,'roll');invariant(G);}
});
test('all progress cards have executable choices and preserve inventories',()=>{
 for(const card of Object.keys(E.PROGRESS).filter(c=>!['printing','constitution'].includes(c))){
 const G=game(),vs=E.cornersOf('0,0');G.attacked=true;G.robber=Object.keys(G.tiles).find(k=>G.tiles[k].land&&k!=='0,0');building(G,'p0',vs[0],'city');building(G,'p0',vs[3]);building(G,'p1',E.cornersOf('1,0')[0],'city');G.publicVP.p1=5;
 const ownK=knight(G,'p0',vs[2],1,false),otherK=knight(G,'p1',vs[1]);const pair=E.vSides(vs[2]).find(([a,b])=>E.sideEnds(a,b).includes(vs[1]));road(G,'p0',...pair);const open=E.vSides(vs[3]).find(([a,b])=>E.sideEnds(a,b).includes(vs[4]));road(G,'p0',...open);
 for(const p of ['p0','p1'])grant(G,p,{wood:2,brick:2,wool:2,wheat:3,ore:3,paper:2,cloth:2,coin:2});addCard(G,'p1','merchant');
 G.tiles['0,0'].terrain=card==='mining'?'copper':'barley';if(card==='alchemy')G.phase='roll';
 try{play(G,card);finish(G);invariant(G);}catch(e){e.message=card+': '+e.message;throw e;}
 }
});
test('domestic trades require acceptance and are atomic when holdings change',()=>{
 const G=game();grant(G,'p0',{wood:1});grant(G,'p1',{ore:1});E.act(G,'p0',{type:'offer',give:{wood:1},want:{ore:1}});atomic(G,'p0',{type:'confirm',with:'p1'});E.act(G,'p1',{type:'accept',offer:G.offer.id});E.act(G,'p0',{type:'confirm',with:'p1'});assert.equal(G.hands.p0.ore,1);assert.equal(G.hands.p1.wood,1);invariant(G);
});

test('ship circles: two open ends at a building, all edges open without an anchor in the circle',()=>{
 const G=game(),vs=E.cornersOf('0,0');for(let i=0;i<6;i++){const pair=E.vSides(vs[i]).find(([a,b])=>E.sideEnds(a,b).includes(vs[(i+1)%6]));road(G,'p0',...pair,'ship');}
 building(G,'p0',vs[0]);assert.equal(G.ships.filter(s=>E.openRoute(G,s)).length,2);
 const out=E.vSides(vs[0]).find(([a,b])=>!G.ships.some(r=>r.k===E.linkKey(a,b))),far=E.sideEnds(...out).find(v=>v!==vs[0]);G.builds[0].v=far;const stem=road(G,'p0',...out,'ship');assert.equal(E.openRoute(G,stem),false);assert.equal(G.ships.filter(s=>E.openRoute(G,s)).length,6);
 building(G,'p0',vs[3]);assert.equal(G.ships.filter(s=>E.openRoute(G,s)).length,0);
});
test('ship relocation cannot strand a knight even when other knights remain with it',()=>{
 const G=game(),e=E.legal(G,'p0','setup').find(o=>o.kind==='ship');const[v,u]=E.sideEnds(e.a,e.b);building(G,'p0',v);road(G,'p0',e.a,e.b,'ship');knight(G,'p0',u);assert.equal(E.movableShips(G,'p0').length,0);
});
test('progress overflow interrupts production for opponents and waits until turn end for current player',()=>{
 const G=game();for(const card of ['merchant','merchant','merchantFleet','guildDues'])addCard(G,'p1',card);G.improvements.p1.trade=1;forceRoll(G,6,'trade',1);assert.equal(G.phase,'resolve');assert.equal(G.queue[0].kind,'progressDiscard');assert.equal(G.queue[0].pid,'p1');assert.equal(G.progress.p1.length,5);choose(G,G.progress.p1[0].id);assert.equal(G.progress.p1.length,4);assert.equal(G.phase,'act');
 for(const card of ['alchemy','alchemy','crane','crane','medicine'])addCard(G,'p0',card);E.act(G,'p0',{type:'end'});assert.equal(G.queue[0].pid,'p0');choose(G,G.progress.p0[0].id);assert.equal(G.phase,'roll');assert.equal(E.cur(G),'p1');
});
test('5–6 and scenario ports occupy valid, distinct coastal intersections',()=>{
 for(let n=3;n<=6;n++){const G=game({n}),seen=new Set();for(const p of G.ports){assert.ok(G.tiles[p.a]?.land);assert.ok(!G.tiles[p.b]?.land);assert.ok(E.nbrs(p.a).includes(p.b));for(const v of p.ends){assert.ok(!seen.has(v));seen.add(v);}}}
});
test('bank and other players never learn the contents of a stolen hand through views',()=>{
 const G=game();G.publicVP.p1=4;grant(G,'p1',{ore:2});play(G,'guildDues');choose(G,'p1');const own=E.viewFor(G,'p0'),other=E.viewFor(G,'p2');assert.equal(own.task.options[0].value,'ore');assert.equal(other.task.options.length,0);assert.equal(other.hand.ore,0);choose(G,'ore');choose(G,'ore');invariant(G);
});

test('pillage with an empty settlement supply reserves the city piece and forces its next upgrade',()=>{
 const G=game(),vs=[...new Set(Object.keys(G.tiles).filter(k=>G.tiles[k].land).flatMap(E.cornersOf))];for(let i=0;i<5;i++)building(G,'p0',vs[i]);const city=building(G,'p0',vs[10],'city');G.barbarian=6;forceRoll(G,5,'barbarian');choose(G,city.v);assert.ok(G.builds.find(b=>b.v===city.v).displacedCity);assert.deepEqual(E.legal(G,'p0','city'),[{v:city.v}]);grant(G,'p0',E.COST.city);E.act(G,'p0',{type:'build',kind:'city',v:city.v});assert.equal(G.builds.find(b=>b.v===city.v).displacedCity,undefined);assert.equal(E.supply(G,'p0','settlement'),0);invariant(G);
});
test('winning waits for the scoring player’s turn and includes hidden development points',()=>{
 const G=game({raiders:false,sea:false});G.publicVP.p1=9;addCard(G,'p1','vp');grant(G,'p0',{wood:4});E.act(G,'p0',{type:'bank',give:'wood',get:'ore'});assert.notEqual(G.phase,'gameOver');assert.equal(E.viewFor(G,'p0').players[1].points,9);E.act(G,'p0',{type:'end'});assert.equal(G.phase,'gameOver');assert.deepEqual(G.result.winners,['p1']);assert.equal(E.viewFor(G,'p0').players[1].points,10);
});
test('invalid legacy state never mutates into an official game',()=>{
 const G=game();G.v=3;const before=structuredClone(G);assert.throws(()=>E.act(G,'p0',{type:'end'}),/old custom rules/);assert.deepEqual(G,before);assert.equal(E.viewFor(G,'p0').legacy,true);
});

test('supplied PDF pages 6–8: progress card names and 18-card decks',()=>{
 const expected={science:[['Alchemist',2],['Crane',2],['Engineer',1],['Inventor',2],['Irrigation',2],['Medicine',2],['Mining',2],['Printer',1],['Road Building',2],['Smith',2]],trade:[['Commercial Harbor',2],['Master Merchant',2],['Merchant Fleet',2],['Merchant',6],['Resource Monopoly',4],['Commodity Monopoly',2]],politics:[['Bishop',2],['Constitution',1],['Deserter',2],['Diplomat',2],['Intrigue',2],['Saboteur',2],['Spy',3],['Warlord',2],['Wedding',2]]};
 for(const [track,cards] of Object.entries(expected)){
  assert.deepEqual(Object.values(E.PROGRESS).filter(c=>c.track===track).map(c=>[c.name,c.n]).sort(),cards.sort());
  assert.equal(game().progressDecks[track].length,18);
 }
});

test('supplied PDF page 6: all red-die thresholds for all improvement tracks',()=>{
 for(const track of Object.keys(E.TRACKS))for(let level=0;level<=5;level++)for(let red=1;red<=6;red++){
  const G=game({sea:false});G.improvements.p0[track]=level;
  // Keep public VP cards out of the first position so a draw is directly observable.
  G.progressDecks[track].sort((a,b)=>Number(['printing','constitution'].includes(a))-Number(['printing','constitution'].includes(b)));
  forceRoll(G,red+1,track,red);finish(G);
  assert.equal(G.progress.p0.length,Number(level>0&&red<=level+1),`${track} level ${level}, red ${red}`);
 }
});

test('supplied PDF page 4: reserved destroyed city can be rebuilt with no free city pieces',()=>{
 for(const medicine of [false,true]){
  const G=game({sea:false}),vs=[...new Set(Object.keys(G.tiles).flatMap(E.cornersOf))];
  for(let i=0;i<5;i++)building(G,'p0',vs[i]);
  const ruined=building(G,'p0',vs[8],'settlement',{displacedCity:true});
  for(let i=9;i<12;i++)building(G,'p0',vs[i],'city');
  assert.equal(E.supply(G,'p0','city'),0);
  grant(G,'p0',medicine?{ore:2,wheat:1}:E.COST.city);
  if(medicine){play(G,'medicine');assert.deepEqual(E.taskOptions(G,G.queue[0]).map(o=>o.v),[ruined.v]);choose(G,ruined.v);}
  else{assert.ok(E.availableActions(G,'p0').some(x=>x.action.type==='build'&&x.action.kind==='city'&&x.action.v===ruined.v));atomic(G,'p0',{type:'build',kind:'city',v:vs[0]});E.act(G,'p0',{type:'build',kind:'city',v:ruined.v});}
  assert.equal(G.builds.find(b=>b.v===ruined.v).kind,'city');assert.equal(E.supply(G,'p0','city'),0);invariant(G);
 }
});
