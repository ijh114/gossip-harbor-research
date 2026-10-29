import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createPlay} from '../src/play-model.mjs';
import {createTutorialRuntime,validTutorialRuntime,buildTutorialRuntimeContext,tutorialRuntimeEvent,tutorialRuntimeView,tutorialRuntimePermission,tutorialRuntimePermissionFromView,restoreTutorialRuntime} from '../src/tutorial-runtime.mjs';
import {renderTutorialRuntimePanel} from '../src/tutorial-runtime-page.mjs';
const read=async n=>JSON.parse(await readFile(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const [playConfig,base,more,catalog,factory]=await Promise.all(['play-config','tutorial-extension','tutorial-more','tutorial-catalog','factory-play'].map(read));
const full={playConfig,tutorialConfig:base,tutorialMoreConfig:more,tutorialCatalogConfig:catalog,factoryConfig:factory};
const subset=ids=>({tutorialCatalogConfig:{...catalog,guides:catalog.guides.filter(g=>ids.includes(g.id))}});
const basic=()=>({mode:'research',otherStrong:false,registeredTutorials:[],finishedTutorials:[],openViews:[],activities:{}});
const send=(s,event,ctx,data)=>{const before=JSON.stringify(ctx),r=tutorialRuntimeEvent(s,event,ctx,data);assert.equal(JSON.stringify(ctx),before,'Context is read-only');assert.equal(r.ok,true,r.status+': '+r.message+' '+(r.diagnostic||''));return r;};
test('actual context binds only implemented web state and preserves main wallet, board and random state',()=>{
 const main=createPlay(playConfig,{scenario:'initial',guide:true});main.stage='play';main.wallet.level=3;const before=structuredClone(main),ui={presentation:'board',skin:'game',storyRecapOpen:null,storyUnlockedBooks:[],manualGuideId:'tutorial_story_recap'},ctx=buildTutorialRuntimeContext(main,full,ui);
 assert.equal(ctx.level,3);assert.equal(ctx.functionEnabled.inventory,true);assert.equal(ctx.functionEnabled.shop,true);assert.equal(ctx.functionEnabled.bubble,false);assert.equal(Object.hasOwn(ctx.activities,'BakeOut'),false);assert.equal(ctx.generatorFactoryOpen,null);assert.equal(ctx.storyRecapOpen,null);assert.deepEqual(ctx.storyUnlockedBooks,[]);assert.equal(ctx.manualGuideId,'tutorial_story_recap');assert.deepEqual(main,before);
 const activities=buildTutorialRuntimeContext(main,full,{skin:'activities'});assert.equal(activities.gameMode,null);assert.equal(activities.mainBoardViewAvailable,false);
});
test('initial 97-guide coordination never applies research examples or mutates main resources and skips an unchanged reconciliation',()=>{
 const main=createPlay(playConfig,{scenario:'initial',guide:true});main.stage='play';const before=structuredClone(main),ctx=buildTutorialRuntimeContext(main,full,{presentation:'board'}),s=createTutorialRuntime(full);
 send(s,{type:'reconcile',now:0},ctx,full);assert.equal(tutorialRuntimeView(s,ctx,full).rows.length,97);assert.deepEqual(s.overrides,{});assert.deepEqual(s.completed,[]);assert.ok(Object.keys(s.entries).length>0);assert.ok(tutorialRuntimeView(s,ctx,full).unknown.includes('activities.BakeOut'));assert.equal(send(s,{type:'reconcile',now:0},ctx,full).status,'unchanged');assert.deepEqual(main,before);
});
test('real FloatRace masks complete in source order and only final Finish starts its registered predecessor-dependent guide',()=>{
 const ids=['tutorial_floatrace_start','tutorial_floatrace_entry'],data=subset(ids),ctx={...basic(),openViews:['FloatRaceMainWindow'],activities:{FloatRace:{state:'Started',id:'explicit-research'}}},s=createTutorialRuntime(data);
 send(s,{type:'reconcile',now:0},ctx,data);send(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'FloatRaceMainWindow'},now:0,eventId:'open'},ctx,data);assert.equal(s.registered.includes(ids[0]),true);assert.equal(s.completed.length,0);assert.equal(s.entries[ids[1]],undefined);
 send(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'OtherWindow'},now:0,eventId:'other'},ctx,data);assert.equal(s.entries[ids[1]],undefined,'early Finished registration alone is not global Finish');
 for(let i=0;i<2;i++)send(s,{type:'mask-click',guideId:ids[0],callbackId:s.entries[ids[0]].state.mask.id,now:0,eventId:'mask'+i},ctx,data);
 assert.deepEqual(s.completed,[ids[0]]);assert.ok(s.entries[ids[1]]);const kinds=s.history.filter(h=>h.id===ids[0]).map(h=>h.kind);assert.deepEqual(kinds.slice(-4),['OnRemove','SetTutorialFinished','TryToStartTutorials','TutorialFinished']);
});
test('a weak source BakeOut guide finishes instead of waiting when another real strong guide exists',()=>{
 const data=subset(['tutorial_bakeout_1']),ctx={...basic(),otherStrong:true,openViews:['BakeOutMainWindow'],activities:{BakeOut:{state:'Started',id:'bake',bakeOutModeOn:true}}},s=createTutorialRuntime(data);
 send(s,{type:'reconcile',now:0},ctx,data);send(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'BakeOutMainWindow'},now:0},ctx,data);assert.deepEqual(s.completed,['tutorial_bakeout_1']);assert.equal(tutorialRuntimeView(s,ctx,data).active.length,0);
});
const lit=v=>({v}),program=body=>({parameters:[],body:body.map(i=>({sourceId:'test-source-ir',lineStart:1,lineEnd:1,...i}))});
// Two test-only source IR programs run through the real catalog engine. No
// invented game guide or live observation is added to the production catalog.
function competition(){const guides=['a','b'].map(id=>({id,name:id,configConditions:[],constants:{},sourceRefs:[],unimplemented:[],programs:{
 OnStart:program([{op:'listen',event:lit('Open'),handler:{handler:'Open'}},{op:'listen',event:lit('Close'),handler:{handler:'Close'}}]),
 Open:program([{op:'if',cases:[{test:{call:'self:CheckOtherTutorialInStrong',args:[],factId:'other'},body:[{op:'return',values:[]}]}],otherwise:[]},{op:'strong',value:lit(true)},{op:'assign',targets:['self.m_strOngoingDatas'],values:[lit('1')]},{op:'input-lock',value:lit(true)},{op:'schedule',id:'timer-'+id,handler:{handler:'Timer'},delay:lit(.2),repeat:false},{op:'mask',kind:'source-mask',id:'mask-'+id,callee:'TutorialHelper.WholeMask',args:[],callback:{handler:'Finish'}}]),
 Timer:program([{op:'assign',targets:['self.timerRan'],values:[lit(true)]},{op:'input-lock',value:lit(false)}]),
 Close:program([{op:'assign',targets:['self.closedAfterTimer'],values:[{get:{ref:'self'},key:'timerRan'}]},{op:'finish'}]),Finish:program([{op:'finish'}])
 }}));return {tutorialCatalogConfig:{schemaVersion:1,revision:'d'.repeat(64),guides}};}
