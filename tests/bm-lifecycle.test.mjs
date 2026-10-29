import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runBMLifecycle,snapshotBMLifecycle} from '../src/bm-lifecycle.mjs';
import {createPlay,advancePlay} from '../src/play-model.mjs';
import {dispatchCommerce,reconcileCommerce} from '../src/commerce-model.mjs';

const load=async name=>JSON.parse(await readFile(new URL('../src/data/'+name,import.meta.url),'utf8'));
const catalog=await load('bm-lifecycle.json'),playConfig=await load('play-config.json');
const preset=id=>structuredClone(catalog.presets.find(item=>item.id===id));
const event=(run,id)=>run.events.find(item=>item.id===id);

test('the replay requires explicit research mode and rejects decreasing or invalid event times before executing anything',()=>{
 const sample=preset('duration-boundaries');delete sample.mode;
 assert.equal(runBMLifecycle(sample,catalog,{playConfig}).ok,false);
 for(const bad of [-1,NaN,Infinity,0.5]){const s=preset('duration-boundaries');s.events[0].at=bad;const result=runBMLifecycle(s,catalog,{playConfig});assert.equal(result.ok,false);assert.equal(result.events.length,0);}
 const decreasing=preset('duration-boundaries');decreasing.events=[{id:'a',at:10,kind:'probe'},{id:'b',at:9,kind:'probe'}];
 assert.equal(runBMLifecycle(decreasing,catalog,{playConfig}).status,'invalid-scenario');
 assert.equal(runBMLifecycle('duration-boundaries',catalog,{}).status,'missing-play-config');
});

test('replay does not mutate catalog, caller scenario, source play config or caller-owned play state',()=>{
 const scenario=preset('duration-boundaries'),before=JSON.stringify({scenario,catalog,playConfig});
 const result=runBMLifecycle(scenario,catalog,{playConfig});assert.equal(result.ok,true);
 assert.equal(JSON.stringify({scenario,catalog,playConfig}),before);
 assert.equal(result.mode,'research');assert.equal(result.originalRuntimeObserved,false);assert.ok(result.boundaries.length);
 assert.ok(result.events.every(entry=>entry.evidenceType==='research-replay'));
});

test('group end, item end and cooldown end come from the actual commerce model with source equality disagreement retained',()=>{
 const result=runBMLifecycle('duration-boundaries',catalog,{playConfig});
 const created=event(result,'create').after;
 assert.equal(created.groupState,'Open');assert.equal(created.groupEnd,120);assert.equal(created.itemEnd,60);assert.equal(created.triggerCount,1);
 const equality=event(result,'item-equality');assert.equal(equality.after.existing,false);
 const comparison=equality.comparisons.find(item=>item.id==='item-expiry-equality');assert.equal(comparison.status,'gap');assert.equal(comparison.actual,false);assert.equal(comparison.sourcePrediction,true);
 assert.equal(event(result,'item-after').comparisons.find(item=>item.id==='item-expiry-equality').status,'aligned');
 const renewed=event(result,'regenerate').after;assert.equal(renewed.groupEnd,120);assert.equal(renewed.itemEnd,121);assert.equal(renewed.triggerCount,2);
 const cooling=event(result,'group-boundary').after;assert.equal(cooling.groupState,'CoolingDown');assert.equal(cooling.cooldownEnd,180);assert.equal(cooling.existing,true);
 const reset=event(result,'cooldown-boundary').after;assert.equal(reset.groupState,'None');assert.equal(reset.left,0);
});

test('existing bundle can be selected after daily creation quota is consumed and closing evaluation does not mint a bundle',()=>{
 const result=runBMLifecycle('duration-boundaries',catalog,{playConfig});
 const closed=event(result,'close-existing');assert.equal(closed.after.route,'EnergyBundle');assert.equal(closed.before.triggerCount,closed.after.triggerCount);
 const quota=event(result,'quota-existing');assert.equal(quota.after.triggerCount,3);assert.equal(quota.after.canGenerate,false);assert.equal(quota.after.existing,true);assert.equal(quota.after.route,'EnergyBundle');
});

test('unsupported EnergyGift IAP and duplicate success requests never issue rewards or consume left count',()=>{
 const result=runBMLifecycle('duration-boundaries',catalog,{playConfig});
 for(const id of ['purchase-unsupported','purchase-duplicate']){const entry=event(result,id);assert.equal(entry.result.status,'unsupported');assert.equal(entry.result.ok,false);assert.deepEqual(entry.before.wallet,entry.after.wallet);assert.equal(entry.after.left,entry.before.left);assert.equal(entry.comparisons.find(item=>item.id==='energy-iap-unsupported').status,'unimplemented');}
 assert.equal(result.receiptsVerified,0);assert.equal(result.rewardsIssuedByHarness,0);
});

