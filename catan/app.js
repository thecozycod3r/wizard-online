import * as E from './engine.js';
import {startTable,esc} from '../shared/kit.js';
import {alerts} from '../shared/alert.js';
import {createWorld} from './world.js';
import {createDice} from './dice.js';
import {rules} from './rules.js';
const ART={wood:'timber',brick:'stone',wool:'flax',wheat:'grain',ore:'copper',coin:'silver'};
const NAME={wood:'Wood',brick:'Brick',wool:'Wool',wheat:'Wheat',ore:'Ore',paper:'Paper',cloth:'Cloth',coin:'Coin'};
const title=s=>s.charAt(0).toUpperCase()+s.slice(1);
const icon=r=>ART[r]?`<img class="ri" src="art/r-${ART[r]}.webp" alt="${NAME[r]}">`:`<span class="commodity" aria-label="${NAME[r]}">${r==='paper'?'▤':'▧'}</span>`;
const cost=c=>Object.entries(c).map(([r,n])=>`${n} ${icon(r)} <span>${NAME[r]}</span>`).join(' + ');
const goodsText=c=>Object.entries(c).map(([r,n])=>`${n} ${NAME[r]}`).join(', ');
const storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const world=createWorld(document.getElementById('world'),{quality:storage.get('catan-quality')||undefined,soundOn:()=>alerts.on,onShip:id=>{const v=T?.V();if(v?.actions.some(o=>o.action.type==='moveShip'&&o.action.id===id))T.room.act({type:'moveShip',id});}});
const dice=createDice(world);
let T, sheet=null, mode=null, gameId=null, taskId=null, setupVertex=null, setupKind='road', robberType='robber', give='wood',get='brick';
let draft={give:{},want:{}};
const demo=E.newGame(['a','b','c'].map(id=>({id,name:id})),{seed:7,sea:true,raiders:true});
while(demo.phase==='setup')E.act(demo,E.cur(demo),E.smartAction(demo,E.cur(demo)));
world.sync(E.viewFor(demo,null),{instant:true});world.home(1);
const me=v=>v.players[v.me]?.id;
const myTurn=v=>v.cur===me(v);
const choosing=v=>v.task?.pid===me(v);
const send=a=>{mode=null;sheet=null;world.arm(null);T.room.act(a);};
T=startTable({
 path:'catan',letter:'C',engine:E,hook:'__tide',title:'Catan',prefix:'catan-v4-',min:E.MIN_PLAYERS,max:E.MAX_PLAYERS,
 defaults:{sea:1,raiders:1,timer:180},timers:[[120,'2 min'],[180,'3 min'],[300,'5 min']],rules,
 eyebrow:'Table Night · Trade, build, settle',
 blurb:'Build settlements and cities, trade resources, and compete for victory points. Play CATAN with Seafarers and Cities & Knights, separately or together. 3–6 players.',
 confetti:['#ffd76a','#7fd3c8','#f3efe2','#e8834a'],
 hero:()=>'<div class="heroart"><img src="art/hero.webp" alt="An island board surrounded by sea"></div>',
 welcomeFan:()=>E.RES.map(r=>icon(r)),preload:['art/hero.webp'],hscroll:'.rail,.resbar,.tabs,.tbl',
 lobby:(L,host,ctx)=>{const s=L.settings,n=L.players.length;return `<div class="row"><span>Seafarers <small class="muted">Heading for New Shores</small></span>${ctx.seg('sea',[[1,'On'],[0,'Off']],+!!s.sea,host)}</div>
 <div class="row"><span>Cities &amp; Knights</span>${ctx.seg('raiders',[[1,'On'],[0,'Off']],+!!s.raiders,host)}</div>
 <p>First to <b>${E.targetFor(s)} victory points</b> during their turn wins.</p><p class="muted">${n>4?'5–6 players: paired turns. Player 2 acts after Player 1 and may trade only with the bank.':'3–4 players: standard turns.'} Cities & Knights follows the supplied rules reference. ${s.sea?'The scenario uses its published main island and small-island layout.':''}</p>`;},
 game,overlay,onAct,onView,afterRender,effect,scores,podium
});
function onView(v,prev){
 if(v.legacy)return;
 if(gameId!==v.gameId){gameId=v.gameId;mode=null;sheet=null;setupVertex=null;taskId=null;world.reset();world.sync(v,{instant:true});world.home(1);world.setMode('game');}
 else world.sync(v);
 if(v.task?.id!==taskId){taskId=v.task?.id;mode=null;sheet=null;robberType=v.task?.options.some(o=>o.piece==='robber')?'robber':'pirate';}
 if(v.setupStep!==prev?.setupStep)setupVertex=null;
 if(v.cur!==prev?.cur){mode=null;sheet=null;}
}
function afterRender(ctx){const v=ctx.V();document.body.dataset.mode=ctx.S.mode;if(ctx.S.mode!=='game'||!v||v.legacy){world.arm(null);return;}armBoard(v);}
function armBoard(v){
 if(v.phase==='setup'&&myTurn(v)){
  if(!setupVertex)return world.arm({kind:'corner',targets:[...new Set(v.setup.map(o=>o.v))].map(v=>({v})),onPick:o=>{setupVertex=o.v;T.render();}});
  let targets=v.setup.filter(o=>o.v===setupVertex&&o.kind===setupKind);
  if(!targets.length){setupKind=setupKind==='road'?'ship':'road';targets=v.setup.filter(o=>o.v===setupVertex&&o.kind===setupKind);}
  return world.arm({kind:'link',targets,onPick:o=>{setupVertex=null;send({type:'place',...o});}});
 }
 if(choosing(v)){
  let options=v.task.options;if(v.task.kind==='robber')options=options.filter(o=>o.piece===robberType);
  if(options.some(o=>o.a)){if(!mode||mode.task!==v.task.id)mode={task:v.task.id,kind:options.find(o=>o.a)?.kind||'road'};const targets=options.filter(o=>o.a&&(!o.kind||o.kind===mode.kind));return world.arm({kind:'link',targets,onPick:o=>send({type:'choose',value:o.value})});}
  if(options.some(o=>o.v))return world.arm({kind:'corner',targets:options.filter(o=>o.v),onPick:o=>send({type:'choose',value:o.value})});
  if(options.some(o=>o.k))return world.arm({kind:'tile',targets:options.filter(o=>o.k),onPick:o=>send({type:'choose',value:o.value})});
 }
 if(mode?.build&&myTurn(v)){
  const targets=v.actions.filter(o=>o.action.type==='build'&&o.action.kind===mode.build).map(o=>o.action);
  return world.arm({kind:['road','ship'].includes(mode.build)?'link':'corner',targets,onPick:send});
 }
 world.arm(null);
}
function rail(v,ctx){return `<div class="rail">${v.players.map((p,i)=>`<div class="pchip ${v.cur===p.id?'turn':''} ${p.id===me(v)?'me':''}" style="--pc:${ctx.SEAT[i]}" data-pid="${p.id}"><span class="av" style="background:${ctx.SEAT[i]}">${esc(p.name[0])}</span><span class="nm">${esc(p.id===me(v)?'You':p.name)}<span class="sub">${p.cards} cards · ${v.raiders?p.defence+' strength':p.development+' development'}</span></span><span class="rv">${p.points}<small>/${v.target}</small></span><span class="tmr" data-tmr="${p.id}"></span></div>`).join('')}</div>`;}
function resources(v){return v.hand?`<div class="resbar">${(v.raiders?E.GOODS:E.RES).map(r=>`<span class="res ${v.hand[r]?'':'zero'}" title="${NAME[r]}" data-r="${r}">${icon(r)}<span class="resource-name">${NAME[r]}</span><b>${v.hand[r]}</b></span>`).join('')}</div>`:'';}
const button=(label,act,attrs='',disabled=false)=>`<button class="btn small" data-act="${act}" ${attrs} ${disabled?'disabled':''}>${label}</button>`;
function game(ctx){const v=ctx.V();if(v.legacy)return `<div class="page"><h1>This is a custom-rules save</h1><p>Start a new Catan table to use the official rules. This saved game has not been changed.</p><a class="btn" href="./">New table</a></div>`;
 const info=`<span class="rnd"><small>ROUND ${v.round}</small>${v.paired?'Player 2':'Player 1'}</span>${v.dice?`<span class="dd"><b title="Red die">${v.dice[0]}</b><b>${v.dice[1]}</b></span>`:''}${v.raiders?`<button class="btn ghost small" data-act="sheet" data-k="cities">⚔ ${v.barbarian}/7 · ${v.event?title(v.event):'Barbarians'}</button>`:''}`;
 return `<div id="table" class="tide">${ctx.topBar(info)}${rail(v,ctx)}<div class="spacer"></div><div class="cam">${button('⌖','home','aria-label="Recentre board"')}</div>${dock(v,ctx)}</div>`;
}
function dock(v,ctx){let status='',controls='';const mine=myTurn(v),name=esc(ctx.nameOf(v.task?.pid||v.cur));
 if(v.phase==='setup'){
  const city=v.raiders&&v.setupStep>=v.players.length;status=mine?(setupVertex?'Choose an adjacent edge':`Place your ${city?'city':'settlement'} on a glowing corner`):`${name} is placing starting pieces`;
  if(mine&&setupVertex){controls=button('Back','back');if(v.sea)controls+=['road','ship'].map(k=>button(title(k),'setupkind',`data-k="${k}" aria-pressed="${setupKind===k}"`,!v.setup.some(o=>o.v===setupVertex&&o.kind===k))).join('');}
 }else if(v.phase==='resolve'){
  status=choosing(v)?`${v.task.title}${v.task.reason?' · '+v.task.reason:''}${v.task.count?' · '+v.task.count+' remaining':''}`:`${name}: ${v.task.title.toLowerCase()}`;
  if(choosing(v)){
   const opts=v.task.options,spatial=opts.some(o=>o.v||o.a||o.k);
   if(v.task.kind==='robber'&&v.sea)controls+=['robber','pirate'].filter(k=>opts.some(o=>o.piece===k)||k==='pirate'&&opts.some(o=>o.value==='pirate:frame')).map(k=>button(title(k),'robbertype',`data-k="${k}" aria-pressed="${robberType===k}"`)).join('');
   const kinds=[...new Set(opts.filter(o=>o.a&&o.kind).map(o=>o.kind))];if(kinds.length>1)controls+=kinds.map(k=>button(title(k),'taskkind',`data-k="${k}"`)).join('');
   if(spatial){status+=' · tap a glowing spot';controls+=opts.filter(o=>!o.v&&!o.a&&!o.k).map(o=>button(esc(o.label),'choose',`data-value="${esc(o.value)}"`)).join('');controls+=button('List choices','sheet','data-k="choices"');}
   else controls+=`<div class="choice-buttons">${opts.map(o=>button(esc(o.label),'choose',`data-value="${esc(o.value)}"`)).join('')}</div>`;
  }
 }else if(v.phase==='roll'){
  status=mine?'Your turn — roll the dice':`${name} is rolling`;
  if(mine)controls=button('🎲 Roll','roll')+button(v.raiders?'Progress cards':'Development cards','sheet','data-k="cards"');
 }else if(v.phase==='act'){
  status=mine?(mode?.build?`Place ${mode.build}: tap a glowing ${['road','ship'].includes(mode.build)?'edge':'corner'}`:'Build, trade, or play cards — then end your turn'):`${name} is building and trading`;
  if(mine)controls=mode?.build?button('Cancel','back'):[button('Build','sheet','data-k="build"'),button('Bank','sheet','data-k="bank"'),...(!v.paired?[button('Trade','sheet','data-k="trade"')]:[]),button(v.raiders?'Progress':'Cards','sheet','data-k="cards"'),...(v.raiders?[button('Cities & Knights','sheet','data-k="cities"')]:[]),...(v.sea?[button('Move ship','sheet','data-k="ships"')]:[]),button('End turn →','end')].join('');
 }else if(v.phase==='gameOver'){status=v.result.winners.includes(me(v))?'You win!':`${esc(ctx.nameOf(v.result.winners[0]))} wins`;controls=button('Results','over');}
 const offer=v.offer&&v.offer.from!==me(v)&&v.hand?`<div class="offer"><span>${esc(ctx.nameOf(v.offer.from))} offers ${goodsText(v.offer.give)} for ${goodsText(v.offer.want)}</span>${button(v.offer.yes.includes(me(v))?'Accepted':'Accept','accept','',!E.canPay(v.hand,v.offer.want)||v.offer.yes.includes(me(v)))}${button('Decline','decline')}</div>`:'';
 return `<div class="dock ${mine||choosing(v)?'mine':''}">${offer}<div class="dockhead"><span class="status">${status}</span></div>${resources(v)}<div class="actions">${controls}</div></div>`;
}
function overlay(ctx){const v=ctx.V();if(!sheet||!v||v.legacy)return'';const p=me(v),act=v.phase==='act'&&myTurn(v),wrap=(name,html)=>ctx.sheet(name,`<div class="sheetbody">${html}</div>`);
 if(sheet==='choices')return wrap(v.task.title,`<div class="blist">${v.task.options.map(o=>button(esc(o.label),'choose',`data-value="${esc(o.value)}"`)).join('')}</div>`);
 if(sheet==='build')return wrap('Build',`<div class="blist">${['road','settlement','city',...(v.sea?['ship']:[]),...(v.raiders?['knight','wall']:['development'])].map(k=>{
 const enabled=act&&v.actions.some(o=>k==='development'?o.action.type===k:o.action.type==='build'&&o.action.kind===k);const left=k==='development'?v.deck:E.supply(v,p,k);
 return `<button class="bitem" data-act="build" data-k="${k}" ${enabled?'':'disabled'}><span class="bn">${title(k)} <small>${k==='city'&&v.builds.some(b=>b.pid===p&&b.displacedCity)?'Rebuild destroyed city first':`${left} left`}</small></span><span class="bc">${cost(E.COST[k])}</span><span class="bd">${{road:'Land edge · connects settlements',ship:'Sea or coastal edge · connects shipping routes',settlement:'1 VP · follows the distance rule',city:'2 VP · replaces your settlement',knight:'Basic knight · starts inactive',wall:'Protects two extra cards on a 7',development:'Draw one hidden development card'}[k]}</span></button>`;
 }).join('')}</div>`);
 if(sheet==='cards')return wrap(v.raiders?'Progress cards':'Development cards',`<p>${v.raiders?'Play any number during the Action phase. Alchemist is played before rolling. Keep at most four at turn end.':'Play one card per turn, including before rolling. Newly bought cards wait until your next turn. Victory points remain hidden until you win.'}</p><div class="clist">${v.cards.map(c=>`<div class="ccard"><div><b>${esc(c.name)}</b><p>${esc(c.text)}</p>${button(c.card==='vp'?'Hidden victory point':'Play','play',`data-id="${c.id}"`,!c.playable)}</div></div>`).join('')||'<p>No cards yet.</p>'}</div>`);
 if(sheet==='bank'){
 const goods=v.raiders?E.GOODS:E.RES,rate=E.tradeRate(v,p,give);return wrap('Trade with the bank',`<p>Ports, the merchant, and city improvements determine your exchange rate.</p><label>Give <select id="bank-give">${goods.map(r=>`<option value="${r}" ${r===give?'selected':''}>${NAME[r]} (${v.hand[r]} held)</option>`).join('')}</select></label><label>Receive <select id="bank-get">${goods.map(r=>`<option value="${r}" ${r===get?'selected':''}>${NAME[r]} (${v.bank[r]} in bank)</option>`).join('')}</select></label><p>${rate} ${NAME[give]} → 1 ${NAME[get]}</p>${button('Exchange','bank','',!act||give===get||v.hand[give]<rate||!v.bank[get])}<div class="bank-stock">${goods.map(r=>`<span>${icon(r)} ${v.bank[r]}</span>`).join('')}</div>`);
 }
 if(sheet==='trade'){
 if(v.offer?.from===p)return wrap('Your offer',`<p>Give ${goodsText(v.offer.give)} for ${goodsText(v.offer.want)}.</p>${v.players.filter(x=>x.id!==p).map(x=>`<div class="tr">${esc(x.name)} ${v.offer.yes.includes(x.id)?button('Trade','confirm',`data-pid="${x.id}"`):v.offer.no.includes(x.id)?'Declined':'Waiting'}</div>`).join('')}${button('Withdraw','cancel')}`);
 const step=(s,r)=>`<span class="step">${button('−','step',`data-side="${s}" data-r="${r}" data-d="-1"`)}<b>${draft[s][r]||0}</b>${button('+','step',`data-side="${s}" data-r="${r}" data-d="1"`,s==='give'&&(draft.give[r]||0)>=v.hand[r])}</span>`;
 return wrap('Offer a trade',`<div class="tgrid"><span>Resource</span><b>Give</b><b>Want</b>${(v.raiders?E.GOODS:E.RES).map(r=>`<span>${icon(r)} ${NAME[r]}</span>${step('give',r)}${step('want',r)}`).join('')}</div>${button('Offer to table','offer','',!act||!Object.keys(draft.give).length||!Object.keys(draft.want).length)}${v.actions.filter(o=>o.action.type==='harbor').map(o=>button(esc(o.label),'action',`data-action="${esc(JSON.stringify(o.action))}"`)).join('')}`);
 }
 if(sheet==='cities'){
 const cities=v.builds.filter(b=>b.kind==='city').length,defence=v.players.reduce((n,p)=>n+p.defence,0);
 return wrap('Cities & Knights',`<p>Barbarians: <b>${v.barbarian}/7</b> steps. Strength <b>${cities}</b> · active knights <b>${defence}</b>. ${v.attacked?'The robber and pirate are active.':'The robber and pirate stay inactive until the first attack.'}</p><div class="meter"><i style="width:${v.barbarian/7*100}%"></i><span>${7-v.barbarian} barbarian rolls to attack</span></div><h3>City improvements</h3>${Object.entries(E.TRACKS).map(([track,r])=>{
 const level=v.improvements[p][track],available=v.actions.find(o=>o.action.type==='improve'&&o.action.track===track);return `<div class="tr"><span>${title(track)} · ${level}/5<br><small>${{science:'Level 3: Aqueduct',trade:'Level 3: commodities trade 2:1',politics:'Level 3: mighty knights'}[track]}</small></span>${button(level===5?'Complete':`${level+1} ${NAME[r]} → level ${level+1}`,'improve',`data-track="${track}"`,!available)}</div>`;
 }).join('')}<h3>Your knights</h3>${v.knights.filter(k=>k.pid===p).map(k=>`<div class="knight-row"><b>Level ${k.level} · ${k.active?'Active':'Inactive'}</b>${v.actions.filter(o=>o.group==='knights'&&o.action.id===k.id).map(o=>button(esc(o.label),'action',`data-action="${esc(JSON.stringify(o.action))}"`)).join('')}${button('Locate','locate',`data-v="${k.v}"`)}</div>`).join('')||'<p>Build a knight on an empty intersection connected to your route.</p>'}`);
 }
 if(sheet==='ships')return wrap('Move a ship',`<p>Once per turn, relocate one eligible open ship. New ships and pirate-blocked ships cannot move.</p>${v.actions.filter(o=>o.group==='ships').map(o=>button(`${o.action.a} / ${o.action.b}`,'action',`data-action="${esc(JSON.stringify(o.action))}"`)).join('')||'<p>No eligible ships to move.</p>'}`);
 return'';
}
function onAct(a,el,ctx,e){const v=ctx.V();switch(a){
 case'close':case'closebg':if(sheet){if(a==='closebg'&&e.target!==el)return true;sheet=null;ctx.render();return true;}return undefined;
 case'home':world.home();return true;
 case'back':mode=null;setupVertex=null;ctx.render();return true;
 case'setupkind':setupKind=el.dataset.k;ctx.render();return true;
 case'robbertype':robberType=el.dataset.k;ctx.render();return true;
 case'taskkind':mode={task:v.task.id,kind:el.dataset.k};ctx.render();return true;
 case'sheet':sheet=el.dataset.k;mode=null;ctx.render();return true;
 case'build':sheet=null;if(el.dataset.k==='development')send({type:'development'});else{mode={build:el.dataset.k};ctx.render();}return true;
 case'roll':case'end':case'cancel':send({type:a});return true;
 case'choose':send({type:'choose',value:el.dataset.value});return true;
 case'play':send({type:'play',id:+el.dataset.id});return true;
 case'improve':send({type:'improve',track:el.dataset.track});return true;
 case'action':send(JSON.parse(el.dataset.action));return true;
 case'locate':sheet=null;world.focus(el.dataset.v,7);ctx.render();return true;
 case'bank':T.room.act({type:'bank',give,get});return true;
 case'step':{const s=el.dataset.side,r=el.dataset.r,n=Math.max(0,Math.min(99,(draft[s][r]||0)+ +el.dataset.d));if(n)draft[s][r]=n;else delete draft[s][r];ctx.render();return true;}
 case'offer':T.room.act({type:'offer',...draft});draft={give:{},want:{}};return true;
 case'confirm':send({type:'confirm',with:el.dataset.pid});return true;
 case'accept':case'decline':T.room.act({type:a,offer:v.offer.id});return true;
 default:return undefined;
}}
document.addEventListener('change',e=>{if(e.target.id==='bank-give'){give=e.target.value;T.render();}if(e.target.id==='bank-get'){get=e.target.value;T.render();}});
function effect(last,v,prev,ctx){if(last.kind==='roll'&&last.dice)dice.roll(last.dice).catch(()=>{});if(last.barbarian)ctx.toast(last.barbarian.won?'Catan is defended.':'Barbarians win — weakest defenders must downgrade a city.');if(last.kind==='build')world.sfx('thunk');}
function scores(ctx){const v=ctx.V();return `<div class="tbl"><table><tr><th>Player</th><th>Buildings</th><th>Longest route</th><th>Victory points</th></tr>${v.players.map(p=>`<tr><td>${esc(p.name)}</td><td>${v.builds.filter(b=>b.pid===p.id).length}</td><td>${v.routeLengths[p.id]||0}${v.awards.route===p.id?' +2 VP':''}</td><td>${p.points}</td></tr>`).join('')}</table></div><p>First to ${v.target} on their own turn wins. Opponents’ development victory points stay hidden until game end.</p>`;}
function podium(ctx){return scores(ctx);}
window.__tideW=world;window.__tideT=T;
