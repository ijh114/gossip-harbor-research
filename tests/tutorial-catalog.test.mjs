import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTutorialCatalog,validTutorialCatalog,tutorialCatalogEvent,tutorialCatalogView} from '../src/tutorial-catalog.mjs';
const read=async n=>JSON.parse(await readFile(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const [catalog,progress,first,more]=await Promise.all(['tutorial-catalog','play-progress','tutorial-extension','tutorial-more'].map(read));
const extra=new Set([...first.guides,...more.guides].map(g=>g.id));
const definition=id=>catalog.guides.find(g=>g.id===id);
const context=more=>({mode:'research',...more});
const event=(s,e,ctx={})=>tutorialCatalogEvent(s,e,context(ctx),catalog);
function allObjects(v,out=[]){if(v&&typeof v==='object'){out.push(v);for(const x of Object.values(v))allObjects(x,out);}return out;}
const fact=(id,call)=>allObjects(definition(id).programs).find(x=>x.call===call)?.factId;
const semantic=s=>{const c=structuredClone(s);delete c.unknown;delete c.status;return c;};

test('catalog enumerates exactly the 87 remaining IDs with immutable source/condition anchors',()=>{
 const expected=progress.tutorials.rows.filter(r=>r.status==='server-or-presentation-required'&&!extra.has(r.id));
 assert.equal(catalog.guides.length,87);assert.deepEqual(catalog.guides.map(g=>g.id),expected.map(g=>g.id));
 const refs=new Map(catalog.sources.map(s=>[s.id,s]));assert.equal(refs.size,catalog.sources.length);assert.equal(catalog.managerSources.length,6);
 for(const r of expected){const g=definition(r.id);assert.equal(g.originalRuntimeObserved,false);assert.ok(g.programs.OnStart);for(const s of r.sources){const actual=catalog.sources.find(x=>x.path===s.path);assert.ok(actual,s.path);assert.equal(actual.sha256,s.sha256);}
  for(const p of Object.values(g.programs)){const s=refs.get(p.sourceId);assert.ok(s);assert.ok(p.lineStart>=1&&p.lineEnd>=p.lineStart&&p.lineEnd<=s.lineEnd);}
 }
 assert.equal(catalog.enums.ETutorialId.AcquireAvatarFrame,'tutorial_acquire_avatar_frame');
 assert.equal(catalog.enums.ETutorialState.Ongoing,1);
});
test('no-context starts preserve unknowns and never fabricate completion of 87 guides',()=>{
 let started=0,unknown=0;for(const g of catalog.guides){const s=createTutorialCatalog(catalog,g.id);assert.equal(validTutorialCatalog(s,catalog),true);const r=event(s,{type:'executer-started'});assert.ok(['started','unknown','unimplemented'].includes(r.status),g.id+': '+r.status);if(r.status==='started')started++;else unknown++;assert.deepEqual(s.completed,[],g.id);assert.equal(validTutorialCatalog(s,catalog),true);const before=structuredClone(s);assert.equal(event(s,{type:'next'}).status,'unsupported-event');assert.deepEqual(s,before);}
 assert.ok(started>0);assert.ok(unknown>0);
});
test('FloatRace source masks register first and finish after actual two callbacks, retaining source phase typo',()=>{
 const id='tutorial_floatrace_start',s=createTutorialCatalog(catalog,id),ctx={openViews:['FloatRaceMainWindow'],activities:{FloatRace:{state:'Started',id:'research-float-1'}}};
 assert.equal(event(s,{type:'executer-started'},ctx).ok,true);
 assert.equal(event(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'FloatRaceMainWindow'}},ctx).ok,true);
 assert.deepEqual(s.registeredFinished,[id]);assert.deepEqual(s.completed,[]);assert.equal(s.strong,true);const old=s.mask.id;
 assert.equal(event(s,{type:'mask-click',callbackId:old},ctx).status,'mask-callback');assert.equal(s.phase,'1','original second method also assigns Step.ShowIslandNode, not Step.ShowAliveNum');
 assert.equal(event(s,{type:'mask-click',callbackId:old},ctx).status,'stale-callback');assert.deepEqual(s.completed,[]);
 assert.equal(event(s,{type:'mask-click',callbackId:s.mask.id},ctx).status,'completed');assert.deepEqual(s.completed,[id]);assert.equal(s.mask,null);assert.equal(s.strong,false);assert.deepEqual(s.subscriptions,[]);
});
test('activity Ended event finishes an active guide and clears callbacks without target mutation',()=>{
 const s=createTutorialCatalog(catalog,'tutorial_floatrace_start'),ctx={openViews:['FloatRaceMainWindow'],activities:{FloatRace:{state:'Started',id:'research-float-1'}}};event(s,{type:'executer-started'},ctx);event(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'FloatRaceMainWindow'}},ctx);
 const next={...ctx,activities:{FloatRace:{state:'Ended',id:'research-float-1'}}};const r=event(s,{type:'source-event',sourceEvent:'EEventType.FloatRaceStateChanged'},next);assert.equal(r.status,'completed');assert.equal(s.completed.length,1);assert.equal(tutorialCatalogView(s,context(next),catalog).nextDueAt,null);assert.equal(next.activities.FloatRace.state,'Ended');
});
test('missing activity/guard values roll back progression instead of treating object symbols as true',()=>{
 const s=createTutorialCatalog(catalog,'tutorial_floatrace_start');event(s,{type:'executer-started'});const before=semantic(s);
 const r=event(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'FloatRaceMainWindow'}},{openViews:['FloatRaceMainWindow']});assert.equal(r.status,'unknown');assert.ok(r.unknown.some(x=>x==='activities.FloatRace'));assert.deepEqual(semantic(s),before);assert.equal(s.registeredFinished.length,0);
});
test('source 0.2 second delay retains lock before boundary and handles missing window after boundary',()=>{
 const id='tutorial_coin_race_first_main_window',s=createTutorialCatalog(catalog,id),round=fact(id,'model:GetCurrentRound');assert.ok(round);
 const ctx={otherStrong:false,openViews:['CoinRaceMainWindow'],activities:{CoinRace:{state:'Started',id:'research-coin-1'}},facts:{[round]:1}};
 event(s,{type:'executer-started'},ctx);assert.equal(event(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'CoinRaceMainWindow'}},ctx).ok,true);assert.equal(s.inputLocked,true);assert.equal(s.registeredFinished.length,1);assert.equal(s.completed.length,0);assert.equal(s.pending[0].dueAt,0.2);
 event(s,{type:'clock',now:0.199},ctx);assert.equal(s.inputLocked,true);assert.equal(s.completed.length,0);
 const r=event(s,{type:'clock',now:0.2},{...ctx,openViews:[]});assert.equal(r.status,'completed');assert.equal(s.inputLocked,false);assert.equal(s.pending.length,0);
});
test('source factory polling keeps explicit false closed, stops its repeat when a delayed start is scheduled',()=>{
 const s=createTutorialCatalog(catalog,'tutorial_generator_factory');assert.equal(event(s,{type:'executer-started'}).ok,true);assert.equal(s.pending.length,1);
 const ctx={generatorFactoryOpen:false,gameMode:'Main',allWindowsClosed:true,otherStrong:false};assert.equal(event(s,{type:'clock',now:1},ctx).ok,true);assert.equal(s.pending.length,1);assert.equal(s.pending[0].dueAt,2);assert.equal(s.strong,false);
 ctx.generatorFactoryOpen=true;const r=event(s,{type:'clock',now:2},ctx);assert.equal(r.ok,true);assert.equal(s.inputLocked,true);assert.equal(s.pending.length,1);assert.equal(s.pending[0].dueAt,2.5);assert.equal(s.pending[0].repeatSeconds,null,'Unschedule inside callback cancels its repeating poll');assert.equal(s.registeredFinished.length,0);
});
test('config predecessor conditions are ANDed and false remains distinct from unknown',()=>{
 const s=createTutorialCatalog(catalog,'tutorial_floatrace_entry');assert.equal(event(s,{type:'executer-started'}).status,'unknown');assert.equal(event(s,{type:'executer-started'},{registeredTutorials:[]}).status,'ineligible');assert.equal(s.started,false);
 assert.equal(event(s,{type:'executer-started'},{registeredTutorials:['tutorial_floatrace_start']}).status,'started');
});
test('registered-but-visually-open guide is not automatically replayed or marked visually complete on reload',()=>{
 const id='tutorial_floatrace_start',s=createTutorialCatalog(catalog,id),ctx={openViews:['FloatRaceMainWindow'],activities:{FloatRace:{state:'Started',id:'research-float-1'}}};event(s,{type:'executer-started'},ctx);event(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'FloatRaceMainWindow'}},ctx);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(validTutorialCatalog(restored,catalog),true);assert.equal(event(restored,{type:'resume'},ctx).status,'registered-not-restored');assert.equal(restored.active,null);assert.deepEqual(restored.registeredFinished,[id]);assert.deepEqual(restored.completed,[]);assert.deepEqual(restored.subscriptions,[]);
});
test('cross tutorial registration uses real enum IDs and does not count another visual guide as complete',()=>{
 const id='tutorial_acquire_avatar',s=createTutorialCatalog(catalog,id),avatar=fact(id,'GM.UserProfileModel:CanShowAvatarsRedPot'),frame=fact(id,'GM.UserProfileModel:CanShowAvatarFrameRedPoint');assert.ok(avatar);assert.ok(frame);
 const ctx={registeredTutorials:[],openViews:['SettingUserInfoWindow'],facts:{[avatar]:true,[frame]:true}};event(s,{type:'executer-started'},ctx);const r=event(s,{type:'source-event',sourceEvent:'OpenView',payload:{name:'SettingUserInfoWindow'}},ctx);assert.equal(r.ok,true);assert.deepEqual(r.registrations.map(x=>x.id),['tutorial_acquire_avatar_frame']);assert.deepEqual(s.registeredFinished,[id]);assert.deepEqual(s.completed,[]);assert.equal(s.inputLocked,true);
 event(s,{type:'clock',now:0.2},ctx);assert.equal(s.inputLocked,false);assert.ok(s.mask?.callback);assert.equal(event(s,{type:'mask-click'},ctx).status,'completed');
});
test('an actual source multi-return assignment requires explicit arity and accepts a typed native tuple',()=>{
 const id='tutorial_adventure_activity_board',s=createTutorialCatalog(catalog,id),collection=definition(id).programs.OnStart.body.find(i=>i.op==='loop').id,ctx={collections:{[collection]:[]}};
 assert.equal(event(s,{type:'executer-started'},ctx).ok,true);const before=semantic(s),input={type:'source-event',sourceEvent:'ItemMerged',payload:{New:{type:'research-tool'}}},pair=fact(id,'GM.ActivityManager:GetStartedAdventure');
 const r=event(s,input,ctx);assert.equal(r.status,'unknown');assert.deepEqual(semantic(s),before);assert.deepEqual(s.completed,[]);
 const untyped=event(s,input,{...ctx,facts:{[pair]:[null,null]}});assert.equal(untyped.status,'unknown');assert.ok(untyped.unknown[0].startsWith('return-tuple:'));assert.deepEqual(semantic(s),before);
 const typed=event(s,input,{...ctx,facts:{[pair]:{$luaTuple:[null,null]}}});assert.equal(typed.ok,true);assert.equal(typed.status,'event-dispatched');assert.deepEqual(s.completed,[]);
});
test('unsafe/corrupt inputs preserve the existing save and remain serializable after rejected operations',()=>{
 const s=createTutorialCatalog(catalog,'tutorial_floatrace_start'),before=structuredClone(s);
 for(const facts of [{x:()=>true},{x:Infinity},{x:undefined},{x:new Date()},Object.create({x:true})]){const r=event(s,{type:'executer-started'},{facts});assert.equal(r.status,'invalid-input');assert.deepEqual(s,before);}
 for(const payload of [()=>true,{x:Infinity},{x:undefined},new Map()]){const r=event(s,{type:'source-event',sourceEvent:'OpenView',payload});assert.equal(r.status,'invalid-input');assert.deepEqual(s,before);}
 const corrupt={...s,pending:[{id:'x',handler:'nonexistent',dueAt:0,locals:{},repeatSeconds:null}]};const saved=JSON.stringify(corrupt);assert.equal(validTutorialCatalog(corrupt,catalog),false);assert.equal(event(corrupt,{type:'reset'}).status,'invalid-state');assert.equal(JSON.stringify(corrupt),saved);
 assert.equal(event(s,{type:'executer-started',now:-1}).status,'invalid-time');assert.deepEqual(s,before);
});