function pendingCompetition(){const data=competition(),ctx=basic(),s=createTutorialRuntime(data);send(s,{type:'reconcile',now:0},ctx,data);const trial=send(s,{type:'source-event',sourceEvent:'Open',payload:{},now:0,eventId:'open'},ctx,data);assert.equal(trial.status,'ambiguous-order',JSON.stringify({trial,diag:s.diagnostics,states:Object.fromEntries(Object.entries(s.entries).map(([id,e])=>[id,{strong:e.state.strong,unknown:e.state.unknown}]))}));return {data,ctx,s};}
test('simultaneous claims require explicit order; safe UI events are deferred with original contexts and timer callbacks run before a later close',()=>{
 const {data,ctx,s}=pendingCompetition();assert.deepEqual(s.ambiguity.candidates,['a','b']);assert.equal(s.entries.a.state.strong,false);assert.equal(s.entries.b.state.strong,false);
 assert.equal(send(s,{type:'source-event',sourceEvent:'Close',payload:{name:'window'},now:1,eventId:'close'},ctx,data).status,'source-event-deferred');assert.equal(s.deferredEvents.length,1);assert.equal(send(s,{type:'source-event',sourceEvent:'Close',payload:{},now:1,eventId:'close'},ctx,data).status,'duplicate-event');
 send(s,{type:'choose-order',order:['a','b'],now:1.2},ctx,data);assert.equal(s.ambiguity,null);assert.equal(s.deferredEvents.length,0);assert.equal(s.entries.a.state.variables.closedAfterTimer,true);assert.deepEqual(new Set(s.completed),new Set(['a','b']));assert.equal(s.time,1.2);assert.equal(validTutorialRuntime(s,data),true);
});
test('deferred IDs remain deduplicated after history rollover and capacity rejection preserves the entire saved runtime',()=>{
 const {data,ctx,s}=pendingCompetition();for(let i=0;i<128;i++)send(s,{type:'source-event',sourceEvent:'Unrelated',payload:{i},now:i+1,eventId:'queued-'+i},ctx,data);
 assert.equal(s.deferredEvents.length,128);assert.equal(send(s,{type:'source-event',sourceEvent:'Unrelated',payload:{},now:129,eventId:'queued-0'},ctx,data).status,'duplicate-event');const before=structuredClone(s);const overflow=tutorialRuntimeEvent(s,{type:'source-event',sourceEvent:'Unrelated',now:129,eventId:'overflow'},ctx,data);assert.equal(overflow.status,'deferred-capacity');assert.deepEqual(s,before);
 send(s,{type:'disable',now:129},ctx,data);assert.equal(s.deferredEvents.length,0);assert.equal(s.ambiguity,null);assert.deepEqual(s.completed,[]);assert.equal(tutorialRuntimeView(s,ctx,data).active.length,0);assert.ok(s.history.some(h=>h.kind==='deferred-cancelled'));
});
test('same-ID manual ownership pauses automatic instances and external Finished registration does not fabricate visual completion',()=>{
 const id='tutorial_floatrace_start',data=subset([id]),ctx={...basic(),openViews:['FloatRaceMainWindow'],activities:{FloatRace:{state:'Started',id:'x'}}},s=createTutorialRuntime(data);send(s,{type:'reconcile',now:0},ctx,data);send(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'FloatRaceMainWindow'},now:0},ctx,data);const seq=s.entries[id].state.sequence;
 const manual={...ctx,manualGuideId:id,otherStrong:true};send(s,{type:'reconcile',now:0},manual,data);send(s,{type:'source-event',sourceEvent:'FloatRaceStateChanged',now:0},manual,data);assert.equal(s.entries[id].state.sequence,seq);assert.equal(tutorialRuntimeView(s,manual,data).active.length,0);
 send(s,{type:'reconcile',now:0},{...ctx,registeredTutorials:[id]},data);assert.equal(s.entries[id].externalFinished,true);assert.equal(s.completed.includes(id),false);
});
test('actual boost HUD is allowed while unrelated mutations are blocked, and cached-view permission matches direct permission',()=>{
 const guide=base.guides.find(g=>g.id==='tutorial_event_energyboost_simple'),data={tutorialConfig:{...base,guides:[guide]}},ctx={...structuredClone(guide.researchExample),availableHud:{EnergyBoost:true},board:[],selectedIndex:null},s=createTutorialRuntime(data);send(s,{type:'reconcile',now:0},ctx,data);send(s,{type:'source-event',sourceEvent:'GameModeChangeFinished',now:0},ctx,data);
 assert.equal(tutorialRuntimePermission(s,'generate',null,ctx,data).allowed,false);send(s,{type:'clock',now:.5},ctx,data);const v=tutorialRuntimeView(s,ctx,data);assert.equal(tutorialRuntimePermissionFromView(v,'set-boost',1).allowed,true);assert.equal(tutorialRuntimePermissionFromView(v,'sell').allowed,false);assert.equal(tutorialRuntimePermissionFromView(v,'runtime:disable').allowed,true);assert.deepEqual(tutorialRuntimePermission(s,'sell',null,ctx,data),tutorialRuntimePermissionFromView(v,'sell',null));
 send(s,{type:'source-event',sourceEvent:'EnergyBoostModeChanged',payload:{},now:.5,eventId:'boost-1'},ctx,data);assert.equal(s.entries[guide.id].state.active.phase,'click-2');send(s,{type:'source-event',sourceEvent:'EnergyBoostModeChanged',payload:{},now:.5,eventId:'boost-1'},ctx,data);assert.equal(s.completed.length,0);send(s,{type:'source-event',sourceEvent:'EnergyBoostModeChanged',payload:{},now:.5,eventId:'boost-2'},ctx,data);assert.deepEqual(s.completed,[guide.id]);
});
test('factory acquisition polling participates in the global clock and an unresolved random selection stops until context changes',()=>{
 const guide=base.guides.find(g=>g.id==='tutorial_generator_factory_Acquire'),data={tutorialConfig:{...base,guides:[guide]}},ctx={...basic(),gameMode:'Main',allWindowsClosed:true,mainBoardViewAvailable:true,generatorFactoryOpen:true,registeredTutorials:['tutorial_generator_factory'],factoryCandidates:[{uid:'1',hasFactoryComponent:true,position:{x:1,y:1}}]},s=createTutorialRuntime(data);
 send(s,{type:'reconcile',now:0},ctx,data);assert.equal(tutorialRuntimeView(s,ctx,data).nextDueAt,1);send(s,{type:'clock',now:1},ctx,data);assert.equal(tutorialRuntimeView(s,ctx,data).nextDueAt,1.3);send(s,{type:'clock',now:1.3},ctx,data);assert.equal(tutorialRuntimeView(s,ctx,data).nextDueAt,null);assert.ok(s.diagnostics[guide.id].unknown.includes('factoryRandomRoll'));
 const supplied={...ctx,factoryRandomRoll:0};send(s,{type:'clock',now:1.4},supplied,data);assert.equal(tutorialRuntimeView(s,supplied,data).active[0].active.target.uid,'1');
});
test('global force positions and drag lock are enforced; unconnected generation and cost effects never spend main resources',()=>{
 const data=competition(),s=createTutorialRuntime(data),ctx={...basic(),selectedIndex:null,inputMode:'game',board:[{uid:1,index:15,type:'103',cover:null,bubbled:false,generator:true}]};s.constraints.forceSource={x:2,y:3};s.constraints.forceTarget={x:4,y:5};
 assert.equal(tutorialRuntimePermission(s,'game-cell',15,ctx,data).allowed,true);assert.equal(tutorialRuntimePermission(s,'game-cell',14,ctx,data).allowed,false);assert.equal(tutorialRuntimePermission(s,'move','15,31',ctx,data).allowed,true);assert.equal(tutorialRuntimePermission(s,'move','15,30',ctx,data).allowed,false);
 s.constraints.dragLocks=['source-lock'];assert.equal(tutorialRuntimePermission(s,'drag-start',15,ctx,data).allowed,false);s.constraints.dragLocks=[];s.constraints.forceSpreadCode='201';assert.equal(tutorialRuntimePermission(s,'generate',null,ctx,data).reason,'source-effect-unimplemented');s.constraints.forceSkipCost=0;s.constraints.forceBubbleCost=0;assert.equal(tutorialRuntimePermission(s,'speedup-item',null,ctx,data).allowed,false);assert.equal(tutorialRuntimePermission(s,'buy-bubble',null,ctx,data).allowed,false);assert.equal(tutorialRuntimePermission(s,'export',null,ctx,data).allowed,true);
});
test('registered open guides do not replay or gain visual completion on reload; corrupt runtime and failed events remain preserved',()=>{
 const id='tutorial_floatrace_start',data=subset([id]),ctx={...basic(),openViews:['FloatRaceMainWindow'],activities:{FloatRace:{state:'Started',id:'x'}}},s=createTutorialRuntime(data);send(s,{type:'reconcile',now:0},ctx,data);send(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'FloatRaceMainWindow'},now:0},ctx,data);const restored=JSON.parse(JSON.stringify(s));assert.equal(restoreTutorialRuntime(restored,ctx,data).ok,true);assert.equal(restored.entries[id].state.active,null);assert.deepEqual(restored.completed,[]);assert.equal(restored.registered.includes(id),true);
 const broken=structuredClone(s);broken.entries[id].state.pending=[{handler:'does-not-exist'}];const before=structuredClone(broken);assert.equal(validTutorialRuntime(broken,data),false);assert.equal(tutorialRuntimeEvent(broken,{type:'reset',guideId:id,now:0},ctx,data).status,'invalid-state');assert.deepEqual(broken,before);
});
test('runtime panel exposes active source callbacks, explicit contexts, all97 statuses and corrupted-save recovery controls',()=>{
 const s=createTutorialRuntime(full),ctx=basic(),dom=new JSDOM(renderTutorialRuntimePanel(s,ctx,full));try{const d=dom.window.document;assert.equal(d.querySelector('[data-runtime-guide]').options.length,97);assert.equal(d.querySelector('[data-runtime-context]').value,'{}');assert.ok(d.querySelector('[data-play="runtime:disable"]'));assert.equal(d.querySelectorAll('[aria-label="자동 안내 상태 목록"] tbody tr').length,97);}finally{dom.window.close();}
 const broken=new JSDOM(renderTutorialRuntimePanel(null,ctx,full));try{assert.ok(broken.window.document.querySelector('[data-play="runtime:clear-invalid"]'));assert.ok(broken.window.document.querySelector('[data-play=export]'));}finally{broken.window.close();}
});
test('source constraint deltas update the shared singleton and clear in actual source event order without changing board data',()=>{
 const g={id:'constraint-probe',name:'Source IR constraint probe',constants:{},configConditions:[],sourceRefs:[],unimplemented:[],programs:{OnStart:program([{op:'constraint',action:'SetForceSourceBoardPosition',args:[lit({x:2,y:3})]},{op:'constraint',action:'AddDragLock',args:[lit('constraint-probe')]},{op:'listen',event:lit('Read'),handler:{handler:'Read'}},{op:'listen',event:lit('Clear'),handler:{handler:'Clear'}}]),Read:program([{op:'assign',targets:['self.seen'],values:[{call:'GM.TutorialModel:GetForceSourceBoardPosition',args:[],factId:'read-global'}]}]),Clear:program([{op:'constraint',action:'ClearTempDatas',args:[]}])}},data={tutorialCatalogConfig:{schemaVersion:1,revision:'f'.repeat(64),guides:[g]}},ctx=basic(),s=createTutorialRuntime(data);
 send(s,{type:'reconcile',now:0},ctx,data);assert.deepEqual(s.constraints.forceSource,{x:2,y:3});assert.deepEqual(s.constraints.dragLocks,['constraint-probe']);send(s,{type:'source-event',sourceEvent:'Read',now:0},ctx,data);assert.deepEqual(s.entries[g.id].state.variables.seen,{x:2,y:3});send(s,{type:'source-event',sourceEvent:'Clear',now:0},ctx,data);assert.equal(s.constraints.forceSource,null);assert.deepEqual(s.constraints.dragLocks,[]);assert.ok(s.history.some(h=>h.kind==='constraint-update'));
});
test('unsafe non-JSON contexts and invalid optional runtime fields preserve the original record',()=>{
 const data=subset(['tutorial_floatrace_start']),s=createTutorialRuntime(data),before=structuredClone(s);for(const value of [undefined,Infinity,new Date(),()=>true]){const r=tutorialRuntimeEvent(s,{type:'reconcile',now:0},{...basic(),facts:{value}},data);assert.equal(r.ok,false);assert.deepEqual(s,before);}
 const bad=structuredClone(s);bad.constraints.forceSkipCost={price:0};assert.equal(validTutorialRuntime(bad,data),false);assert.equal(tutorialRuntimeEvent(bad,{type:'disable',now:0},basic(),data).status,'invalid-state');
});