test('day probe records eager web reset separately from source reset-on-trigger and normal wallet price reset',()=>{
 const result=runBMLifecycle('day-and-config',catalog,{playConfig});
 const created=event(result,'before-midnight');assert.equal(created.after.triggerCount,1);assert.equal(created.after.wallet.price,20);
 const day=event(result,'day-probe');assert.equal(day.after.triggerCount,0);assert.equal(day.after.triggerDay,1);assert.equal(day.after.wallet.price,10);assert.equal(day.after.wallet.freeUsed,1);
 const difference=day.comparisons.find(item=>item.id==='daily-reset-timing');assert.equal(difference.status,'gap');assert.equal(difference.actual,0);assert.equal(difference.sourcePrediction,1);
});

test('same group ID is an explicit source assumption and whole-input web signature resets are not silently fixed',()=>{
 const result=runBMLifecycle('day-and-config',catalog,{playConfig});
 const changed=event(result,'same-group-edit');assert.equal(changed.before.groupState,'Open');assert.equal(changed.after.groupState,'None');assert.equal(changed.after.left,0);
 assert.equal(changed.comparisons.find(item=>item.id==='config-identity-reset').status,'conditional-gap');
 assert.equal(event(result,'recreate-after-edit').after.groupEnd,86700);
 const unknown=preset('day-and-config');delete unknown.events.find(item=>item.id==='same-group-edit').sourceAssumption;
 assert.equal(event(runBMLifecycle(unknown,catalog,{playConfig}),'same-group-edit').comparisons.find(item=>item.id==='config-identity-reset').status,'input-unknown');
});

test('follow-up priority reuses the actual route, exact cooldown and fixed-money tie; missing prices remain unknown',()=>{
 const result=runBMLifecycle('followup-priority',catalog,{playConfig});
 assert.equal(event(result,'plenty-first').after.route,'PlentyBundle');assert.equal(event(result,'plenty-first').after.moreNextAt,160);
 assert.equal(event(result,'cooldown-blocked').after.route,null);
 const missing=event(result,'prices-unknown');assert.equal(missing.after.route,null);assert.ok(missing.after.routeUnknown);
 assert.equal(event(result,'tie-chain').after.route,'ChainBundle');assert.equal(event(result,'tie-chain').after.moreNextAt,221);
 assert.equal(event(result,'no-next-chain-payid').after.route,'NewWeeklyBundle');
});

test('first-positive normal-cost comparison exposes the current free-refill discrepancy without changing shared commerce',()=>{
 const s=preset('followup-priority');s.initial.wallet.freeUsed=0;s.events=[{id:'free-close',at:100,kind:'commerceAction',action:'commerce-trigger',value:'close'}];
 const run=runBMLifecycle(s,catalog,{playConfig}),entry=event(run,'free-close'),comparison=entry.comparisons.find(item=>item.id==='more-free-normal-price');
 assert.equal(entry.after.route,null);assert.equal(comparison.actual,0);assert.equal(comparison.sourcePrediction,20);assert.equal(comparison.status,'gap');
});

test('missing server fields and runtime LateInit are input-unknown rather than supplied by an invented default',()=>{
 const s=preset('duration-boundaries');s.input.energyGift.groupCD=null;delete s.sourceInputs.lateInited;s.events=[{id:'check',at:0,kind:'probe'}];
 const run=runBMLifecycle(s,catalog,{playConfig});assert.equal(run.ok,true);assert.equal(run.final.configured,false);assert.equal(run.final.sourcePredicate.status,'input-unknown');
 assert.ok(run.unknown.some(value=>value.includes('groupCD')));assert.ok(run.unknown.some(value=>value.includes('lateInited')));
});

test('identical-time probes are read-only and never add implicit per-second ticks',()=>{
 const s=preset('duration-boundaries');s.events=[{id:'create',at:0,kind:'commerceAction',action:'commerce-trigger',value:'lack'},{id:'one',at:0,kind:'probe'},{id:'two',at:0,kind:'probe'}];
 const run=runBMLifecycle(s,catalog,{playConfig});assert.deepEqual(event(run,'one').before,event(run,'one').after);assert.deepEqual(event(run,'two').before,event(run,'two').after);
});

