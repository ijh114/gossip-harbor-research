import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createMoreTutorials,moreTutorialEvent,moreTutorialView,validMoreTutorials} from '../src/tutorial-more.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/tutorial-more.json',import.meta.url),'utf8'));
const previous=JSON.parse(await readFile(new URL('../src/data/tutorial-extension.json',import.meta.url),'utf8'));
const by=Object.fromEntries(c.guides.map(g=>[g.executer,g]));
const context=key=>structuredClone(by[key].researchExample);
const act=(s,key,event,ctx=context(key))=>moreTutorialEvent(s,{guideId:by[key].id,...event},ctx,c);
const fresh=()=>createMoreTutorials(c);
test('five additional executers have source identities and do not duplicate the previous five guide projections',()=>{
 const d=structuredClone(c);delete d.revision;assert.equal(createHash('sha256').update(JSON.stringify(d)).digest('hex'),c.revision);assert.equal(c.guides.length,5);
 for(const g of c.guides){assert.equal(previous.guides.some(x=>x.id===g.id),false);assert.equal(g.researchExample.mode,'research');assert.ok(g.fields.length);assert.ok(g.eventCatalog.length);for(const source of g.sources){assert.match(source.path,/^analysis\//);assert.match(source.sha256,/^[a-f0-9]{64}$/);}}
 assert.equal(validMoreTutorials(fresh(),c),true);
});
test('missing mode and required context snapshots are atomic unknown failures for the five selected start events',()=>{
 for(const g of c.guides){const s=fresh(),before=structuredClone(s),event={guideId:g.id,...g.eventCatalog[0].event};
  assert.equal(moreTutorialEvent(s,event,{},c).status,'unknown');assert.deepEqual(s,before);
  assert.equal(moreTutorialEvent(s,event,{mode:'research'},c).status,'unknown');assert.deepEqual(s,before);
 }
});
test('eightfold boost begins after its exact start-window close and registers only at one of three finish callbacks',()=>{
 const key='EnergyBoostEight';
 for(const event of [{type:'mask-click'},{type:'energy-mode-changed'},{type:'view-opened',name:'EnergyBoostSettingWindow'}]){
  const s=fresh(),ctx=context(key);assert.equal(act(s,key,{type:'view-closed',name:'other'},ctx).status,'ignored');
  act(s,key,{type:'view-closed',name:'EnergyBoostEightStartWindow'},ctx);assert.equal(s.active.phase,'boost-highlight');assert.equal(s.active.strong,true);assert.equal(s.active.registered,false);assert.deepEqual(s.registeredFinished,[]);
  assert.equal(act(s,key,event,ctx).status,'completed');assert.equal(s.registeredFinished.length,1);assert.equal(s.completed.length,1);
 }
});
test('eightfold boost restoration finishes ongoing1 without a HUD and no extra server level gate is invented',()=>{
 const key='EnergyBoostEight';let s=fresh();assert.equal(act(s,key,{type:'executer-started'},{mode:'research',persistedOngoingData:'1'}).status,'completed');
 s=fresh();assert.equal(act(s,key,{type:'executer-started'},{mode:'research',persistedOngoingData:''}).status,'ignored');const ctx={...context(key),energyBoostLevel:0};act(s,key,{type:'view-closed',name:'EnergyBoostEightStartWindow'},ctx);assert.equal(s.active.registered,false);assert.equal(act(s,key,{type:'executer-started'},ctx).status,'completed');
});
test('weekly star guide early finish paths preserve empty-window and other-strong semantics without showing a fake step',()=>{
 const key='WeeklyActiveQuestBonusStar';let s=fresh();assert.equal(act(s,key,{type:'weekly-bonus-star-collected'},{mode:'research',openViews:[]}).status,'completed');assert.equal(s.history.some(x=>x.kind==='phase'),false);
 s=fresh();assert.equal(act(s,key,{type:'weekly-bonus-star-collected'},{...context(key),otherStrong:true}).status,'completed');
 s=fresh();const ctx={...context(key),openViews:[...c.weeklyWindows]};const before=structuredClone(s);assert.equal(act(s,key,{type:'weekly-bonus-star-collected'},ctx).status,'unknown');assert.deepEqual(s,before);ctx.weeklySelectedWindow=c.weeklyWindows[1];assert.equal(act(s,key,{type:'weekly-bonus-star-collected'},ctx).status,'started');assert.equal(s.active.snapshot.window,c.weeklyWindows[1]);
});
test('weekly star0.6s callback does not recheck strong state and any activity state event can finish it',()=>{
 const key='WeeklyActiveQuestBonusStar',s=fresh(),ctx=context(key);act(s,key,{type:'weekly-bonus-star-collected'},ctx);assert.equal(s.active.registered,true);assert.equal(s.completed.length,0);
 assert.equal(act(s,key,{type:'clock',now:.59},ctx).status,'waiting');ctx.otherStrong=true;assert.equal(act(s,key,{type:'clock',now:.6},ctx).status,'advanced');assert.equal(s.active.phase,'star-area');assert.equal(act(s,key,{type:'weekly-state-changed',state:'Started'},ctx).status,'completed');
 const t=fresh(),gone=context(key);act(t,key,{type:'weekly-bonus-star-collected'},gone);gone.openViews=[];const before=structuredClone(t);assert.equal(act(t,key,{type:'clock',now:.6},gone).status,'blocked');assert.deepEqual(t,before);
});
test('bonus task does not guess which active pass won pairs order or convert the no-active Assert into completion',()=>{
 const key='PassActivityBonusTask';let s=fresh(),ctx=context(key);ctx.passActivities.forEach(x=>x.state='Released');assert.equal(act(s,key,{type:'pass-bonus-cell-created'},ctx).status,'blocked');assert.equal(s.completed.length,0);
 s=fresh();ctx=context(key);ctx.passActivities[1].state='Started';const before=structuredClone(s);assert.equal(act(s,key,{type:'pass-bonus-cell-created'},ctx).status,'unknown');assert.deepEqual(s,before);ctx.selectedPassActivity='WitchlingPass';assert.equal(act(s,key,{type:'pass-bonus-cell-created'},ctx).status,'started');assert.equal(s.active.snapshot.activityType,'WitchlingPass');
});
test('bonus task missed delayed checks keep the guide unfinished and allow a new cell event to retry',()=>{
 const key='PassActivityBonusTask',s=fresh(),ctx=context(key);act(s,key,{type:'pass-bonus-cell-created'},ctx);assert.equal(s.active.registered,false);assert.equal(s.active.strong,false);
 ctx.bonusTaskCellAlive=false;delete ctx.otherStrong;assert.equal(act(s,key,{type:'clock',now:1.5},ctx).status,'waiting');assert.equal(s.active.phase,'waiting-cell');assert.equal(s.completed.length,0);assert.equal(s.registeredFinished.length,0);
 ctx.bonusTaskCellAlive=true;ctx.otherStrong=true;act(s,key,{type:'pass-bonus-cell-created',now:2},ctx);act(s,key,{type:'clock',now:3.5},ctx);assert.equal(s.active.phase,'waiting-cell');
 ctx.otherStrong=false;act(s,key,{type:'pass-bonus-cell-created',now:4},ctx);assert.equal(act(s,key,{type:'clock',now:5.5},ctx).status,'advanced');assert.equal(s.active.phase,'bonus-dialog');assert.equal(s.active.strong,true);assert.equal(s.active.registered,false);
 assert.equal(act(s,key,{type:'mask-click'},ctx).status,'completed');assert.equal(s.registeredFinished.length,1);assert.equal(s.completed.length,1);
});
test('bonus task selected-model Ended/Released may finish during delay; Started is ignored',()=>{
 const key='PassActivityBonusTask';for(const state of ['Ended','Released']){const s=fresh(),ctx=context(key);act(s,key,{type:'pass-bonus-cell-created'},ctx);assert.equal(act(s,key,{type:'pass-state-changed',selectedState:'Started'},ctx).status,'ignored');assert.equal(s.completed.length,0);assert.equal(act(s,key,{type:'pass-state-changed',selectedState:state},ctx).status,'completed');assert.equal(s.registeredFinished.length,1);}
});
test('extra reward entry requires a running model and WholeMask alone cannot advance its task-button phase',()=>{
 const key='TaskExtraReward',s=fresh();assert.equal(act(s,key,{type:'extra-reward-start'},{mode:'research',extraRewardModelExists:false}).status,'ignored');assert.equal(s.registeredFinished.length,0);
 const ctx=context(key);act(s,key,{type:'extra-reward-start'},ctx);assert.equal(s.active.phase,'task-button');assert.equal(s.registeredFinished.length,1);assert.equal(act(s,key,{type:'mask-click'},ctx).status,'ignored');assert.equal(s.active.phase,'task-button');
 ctx.openViews=[];assert.equal(act(s,key,{type:'view-opened',name:'TaskWindow'},ctx).status,'completed');
});
test('extra reward chest uses1s delay, source mask geometry and nil-transform finish',()=>{
 const key='TaskExtraReward';let s=fresh(),ctx=context(key);act(s,key,{type:'extra-reward-start'},ctx);act(s,key,{type:'view-opened',name:'TaskWindow'},ctx);assert.equal(s.active.phase,'chest-delay');
 const missing={...ctx};delete missing.extraChestAvailable;const before=structuredClone(s);assert.equal(act(s,key,{type:'clock',now:1},missing).status,'unknown');assert.deepEqual(s,before);
 act(s,key,{type:'clock',now:1},ctx);assert.deepEqual(s.active.target,{area:'extra-chest',maskOffset:[0,82,0],maskSizeAdd:[20,20]});assert.equal(act(s,key,{type:'mask-click'},ctx).status,'completed');
 s=fresh();ctx=context(key);act(s,key,{type:'extra-reward-start'},ctx);act(s,key,{type:'view-opened',name:'TaskWindow'},ctx);ctx.extraChestAvailable=false;assert.equal(act(s,key,{type:'clock',now:1},ctx).status,'completed');
});
test('extra reward model absence after activation finishes without requiring a running query from a missing model',()=>{
 const key='TaskExtraReward',s=fresh(),ctx=context(key);act(s,key,{type:'extra-reward-start'},ctx);assert.equal(act(s,key,{type:'extra-state-changed',modelExists:false},ctx).status,'completed');
});
test('generator boost preserves two short-circuit CanActiveSpread queries and post-registration window disappearance',()=>{
 const key='GeneratorBoostActive';let s=fresh();assert.equal(act(s,key,{type:'generator-buff-animation-ended'},{mode:'research',openViews:[]}).status,'ignored');
 assert.equal(act(s,key,{type:'generator-buff-animation-ended'},{mode:'research',openViews:[c.generatorWindow],canActiveSpreadFirst:false}).status,'ignored');
 const before=structuredClone(s);assert.equal(act(s,key,{type:'generator-buff-animation-ended'},{mode:'research',openViews:[c.generatorWindow],canActiveSpreadFirst:true}).status,'unknown');assert.deepEqual(s,before);
 s=fresh();const ctx={...context(key),boostWindowAfterStartAvailable:false};assert.equal(act(s,key,{type:'generator-buff-animation-ended'},ctx).status,'completed');assert.equal(s.registeredFinished.length,1);
});
test('generator boost Ended is not its source exit state; Started/Released or its two mask steps do finish',()=>{
 const key='GeneratorBoostActive';for(const state of ['Started','Released']){const s=fresh(),ctx=context(key);act(s,key,{type:'generator-buff-animation-ended'},ctx);assert.equal(act(s,key,{type:'generator-state-changed',state:'Ended'},ctx).status,'ignored');assert.equal(s.completed.length,0);assert.equal(act(s,key,{type:'generator-state-changed',state},ctx).status,'completed');}
 const s=fresh(),ctx=context(key);act(s,key,{type:'generator-buff-animation-ended'},ctx);act(s,key,{type:'mask-click'},ctx);assert.equal(s.active.phase,'close-area');assert.equal(act(s,key,{type:'mask-click'},ctx).status,'completed');
});
test('additional guide state rejects backwards time and malformed saves and never mutates old guides or the main wallet',()=>{
 const key='TaskExtraReward',s=fresh(),ctx=context(key),external={wallet:{coins:34,gems:200},onboarding:{registeredFinished:['tutorial_3'],completed:[]}},externalBefore=structuredClone(external),ctxBefore=structuredClone(ctx);
 act(s,key,{type:'extra-reward-start',now:5},ctx);const before=structuredClone(s);assert.equal(act(s,key,{type:'clock',now:4},ctx).status,'blocked');assert.deepEqual(s,before);assert.equal(act(s,'EnergyBoostEight',{type:'view-closed',name:'EnergyBoostEightStartWindow',now:5}).status,'blocked');assert.deepEqual(s,before);
 act(s,key,{type:'reset'},ctx);assert.deepEqual(s.registeredFinished,[]);assert.deepEqual(s.completed,[]);assert.deepEqual(ctx,ctxBefore);assert.deepEqual(external,externalBefore);assert.equal(moreTutorialView(s,ctx,c).valid,true);assert.equal(validMoreTutorials(s,c),true);
 const bad=structuredClone(s);bad.completed.push(by[key].id);assert.equal(validMoreTutorials(bad,c),false);assert.equal(moreTutorialEvent(bad,{type:'reset',guideId:by[key].id},ctx,c).status,'blocked');
});