test('actual recap entry is the sole permitted target after its mask, and TaskWindow closure completes the guide',()=>{
 const guide=base.guides.find(g=>g.id==='tutorial_story_recap'),data={tutorialConfig:{...base,guides:[guide]}},ctx={...basic(),storyRecapOpen:true,storyUnlockedBooks:[1],recapEntryAvailable:true,openViews:['TaskWindow']},s=createTutorialRuntime(data);
 send(s,{type:'reconcile',now:0},ctx,data);send(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'TaskWindow'},now:0,eventId:'task-open'},ctx,data);send(s,{type:'clock',now:1},ctx,data);send(s,{type:'mask-click',guideId:guide.id,now:1},ctx,data);
 const v=tutorialRuntimeView(s,ctx,data),binding=v.active[0].binding;assert.equal(v.active[0].active.phase,'recap-highlight');assert.equal(binding.key,'StoryRecapEntry');assert.equal(binding.selector,'[data-play="recap:open-shelf"]');assert.equal(binding.nativeGeometryResolved,false);assert.equal(tutorialRuntimePermissionFromView(v,'recap:open-shelf').allowed,true);assert.equal(tutorialRuntimePermissionFromView(v,'generate').allowed,false);
 assert.equal(tutorialRuntimePermission(s,'recap:open-shelf',null,{...ctx,recapEntryAvailable:false},data).reason,'target-unresolved');assert.equal(tutorialRuntimePermission(s,'recap:open-shelf',null,{...ctx,openViews:[]},data).reason,'target-unresolved');
 send(s,{type:'source-event',sourceEvent:'CloseView',payload:{name:'TaskWindow'},now:1,eventId:'task-close'},{...ctx,openViews:['StoryRecapMainWindow']},data);assert.deepEqual(s.completed,[guide.id]);
});

