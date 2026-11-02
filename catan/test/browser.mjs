import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:8766/catan/';
const browser=await chromium.launch({headless:true});
for(const viewport of [{width:1200,height:850},{width:390,height:844}]){
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?lite');await page.waitForFunction(()=>window.__tide?.E);
 await page.evaluate(()=>{
  const T=__tide,E=T.E,W=__tideW;window.qaGame=E.newGame(['a','b','c'].map(id=>({id,name:'Player '+id})),{seed:19,sea:true,raiders:true});
  window.qaRender=()=>{const G=window.qaGame,prev=T.S.view;const p=E.waitingOn(G)[0]||G.players[0].id;T.S.me=p;T.S.mode='game';T.S.lobby={players:G.players,settings:{sea:1,raiders:1}};T.S.view=E.viewFor(G,p);T.cfg.onView(T.S.view,prev);T.render();W.controls.target.set(0,-0.4,-1.5);W.camera.position.set(0,innerWidth<600?28:18,innerWidth<600?15:9);W.controls.update();W.renderOnce();};
  T.room.act=a=>{try{E.act(qaGame,T.S.me,a);window.qaLast=a;qaRender();}catch(e){window.qaError=e.message;throw e;}};qaRender();
 });
 async function tap(){await page.evaluate(()=>__tideW.renderOnce());const target=await page.evaluate(()=>__tideW.targetsOnScreen().filter(t=>document.elementFromPoint(t.x,t.y)?.tagName==='CANVAS').sort((a,b)=>Math.abs(a.x-innerWidth/2)+Math.abs(a.y-innerHeight*.4)-Math.abs(b.x-innerWidth/2)-Math.abs(b.y-innerHeight*.4))[0]);assert.ok(target,'No clickable board target');await page.mouse.click(target.x,target.y);await page.waitForTimeout(80);return target;}
 for(let i=0;i<6;i++){assert.equal(await page.evaluate(()=>qaGame.phase),'setup');await tap();await tap();}
 assert.equal(await page.evaluate(()=>qaGame.phase),'roll');
 await page.evaluate(()=>{qaGame.phase='act';qaGame.returnPhase='act';for(const r of __tide.E.GOODS){const n=Math.min(6,qaGame.bank[r]);qaGame.bank[r]-=n;qaGame.hands[__tide.E.cur(qaGame)][r]+=n;}qaRender();});
 await page.locator('[data-act=sheet][data-k=build]').click();await page.locator('[data-act=build][data-k=city]').click();await tap();
 assert.equal(await page.evaluate(()=>qaLast.kind),'city');
 await page.locator('[data-act=sheet][data-k=build]').click();await page.locator('[data-act=build][data-k=knight]').click();await tap();
 await page.locator('[data-act=sheet][data-k=cities]').last().click();await page.getByRole('button',{name:'Activate level 1 knight'}).click();
 assert.equal(await page.evaluate(()=>qaGame.knights[0].active),true);
 await page.evaluate(()=>{const G=qaGame,p=__tide.E.cur(G);const deck=G.progressDecks.trade;deck.splice(deck.indexOf('merchantFleet'),1);G.progress[p].push({id:++G.n,card:'merchantFleet'});qaRender();});
 await page.locator('[data-act=sheet][data-k=cards]').click();await page.getByRole('button',{name:'Play',exact:true}).click();await page.locator('[data-act=choose][data-value=wood]').click();assert.ok(await page.evaluate(()=>qaGame.tradeRates.includes('wood')));
 await page.locator('[data-act=sheet][data-k=bank]').click();await page.locator('#bank-give').selectOption('wood');await page.locator('#bank-get').selectOption('ore');await page.getByRole('button',{name:'Exchange',exact:true}).click();assert.equal(await page.evaluate(()=>qaLast.type),'bank');await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.evaluate(()=>{const G=qaGame,E=__tide.E,p=E.cur(G),o=E.legal(G,p,'setup').find(o=>o.kind==='ship');G.builds.push({pid:p,v:o.v,kind:'settlement',wall:false});qaRender();});
 await page.locator('[data-act=sheet][data-k=build]').click();await page.locator('[data-act=build][data-k=ship]').click();await tap();assert.equal(await page.evaluate(()=>qaLast.kind),'ship');
 const geometry=await page.evaluate(()=>{const W=__tideW,E=__tide.E,G=qaGame;W.reset();W.sync(E.viewFor(G,E.cur(G)),{instant:true});W.renderOnce();const houses=[],ships=[],knights=[];W.scene.traverse(o=>{if(o.userData.vertex&&o.userData.pid)houses.push(o);if(o.userData.shipId)ships.push(o);if(o.userData.knightId)knights.push(o);});return{houses:houses.length,expectedHouses:G.builds.length,knights:knights.length,ships:ships.length,misplaced:G.builds.filter(b=>{const[x,z]=E.vXY(b.v);return !houses.some(o=>o.userData.pid===b.pid&&Math.hypot(o.position.x-x,o.position.z-z)<1e-8);}).length,misplacedShips:G.ships.filter(s=>{const[a,b]=E.sideEnds(s.a,s.b).map(E.vXY);return !ships.some(o=>o.userData.shipId===s.id&&Math.hypot(o.position.x-(a[0]+b[0])/2,o.position.z-(a[1]+b[1])/2)<1e-8);}).length};});
 assert.equal(geometry.houses,geometry.expectedHouses);assert.equal(geometry.misplaced,0);assert.equal(geometry.misplacedShips,0);assert.equal(geometry.knights,1);assert.ok(geometry.ships>=1);assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`/tmp/catan-v4-${viewport.width}.png`});console.log({viewport,...geometry,errors});await page.close();
}
await browser.close();
