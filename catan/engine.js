// CATAN sixth-edition rules. Pure serializable state; mutations are transactional.
import * as H from './geometry.js';
import { makeBoard, TERRAIN } from './maps.js';
import { PROGRESS, DEVELOPMENT, TRACKS } from './cards.js';
export * from './geometry.js';
export { TERRAIN, PROGRESS, DEVELOPMENT, TRACKS };
const { key, unkey, nbrs, cornersOf, vHexes, vSides, vNbrs, sideEnds, linkKey, pips }=H;
export const MIN_PLAYERS=3, MAX_PLAYERS=6;
export const RES=['wood','brick','wool','wheat','ore'], COMMODITIES=['paper','cloth','coin'], GOODS=[...RES,...COMMODITIES];
export const COST={road:{wood:1,brick:1},settlement:{wood:1,brick:1,wool:1,wheat:1},city:{ore:3,wheat:2},ship:{wood:1,wool:1},development:{ore:1,wool:1,wheat:1},knight:{ore:1,wool:1},promote:{ore:1,wool:1},activate:{wheat:1},wall:{brick:2}};
export const LIMIT={road:15,settlement:5,city:4,ship:15,wall:3};
export const targetFor=s=>s.sea?(s.raiders?16:14):(s.raiders?13:10);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
const empty=()=>Object.fromEntries(GOODS.map(r=>[r,0]));
function rnd(G){let t=G.rng=(G.rng+0x6d2b79f5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
const ri=(G,n)=>Math.floor(rnd(G)*n);
function shuffle(G,a){for(let i=a.length-1;i>0;i--){const j=ri(G,i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export const canPay=(h,c)=>Object.entries(c).every(([r,n])=>(h?.[r]||0)>=n);
const own=(G,p)=>G.builds.filter(b=>b.pid===p);
const piece=(G,v)=>G.builds.find(b=>b.v===v)||G.knights.find(k=>k.v===v);
const routes=G=>[...G.trails,...G.ships];
const ends=e=>sideEnds(e.a,e.b);
const touches=(e,v)=>ends(e).includes(v);
const enemy=(G,p,v)=>piece(G,v)&&piece(G,v).pid!==p;
const onLand=(G,v)=>vHexes(v).some(k=>G.tiles[k]?.land);
const spaced=(G,v)=>!piece(G,v)&&vNbrs(v).every(u=>!G.builds.some(b=>b.v===u));
const vertices=G=>[...new Set(Object.keys(G.tiles).flatMap(cornersOf))];
const ordered=G=>G.players.map((_,i)=>G.players[(G.turn+i)%G.players.length].id);
export const cur=G=>G.phase==='setup'?G.setupOrder[G.setupStep]:G.players[G.paired?(G.turn+3)%G.players.length:G.turn]?.id;
export const waitingOn=G=>G.phase==='gameOver'?[]:G.queue?.length?[G.queue[0].pid]:[cur(G)];
export const timerKey=G=>`${G.turnNo}.${G.phase}.${G.setupStep}.${G.queue[0]?.id||0}`;
export const pause=()=>null;
export function newGame(players,settings={}){
 assert(players.length>=3&&players.length<=6,'Official CATAN supports 3–6 players (5–6 uses the extension).');
 assert(new Set(players.map(p=>p.id)).size===players.length&&players.every(p=>typeof p.id==='string'&&p.id),'Each player needs a unique id.');
 const G={v:4,game:'catan',gameId:Math.random().toString(36).slice(2),seq:0,n:0,rng:(settings.seed??Date.now())>>>0,sea:!!(settings.sea??1),raiders:!!(settings.raiders??1),players:players.map(({id,name})=>({id,name})),tiles:{},ports:[],builds:[],trails:[],ships:[],knights:[],hands:{},dev:{},progress:{},improvements:{},publicVP:{},defenders:{},playedKnights:{},islands:{},bank:empty(),awards:{route:null,army:null},routeLengths:{},metropolis:{science:null,trade:null,politics:null},merchant:null,robber:null,pirate:null,barbarian:0,attacked:false,turn:0,paired:false,round:1,turnNo:0,phase:'setup',setupStep:0,setupOrder:[],queue:[],qid:0,returnPhase:'act',dice:null,event:null,played:false,movedShip:false,tradeRates:[],harbor:null,result:null,last:null};
 G.target=targetFor(G); const large=players.length>4;
 for(const r of RES)G.bank[r]=large?24:19;for(const r of COMMODITIES)G.bank[r]=G.raiders?(large?18:12):0;
 for(const p of players){G.hands[p.id]=empty();G.dev[p.id]=[];G.progress[p.id]=[];G.improvements[p.id]={science:0,trade:0,politics:0};G.publicVP[p.id]=0;G.defenders[p.id]=0;G.playedKnights[p.id]=0;G.islands[p.id]=[];}
 makeBoard(G,a=>shuffle(G,a));G.robber=G.raiders?null:G.robberStart;G.pirate=G.pirateStart;
 G.devDeck=G.raiders?[]:shuffle(G,[...Array(large?20:14).fill('knight'),...Array(large?3:2).fill('roadBuilding'),...Array(large?3:2).fill('yearOfPlenty'),...Array(large?3:2).fill('monopoly'),...Array(5).fill('vp')]);
 G.progressDecks=Object.fromEntries(Object.keys(TRACKS).map(t=>[t,shuffle(G,Object.values(PROGRESS).filter(c=>c.track===t).flatMap(c=>Array(c.n).fill(c.id)))]));
 G.startRolls={};let contenders=players.map(p=>p.id);while(contenders.length>1){for(const p of contenders)G.startRolls[p]=2+ri(G,6)+ri(G,6);const high=Math.max(...contenders.map(p=>G.startRolls[p]));contenders=contenders.filter(p=>G.startRolls[p]===high);}G.turn=players.findIndex(p=>p.id===contenders[0]);const order=ordered(G);G.setupOrder=[...order,...order.slice().reverse()];G.last={kind:'start',n:++G.n};return G;
}
function pay(G,p,c){assert(canPay(G.hands[p],c),'Not enough cards.');for(const [r,n]of Object.entries(c)){G.hands[p][r]-=n;G.bank[r]+=n;}}
function take(G,p,r,n){const k=Math.min(n,G.bank[r]);G.bank[r]-=k;G.hands[p][r]+=k;return k;}
function transfer(G,from,to,c){assert(canPay(G.hands[from],c),'Those cards are no longer available.');for(const[r,n]of Object.entries(c)){G.hands[from][r]-=n;G.hands[to][r]+=n;}}
function validCards(G,c){assert(c&&typeof c==='object'&&!Array.isArray(c),'Choose cards.');for(const[r,n]of Object.entries(c))assert((G.raiders?GOODS:RES).includes(r)&&Number.isInteger(n)&&n>0&&n<=99,'Invalid card amount.');return c;}
function allEdges(G){const seen=new Set(),out=[];for(const a in G.tiles)for(const b of nbrs(a)){const k=linkKey(a,b);if(seen.has(k))continue;seen.add(k);out.push({a,b,k});}return out;}
function edgeTerrain(G,e,type){const a=G.tiles[e.a],b=G.tiles[e.b];return type==='road'?!!(a?.land||b?.land):G.sea&&!!((a&&!a.land)||(b&&!b.land)||(!a&&b?.land)||(!b&&a?.land));}
function connected(G,p,e,type){return ends(e).some(v=>{
 if(enemy(G,p,v))return false;
 if(G.builds.some(b=>b.v===v&&b.pid===p))return true;
 return routes(G).some(r=>r.pid===p&&r.kind===type&&touches(r,v));
});}
export function legal(G,p,kind){
 if(kind==='setup'){
 const opts=[];for(const v of vertices(G))if(spaced(G,v)&&vHexes(v).some(k=>G.tiles[k]?.land&&G.tiles[k].island===0))for(const[a,b]of vSides(v)){
 const e={a,b,k:linkKey(a,b),v};if(routes(G).some(r=>r.k===e.k))continue;
 for(const type of G.sea?['road','ship']:['road'])if(edgeTerrain(G,e,type))opts.push({...e,kind:type});}return opts;
 }
 if(kind==='road'||kind==='ship')return allEdges(G).filter(e=>!routes(G).some(r=>r.k===e.k)&&edgeTerrain(G,e,kind)&&(kind!=='ship'||(e.a!==G.pirate&&e.b!==G.pirate))&&connected(G,p,e,kind));
 if(kind==='settlement')return vertices(G).filter(v=>onLand(G,v)&&spaced(G,v)&&routes(G).some(r=>r.pid===p&&touches(r,v))).map(v=>({v}));
 if(kind==='city') {const forced=own(G,p).find(b=>b.displacedCity);return own(G,p).filter(b=>b.kind==='settlement'&&(!forced||b===forced)).map(b=>({v:b.v}));}
 if(kind==='wall')return own(G,p).filter(b=>b.kind==='city'&&!b.wall).map(b=>({v:b.v}));
 if(kind==='knight')return vertices(G).filter(v=>!piece(G,v)&&routes(G).some(r=>r.pid===p&&touches(r,v))).map(v=>({v}));
 return [];
}
function hasCityPiece(G,p){return supply(G,p,'city')>0||own(G,p).some(b=>b.displacedCity);}
export function supply(G,p,kind){if(kind==='road'||kind==='ship')return LIMIT[kind]-(kind==='road'?G.trails:G.ships).filter(r=>r.pid===p).length;if(kind==='knight')return 2-G.knights.filter(k=>k.pid===p&&k.level===1).length;if(kind==='wall')return 3-own(G,p).filter(b=>b.wall).length;return LIMIT[kind]-own(G,p).filter(b=>b.kind===kind&&!b.displacedCity).length-(kind==='city'?own(G,p).filter(b=>b.displacedCity).length:0);}
function addRoute(G,p,kind,e){const r={a:e.a,b:e.b,k:linkKey(e.a,e.b),pid:p,kind,id:++G.n,built:G.turnNo};(kind==='road'?G.trails:G.ships).push(r);}
function addBuilding(G,p,v,kind){G.builds.push({pid:p,v,kind,wall:false});
 if(G.phase!=='setup'&&G.sea)for(const i of new Set(vHexes(v).map(k=>G.tiles[k]?.island).filter(i=>i>0)))if(!G.islands[p].includes(i)){G.islands[p].push(i);G.publicVP[p]+=2;}
}
export function points(G,p,hidden=true){return own(G,p).reduce((n,b)=>n+(b.kind==='city'?2:1)+(b.metro?2:0),0)+G.publicVP[p]+G.defenders[p]+(G.awards.route===p?2:0)+(G.awards.army===p?2:0)+(G.merchant?.pid===p?1:0)+(hidden?G.dev[p].filter(c=>c.card==='vp').length:0);}
export const renown=points;
export function longestRoute(G,p){
 const rr=routes(G).filter(r=>r.pid===p), at=new Map();
 rr.forEach((r,i)=>ends(r).forEach(v=>{if(!at.has(v))at.set(v,[]);at.get(v).push(i);}));
 function walk(v,used,previous){if(used.size&&enemy(G,p,v))return used.size;let best=used.size;
 for(const i of at.get(v)||[]){if(used.has(i))continue;const r=rr[i];if(previous&&previous!==r.kind&&!G.builds.some(b=>b.v===v&&b.pid===p))continue;used.add(i);best=Math.max(best,walk(ends(r).find(x=>x!==v),used,r.kind));used.delete(i);}return best;}
 return Math.max(0,...[...at.keys()].map(v=>walk(v,new Set(),null)));
}
function awards(G){
 for(const p of G.players)G.routeLengths[p.id]=longestRoute(G,p.id);
 for(const[type,values,min]of [['route',G.routeLengths,5],['army',G.playedKnights,3]]){
 if(type==='army'&&G.raiders){G.awards.army=null;continue;}
 const max=Math.max(...Object.values(values)),leaders=G.players.filter(p=>values[p.id]===max).map(p=>p.id);
 G.awards[type]=max<min?null:leaders.includes(G.awards[type])?G.awards[type]:leaders.length===1?leaders[0]:null;
 }
}
function win(G){if(G.phase==='setup'||G.phase==='gameOver')return;const p=cur(G);if(points(G,p)>=G.target){G.phase='gameOver';G.queue=[];G.result={winners:[p],rows:G.players.map(x=>({pid:x.id,points:points(G,x.id)})).sort((a,b)=>b.points-a.points)};}}
function reachable(G,p,start,allowEnemyEnd=false){const seen=new Set([start]),todo=[start];while(todo.length){const v=todo.shift();if(v!==start&&enemy(G,p,v))continue;for(const r of routes(G))if(r.pid===p&&touches(r,v)){const u=ends(r).find(x=>x!==v);if(!seen.has(u)&&(!enemy(G,p,u)||allowEnemyEnd)){seen.add(u);todo.push(u);}}}seen.delete(start);return [...seen];}
export function knightDestinations(G,k){return reachable(G,k.pid,k.v,true).filter(v=>!piece(G,v)||(G.knights.some(o=>o.v===v&&o.pid!==k.pid&&o.level<k.level)));}
function connectedAnchors(G,p,rr,start,skip){const seen=new Set([start]),todo=[start],anchors=new Set();while(todo.length){const v=todo.pop();if(G.builds.some(b=>b.pid===p&&b.v===v)||G.knights.some(k=>k.pid===p&&k.v===v))anchors.add(v);for(const r of rr)if(r!==skip&&touches(r,v)){const u=ends(r).find(x=>x!==v);if(!seen.has(u)){seen.add(u);todo.push(u);}}}return{seen,anchors};}
export function openRoute(G,r){
 const rr=routes(G).filter(e=>e.pid===r.pid&&e.kind===r.kind),[a,b]=ends(r);
 const anchors=new Set([...own(G,r.pid).map(b=>b.v),...G.knights.filter(k=>k.pid===r.pid).map(k=>k.v)]);
 const at=new Map();for(const e of rr)for(const v of ends(e)){if(!at.has(v))at.set(v,[]);at.get(v).push(e);}
 // Closed edges lie on a simple path between two distinct owned anchors.
 // Ignore rival interruptions here: they do not open an already closed shipping route.
 function closed(v,start,seen,usedEdge){
  if(v!==start&&anchors.has(v))return usedEdge;
  for(const e of at.get(v)||[]){const u=ends(e).find(x=>x!==v);if(seen.has(u))continue;seen.add(u);if(closed(u,start,seen,usedEdge||e===r))return true;seen.delete(u);}return false;
 }
 for(const v of anchors)if(at.has(v)&&closed(v,v,new Set([v]),false))return false;
 const open=v=>!anchors.has(v)&&!G.knights.some(k=>k.v===v)&&!(at.get(v)||[]).some(e=>e!==r);
 if(open(a)||open(b))return true;
 if(!connectedAnchors(G,r.pid,rr,a,r).seen.has(b))return false;
 // A ship circle without an anchor has removable edges. A circle returning to
 // one building has only its two ends at that building open (official FAQ).
 const cyclic=rr.filter(e=>{const[x,y]=ends(e);return connectedAnchors(G,r.pid,rr,x,e).seen.has(y);});
 const component=connectedAnchors(G,r.pid,cyclic,a,null),inside=[...anchors].filter(v=>component.seen.has(v));
 return inside.length===0||(inside.length===1&&ends(r).includes(inside[0]));
}
export function movableShips(G,p){if(!G.sea||G.movedShip)return[];return G.ships.filter(s=>s.pid===p&&s.built!==G.turnNo&&s.a!==G.pirate&&s.b!==G.pirate&&openRoute(G,s)).filter(s=>{
 const rr=routes(G).filter(r=>r!==s&&r.pid===p);return G.knights.filter(k=>k.pid===p).every(k=>own(G,p).some(b=>connectedAnchors(G,p,rr,k.v,null).seen.has(b.v)));
});}
export function shipDestinations(G,p,id){const s=movableShips(G,p).find(s=>s.id===id);if(!s)return[];const test={...G,ships:G.ships.filter(x=>x!==s)};return legal(test,p,'ship').filter(e=>e.k!==s.k);}
export function tradeRate(G,p,r){let rate=4;const vs=new Set(own(G,p).map(b=>b.v));for(const port of G.ports)if(port.ends.some(v=>vs.has(v)))rate=Math.min(rate,port.res==='any'?3:port.res===r?2:4);if(G.raiders&&G.improvements[p].trade>=3&&COMMODITIES.includes(r))rate=2;if(G.merchant?.pid===p&&TERRAIN[G.tiles[G.merchant.at].terrain]===r)rate=2;if(G.tradeRates.includes(r))rate=2;return rate;}
function build(G,p,a,free=false,cost=null){const k=a.kind;assert(['road','ship','settlement','city','knight','wall'].includes(k),'Unknown piece.');assert(!['knight','wall'].includes(k)||G.raiders,'Enable Cities & Knights.');assert(k!=='ship'||G.sea,'Enable Seafarers.');assert(supply(G,p,k)>0||k==='city'&&own(G,p).some(b=>b.v===a.v&&b.displacedCity),'No pieces remaining.');const spot=legal(G,p,k).find(o=>k==='road'||k==='ship'?o.k===linkKey(a.a,a.b):o.v===a.v);assert(spot,'That placement is not legal.');if(!free)pay(G,p,cost||COST[k]);
 if(k==='road'||k==='ship')addRoute(G,p,k,spot);
 else if(k==='settlement')addBuilding(G,p,a.v,k);
 else if(k==='city'){const b=G.builds.find(b=>b.v===a.v);b.kind='city';delete b.displacedCity;}
 else if(k==='wall')G.builds.find(b=>b.v===a.v).wall=true;
 else G.knights.push({id:++G.n,pid:p,v:a.v,level:1,active:false,activated:-1,promoted:-1});
}
function task(G,kind,pid,data={}){const t={kind,pid,id:++G.qid,...data},i=G.queue.findIndex(t=>t.kind.startsWith('_'));if(!kind.startsWith('_')&&i>=0)G.queue.splice(i,0,t);else G.queue.push(t);}
function prepend(G,kind,pid,data={}){G.queue.unshift({kind,pid,id:++G.qid,...data});}
function drain(G){while(G.queue.length&&G.queue[0].kind.startsWith('_')){const t=G.queue.shift();if(t.kind==='_production')produce(G);if(t.kind==='_end')finishTurn(G);if(t.kind==='_steal'){const victims=robberVictims(G,t.piece,t.at,cur(G));if(t.all)for(const p of victims)steal(G,p,cur(G));else if(victims.length===1)steal(G,victims[0],cur(G));else if(victims.length>1)prepend(G,'victim',cur(G),{victims});}}
 G.phase=G.queue.length?'resolve':G.returnPhase;
}
function drawProgress(G,p,track){const card=G.progressDecks[track].shift();if(!card)return;if(['printing','constitution'].includes(card))G.publicVP[p]++;else{G.progress[p].push({id:++G.n,card});if(p!==cur(G)&&G.progress[p].length>4)task(G,'progressDiscard',p);} }
function barbarians(G){const strength=G.builds.filter(b=>b.kind==='city').length,defence=Object.fromEntries(G.players.map(p=>[p.id,G.knights.filter(k=>k.pid===p.id&&k.active).reduce((n,k)=>n+k.level,0)]));const total=sum(defence);
 G.last.barbarian={strength,defence,total,won:total>=strength};
 if(total>=strength){const max=Math.max(...Object.values(defence)),leaders=ordered(G).filter(p=>defence[p]===max);if(leaders.length===1)G.defenders[leaders[0]]++;else for(const p of leaders)task(G,'progressReward',p);}
 else{const vulnerable=G.players.filter(p=>own(G,p.id).some(b=>b.kind==='city'&&!b.metro));const min=Math.min(...vulnerable.map(p=>defence[p.id]));for(const p of vulnerable)if(defence[p.id]===min)task(G,'pillage',p.id);}
 for(const k of G.knights)k.active=false;G.barbarian=0;G.attacked=true;if(G.robber===null)G.robber=G.robberStart;
}
function roll(G,chosen=null){G.dice=chosen||[1+ri(G,6),1+ri(G,6)];G.last.dice=[...G.dice];G.returnPhase='act';
 if(G.raiders){G.event=['barbarian','barbarian','barbarian','science','trade','politics'][ri(G,6)];G.last.event=G.event;if(G.event==='barbarian'){if(++G.barbarian===7)barbarians(G);}else for(const p of ordered(G))if(G.improvements[p][G.event]>0&&G.dice[0]<=G.improvements[p][G.event]+1)drawProgress(G,p,G.event);}
 task(G,'_production',cur(G));drain(G);
}
function produce(G){const total=sum(G.dice),p=cur(G);G.last.prod=[];
 if(total===7){for(const id of ordered(G)){const count=sum(G.hands[id]),limit=7+2*own(G,id).filter(b=>b.wall).length;if(count>limit)task(G,'discard',id,{count:Math.floor(count/2)});}if(!G.raiders||G.attacked)task(G,'robber',p);return;}
 const due=Object.fromEntries(GOODS.map(r=>[r,{}])),gold={};
 for(const b of G.builds)for(const k of vHexes(b.v)){const t=G.tiles[k];if(!t?.land||t.mark!==total||k===G.robber)continue;const r=TERRAIN[t.terrain];if(!r)continue;const n=b.kind==='city'?2:1;if(r==='gold'){gold[b.pid]=(gold[b.pid]||0)+n;continue;}const gain={[r]:n};if(G.raiders&&b.kind==='city'&&['wood','wool','ore'].includes(r)){gain[r]=1;gain[{wood:'paper',wool:'cloth',ore:'coin'}[r]]=1;}for(const [res,num]of Object.entries(gain))due[res][b.pid]=(due[res][b.pid]||0)+num;G.last.prod.push({tile:k,pid:b.pid,gain});}
 const got=new Set();for(const r of GOODS){const entries=Object.entries(due[r]);if(sum(due[r])>G.bank[r]&&entries.length>1)continue;for(const[id,n]of entries)if(take(G,id,r,n))got.add(id);}
 for(const id of ordered(G))if(gold[id]){task(G,'resource',id,{count:gold[id],reason:'Gold fields'});got.add(id);}
 if(G.raiders)for(const id of ordered(G))if(G.improvements[id].science>=3&&!got.has(id))task(G,'resource',id,{count:1,reason:'Aqueduct'});
}
function robberVictims(G,type,at,p){return [...new Set((type==='pirate'?G.ships.filter(s=>s.a===at||s.b===at):G.builds.filter(b=>vHexes(b.v).includes(at))).map(x=>x.pid))].filter(id=>id!==p&&sum(G.hands[id])>0);}
function steal(G,from,to){const bag=GOODS.flatMap(r=>Array(G.hands[from][r]).fill(r));if(bag.length)transfer(G,from,to,{[bag[ri(G,bag.length)]]:1});}
function promote(G,p,id,free=false){const k=G.knights.find(k=>k.id===id&&k.pid===p);assert(k&&k.level<3&&k.promoted!==G.turnNo,'This knight cannot be promoted.');assert(k.level<2||G.improvements[p].politics>=3,'Reach politics level 3 first.');assert(G.knights.filter(o=>o.pid===p&&o.level===k.level+1).length<2,'No knight of that level in supply.');if(!free)pay(G,p,COST.promote);k.level++;k.promoted=G.turnNo;}
function improve(G,p,track,discount=0){assert(Object.hasOwn(TRACKS,track),'Choose an improvement track.');const level=G.improvements[p][track]+1;assert(level<=5&&own(G,p).some(b=>b.kind==='city'),'You need a city and an unfinished track.');const holder=G.metropolis[track],gain=level>=4&&(!holder||G.improvements[holder][track]<level);if(level>=4)assert(own(G,p).some(b=>b.kind==='city'&&(!b.metro||b.metro===track)),'You need a city available for this metropolis.');pay(G,p,{[TRACKS[track]]:Math.max(0,level-discount)});G.improvements[p][track]=level;
 if(gain&&holder!==p){for(const b of G.builds)if(b.metro===track)delete b.metro;G.metropolis[track]=p;task(G,'metropolis',p,{track});}
}
function resetTurn(G){G.turnNo++;G.played=false;G.movedShip=false;G.tradeRates=[];G.harbor=null;G.offer=null;}
function finishTurn(G){if(G.players.length>4&&!G.paired){G.paired=true;resetTurn(G);G.returnPhase='act';}else{G.paired=false;G.turn=(G.turn+1)%G.players.length;if(G.turn===0)G.round++;resetTurn(G);G.returnPhase='roll';}}

function displace(G,k){const destinations=reachable(G,k.pid,k.v).filter(v=>!piece(G,v));G.knights=G.knights.filter(x=>x.id!==k.id);if(destinations.length)task(G,'retreat',k.pid,{knight:{...k},destinations});}
function cardAvailable(G,p,id){const c=G.raiders?G.progress[p].find(c=>c.id===id):G.dev[p].find(c=>c.id===id);if(!c)return false;
 if(!G.raiders)return c.card!=='vp'&&c.at!==G.turnNo&&!G.played&&(G.phase==='act'||G.phase==='roll');
 return c.card==='alchemy'?G.phase==='roll':G.phase==='act';
}
function startCard(G,p,id){assert(cardAvailable(G,p,id),'That card cannot be played now.');const hand=G.raiders?G.progress[p]:G.dev[p],i=hand.findIndex(c=>c.id===id),c=hand[i],card=c.card;
 const other=G.players.filter(x=>x.id!==p);
 const needTarget={yearOfPlenty:()=>RES.some(r=>G.bank[r]>0),guildDues:()=>other.some(x=>points(G,x.id,false)>points(G,p,false)&&sum(G.hands[x.id])>0),espionage:()=>other.some(x=>G.progress[x.id].length),treason:()=>G.knights.some(k=>k.pid!==p),intrigue:()=>G.knights.some(k=>k.pid!==p&&routes(G).some(r=>r.pid===p&&touches(r,k.v))),merchant:()=>own(G,p).some(b=>vHexes(b.v).some(k=>RES.includes(TERRAIN[G.tiles[k]?.terrain]))),engineering:()=>supply(G,p,'wall')>0&&legal(G,p,'wall').length,medicine:()=>hasCityPiece(G,p)&&legal(G,p,'city').length&&canPay(G.hands[p],{ore:2,wheat:1}),encouragement:()=>G.knights.some(k=>k.pid===p&&!k.active),taxation:()=>G.attacked,invention:()=>Object.values(G.tiles).filter(t=>t.land&&t.mark&&![2,6,8,12].includes(t.mark)).length>=2,smithing:()=>promotable(G,p).length,crane:()=>Object.keys(TRACKS).some(track=>canImprove(G,p,track,1)),roadBuilding:()=>['road',...(G.sea?['ship']:[])].some(k=>supply(G,p,k)>0&&legal(G,p,k).length),diplomacy:()=>routes(G).some(r=>openRoute(G,r)),irrigation:()=>own(G,p).some(b=>vHexes(b.v).some(k=>TERRAIN[G.tiles[k]?.terrain]==='wheat')),mining:()=>own(G,p).some(b=>vHexes(b.v).some(k=>TERRAIN[G.tiles[k]?.terrain]==='ore'))};
 if(needTarget[card])assert(needTarget[card](),'There is no legal use for that card.');
 hand.splice(i,1);if(G.raiders)G.progressDecks[PROGRESS[card].track].push(card);else G.played=true;
 G.returnPhase=G.phase;G.last.card=card;
 switch(card){
 case'knight':G.playedKnights[p]++;task(G,'robber',p);break;
 case'roadBuilding':task(G,'freeRoutes',p,{count:2});break;
 case'yearOfPlenty':task(G,'resource',p,{count:2,reason:'Invention'});break;
 case'monopoly':case'resourceMonopoly':case'tradeMonopoly':task(G,'monopoly',p,{card});break;
 case'alchemy':task(G,'alchemy',p);break;
 case'crane':task(G,'crane',p);break;
 case'engineering':task(G,'freeWall',p);break;
 case'invention':task(G,'swapFirst',p);break;
 case'irrigation':case'mining':{const r=card==='irrigation'?'wheat':'ore',ks=new Set(own(G,p).flatMap(b=>vHexes(b.v)).filter(k=>TERRAIN[G.tiles[k]?.terrain]===r));take(G,p,r,ks.size*2);break;}
 case'medicine':task(G,'medicine',p);break;
 case'smithing':task(G,'smithing',p,{count:2});break;
 case'commercialHarbor':G.harbor={pid:p,used:[]};break;
 case'guildDues':case'espionage':case'treason':task(G,'opponent',p,{card});break;
 case'merchant':task(G,'merchant',p);break;
 case'merchantFleet':task(G,'merchantFleet',p);break;
 case'diplomacy':task(G,'diplomacy',p);break;
 case'encouragement':for(const k of G.knights)if(k.pid===p&&!k.active){k.active=true;k.activated=G.turnNo;}break;
 case'intrigue':task(G,'intrigue',p);break;
 case'sabotage':for(const id of ordered(G))if(id!==p&&points(G,id,false)>=points(G,p,false)&&sum(G.hands[id])>=2)task(G,'discard',id,{count:Math.floor(sum(G.hands[id])/2)});break;
 case'taxation':task(G,'robber',p,{only:'robber',all:true});break;
 case'wedding':for(const id of ordered(G))if(id!==p&&points(G,id,false)>points(G,p,false)&&sum(G.hands[id]))task(G,'give',id,{to:p,count:Math.min(2,sum(G.hands[id]))});break;
 default:throw new Error('Unknown card.');
 }
 drain(G);
}
function promotable(G,p){return G.knights.filter(k=>k.pid===p&&k.level<3&&k.promoted!==G.turnNo&&(k.level===1||G.improvements[p].politics>=3)&&G.knights.filter(o=>o.pid===p&&o.level===k.level+1).length<2);}
function canImprove(G,p,track,discount=0){const level=G.improvements[p][track]+1;return level<=5&&own(G,p).some(b=>b.kind==='city')&&canPay(G.hands[p],{[TRACKS[track]]:Math.max(0,level-discount)})&&(level<4||own(G,p).some(b=>b.kind==='city'&&(!b.metro||b.metro===track)));}
const option=(value,label,data={})=>({value:String(value),label,...data});
function tileName(G,k){const t=G.tiles[k];return `${t?.terrain==='gold'?'Gold':TERRAIN[t?.terrain]||'Desert'}${t?.mark?' '+t.mark:''} (${k})`;}
function vertexName(G,v){return vHexes(v).filter(k=>G.tiles[k]?.land).map(k=>tileName(G,k)).join(' / ');}
export function taskOptions(G,t){const p=t.pid,hand=G.hands[p],pieces=own(G,p),goods=G.raiders?GOODS:RES;
 const cards=(pool,allowed=goods)=>allowed.filter(r=>pool[r]>0).map(r=>option(r,`${r} (${pool[r]} available)`));
 const vs=bs=>bs.map(b=>option(b.v,vertexName(G,b.v),{v:b.v}));
 const routeOpts=(types)=>types.flatMap(kind=>supply(G,p,kind)>0?legal(G,p,kind).map(e=>option(`${kind}:${e.k}`,`${kind}: ${e.a} / ${e.b}`,{a:e.a,b:e.b,kind})):[]);
 switch(t.kind){
 case'discard':case'give':return cards(hand);
 case'resource':return [...cards(G.bank,RES),...(RES.every(r=>!G.bank[r])?[option('skip','Bank has no resources')]:[])];
 case'progressDiscard':return G.progress[p].map(c=>option(c.id,PROGRESS[c.card].name));
 case'progressReward':return Object.keys(TRACKS).filter(k=>G.progressDecks[k].length).map(k=>option(k,k));
 case'pillage':return vs(pieces.filter(b=>b.kind==='city'&&!b.metro));
 case'metropolis':return vs(pieces.filter(b=>b.kind==='city'&&!b.metro));
 case'victim':return t.victims.map(id=>option(id,G.players.find(p=>p.id===id).name));
 case'robber':return [
 ...(!t.only||t.only==='robber'?Object.keys(G.tiles).filter(k=>G.tiles[k].land&&k!==G.robber).map(k=>option('robber:'+k,'Robber: '+tileName(G,k),{k,piece:'robber'})):[]),
 ...(G.sea&&(!t.only||t.only==='pirate')?[...Object.keys(G.tiles).filter(k=>!G.tiles[k].land&&k!==G.pirate).map(k=>option('pirate:'+k,'Pirate: '+k,{k,piece:'pirate'})),...(G.pirate!==null?[option('pirate:frame','Pirate: return to frame')]:[])]:[])
 ];
 case'freeRoutes':{const opts=routeOpts(t.only?[t.only]:G.sea?['road','ship']:['road']);return [...opts,...(t.count<2||!opts.length?[option('skip','Finish free building')]:[])];}
 case'medicine':return vs(legal(G,p,'city'));
 case'freeWall':return vs(legal(G,p,'wall'));
 case'smithing':{const ks=promotable(G,p);return [...ks.map(k=>option(k.id,`Level ${k.level} knight: ${vertexName(G,k.v)}`,{v:k.v})),...(t.count<2||!ks.length?[option('skip','Finish promotions')]:[])];}
 case'crane':return Object.keys(TRACKS).filter(k=>canImprove(G,p,k,1)).map(k=>option(k,`${k} level ${G.improvements[p][k]+1}`));
 case'alchemy':return Array.from({length:36},(_,i)=>option(`${1+Math.floor(i/6)},${1+i%6}`,`Red ${1+Math.floor(i/6)} · white ${1+i%6}`));
 case'monopoly':return (t.card==='tradeMonopoly'?COMMODITIES:RES).map(r=>option(r,r));
 case'merchantFleet':return goods.map(r=>option(r,r));
 case'merchant':return [...new Set(pieces.flatMap(b=>vHexes(b.v)).filter(k=>RES.includes(TERRAIN[G.tiles[k]?.terrain])))].map(k=>option(k,tileName(G,k),{k}));
 case'swapFirst':case'swapSecond':return Object.keys(G.tiles).filter(k=>G.tiles[k].land&&G.tiles[k].mark&&![2,6,8,12].includes(G.tiles[k].mark)&&k!==t.first).map(k=>option(k,tileName(G,k),{k}));
 case'opponent':return G.players.filter(x=>x.id!==p&&(t.card==='guildDues'?points(G,x.id,false)>points(G,p,false)&&sum(G.hands[x.id])>0:t.card==='espionage'?G.progress[x.id].length:G.knights.some(k=>k.pid===x.id))).map(x=>option(x.id,x.name));
 case'spyHand':return cards(G.hands[t.from]);
 case'spyCard':return G.progress[t.from].map(c=>option(c.id,PROGRESS[c.card].name));
 case'removeKnight':return G.knights.filter(k=>k.pid===p).map(k=>option(k.id,`Level ${k.level} ${k.active?'active':'inactive'} knight`,{v:k.v}));
 case'replacement':return [...[1,2,3].filter(l=>l<=t.level&&G.knights.filter(k=>k.pid===p&&k.level===l).length<2).flatMap(l=>legal(G,p,'knight').map(o=>option(`${l}:${o.v}`,`Level ${l}: ${vertexName(G,o.v)}`,{v:o.v}))),option('skip','Do not recruit a replacement')];
 case'retreat':return t.destinations.filter(v=>!piece(G,v)).map(v=>option(v,vertexName(G,v),{v}));
 case'intrigue':return G.knights.filter(k=>k.pid!==p&&routes(G).some(r=>r.pid===p&&touches(r,k.v))).map(k=>option(k.id,`Displace level ${k.level} knight`,{v:k.v}));
 case'knightMove':{const k=G.knights.find(k=>k.id===t.knight);return knightDestinations(G,k).map(v=>option(v,vertexName(G,v),{v}));}
 case'moveShip':return shipDestinations(G,p,t.ship).map(e=>option(e.k,`${e.a} / ${e.b}`,{a:e.a,b:e.b,kind:'ship'}));
 case'diplomacy':return routes(G).filter(r=>openRoute(G,r)).map(r=>option(r.id,`${r.pid===p?'Your':G.players.find(p=>p.id===r.pid).name+'’s'} ${r.kind}`,{a:r.a,b:r.b}));
 case'harborGive':return cards(hand,RES);
 case'harborReturn':return cards(hand,COMMODITIES);
 default:return [];
 }
}
const TASK_TITLES={discard:'Discard cards',give:'Choose cards to give',resource:'Choose resources',progressDiscard:'Discard excess progress cards',progressReward:'Choose a progress deck',pillage:'Choose a city to downgrade',metropolis:'Choose a city for your metropolis',victim:'Choose a player to steal from',robber:'Move the robber or pirate',freeRoutes:'Build free roads or ships',medicine:'Choose a settlement to upgrade',freeWall:'Choose a city for a free wall',smithing:'Choose a knight to promote',crane:'Choose an improvement',alchemy:'Choose the production dice',monopoly:'Choose a card type',merchantFleet:'Choose your 2:1 trade type',merchant:'Place the merchant',swapFirst:'Choose the first number token',swapSecond:'Choose the second number token',opponent:'Choose an opponent',spyHand:'Choose a card from their hand',spyCard:'Choose a progress card to take',removeKnight:'Choose a knight to remove',replacement:'Recruit a replacement knight',retreat:'Retreat your displaced knight',intrigue:'Choose a knight to displace',knightMove:'Move or displace with your knight',moveShip:'Choose the ship’s new edge',diplomacy:'Choose an open route to remove',harborGive:'Offer a resource',harborReturn:'Choose a commodity to exchange'};
function resolve(G,p,value){const t=G.queue[0];assert(t&&t.pid===p,'Waiting for another player.');const o=taskOptions(G,t).find(o=>o.value===String(value));assert(o,'That choice is not legal.');G.queue.shift();const again=()=>{t.count--;if(t.count>0)G.queue.unshift(t);};
 switch(t.kind){
 case'discard':pay(G,p,{[value]:1});again();break;
 case'give':transfer(G,p,t.to,{[value]:1});again();break;
 case'resource':if(value!=='skip'){take(G,p,value,1);again();}break;
 case'progressDiscard':{const i=G.progress[p].findIndex(c=>c.id===+value),[c]=G.progress[p].splice(i,1);G.progressDecks[PROGRESS[c.card].track].push(c.card);if(G.progress[p].length>4)G.queue.unshift(t);break;}
 case'progressReward':drawProgress(G,p,value);break;
 case'pillage':{const b=G.builds.find(b=>b.v===value);if(supply(G,p,'settlement')===0)b.displacedCity=true;b.kind='settlement';b.wall=false;break;}
 case'metropolis':G.builds.find(b=>b.v===value).metro=t.track;break;
 case'victim':steal(G,value,p);break;
 case'robber':{const[type,at]=value.split(':');G[type]=at==='frame'?null:at;prepend(G,'_steal',p,{piece:type,at:G[type],all:t.all});break;}
 case'freeRoutes':if(value!=='skip'){build(G,p,{kind:o.kind,a:o.a,b:o.b},true);again();}break;
 case'medicine':build(G,p,{kind:'city',v:value},false,{ore:2,wheat:1});break;
 case'freeWall':build(G,p,{kind:'wall',v:value},true);break;
 case'smithing':if(value!=='skip'){promote(G,p,+value,true);again();}break;
 case'crane':improve(G,p,value,1);break;
 case'alchemy':roll(G,value.split(',').map(Number));break;
 case'monopoly':for(const id of ordered(G))if(id!==p){const n=Math.min(G.hands[id][value],t.card==='monopoly'?Infinity:t.card==='tradeMonopoly'?1:2);if(n)transfer(G,id,p,{[value]:n});}break;
 case'merchantFleet':G.tradeRates.push(value);break;
 case'merchant':G.merchant={pid:p,at:value};break;
 case'swapFirst':prepend(G,'swapSecond',p,{first:value});break;
 case'swapSecond':[G.tiles[t.first].mark,G.tiles[value].mark]=[G.tiles[value].mark,G.tiles[t.first].mark];break;
 case'opponent':if(t.card==='guildDues')prepend(G,'spyHand',p,{from:value,count:Math.min(2,sum(G.hands[value]))});else if(t.card==='espionage')prepend(G,'spyCard',p,{from:value});else prepend(G,'removeKnight',value,{to:p});break;
 case'spyHand':transfer(G,t.from,p,{[value]:1});again();break;
 case'spyCard':{const i=G.progress[t.from].findIndex(c=>c.id===+value);G.progress[p].push(G.progress[t.from].splice(i,1)[0]);break;}
 case'removeKnight':{const k=G.knights.find(k=>k.id===+value);G.knights=G.knights.filter(o=>o!==k);prepend(G,'replacement',t.to,{level:k.level,active:k.active});break;}
 case'replacement':if(value!=='skip')G.knights.push({id:++G.n,pid:p,v:o.v,level:+value.split(':')[0],active:t.active,activated:t.active?G.turnNo:-1,promoted:-1});break;
 case'retreat':G.knights.push({...t.knight,v:value});break;
 case'intrigue':displace(G,G.knights.find(k=>k.id===+value));break;
 case'knightMove':{const k=G.knights.find(k=>k.id===t.knight),enemy=G.knights.find(k=>k.v===value);if(enemy)displace(G,enemy);k.v=value;k.active=false;break;}
 case'moveShip':{const s=G.ships.find(s=>s.id===t.ship);Object.assign(s,{a:o.a,b:o.b,k:o.value});G.movedShip=true;break;}
 case'diplomacy':{const r=routes(G).find(r=>r.id===+value);G.trails=G.trails.filter(o=>o!==r);G.ships=G.ships.filter(o=>o!==r);if(r.pid===p)prepend(G,'freeRoutes',p,{only:r.kind,count:1});break;}
 case'harborGive':G.harbor.used.push(t.to);if(COMMODITIES.some(r=>G.hands[t.to][r])){transfer(G,p,t.to,{[value]:1});prepend(G,'harborReturn',t.to,{to:p});}break;
 case'harborReturn':transfer(G,p,t.to,{[value]:1});break;
 }
 drain(G);
}
export function act(G,p,a){const before=structuredClone(G);try{assert(G.v===4,'This table uses the old custom rules. Start a new official-rules table.');apply(G,p,a);awards(G);win(G);G.seq++;if(G.last)G.last.n=++G.n;return G;}catch(e){for(const k of Object.keys(G))delete G[k];Object.assign(G,before);throw e;}}
function apply(G,p,a){assert(a&&typeof a==='object','Unknown action.');assert(G.phase!=='gameOver','The game is over.');assert(Object.hasOwn(G.hands,p),'You are not seated.');G.last={kind:a.type,pid:p};
 if(a.type==='choose'){assert(G.phase==='resolve','There is no pending choice.');resolve(G,p,String(a.value));return;}
 if(['accept','decline'].includes(a.type)){assert(G.phase==='act'&&!G.paired&&G.offer&&G.offer.from!==p&&G.offer.id===a.offer,'That trade is no longer available.');if(a.type==='accept'){assert(canPay(G.hands[p],G.offer.want),'You cannot afford this trade.');G.offer.yes=[...new Set([...G.offer.yes,p])];G.offer.no=G.offer.no.filter(x=>x!==p);}else{G.offer.no=[...new Set([...G.offer.no,p])];G.offer.yes=G.offer.yes.filter(x=>x!==p);}return;}
 assert(cur(G)===p,'It is not your turn.');assert(!G.queue.length,'Resolve the pending choice first.');
 if(a.type==='place'){
 assert(G.phase==='setup','Setup is over.');const spot=legal(G,p,'setup').find(o=>o.v===a.v&&o.k===linkKey(a.a,a.b)&&o.kind===(a.kind||'road'));assert(spot,'That starting placement is not legal.');const second=G.setupStep>=G.players.length;
 addBuilding(G,p,a.v,second&&G.raiders?'city':'settlement');addRoute(G,p,spot.kind,spot);
 if(second)for(const k of vHexes(a.v)){const r=TERRAIN[G.tiles[k]?.terrain];if(RES.includes(r))take(G,p,r,1);}
 G.setupStep++;if(G.setupStep===G.setupOrder.length){G.phase='roll';G.returnPhase='roll';resetTurn(G);}return;
 }
 if(a.type==='play'){startCard(G,p,a.id);return;}
 if(a.type==='roll'){assert(G.phase==='roll','You cannot roll now.');roll(G);return;}
 assert(G.phase==='act','Finish the roll first.');G.returnPhase='act';
 switch(a.type){
 case'build':build(G,p,a);break;
 case'development':assert(!G.raiders&&G.devDeck.length,'No development cards available.');pay(G,p,COST.development);G.dev[p].push({id:++G.n,card:G.devDeck.pop(),at:G.turnNo});break;
 case'bank':{const {give,get}=a;assert((G.raiders?GOODS:RES).includes(give)&&(G.raiders?GOODS:RES).includes(get)&&give!==get,'Choose different card types.');assert(G.bank[get]>0,'The bank is out of that card.');pay(G,p,{[give]:tradeRate(G,p,give)});take(G,p,get,1);break;}
 case'offer':assert(!G.paired,'Player 2 may trade only with the bank.');validCards(G,a.give);validCards(G,a.want);assert(sum(a.give)>0&&sum(a.want)>0&&Object.keys(a.give).every(r=>!a.want[r]),'Offer different cards on each side.');assert(canPay(G.hands[p],a.give),'You do not have those cards.');G.offer={id:++G.n,from:p,give:{...a.give},want:{...a.want},yes:[],no:[]};break;
 case'confirm':{const o=G.offer;assert(!G.paired&&o?.from===p&&o.yes.includes(a.with),'No accepted trade with that player.');assert(canPay(G.hands[p],o.give)&&canPay(G.hands[a.with],o.want),'The cards are no longer available.');transfer(G,p,a.with,o.give);transfer(G,a.with,p,o.want);G.offer=null;break;}
 case'cancel':G.offer=null;break;
 case'activate':{assert(G.raiders,'Enable Cities & Knights.');const k=G.knights.find(k=>k.pid===p&&k.id===a.id);assert(k&&!k.active,'Choose an inactive knight.');pay(G,p,COST.activate);k.active=true;k.activated=G.turnNo;break;}
 case'promote':assert(G.raiders,'Enable Cities & Knights.');promote(G,p,a.id);break;
 case'improve':assert(G.raiders,'Enable Cities & Knights.');improve(G,p,a.track);drain(G);break;
 case'knightMove':case'chase':{const k=G.knights.find(k=>k.pid===p&&k.id===a.id);assert(k?.active&&k.activated!==G.turnNo,'Activate a knight on an earlier turn first.');if(a.type==='knightMove'){assert(knightDestinations(G,k).length,'No legal destination.');task(G,'knightMove',p,{knight:k.id});}else{assert(G.attacked,'The robber and pirate are protected before the first attack.');const type=a.piece||'robber';assert(['robber','pirate'].includes(type)&&vHexes(k.v).includes(G[type]),'The knight must be beside that piece.');k.active=false;task(G,'robber',p,{only:type});}drain(G);break;}
 case'moveShip':assert(shipDestinations(G,p,a.id).length,'That ship cannot move.');task(G,'moveShip',p,{ship:a.id});drain(G);break;
 case'harbor':assert(G.harbor?.pid===p&&a.with!==p&&G.players.some(x=>x.id===a.with)&&!G.harbor.used.includes(a.with)&&RES.some(r=>G.hands[p][r]>0),'No commercial harbor exchange available.');task(G,'harborGive',p,{to:a.with});drain(G);break;
 case'end':if(G.progress[p].length>4){task(G,'progressDiscard',p);task(G,'_end',p);drain(G);}else{finishTurn(G);G.phase=G.returnPhase;}break;
 default:throw new Error('Unknown action.');
 }
}

export function availableActions(G,p){
 if(G.phase==='gameOver'||G.phase==='setup'||G.queue.length||cur(G)!==p)return[];
 const out=[],add=(label,action,group='actions')=>out.push({label,action,group});
 if(G.phase==='roll')add('Roll dice',{type:'roll'});
 if(G.phase==='act'){
 for(const kind of ['road','settlement','city',...(G.sea?['ship']:[]),...(G.raiders?['knight','wall']:[])])if((kind==='city'?hasCityPiece(G,p):supply(G,p,kind)>0)&&canPay(G.hands[p],COST[kind]))for(const o of legal(G,p,kind))add(kind,{type:'build',kind,...o},'build');
 if(!G.raiders&&G.devDeck.length&&canPay(G.hands[p],COST.development))add('Development card',{type:'development'},'build');
 if(G.raiders){
 for(const track of Object.keys(TRACKS))if(canImprove(G,p,track))add(`${track} → level ${G.improvements[p][track]+1}`,{type:'improve',track},'improvements');
 for(const k of G.knights.filter(k=>k.pid===p)){
 if(!k.active&&canPay(G.hands[p],COST.activate))add(`Activate level ${k.level} knight`,{type:'activate',id:k.id,v:k.v},'knights');
 if(promotable(G,p).includes(k)&&canPay(G.hands[p],COST.promote))add(`Promote level ${k.level} knight`,{type:'promote',id:k.id,v:k.v},'knights');
 if(k.active&&k.activated!==G.turnNo){if(knightDestinations(G,k).length)add(`Move level ${k.level} knight`,{type:'knightMove',id:k.id,v:k.v},'knights');for(const type of ['robber',...(G.sea?['pirate']:[])])if(G.attacked&&vHexes(k.v).includes(G[type]))add(`Chase ${type}`,{type:'chase',id:k.id,piece:type,v:k.v},'knights');}
 }
 }
 for(const s of movableShips(G,p))if(shipDestinations(G,p,s.id).length)add('Move ship',{type:'moveShip',id:s.id,a:s.a,b:s.b},'ships');
 if(G.harbor?.pid===p&&RES.some(r=>G.hands[p][r]))for(const x of G.players)if(x.id!==p&&!G.harbor.used.includes(x.id))add(`Harbor exchange with ${x.name}`,{type:'harbor',with:x.id},'trade');
 add('End turn',{type:'end'});
 }
 return out;
}
export function viewFor(G,p){
 if(G.v!==4)return{legacy:true,gameId:G.gameId,phase:'legacy',players:G.players,result:null};
 const names=G.players.map(x=>({...x,points:points(G,x.id,x.id===p||G.phase==='gameOver'),renown:points(G,x.id,x.id===p||G.phase==='gameOver'),cards:sum(G.hands[x.id]),development:G.dev[x.id].length,progress:G.progress[x.id].length,defence:G.knights.filter(k=>k.pid===x.id&&k.active).reduce((n,k)=>n+k.level,0)}));
 const t=G.queue[0],hand=p&&G.hands[p]?{...G.hands[p]}:null;
 return structuredClone({v:G.v,gameId:G.gameId,seq:G.seq,sea:G.sea,raiders:G.raiders,target:G.target,players:names,me:G.players.findIndex(x=>x.id===p),cur:cur(G),waiting:waitingOn(G),phase:G.phase,turn:G.turn,turnNo:G.turnNo,round:G.round,paired:G.paired,setupStep:G.setupStep,setupLen:G.setupOrder.length,R:G.R,season:0,tiles:G.tiles,ports:G.ports,builds:G.builds,trails:G.trails,ships:G.ships,knights:G.knights,robber:G.robber,pirate:G.pirate,barbarian:G.barbarian,attacked:G.attacked,merchant:G.merchant,improvements:G.improvements,metropolis:G.metropolis,awards:G.awards,routeLengths:G.routeLengths,publicVP:G.publicVP,defenders:G.defenders,bank:G.bank,hand,offer:G.offer||null,dice:G.dice,event:G.event,deck:G.devDeck.length,costs:COST,played:G.played,movedShip:G.movedShip,tradeRates:G.tradeRates,harbor:G.harbor,
 cards:hand?(G.raiders?G.progress[p]:G.dev[p]).map(c=>({... (G.raiders?PROGRESS[c.card]:DEVELOPMENT[c.card]),...c,playable:cardAvailable(G,p,c.id)&&cur(G)===p&&!G.queue.length})):[],
 setup:hand&&G.phase==='setup'&&cur(G)===p?legal(G,p,'setup'):[],actions:hand?availableActions(G,p):[],
 task:t?{id:t.id,kind:t.kind,pid:t.pid,title:TASK_TITLES[t.kind],count:t.count,reason:t.reason,options:t.pid===p?taskOptions(G,t):[]}:null,
 last:G.last,result:G.result});
}
function cornerValue(G,v,p){const have=new Set(own(G,p).flatMap(b=>vHexes(b.v)).map(k=>TERRAIN[G.tiles[k]?.terrain]));return vHexes(v).reduce((n,k)=>{const t=G.tiles[k];return n+(t?.land?pips(t.mark)*(TERRAIN[t.terrain]==='ore'&&G.raiders?1.3:1)+(have.has(TERRAIN[t.terrain])?0:2):0);},0);}
function chooseAuto(G,p){const t=G.queue[0],opts=taskOptions(G,t);if(!opts.length)throw new Error(`No choices for ${t.kind}`);
 let o=opts[0];
 if(['discard','give','harborGive','harborReturn'].includes(t.kind))o=opts.sort((a,b)=>G.hands[p][b.value]-G.hands[p][a.value])[0];
 if(t.kind==='resource')o=opts.filter(x=>x.value!=='skip').sort((a,b)=>G.hands[p][a.value]-G.hands[p][b.value])[0]||o;
 if(t.kind==='progressReward')o=opts.find(x=>x.value==='science')||o;
 if(['freeRoutes','moveShip'].includes(t.kind))o=opts.filter(x=>x.value!=='skip').sort((a,b)=>routeValue(G,p,b)-routeValue(G,p,a))[0]||o;
 if(t.kind==='robber')o=opts.filter(x=>x.piece==='robber').sort((a,b)=>robberValue(G,p,b.k)-robberValue(G,p,a.k))[0]||o;
 if(t.kind==='monopoly')o=opts.sort((a,b)=>G.players.reduce((n,x)=>n+(x.id===p?0:G.hands[x.id][b.value]-G.hands[x.id][a.value]),0))[0];
 if(t.kind==='alchemy')o=opts.sort((a,b)=>productionValue(G,p,b.value)-productionValue(G,p,a.value))[0];
 if(['metropolis','medicine','replacement'].includes(t.kind))o=opts.filter(o=>o.v).sort((a,b)=>cornerValue(G,b.v,p)-cornerValue(G,a.v,p))[0]||o;
 return{type:'choose',value:o.value};
}
function productionValue(G,p,value){const n=sum(value.split(',').map(Number));return own(G,p).flatMap(b=>vHexes(b.v)).filter(k=>G.tiles[k]?.mark===n).length;}
function robberValue(G,p,k){return G.builds.filter(b=>vHexes(b.v).includes(k)).reduce((n,b)=>n+(b.pid===p?-10:1)*(b.kind==='city'?2:1)*pips(G.tiles[k].mark),0);}
function routeValue(G,p,e){if(!e.a)return-100;return Math.max(...ends(e).map(v=>{const spot=u=>onLand(G,u)&&spaced(G,u)?cornerValue(G,u,p):0;return spot(v)+Math.max(0,...vNbrs(v).filter(Boolean).map(spot))*.6;}));}
export function smartAction(G,p){if(!waitingOn(G).includes(p))return null;if(G.queue.length)return chooseAuto(G,p);if(G.phase==='setup'){const opts=legal(G,p,'setup');opts.sort((a,b)=>cornerValue(G,b.v,p)-cornerValue(G,a.v,p)||routeValue(G,p,b)-routeValue(G,p,a));return{type:'place',...opts[0]};}if(G.phase==='roll')return{type:'roll'};return{type:'end'};}
export const autoAction=smartAction;
export function botAction(G,p){if(G.phase!=='act'||G.queue.length||cur(G)!==p)return smartAction(G,p);
 const h=G.hands[p],actions=availableActions(G,p),builds=actions.filter(x=>x.action.type==='build');
 const candidate=kind=>builds.filter(x=>x.action.kind===kind).sort((a,b)=>(b.action.v?cornerValue(G,b.action.v,p):routeValue(G,p,b.action))-(a.action.v?cornerValue(G,a.action.v,p):routeValue(G,p,a.action)))[0]?.action;
 if(G.raiders){const strength=G.knights.filter(k=>k.pid===p&&k.active).reduce((n,k)=>n+k.level,0),cities=own(G,p).filter(b=>b.kind==='city').length;
 if(strength<cities){const a=actions.find(x=>x.action.type==='activate');if(a)return a.action;const k=candidate('knight');if(k)return k;const promote=actions.find(x=>x.action.type==='promote');if(promote)return promote.action;}
 }
 for(const kind of ['settlement','city']){const a=candidate(kind);if(a)return a;}
 const improvement=actions.find(x=>x.action.type==='improve');if(improvement)return improvement.action;
 const cards=(G.raiders?G.progress[p]:G.dev[p]).filter(c=>cardAvailable(G,p,c.id));
 for(const c of cards){try{const copy=structuredClone(G);act(copy,p,{type:'play',id:c.id});return{type:'play',id:c.id};}catch{}}
 if(!legal(G,p,'settlement').length){const choices=['road',...(G.sea?['ship']:[])].map(candidate).filter(Boolean).sort((a,b)=>routeValue(G,p,b)-routeValue(G,p,a));if(choices[0]&&routeValue(G,p,choices[0])>0)return choices[0];}
 const dev=actions.find(x=>x.action.type==='development');if(dev)return dev.action;
 if(G.raiders&&sum(h)>7){const wall=candidate('wall');if(wall)return wall;}
 const goals=[];
 for(const kind of ['settlement','city',...(G.raiders?['knight']:['development']),'road',...(G.sea?['ship']:[])])if(kind==='development'?G.devDeck.length:supply(G,p,kind)>0&&legal(G,p,kind).length)goals.push(COST[kind]);
 if(G.raiders)for(const track in TRACKS)if(G.improvements[p][track]<5&&own(G,p).some(b=>b.kind==='city'))goals.push({[TRACKS[track]]:G.improvements[p][track]+1});
 for(const goal of goals){const missing=Object.keys(goal).filter(r=>h[r]<goal[r]&&G.bank[r]>0);for(const get of missing){const give=(G.raiders?GOODS:RES).filter(r=>r!==get&&h[r]-(goal[r]||0)>=tradeRate(G,p,r)).sort((a,b)=>h[b]-h[a])[0];if(give)return{type:'bank',give,get};}}
 return{type:'end'};
}