const literal=value=>({v:value}),reference=name=>({ref:name});
const assignment=(targets,values,isLocal=true)=>({op:'assign',targets,values,isLocal,sourceId:'probe',lineStart:1,lineEnd:1});
const sourceProgram=body=>({parameters:[],body:body.map(i=>({sourceId:'probe',lineStart:1,lineEnd:1,...i}))});
function probe(body,extra={}){return {schemaVersion:1,revision:'e'.repeat(64),guides:[{id:'typed-probe',constants:{},configConditions:[],programs:{OnStart:sourceProgram(body),...extra},sourceRefs:[],unimplemented:[],support:'typed-source-semantics-probe'}]};}
test('shared lexical cells retain outer changes and callback changes across a JSON round trip',()=>{
 const c=probe([
  assignment(['x'],[literal(1)]),
  {op:'schedule',id:'a',handler:{handler:'cb@a'},delay:literal(1),repeat:false},
  {op:'schedule',id:'b',handler:{handler:'cb@b'},delay:literal(2),repeat:false},
  assignment(['x'],[literal(2)],false)
 ],{
  'cb@a':sourceProgram([assignment(['self.a'],[reference('x')]),assignment(['x'],[literal(3)],false)]),
  'cb@b':sourceProgram([assignment(['self.b'],[reference('x')])])
 });
 const s=createTutorialCatalog(c),ctx={mode:'research'};assert.equal(tutorialCatalogEvent(s,{type:'executer-started'},ctx,c).ok,true);
 assert.equal(s.pending[0].locals.x.$cell,s.pending[1].locals.x.$cell);
 const saved=JSON.parse(JSON.stringify(s));assert.equal(validTutorialCatalog(saved,c),true);
 assert.equal(tutorialCatalogEvent(saved,{type:'clock',now:1},ctx,c).ok,true);assert.equal(saved.variables.a,2);
 const savedAgain=JSON.parse(JSON.stringify(saved));assert.equal(tutorialCatalogEvent(savedAgain,{type:'clock',now:2},ctx,c).ok,true);assert.equal(savedAgain.variables.b,3);assert.equal(Object.keys(savedAgain.cells).length,0,'unreferenced cells are collected after callbacks');
});
test('a callback local shadows the captured cell without changing a sibling closure',()=>{
 const c=probe([assignment(['x'],[literal(1)]),{op:'schedule',id:'a',handler:{handler:'cb@a'},delay:literal(1),repeat:false},{op:'schedule',id:'b',handler:{handler:'cb@b'},delay:literal(2),repeat:false}],{
  'cb@a':sourceProgram([assignment(['x'],[literal(9)],true),assignment(['self.a'],[reference('x')])]),
  'cb@b':sourceProgram([assignment(['self.b'],[reference('x')])])
 });const s=createTutorialCatalog(c),ctx={mode:'research'};tutorialCatalogEvent(s,{type:'executer-started'},ctx,c);tutorialCatalogEvent(s,{type:'clock',now:1},ctx,c);tutorialCatalogEvent(s,{type:'clock',now:2},ctx,c);assert.equal(s.variables.a,9);assert.equal(s.variables.b,1);
});
test('typed tuples expand only the last call and never expand an ordinary Lua table',()=>{
 const native={call:'Native.GetTuple',args:[],factId:'tuple',label:'known native tuple'},c=probe([
  {...assignment(['a','b','c'],[native]),multiReturn:true},assignment(['self.a','self.b','self.c'],[reference('a'),reference('b'),reference('c')])
 ]),ctx={mode:'research',facts:{tuple:{$luaTuple:[0,false]}}},s=createTutorialCatalog(c);
 assert.equal(tutorialCatalogEvent(s,{type:'executer-started'},ctx,c).ok,true);assert.equal(s.variables.a,0);assert.equal(s.variables.b,false);assert.equal(s.variables.c,null,'explicit two-result arity pads only the third assignment with nil');
 const noArity=createTutorialCatalog(c);assert.equal(tutorialCatalogEvent(noArity,{type:'executer-started'},{mode:'research',facts:{tuple:[0,false]}},c).status,'unknown');
 const scalarCall=probe([assignment(['a','b'],[native,literal('last')]),assignment(['self.a','self.b'],[reference('a'),reference('b')])]);const single=createTutorialCatalog(scalarCall);assert.equal(tutorialCatalogEvent(single,{type:'executer-started'},ctx,scalarCall).ok,true);assert.equal(single.variables.a,0);assert.equal(single.variables.b,'last');
});
test('GnomeRoom mutable openView capture re-queries the window and retains a retryable source mask',()=>{
 const id='tutorial_gomeroom_game',s=createTutorialCatalog(catalog,id),g=definition(id),def=fact(id,'self.m_activityModel:GetActivityDefinition'),info=fact(id,'self.m_activityModel:GetCurInfo');
 const ctx={openViews:['GnomeRoomMainWindow'],activities:{GnomeRoom:{state:'Started',id:'room-1'}},facts:{[def]:{MainWindowPrefabName:'GnomeRoomMainWindow',GameStartTutorialEvent:'GnomeGameStart',StateChangedEvent:'GnomeState',GameStateChanged:'GnomeGameState',StartGameCardTutorialEvent:'GnomeCardStart',ClickBoxTutorialEvent:'GnomeBoxClick'},[info]:{roomState:1}}};
 assert.equal(event(s,{type:'executer-started'},ctx).ok,true);assert.equal(event(s,{type:'source-event',sourceEvent:'GnomeCardStart',payload:{progressTrans:{}}},ctx).ok,true);assert.equal(event(s,{type:'mask-click'},ctx).ok,true);
 const mask=s.mask.id;const nilWindow={...ctx,openViews:[]};assert.equal(event(s,{type:'mask-click'},nilWindow).ok,true);assert.equal(s.mask.id,mask);assert.equal(s.completed.length,0);
 const restored=JSON.parse(JSON.stringify(s)),show=g.unimplemented.find(x=>x.callee==='openView:ShowTimeView');assert.ok(show);const ready={...ctx,effectResults:{[show.id]:{applied:true,origin:'research'}}};assert.equal(event(restored,{type:'mask-click'},ready).status,'completed');assert.equal(restored.completed.length,1);
});
test('source tutorial force positions and drag locks are explicit state deltas, not main-board changes',()=>{
 const c=probe([
  {op:'constraint',action:'SetForceSourceBoardPosition',args:[{call:'BoardPosition.Create',args:[literal(2),literal(3)],factId:'position'}]},
  {op:'constraint',action:'SetForceTargetBoardPosition',args:[literal({x:4,y:5})]},
  {op:'constraint',action:'AddDragLock',args:[literal('typed-probe')]},
  {op:'listen',event:literal('Clear'),handler:{handler:'Clear'}}
 ],{Clear:sourceProgram([{op:'constraint',action:'ClearTempDatas',args:[]}])}),s=createTutorialCatalog(c),ctx={mode:'research'};
 const r=tutorialCatalogEvent(s,{type:'executer-started'},ctx,c);assert.equal(r.ok,true);assert.equal(r.constraintUpdates.length,3);assert.deepEqual(s.constraints.forceSource,{x:2,y:3,$boardPosition:true});assert.deepEqual(s.constraints.dragLocks,['typed-probe']);
 const copy=JSON.parse(JSON.stringify(s));assert.equal(validTutorialCatalog(copy,c),true);assert.equal(tutorialCatalogEvent(copy,{type:'source-event',sourceEvent:'Clear'},ctx,c).ok,true);assert.equal(copy.constraints.forceSource,null);assert.equal(copy.constraints.forceTarget,null);assert.deepEqual(copy.constraints.dragLocks,[]);
});
test('foreign-effect requests expose typed argument availability and remain blocked without acknowledgment',()=>{
 const c=probe([{op:'effect-required',id:'ui-enable',effectClass:'ui-input-state',callee:'window:SetScrollEnabled',arguments:[literal(false),{call:'Native.Target',args:[],factId:'native-target'}],args:['false','target']}]),s=createTutorialCatalog(c),ctx={mode:'research'};
 const r=tutorialCatalogEvent(s,{type:'executer-started'},ctx,c);assert.equal(r.status,'unimplemented');assert.equal(r.requiredEffect.effectClass,'ui-input-state');assert.deepEqual(r.requiredEffect.arguments[0],{index:0,known:true,value:false});assert.equal(r.requiredEffect.arguments[1].known,false);assert.deepEqual(r.requiredEffect.arguments[1].unknown,['native-target']);assert.equal(s.started,false);
});
test('verified global singleton constraints seed each guide before source reads and are not reset per-guide on resume',()=>{
 const getter={call:'GM.TutorialModel:GetForceSourceBoardPosition',args:[],factId:'global-read'},c=probe([assignment(['self.seen'],[getter])]),s=createTutorialCatalog(c),globalConstraints={...s.constraints,forceSource:{x:5,y:7},dragLocks:['another-guide']},ctx={mode:'research',globalConstraints};
 assert.equal(tutorialCatalogEvent(s,{type:'executer-started'},ctx,c).ok,true);assert.deepEqual(s.variables.seen,{x:5,y:7});assert.deepEqual(s.constraints.dragLocks,['another-guide']);
 assert.equal(tutorialCatalogEvent(s,{type:'resume'},ctx,c).ok,true);assert.deepEqual(s.variables.seen,{x:5,y:7});assert.deepEqual(tutorialCatalogView(s,ctx,c).constraints,globalConstraints);
 assert.equal(tutorialCatalogEvent(s,{type:'clock'},{mode:'research',globalConstraints:{forceSource:null}},c).status,'invalid-input');
});
