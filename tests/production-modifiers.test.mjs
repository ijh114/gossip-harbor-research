import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionModifiers,createProductionModifierPlan,validProductionModifiers,discoActivationEffects,noCooldownActivationEffects} from '../src/production-modifiers.mjs';
import * as Modifiers from '../src/production-modifiers.mjs';

function config(){
 const items=[...[1,2,3,8].flatMap(ch=>Array.from({length:ch===8?5:8},(_,i)=>({type:String(ch*100+i+1),chainId:String(ch),chainLevel:i+1})))];
 return {items,orderRules:{itemConfig:[]},spreadRules:{byType:{'106':{type:'106',pool:[{type:'201',weight:90},{type:'301',weight:10}],costEnergy:true,cooldownSeconds:2,storageRecoverySeconds:30},'1006':{type:'1006',pool:[{type:'201',weight:1}],costEnergy:false,cooldownSeconds:2,storageRecoverySeconds:30}},boostTargetTypes:['106']},
 productionRules:{luckyConfigs:[{generators:['106'],chance:[2,1],pool:[{type:'201',weight:1},{type:'203',weight:1}],superItems:['203'],minLevel:1,maxLevel:999}],subChainMap:{'1':'3'},specialGeneratorChains:[],rawFishType:'805',rawFishChain:'8',generatorItemTypes:['106','1006','805'],discoExitScore:8,continuationSeconds:10,boostHistorySize:4}};
}
function state(){return {board:Array(63).fill(null),wallet:{level:3,time:0,energy:100},inventory:{items:[]},orders:{slots:[]},generatorState:{},productionModifiers:createProductionModifiers()};}
const inputs=extra=>({generatorType:'106',...extra});
const sequence=values=>{let i=0;return ()=>values[Math.min(i++,values.length-1)];};
const hook=(p,name,arg)=>p.hooks[name]({...arg,random:arg.random||(()=>0)});

