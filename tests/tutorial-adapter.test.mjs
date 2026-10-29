import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createTutorialAdapterState,validTutorialAdapterState,createTutorialAdapterSession,tutorialAdapterPermission,tutorialAdapterMountLifecycle,TUTORIAL_ADAPTER_SOURCES} from '../src/tutorial-adapter.mjs';
import {collectTutorialAdapterTargets,registerTutorialAdapterTarget,applyTutorialAdapterDOM} from '../src/tutorial-adapter-dom.mjs';
import {createTutorialRuntime,tutorialRuntimeEvent,tutorialRuntimeView,tutorialRuntimePermissionFromView,tutorialAdapterContext} from '../src/tutorial-runtime.mjs';
import {SOURCE_EXTERNAL_CALLS,SOURCE_LOCK_SCOPES} from '../src/tutorial-adapter-contracts.mjs';
import {renderTutorialRuntimePanel} from '../src/tutorial-runtime-page.mjs';
const catalog=JSON.parse(await readFile(new URL('../src/data/tutorial-catalog.json',import.meta.url),'utf8'));
const empty={schema:1,epoch:'test',targets:[]};
const ctx={mode:'research',otherStrong:false,registeredTutorials:[],activities:{},openViews:[]};
const request=(callee,values=[],extra={})=>({id:'probe@1',guideId:'source-probe',sourceId:'probe',lineStart:1,lineEnd:1,callee,arguments:values.map((value,index)=>({known:true,index,value})),...extra});
const session=(state=createTutorialAdapterState(),registry=empty)=>createTutorialAdapterSession(state,registry,{catalog});
test('finite original MiscModel flags use Lua string storage and exact number getter defaults, without arbitrary state writes',()=>{
 const s=createTutorialAdapterState(),a=session(s);assert.deepEqual(a.read({call:'GM.MiscModel:GetWheelTutorialInNumber'}),{handled:true,known:true,value:0});
 assert.equal(a.apply(request('GM.MiscModel:SetWheelTutorial',[1])).ok,true);assert.equal(s.misc.WheelTutorial,'1');
 assert.equal(a.apply(request('GM.MiscModel:SetAlbumActivityTutorial',[false])).ok,true);assert.equal(s.misc.AlbumActivityTutorial,'false');
 assert.equal(a.apply(request('GM.MiscModel:SetHitBricksTutorial',[null])).ok,true);assert.equal(s.misc.HitBricksTutorial,'nil');
 assert.equal(a.apply(request('GM.MiscModel:SetWalletGems',[10000])).ok,false);assert.equal(Object.hasOwn(s,'wallet'),false);assert.equal(validTutorialAdapterState(JSON.parse(JSON.stringify(s))),true);
 const before=structuredClone(s);assert.equal(a.apply(request('GM.MiscModel:SetWheelTutorial',[{}])).ok,false);assert.deepEqual(s,before);
});
test('MapExplore completion flags share original global Misc keys; activity tutorial flags require an explicit model identity and preserve nil',()=>{
 const s=createTutorialAdapterState(),a=session(s),receiver={known:true,value:{$model:'MapExplore_midfall',id:'explicit-1'}};
 assert.equal(a.apply(request('model:SetTutorialStartFinish',[],{receiver})).ok,true);assert.equal(s.misc.MapExploreFinishStartTutorial,'1');
 assert.equal(a.read({call:'anotherModel:IfTutorialStartFinish'},{receiver:()=>({known:true,value:{$model:'MapExplore_halloween',id:'explicit-2'}})}).value,true);
 assert.equal(a.apply(request('model:SetTutorialBoardFinish',[],{receiver})).ok,true);
 assert.equal(a.apply(request('model:SetPlayFirstShowBubble',[true],{receiver})).ok,true);assert.equal(s.activityFlags['MapExplore_midfall:explicit-1'].flags.playFirstShowBubble,true);
 const pig={known:true,value:{$model:'DailyRating',id:'explicit-pig'}};assert.equal(a.apply(request('self.m_activityModel:SetPiggyTutorialStart',[],{receiver:pig})).ok,true);assert.equal(s.activityFlags['DailyRating:explicit-pig'].flags.piggyTutorialStart,null);assert.equal(a.read({call:'model:IfNeedPiggyTutorialStart'},{receiver:()=>pig}).value,false);
 assert.equal(a.apply(request('model:SetGameTutorial',[true])).status,'unknown');
 assert.equal(a.apply(request('teamModel:SetCurState',['OnGoing'],{receiver})).status,'unimplemented');assert.equal(a.apply(request('model:SetExchangeCoinFree',[],{receiver})).status,'unimplemented');
});
test('source UIManager counts each owner and RemoveAllEventLocks preserves other owner and anonymous locks',()=>{
 const s=createTutorialAdapterState(),a=session(s),lock=(locked,owner)=>a.inputLock({guideId:'source-probe',sourceId:'probe',lineStart:1,locked,owner});
 assert.equal(lock(true,'anonymous').inputLocked,true);lock(true,'self');lock(true,'self');lock(false,'self');assert.equal(s.ownerLocks['guide:source-probe'],1);
 assert.equal(a.apply(request('GM.UIManager:RemoveAllEventLocks',[{$self:true}])).inputLocked,true);assert.equal(s.anonymousLocks,1);assert.equal(s.ownerLocks['guide:source-probe'],undefined);
 assert.equal(lock(false,'anonymous').inputLocked,false);const before=structuredClone(s);assert.equal(lock(false,'anonymous').ok,false);assert.deepEqual(s,before);
 assert.equal(Object.keys(SOURCE_LOCK_SCOPES).length,94);assert.equal(SOURCE_EXTERNAL_CALLS['TC-S021:141'].callee,'window:RestartPrompt');
});
test('DOM registry includes only actual mapped components; enabling never overrides core gates and scrolling is actually blocked',()=>{
 const dom=new JSDOM('<main><div class="game-bottom"><button data-play="inventory">보관함</button></div><dialog class="inventory-dialog"><button data-play="game-factory-open">공장</button><button data-play="inventory-buy" disabled>확장</button></dialog><div class="unrelated-event-panel">WheelWindow처럼 취급 금지</div></main>');
 try{const root=dom.window.document.querySelector('main'),bundle=collectTutorialAdapterTargets(root),s=createTutorialAdapterState(),a=session(s,bundle.registry);
  assert.equal(bundle.registry.targets.some(t=>t.sourceWindow==='WheelWindow'),false);assert.equal(a.apply(request('inventoryBtn:SetClickActive',[false],{guideId:'tutorial_generator_factory'})).ok,true);
  assert.equal(a.apply(request('window:SetScrollEnabled',[false],{receiver:{known:true,value:{$view:'InventoryWindow'}}})).ok,true);applyTutorialAdapterDOM(bundle,s);
  assert.equal(root.querySelector('[data-play="inventory"]').disabled,true);assert.equal(root.querySelector('dialog').style.overflow,'hidden');const wheel=new dom.window.Event('wheel',{bubbles:true,cancelable:true});root.querySelector('dialog').dispatchEvent(wheel);assert.equal(wheel.defaultPrevented,true);
  a.apply(request('inventoryBtn:SetClickActive',[true],{guideId:'tutorial_generator_factory'}));applyTutorialAdapterDOM(bundle,s);assert.equal(root.querySelector('[data-play="inventory"]').disabled,false);assert.equal(root.querySelector('[data-play="inventory-buy"]').disabled,true);
 }finally{dom.window.close();}
});
test('DOM prompt restart hides the gesture and only an actual eligible visible item gains the source >2s hint',()=>{
 const dom=new JSDOM('<main><dialog class="inventory-dialog"><button data-factory-tutorial-tip>조각</button></dialog></main>');try{const root=dom.window.document.querySelector('main'),bundle=collectTutorialAdapterTargets(root),s=createTutorialAdapterState(),a=session(s,bundle.registry),receiver={known:true,value:{$view:'InventoryWindow'}};
  a.apply(request('window:RestartPrompt',[],{guideId:'tutorial_generator_factory',receiver}));a.apply(request('window:StartPrompt',[],{guideId:'tutorial_generator_factory',receiver}));applyTutorialAdapterDOM(bundle,s,{now:0});applyTutorialAdapterDOM(bundle,s,{now:2});assert.equal(root.querySelector('[data-tutorial-factory-gesture]'),null);applyTutorialAdapterDOM(bundle,s,{now:2.01});assert.ok(root.querySelector('[data-tutorial-factory-gesture]'));
  root.innerHTML='<dialog class="inventory-dialog"><button data-factory-tutorial-tip>같은 조각</button></dialog>';applyTutorialAdapterDOM(collectTutorialAdapterTargets(root),s,{now:2.02});assert.equal(root.querySelector('[data-tutorial-factory-gesture]').textContent,'탭');
  a.apply(request('window:RestartPrompt',[],{guideId:'tutorial_generator_factory',receiver}));const next=collectTutorialAdapterTargets(root);applyTutorialAdapterDOM(next,s,{now:3});assert.equal(root.querySelector('[data-tutorial-factory-gesture]'),null);a.apply(request('window:StopPrompt',[],{guideId:'tutorial_generator_factory',receiver}));applyTutorialAdapterDOM(next,s,{now:8});assert.equal(root.querySelector('[data-tutorial-factory-gesture]'),null);
 }finally{dom.window.close();}
});
test('viewport adapter centers the given source target, never the whole list, and rejects an absent native transform',()=>{
 const dom=new JSDOM('<main><div class="game-customer-lane"><article id="order"></article></div></main>');try{const root=dom.window.document.querySelector('main'),area=root.querySelector('.game-customer-lane'),item=root.querySelector('article');Object.defineProperties(area,{clientWidth:{value:100},clientHeight:{value:50}});Object.defineProperties(item,{offsetLeft:{value:350},offsetWidth:{value:100},offsetTop:{value:0},offsetHeight:{value:50}});let moved=null;area.scrollTo=v=>moved=v;
  registerTutorialAdapterTarget(root,item,{id:'order.uid1',kind:'order-cell',sourceWindow:'MainBoard',role:'order-cell',capabilities:[],actions:[]});const bundle=collectTutorialAdapterTargets(root),s=createTutorialAdapterState(),a=session(s,bundle.registry),call='MainBoardView.GetInstance():GetOrderArea():ScrollToMiddle';
  assert.equal(a.apply(request(call,[null])).status,'unknown');assert.equal(a.apply(request(call,[{$tutorialTarget:'order.uid1'}])).ok,true);assert.equal(applyTutorialAdapterDOM(bundle,s).ok,true);assert.equal(moved.left,350);assert.equal(moved.top,0);
 }finally{dom.window.close();}
});
const lit=v=>({v}),program=body=>({parameters:[],body:body.map(i=>({sourceId:'probe',lineStart:1,lineEnd:1,...i}))});
function synthetic(body,guides=['a']){return {tutorialCatalogConfig:{schemaVersion:1,revision:'a'.repeat(64),guides:guides.map(id=>({id,name:id,constants:{},configConditions:[],sourceRefs:[],unimplemented:[],programs:{OnStart:program(body)}}))}};}
test('inline adapter read-after-write is source ordered and a later unknown rolls back both store and progression',()=>{
 const write={op:'effect-required',id:'flag',callee:'GM.MiscModel:SetWheelTutorial',arguments:[lit(1)]},read={op:'assign',targets:['self.seen'],values:[{call:'GM.MiscModel:GetWheelTutorialInNumber',args:[],factId:'read'}]},good=synthetic([write,read]),s=createTutorialRuntime(good),a=createTutorialAdapterState();
 const r=tutorialRuntimeEvent(s,{type:'reconcile'},ctx,good,{adapterState:a,registry:empty});assert.equal(r.ok,true);assert.equal(s.entries.a.state.variables.seen,1);assert.equal(a.misc.WheelTutorial,'1');
 const bad=synthetic([write,{op:'assign',targets:['self.unknown'],values:[{call:'Missing.Required',args:[],factId:'required'}]}]),t=createTutorialRuntime(bad),b=createTutorialAdapterState();const before=structuredClone(b);tutorialRuntimeEvent(t,{type:'reconcile'},ctx,bad,{adapterState:b,registry:empty});assert.deepEqual(b,before);assert.equal(t.entries.a,undefined);assert.equal(t.diagnostics.a.status,'unknown');
});
test('shared external writes require a declared research order and then re-evaluate against the preceding committed store',()=>{
 const data=synthetic([{op:'effect-required',id:'flag',callee:'GM.MiscModel:SetWheelTutorial',arguments:[lit(1)]}],['a','b']),s=createTutorialRuntime(data),a=createTutorialAdapterState(),options={adapterState:a,registry:empty};
 assert.equal(tutorialRuntimeEvent(s,{type:'reconcile'},ctx,data,options).status,'ambiguous-order');assert.deepEqual(a.misc,{});assert.deepEqual(Object.keys(s.entries),[]);
 assert.equal(tutorialRuntimeEvent(s,{type:'choose-order',order:['b','a']},ctx,data,options).ok,true);assert.equal(a.operations.length,2);assert.deepEqual(a.operations.map(x=>x.guideId),['b','a']);assert.equal(a.misc.WheelTutorial,'1');
});
test('original factory source progresses on real inventory/tab events and exact source callback, with adapter restart and independent DB',()=>{
 const data={tutorialCatalogConfig:{...catalog,guides:catalog.guides.filter(g=>g.id==='tutorial_generator_factory')}},s=createTutorialRuntime(data),a=createTutorialAdapterState();let c={...ctx,generatorFactoryOpen:true,gameMode:'Main',allWindowsClosed:true,mainBoardViewAvailable:true},dom=new JSDOM('<main><div class="game-bottom"><button data-play="inventory">보관함</button></div></main>'),root=dom.window.document.querySelector('main');
 try{let bundle=collectTutorialAdapterTargets(root),options=()=>({adapterState:a,registry:bundle.registry}),send=e=>{const r=tutorialRuntimeEvent(s,e,c,data,options());assert.equal(r.ok,true,r.message+' '+r.diagnostic);return r;};
  send({type:'reconcile',now:0});send({type:'clock',now:1});assert.equal(a.anonymousLocks,1);let v=tutorialRuntimeView(s,tutorialAdapterContext(a,bundle.registry,c),data);assert.equal(tutorialRuntimePermissionFromView(v,'runtime:mask').allowed,false);
  send({type:'clock',now:1.5});assert.equal(a.anonymousLocks,0);assert.equal(s.entries.tutorial_generator_factory.state.phase,'1');v=tutorialRuntimeView(s,tutorialAdapterContext(a,bundle.registry,c),data);assert.equal(v.active[0].binding.key,'hud.inventory');assert.equal(tutorialRuntimePermissionFromView(v,'inventory').allowed,true);
  root.innerHTML='<dialog class="inventory-dialog"><button data-play="game-factory-open">공장</button></dialog>';bundle=collectTutorialAdapterTargets(root);c={...c,allWindowsClosed:false,openViews:['InventoryWindow']};send({type:'source-event',sourceEvent:'OpenView',payload:{name:'InventoryWindow'},now:1.5});send({type:'clock',now:1.9});assert.equal(s.entries.tutorial_generator_factory.state.phase,'2');assert.equal(a.targets['inventory.window'].promptStopped,true);
  root.innerHTML='<section class="factory-page"><div class="factory-groups"></div></section>';bundle=collectTutorialAdapterTargets(root);send({type:'source-event',sourceEvent:'GeneratorFactoryTabGenButton',now:1.9});assert.equal(s.entries.tutorial_generator_factory.state.phase,'3');const callbackId=s.entries.tutorial_generator_factory.state.mask.id;send({type:'mask-click',guideId:'tutorial_generator_factory',callbackId,now:1.9});assert.deepEqual(s.completed,['tutorial_generator_factory']);assert.equal(a.targets['inventory.window'].promptStopped,false);assert.equal(a.targets['inventory.window'].promptGeneration,1);assert.equal(validTutorialAdapterState(a),true);
 }finally{dom.window.close();}
});
test('unavailable native targets and invalid saves cannot be bypassed with effectResults success claims',()=>{
 const data=synthetic([{op:'effect-required',id:'native-scroll',callee:'window:SetScrollEnabled',arguments:[lit(false)]}]),s=createTutorialRuntime(data),a=createTutorialAdapterState(),before=structuredClone(a);tutorialRuntimeEvent(s,{type:'reconcile'},{...ctx,effectResults:{'native-scroll':{applied:true,origin:'research'}}},data,{adapterState:a,registry:empty});assert.equal(s.entries.a,undefined);assert.equal(s.diagnostics.a.status,'unknown');assert.deepEqual(a,before);
 const invalid={...a,targets:{x:{scrollRequest:{kind:'middle',generation:1}}}},copy=structuredClone(s);assert.equal(tutorialRuntimeEvent(s,{type:'reconcile'},ctx,data,{adapterState:invalid,registry:empty}).status,'invalid-adapter-state');assert.deepEqual(s,copy);assert.equal(tutorialAdapterPermission(a,empty,'generate').allowed,true);
 assert.ok(TUTORIAL_ADAPTER_SOURCES.every(s=>/^[0-9a-f]{64}$/.test(s.sha256)&&s.lineEnd>=s.lineStart));
});
test('disable/enable and source resume clear transient UI ownership but preserve finite tutorial DB and never replay registered guides',()=>{
 const id='tutorial_generator_factory',data={tutorialCatalogConfig:{...catalog,guides:catalog.guides.filter(g=>g.id===id)}},s=createTutorialRuntime(data),a=createTutorialAdapterState(),c={...ctx,generatorFactoryOpen:false,gameMode:'Main',allWindowsClosed:true},options={adapterState:a,registry:empty};
 tutorialRuntimeEvent(s,{type:'reconcile',now:0},c,data,options);assert.equal(s.entries[id].state.pending.length,1);a.misc.WheelTutorial='1';a.anonymousLocks=1;a.targets.unmounted={scrollEnabled:false};
 assert.equal(tutorialRuntimeEvent(s,{type:'disable',now:0},c,data,options).ok,true);assert.equal(s.entries[id].state.pending.length,0);assert.equal(a.anonymousLocks,0);assert.deepEqual(a.targets,{});assert.equal(a.misc.WheelTutorial,'1');
 assert.equal(tutorialRuntimeEvent(s,{type:'enable',now:0},c,data,options).ok,true);assert.equal(s.entries[id].state.pending.length,1,'unregistered source OnStart is reconstructed');
 s.entries[id].state.registeredFinished.push(id);s.registered.push(id);a.anonymousLocks=1;assert.equal(tutorialRuntimeEvent(s,{type:'resume',now:0},c,data,options).ok,true);assert.equal(a.anonymousLocks,0);assert.deepEqual(s.completed,[]);assert.equal(s.entries[id].state.pending.length,0);assert.equal(s.entries[id].state.active,null);assert.equal(a.misc.WheelTutorial,'1');
});
test('Finish does not terminate the current Lua callback: later required UI work executes or rolls back the whole callback',()=>{
 const body=[{op:'finish'},{op:'effect-required',id:'cleanup',callee:'window:SetScrollEnabled',arguments:[lit(true)]}],data=synthetic(body),s=createTutorialRuntime(data),a=createTutorialAdapterState();
 tutorialRuntimeEvent(s,{type:'reconcile'},ctx,data,{adapterState:a,registry:empty});assert.deepEqual(s.completed,[]);assert.equal(s.entries.a,undefined);assert.equal(s.diagnostics.a.status,'unknown');assert.equal(a.sequence,0);
});
test('runtime documentation exposes all85 operation categories and immutable source anchors without claiming guide completion',()=>{
 const data={tutorialCatalogConfig:catalog},s=createTutorialRuntime(data),dom=new JSDOM(renderTutorialRuntimePanel(s,ctx,data));try{const d=dom.window.document;assert.ok(d.querySelector('[href="data/tutorial-adapter-coverage.json"]'));assert.equal(d.querySelector('[aria-label="튜토리얼 외부 연산 전체"] tbody').children.length,85);assert.ok(d.body.textContent.includes('안내29종 완료를 뜻하지 않습니다'));}finally{dom.window.close();}
});
test('actual component unmount resets only its transient properties, preserving the same-window tab state, source locks and DB',()=>{
 const dom=new JSDOM('<main><dialog class="inventory-dialog"><button data-play="game-factory-open">공장</button></dialog></main>');try{const root=dom.window.document.querySelector('main'),old=collectTutorialAdapterTargets(root),s=createTutorialAdapterState();s.misc.WheelTutorial='1';s.ownerLocks['guide:a']=1;s.targets['inventory.window']={promptStopped:true};
  root.innerHTML='<section class="factory-page"><div class="factory-groups"></div></section>';const tabs=collectTutorialAdapterTargets(root);assert.equal(tutorialAdapterMountLifecycle(s,old.registry,tabs.registry).ok,true);assert.equal(s.targets['inventory.window'].promptStopped,true);
  root.innerHTML='<div class="game-bottom"><button data-play="inventory">보관함</button></div>';const closed=collectTutorialAdapterTargets(root);assert.equal(tutorialAdapterMountLifecycle(s,tabs.registry,closed.registry).changed,true);assert.equal(s.targets['inventory.window'],undefined);assert.equal(s.misc.WheelTutorial,'1');assert.equal(s.ownerLocks['guide:a'],1);
 }finally{dom.window.close();}
});
test('explicit native-equivalent registration binds separate go/icon/effect parts and leaves the close button enabled',()=>{
 const dom=new JSDOM('<main><section><button data-play="order-item-info" data-tutorial-control="order-icon">정보</button><button data-play="deliver" data-tutorial-control="go">제출</button><button data-play="close">닫기</button><span data-tutorial-part="effect">효과</span></section></main>');try{const root=dom.window.document.querySelector('main'),node=root.querySelector('section');registerTutorialAdapterTarget(root,node,{id:'explicit-order',kind:'order',sourceWindow:'ExplicitSourceWindow',role:'window',capabilities:['goButtonEnabled','orderIconEnabled','effectVisible'],actions:['deliver','order-item-info','close']});const bundle=collectTutorialAdapterTargets(root),s=createTutorialAdapterState(),a=session(s,bundle.registry),receiver={known:true,value:{$tutorialTarget:'explicit-order'}};
  a.apply(request('cell:SetGoButtonEnabled',[false],{receiver}));a.apply(request('cell:SetEffectVisible',[false],{receiver}));applyTutorialAdapterDOM(bundle,s);assert.equal(node.querySelector('[data-play="deliver"]').disabled,true);assert.equal(node.querySelector('[data-play="order-item-info"]').disabled,false);assert.equal(node.querySelector('[data-play="close"]').disabled,false);assert.equal(node.hidden,false);assert.equal(node.querySelector('[data-tutorial-part="effect"]').hidden,true);assert.equal(tutorialAdapterPermission(s,bundle.registry,'deliver').allowed,false);assert.equal(tutorialAdapterPermission(s,bundle.registry,'close').allowed,true);
 }finally{dom.window.close();}
});