test('jumping from Open to exactly groupEnd plus cooldown needs another update call; later than that clears directly',()=>{
 const s=preset('duration-boundaries');s.events=[{id:'create',at:0,kind:'commerceAction',action:'commerce-trigger',value:'lack'},
  {id:'sum',at:180,kind:'advanceClock'},{id:'read',at:180,kind:'probe'},
  {id:'next-call',at:180,kind:'commerceAction',action:'commerce-trigger',value:'close'}];
 const run=runBMLifecycle(s,catalog,{playConfig});assert.equal(event(run,'sum').after.groupState,'CoolingDown');assert.equal(event(run,'read').after.groupState,'CoolingDown');assert.equal(event(run,'next-call').after.groupState,'None');
 s.events=[s.events[0],{id:'later',at:181,kind:'advanceClock'}];assert.equal(event(runBMLifecycle(s,catalog,{playConfig}),'later').after.groupState,'None');
});

test('a new day refreshes the web trigger count without bypassing the active group cooldown',()=>{
 const s=preset('duration-boundaries');s.initial.wallet.time=86300;s.input.energyGift.groupDuration=1;s.input.energyGift.groupCD=2;s.input.energyGift.dailyTriggerUpper=1;
 s.events=[{id:'create',at:86300,kind:'commerceAction',action:'commerce-trigger',value:'lack'},
  {id:'cool',at:86360,kind:'advanceClock'},{id:'day',at:86400,kind:'advanceClock'},
  {id:'retry',at:86400,kind:'commerceAction',action:'commerce-trigger',value:'lack'}];
 const run=runBMLifecycle(s,catalog,{playConfig});assert.equal(event(run,'day').after.triggerCount,0);assert.equal(event(run,'day').after.groupState,'CoolingDown');
 assert.equal(event(run,'retry').after.triggerCount,0);assert.equal(event(run,'retry').after.sourcePredicate.result.firstFailure,'cooldown');
});

test('clock and commerce actions match direct existing-model calls rather than a second lifecycle state machine',()=>{
 const scenario=preset('duration-boundaries');scenario.events=scenario.events.slice(0,3);
 const run=runBMLifecycle(scenario,catalog,{playConfig}),state=createPlay(playConfig);
 Object.assign(state.wallet,scenario.initial.wallet);state.stage='play';reconcileCommerce(state,playConfig);
 const flatten=(value,prefix='')=>Object.entries(value).flatMap(([key,item])=>item!==null&&typeof item==='object'&&!Array.isArray(item)?flatten(item,prefix+key+'.'):[[prefix+key,item]]);
 for(const [field,value]of flatten(scenario.input))dispatchCommerce(state,playConfig,'commerce-input',{field,value});
 dispatchCommerce(state,playConfig,'commerce-trigger','lack');advancePlay(state,10,playConfig,{silent:true});dispatchCommerce(state,playConfig,'commerce-trigger','close');advancePlay(state,50,playConfig,{silent:true});
 const actual=snapshotBMLifecycle(state,playConfig,{sourceInputs:scenario.sourceInputs});assert.deepEqual(run.final,actual);
});

test('real play close-offer is retained as a dismissal, distinct from the source BundleEnergyWindow follow-up branch',()=>{
 const s=preset('duration-boundaries');s.events=[{id:'create',at:0,kind:'commerceAction',action:'commerce-trigger',value:'lack'},
  {id:'open',at:0,kind:'playAction',action:'open-energy'},{id:'close-energy',at:0,kind:'playAction',action:'close-energy'},
  {id:'dismiss',at:0,kind:'playAction',action:'close-offer'}];
 const run=runBMLifecycle(s,catalog,{playConfig}),dismiss=event(run,'dismiss');assert.equal(dismiss.before.modal,'offer');assert.equal(dismiss.after.modal,null);
 assert.equal(dismiss.comparisons.find(item=>item.id==='close-offer-routing').status,'unimplemented');
});

test('catalog source anchors distinguish raw Lua hashes and canonical UTF-8/LF web bytes',async()=>{
 for(const ref of catalog.webSources){const file=await readFile(new URL('../src/'+ref.path.replace(/^src\//,''),import.meta.url),'utf8');assert.equal(createHash('sha256').update(file.replace(/\r\n/g,'\n'),'utf8').digest('hex'),ref.sha256);assert.equal(ref.hashPolicy,'UTF-8/LF');}
 for(const ref of catalog.sources){assert.match(ref.sha256,/^[a-f0-9]{64}$/);assert.ok(ref.line_start>=1&&ref.line_end>=ref.line_start);assert.equal(ref.hashPolicy,'raw-file-bytes');assert.equal(ref.evidenceType,'static-code');}
 assert.equal(catalog.presets.length,3);for(const scenario of catalog.presets)assert.equal(scenario.mode,'research');
 assert.doesNotMatch(JSON.stringify(catalog),/[CD]:[\\/]|@gmail\.com|originalPath/);
});