test('missing server inputs keep modifiers inactive and active incomplete disco fails without source mutation',()=>{
 const c=config(),s=state(),before=structuredClone(s),p=createProductionModifierPlan(s,c,{});assert.equal(p.ok,true);assert.equal(p.context.luckyActive,false);assert.equal(p.context.discoActive,false);assert.equal(p.context.smartProduceActive,false);
 assert.equal(createProductionModifierPlan(s,c,inputs({disco:{active:true,score:20}})).ok,false);assert.deepEqual(s,before);
});
test('lucky finite buckets guarantee one hit in a two-draw research bucket without IID substitution',()=>{
 const c=config(),s=state(),i=inputs({lucky:{active:true}});let p=createProductionModifierPlan(s,c,i);
 assert.equal(hook(p,'resolveLucky',{type:'106',maxBoostRatio:0,random:sequence([0.99])}),null);s.productionModifiers=p.finalize({ok:true,energy:1,boostRatio:0,branch:'fixed'}).state;
 assert.deepEqual(s.productionModifiers.lucky.buckets['106'],{totalLeft:1,luckyLeft:1});p=createProductionModifierPlan(s,c,i);
 const lucky=hook(p,'resolveLucky',{type:'106',maxBoostRatio:0,random:sequence([0.1,0.99])});assert.equal(lucky.type,'203');assert.equal(lucky.kind,'super-lucky');assert.deepEqual(p.getState().lucky.buckets['106'],{totalLeft:0,luckyLeft:0});
});
test('failed spread never commits a lucky miss or consumes thresholds',()=>{
 const c=config(),s=state(),before=structuredClone(s),p=createProductionModifierPlan(s,c,inputs({lucky:{active:true}}));hook(p,'resolveLucky',{type:'106',maxBoostRatio:0,random:()=>0.99});const result=p.finalize({ok:false});assert.equal(result.ok,false);assert.deepEqual(s,before);assert.deepEqual(result.state,s.productionModifiers);
});
test('free lucky consumes one due threshold while preserving total and lucky bucket counts',()=>{
 const c=config(),s=state();s.productionModifiers.lucky.freeThresholds=[0];const p=createProductionModifierPlan(s,c,inputs({lucky:{active:true}}));
 const r=hook(p,'resolveLucky',{type:'106',maxBoostRatio:0,random:sequence([0.99,0])});assert.equal(r.kind,'free-lucky');assert.deepEqual(p.getState().lucky.buckets['106'],{totalLeft:2,luckyLeft:1});assert.deepEqual(p.getState().lucky.freeThresholds,[]);
});
test('triple continuation precedes normal buckets and extends its exact ten-second window',()=>{
 const c=config(),s=state(),settings=inputs({lucky:{active:true,specialRanges:[{range:[0,100],extraLucky:0,tripleChance:10000,doubleChance:0}]}});let p=createProductionModifierPlan(s,c,settings);
 hook(p,'resolveLucky',{type:'106',maxBoostRatio:0,random:()=>0});s.productionModifiers=p.finalize({ok:true,energy:1,boostRatio:0,branch:'lucky-external'}).state;assert.equal(s.productionModifiers.lucky.continuation.maxCount,2);
 s.wallet.time=10;p=createProductionModifierPlan(s,c,settings);const before={...p.getState().lucky.buckets['106']};const r=hook(p,'resolveLucky',{type:'106',maxBoostRatio:0,random:()=>0});assert.equal(r.kind,'triple-lucky-1');assert.deepEqual(p.getState().lucky.buckets['106'],before);assert.equal(p.getState().lucky.continuation.expiresAt,20);
});
test('boost history adjustment uses ceil latest sample mean and success finalization records at most once',()=>{
 const c=config(),s=state();s.productionModifiers.lucky.boostHistory=[0,1,2,2];const p=createProductionModifierPlan(s,c,inputs({lucky:{active:true,adjustBoostRatio:true}}));const r=hook(p,'resolveLucky',{type:'106',maxBoostRatio:3,random:()=>0});assert.equal(r.adjustedBoostRatio,2);
 const normal=createProductionModifierPlan(s,c,inputs({lucky:{adjustBoostRatio:true}}));const a=normal.finalize({ok:true,energy:4,boostRatio:2,branch:'fixed'}),b=normal.finalize({ok:true,energy:4,boostRatio:2,branch:'fixed'});assert.deepEqual(a.state.lucky.boostHistory,[1,2,2,2]);assert.deepEqual(a,b);
});
test('energy consumption enters the source range and samples unique free thresholds before final commit',()=>{
 const c=config(),s=state(),p=createProductionModifierPlan(s,c,inputs({lucky:{active:true,specialRanges:[{range:[1,5],extraLucky:2,tripleChance:0,doubleChance:0}]}}));
 p.hooks.afterEnergyConsumed({energy:1,boostRatio:0,branch:'fixed',random:sequence([0,0.99])});assert.deepEqual(p.getState().lucky.freeThresholds,[1,5]);
 const done=p.finalize({ok:true,type:'201',energy:1,boostRatio:0,branch:'fixed'});assert.equal(done.state.lucky.energyCost,1);assert.deepEqual(done.state.lucky.freeThresholds,[1,5]);
 const tomorrow=state();tomorrow.wallet.time=86400;tomorrow.productionModifiers.lucky.energyCost=5;tomorrow.productionModifiers.lucky.freeThresholds=[5];const reset=createProductionModifierPlan(tomorrow,c,inputs({lucky:{active:true,specialRanges:[{range:[1,5],extraLucky:2,tripleChance:0,doubleChance:0}]}}));assert.equal(reset.getState().lucky.energyCost,0);assert.deepEqual(reset.getState().lucky.freeThresholds,[]);
});
test('infinite-energy normal production can record boost history but an extra-normal spread label cannot',()=>{
 const c=config(),s=state(),input=inputs({lucky:{adjustBoostRatio:true}}),infinite=createProductionModifierPlan(s,c,input);
 infinite.hooks.afterEnergyConsumed({energy:0,costEnergy:true,automatic:false,extra:false,boostRatio:2,branch:'fixed'});assert.deepEqual(infinite.getState().lucky.boostHistory,[2]);
 const extra=createProductionModifierPlan(s,c,input);extra.hooks.afterEnergyConsumed({energy:4,costEnergy:true,automatic:false,extra:true,boostRatio:2,branch:'fixed'});assert.deepEqual(extra.getState().lucky.boostHistory,[]);
 const tutorial=createProductionModifierPlan(s,c,input);tutorial.hooks.afterEnergyConsumed({energy:1,costEnergy:true,automatic:false,extra:false,boostRatio:0,branch:'tutorial'});assert.deepEqual(tutorial.getState().lucky.boostHistory,[0],'forced output keeps the source Normal spread label');
});
test('active missing order snapshot and nonboolean server-state flags are rejected before resolver randomness',()=>{
 const c=config(),s=state();delete s.orders;
 assert.equal(createProductionModifierPlan(s,c,inputs({smartProduce:{active:true}})).ok,false);
 assert.equal(createProductionModifierPlan(state(),c,inputs({generatorBoost:{active:true,extraProduce:'yes',extraChance:[1,1]}})).ok,false);
});
test('order snapshots reject unbounded counts, unknown types and duplicate or out-of-range slots before expansion',()=>{
 const c=config(),s=state(),valid={slot:1,requirements:[{type:'201',count:3}]};
 for(const orders of [null,Array.from({length:20},(_,i)=>({...valid,slot:i+1})),[valid,valid],[{...valid,slot:0}],[{...valid,slot:20}],[{...valid,requirements:[{type:'unknown',count:1}]}],[{...valid,requirements:[{type:'201',count:1000000000}]}],[{...valid,requirements:[{type:'201',count:0}]}],[{...valid,requirements:['201','201','201','201']}],[{...valid,requirements:[{type:'201',count:2},{type:'202',count:2}]}],[{...valid,state:'unverified-state'}]]){
  const before=structuredClone(s),p=createProductionModifierPlan(s,c,inputs({smartProduce:{active:true},orders}));assert.equal(p.ok,false);assert.deepEqual(s,before);
 }
 const raw=createProductionModifierPlan(s,c,inputs({smartProduce:{active:true},orders:[{slot:1,requirements:['201','201','201'],state:3}]}));assert.equal(raw.ok,true);
 const maximum=createProductionModifierPlan(s,c,inputs({smartProduce:{active:true},orders:Array.from({length:19},(_,i)=>({...valid,slot:i+1}))}));assert.equal(maximum.ok,true);
 s.orders.slots=[{slot:1,requirements:[{type:'201',count:1e9}]}];assert.equal(createProductionModifierPlan(s,c,inputs()).ok,false,'implicit saved order snapshots are validated too');
});
test('smart production prioritizes unmet mergeable subchain demand and does not boost a merge-satisfied chain',()=>{
 const c=config(),s=state();s.orders.slots=[{slot:1,requirements:[{type:'303',count:1}]}];let p=createProductionModifierPlan(s,c,inputs({smartProduce:{active:true}}));assert.equal(hook(p,'resolveSmartProduce',{type:'106',random:()=>0}),'301');
 s.board[0]={uid:1,type:'301',cover:null};s.inventory.items=[{uid:2,type:'301',cover:null},{uid:3,type:'301',cover:null},{uid:4,type:'301',cover:null}];p=createProductionModifierPlan(s,c,inputs({smartProduce:{active:true}}));assert.equal(hook(p,'resolveSmartProduce',{type:'106',random:()=>0}),null);
});
test('fishnet smart fills a power-of-two board-only gap by lowering the item and retaining energy ratio',()=>{
 const c=config(),s=state();for(let i=0;i<8;i++)s.board[i]={uid:i+1,type:'801',cover:null};const p=createProductionModifierPlan(s,c,inputs({fishNet:{active:true}}));assert.equal(hook(p,'resolveFishNet',{type:'805',ratio:2}),'804');
 s.inventory.items.push({uid:99,type:'804',cover:null});const q=createProductionModifierPlan(s,c,inputs({fishNet:{active:true}}));assert.equal(hook(q,'resolveFishNet',{type:'805',ratio:2}),'804','stored fish is excluded');
});
test('disco direct selection respects score plus8 allowance and closes without normal charge or energy costs',()=>{
 const c=config(),s=state();s.orders.slots=[{slot:1,requirements:['205']}];const p=createProductionModifierPlan(s,c,inputs({disco:{active:true,score:4,property:'test',difficultyLevel:10}}));assert.equal(p.context.discoActive,true);
 const r=hook(p,'resolveDisco',{type:'106',random:()=>0});assert.equal(r.type,'204');const done=p.finalize({ok:true,type:r.type,energy:0,boostRatio:0,branch:'disco-external'});assert.equal(done.state.disco.score,0);assert.equal(done.effects.discoClosed,true);
});
test('disco fallback limiter steps difficulty and boost ratio down instead of inventing a cheaper reward',()=>{
 const c=config(),s=state(),p=createProductionModifierPlan(s,c,inputs({disco:{active:true,score:1,property:'test',difficultyLevel:1}}));assert.equal(hook(p,'resolveDisco',{type:'106',random:()=>0}),null);
 const r=hook(p,'resolveDiscoLimit',{type:'205',ratio:3});assert.equal(r.type,'204');assert.equal(r.ratio,2);assert.equal(r.costCount,0);assert.equal(p.getState().disco.score,0);
});
test('normal extra production uses its own depletion bucket and caches when only one empty position is available',()=>{
 const c=config(),s=state(),i=inputs({generatorBoost:{active:true,extraProduce:true,extraChance:[1,1]}});let p=createProductionModifierPlan(s,c,i);assert.equal(hook(p,'afterBaseGeneration',{generatorType:'106',outputType:'201',random:()=>0}).extra,true);const done=p.finalize({ok:true,type:'201',energy:1,boostRatio:0,branch:'fixed'});assert.deepEqual(done.effects.additionalSpreads,[{type:'201',count:1,costEnergy:false,reason:'generator-boost-extra'}]);
 const b=state();for(let n=0;n<62;n++)b.board[n]={uid:n+1,type:'201',cover:null};p=createProductionModifierPlan(b,c,i);assert.equal(hook(p,'afterBaseGeneration',{generatorType:'106',outputType:'201',random:()=>0}).extra,false);assert.equal(p.getState().generatorBoost.extraCached,true);
});
test('BuffSmart bypasses the extra-production bucket while GeneratorBoostSmart reaches it',()=>{
 const c=config(),s=state(),p=createProductionModifierPlan(s,c,inputs({smartProduce:{active:true},generatorBoost:{active:true,extraProduce:true,extraChance:[1,1]}}));
 assert.equal(hook(p,'afterBaseGeneration',{generatorType:'106',outputType:'301',smart:true,random:()=>{throw new Error('must not draw');}}).extra,false);
 assert.deepEqual(p.getState().generatorBoost.extraBucket,{totalLeft:0,luckyLeft:0});
 const q=createProductionModifierPlan(s,c,inputs({generatorBoost:{active:true,smart:true,extraProduce:true,extraChance:[1,1]}}));
 assert.equal(hook(q,'afterBaseGeneration',{generatorType:'106',outputType:'301',smart:true}).extra,true);
});
test('NoCD and disco activation force only eligible zero-charge active generator timers, including stored state',()=>{
 const c=config(),s=state();s.board[0]={uid:1,type:'106',cover:null};s.generatorState[1]={charges:0,timerStart:0};const p=createProductionModifierPlan(s,c,inputs({buffNoCooldown:true}));assert.equal(p.finalize({ok:true,type:'201',energy:1,boostRatio:0,branch:'fixed'}).effects.skipSourceCooldown,true);
 s.inventory.items=[{uid:2,type:'106',cover:null}];s.generatorState[2]={charges:0,timerStart:0};assert.deepEqual(discoActivationEffects(s,c).sort(),[1,2]);
});
test('NoCD logic activation skips board zero-charge timers and all eligible stored timers, only on an individual transition',()=>{
 const c=config(),s=state();s.board[0]={uid:1,type:'106',cover:null};s.board[1]={uid:2,type:'106',cover:null};s.board[2]={uid:3,type:'1006',cover:null};s.board[3]={uid:4,type:'106',cover:'web'};s.board[4]={uid:5,type:'106',cover:null};
 s.inventory.items=[{uid:6,type:'106',cover:null},{uid:7,type:'106',cover:null}];
 for(const uid of [1,2,3,4,5,6,7])s.generatorState[uid]={charges:uid===2||uid===6?1:0,timerStart:uid===7?null:0};s.bubbles={5:{innerType:'106'}};
 assert.deepEqual(noCooldownActivationEffects(s,c,{}, {buffNoCooldown:true}),[1,6]);
 const gb={generatorBoost:{active:true,noCooldown:true}};assert.deepEqual(noCooldownActivationEffects(s,c,{},gb),[1,6]);
 assert.deepEqual(noCooldownActivationEffects(s,c,gb,gb),[]);assert.deepEqual(noCooldownActivationEffects(s,c,{buffNoCooldown:true},{buffNoCooldown:true}),[]);
 assert.deepEqual(noCooldownActivationEffects(s,c,{generatorBoost:{active:false,noCooldown:true}},gb),[1,6]);
 assert.deepEqual(noCooldownActivationEffects(s,c,{}, {buffNoCooldown:true,...gb}),[1,6],'simultaneous source logic transitions do not duplicate UIDs');
});
test('GeneratorBoost activation keeps its board IsGeneratorItem guard while store uses component support and existing snapshots',()=>{
 const c=config(),s=state();c.productionRules.generatorItemTypes=[];s.board[0]={uid:1,type:'106',cover:null};s.inventory.items=[{uid:2,type:'106',cover:null}];
 s.generatorState[1]={charges:0,timerStart:0};s.generatorState[2]={charges:1,timerStart:0};
 assert.deepEqual(noCooldownActivationEffects(s,c,{}, {generatorBoost:{active:true,noCooldown:true}}),[2]);
 s.generatorState[2].ruleSnapshot={...c.spreadRules.byType['106'],costEnergy:false};
 assert.deepEqual(noCooldownActivationEffects(s,c,{}, {buffNoCooldown:true}),[1],'stored component creation snapshot overrides its reloaded config flag');
});
test('strict modifier state validation rejects corrupt counters and preserves absent old-save compatibility',()=>{
 const c=config(),s=state();assert.equal(validProductionModifiers(s,c),true);for(const mutate of [x=>x.productionModifiers.lucky.buckets={'106':{totalLeft:-1,luckyLeft:0}},x=>x.productionModifiers.lucky.freeThresholds=[-1],x=>x.productionModifiers.lucky.boostHistory=[4],x=>x.productionModifiers.disco={score:-1,property:'test'}]){const bad=structuredClone(s);mutate(bad);assert.equal(validProductionModifiers(bad,c),false);}delete s.productionModifiers;assert.equal(validProductionModifiers(s,c),true);
});
test('GeneratorBoost packaged overlay priorities preserve genuinely missing ExtraLucky item config without inventing an alias',()=>{
 assert.equal(typeof Modifiers.productionConfigFor,'function');
 const c=config(),base=structuredClone(c);c.productionRules.boostItemConfigs={MoreLuckyProduce:{'106':{...c.spreadRules.byType['106'],cooldownSeconds:10}},ExtraProduce:{'106':{...c.spreadRules.byType['106'],cooldownSeconds:5}}};
 c.productionRules.boostLuckyConfigs={MoreLuckyProduce:[{...c.productionRules.luckyConfigs[0],chance:[1,1]}],ExtraLuckyProduce:[{...c.productionRules.luckyConfigs[0],chance:[3,1]}]};
 const more=Modifiers.productionConfigFor(c,inputs({generatorBoost:{active:true,moreLucky:true}}));assert.equal(more.spreadRules.byType['106'].cooldownSeconds,10);assert.deepEqual(more.productionRules.luckyConfigs[0].chance,[1,1]);
 const extraLucky=Modifiers.productionConfigFor(c,inputs({generatorBoost:{active:true,extraLuckyProduce:true,extraProduce:true,extraChance:[1,1]}}));assert.equal(extraLucky.spreadRules.byType['106'].cooldownSeconds,2);assert.deepEqual(extraLucky.productionRules.luckyConfigs[0].chance,[3,1]);assert.equal(c.spreadRules.byType['106'].cooldownSeconds,base.spreadRules.byType['106'].cooldownSeconds);
 const fresh=state();fresh.productionModifiers.lucky.buckets['106']={totalLeft:1,luckyLeft:0};const entering=createProductionModifierPlan(fresh,c,inputs({lucky:{active:true},generatorBoost:{active:true,moreLucky:true}}));assert.equal(entering.getState().lucky.buckets['106'],undefined,'entering or leaving generator lucky config clears counters');
 const existing=state();existing.productionModifiers.lucky.boostConfigActive=true;existing.productionModifiers.lucky.buckets['106']={totalLeft:9,luckyLeft:0};const changing=createProductionModifierPlan(existing,c,inputs({lucky:{active:true},generatorBoost:{active:true,extraLuckyProduce:true}}));assert.equal(changing.getState().lucky.buckets['106'].totalLeft,9,'changing between two nonnil generator lucky configurations does not clear source counters');
});