test('recap shelf and book map to exact source windows while a closed research panel claims neither',()=>{
 const main=createPlay(playConfig,{scenario:'initial',guide:false}),before=structuredClone(main);main.storyRecap={phase:'shelf'};
 let ctx=buildTutorialRuntimeContext(main,full,{presentation:'recap'});assert.deepEqual(ctx.openViews,['StoryRecapMainWindow']);assert.equal(ctx.topView,'StoryRecapMainWindow');
 main.storyRecap.phase='book';ctx=buildTutorialRuntimeContext(main,full,{presentation:'recap'});assert.deepEqual(ctx.openViews,['StoryRecapMainWindow','StoryRecapBookContentWindow']);assert.equal(ctx.topView,'StoryRecapBookContentWindow');
 main.storyRecap.phase='closed';ctx=buildTutorialRuntimeContext(main,full,{presentation:'recap',recapOpen:true});assert.deepEqual(ctx.openViews,[]);assert.equal(ctx.allWindowsClosed,false);delete main.storyRecap;assert.deepEqual(main,before);
});

test('mount reconciliation drains a due source poll once and reaches an unchanged fixed point',()=>{
 const guide=base.guides.find(g=>g.id==='tutorial_generator_factory_Acquire'),data={tutorialConfig:{...base,guides:[guide]}},ctx={...basic(),gameMode:'Main',allWindowsClosed:true,mainBoardViewAvailable:true,generatorFactoryOpen:true,registeredTutorials:['tutorial_generator_factory'],factoryCandidates:[{uid:'1',hasFactoryComponent:true,position:{x:1,y:1}}]},s=createTutorialRuntime(data);send(s,{type:'reconcile',now:0},ctx,data);assert.equal(tutorialRuntimeView(s,ctx,data).nextDueAt,1);const first=send(s,{type:'reconcile',now:1.4},ctx,data);assert.ok(first.ok);const second=send(s,{type:'reconcile',now:1.4},ctx,data);assert.equal(second.changed,false);assert.equal(second.status,'unchanged');
});
