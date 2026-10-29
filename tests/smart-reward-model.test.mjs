import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSmartReward,resolveSmartReward,validSmartSnapshot,equivalentSmartCode,highestSmartCode,deliverHighestSmartReward,smartLackCodes} from '../src/smart-reward-model.mjs';
import * as Smart from '../src/smart-reward-model.mjs';

const config={items:[...[2,5].flatMap(chain=>Array.from({length:10},(_,i)=>({type:String(chain*100+i+1),chainId:String(chain),chainLevel:i+1}))),{type:'1304',chainId:'13',chainLevel:4},{type:'1305',chainId:'13',chainLevel:5}]};
const scores={'203':2,'204':5,'205':10,'206':19,'207':39,'503':2,'504':5,'505':10};
const snapshot=extra=>({scoreMap:{...scores},budget:35,orders:[],stock:{},resultCount:1,isNeedUpFind:true,...extra});

test('no-order fallback uses source205/206 half split only when206 configured, with no invented RNG default',()=>{
 assert.equal(selectSmartReward(snapshot(),config,{random:()=>0.1}).items[0],'205');
 assert.equal(selectSmartReward(snapshot(),config,{random:()=>0.9}).items[0],'206');
 assert.equal(selectSmartReward(snapshot(),config).ok,false);
 const low=selectSmartReward(snapshot({budget:10}),config);assert.equal(low.ok,true);assert.deepEqual(low.items,['205']);assert.equal(low.remainingScore,0);
 const no206=selectSmartReward(snapshot({scoreMap:{'205':10}}),config);assert.deepEqual(no206.items,['205']);
});
test('an exact missing requirement wins before fallback and does not mutate the input stock or score map',()=>{
 const s=snapshot({orders:[{slot:1,requirements:[{type:'205',count:1}]}]});const before=structuredClone(s),r=selectSmartReward(s,config);
 assert.equal(r.ok,true);assert.deepEqual(r.items,['205']);assert.equal(r.remainingScore,25);assert.deepEqual(r.bySlot,{'1':['205']});assert.deepEqual(s,before);
 assert.equal(resolveSmartReward(s,config),'205');
});
test('priority reservation of deliverable orders prevents stock being counted twice',()=>{
 const s=snapshot({orders:[{slot:2,requirements:['205']},{slot:1,requirements:['205']}],stock:{'205':1}}),r=selectSmartReward(s,config);
 assert.equal(r.ok,true);assert.deepEqual(r.trace.finishedSlots,[1]);assert.deepEqual(r.items,['205']);assert.deepEqual(r.bySlot,{'2':['205']});
});
test('partial exact reservation rolls back before another ready order is marked finished',()=>{
 const s=snapshot({orders:[{slot:1,state:3,requirements:['205','505']},{slot:2,state:3,requirements:['205']}],stock:{'205':1}}),r=selectSmartReward(s,config);
 assert.equal(r.ok,true);assert.deepEqual(r.trace.finishedSlots,[2]);assert.equal(r.items.length,1);assert.equal(r.bySlot['1'].length,1);
});
test('mergeable lower stock reduces binary deficit and emits the missing level rather than the original requirement',()=>{
 const r=selectSmartReward(snapshot({orders:[{slot:1,requirements:['205']}],stock:{'204':1}}),config);
 assert.equal(r.ok,true);assert.deepEqual(r.items,['204']);assert.equal(r.remainingScore,30);
});
test('equivalent splitting debits only the actual single emitted piece under the ItemSpread result limit',()=>{
 const s=snapshot({scoreMap:{'203':2},orders:[{slot:1,requirements:['205']}]});const r=selectSmartReward(s,config);
 assert.equal(r.ok,true);assert.deepEqual(r.items,['203']);assert.equal(r.remainingScore,33);
 assert.deepEqual(equivalentSmartCode('205',s.scoreMap,config),{type:'203',multiple:4,score:8});assert.equal(highestSmartCode('201',scores,config),'207');
});
test('up-find scans only the next five levels when no lower equivalent exists',()=>{
 const r=selectSmartReward(snapshot({scoreMap:{'203':2,'205':10},orders:[{slot:1,requirements:['201']}]}),config);
 assert.equal(r.ok,true);assert.deepEqual(r.items,['203']);assert.equal(r.remainingScore,33);
});
test('the source plus10 tolerance and skipped level3 minimum may spend more than remaining budget',()=>{
 const near=selectSmartReward(snapshot({budget:1,orders:[{slot:1,requirements:['205']}]}),config);assert.equal(near.ok,true);assert.deepEqual(near.items,['205']);assert.equal(near.remainingScore,-9);
 const far=selectSmartReward(snapshot({budget:1,orders:[{slot:1,requirements:['207']}]}),config);assert.equal(far.ok,true);assert.deepEqual(far.items,['203']);assert.equal(far.remainingScore,-1);
});
test('slot supply score supersedes priority and special slot6 is excluded',()=>{
 const r=selectSmartReward(snapshot({orders:[{slot:1,requirements:['207']},{slot:2,requirements:['205']},{slot:6,requirements:['201']}]}),config);
 assert.equal(r.ok,true);assert.deepEqual(r.items,['205']);assert.deepEqual(r.bySlot,{'2':['205']});
 const onlySpecial=selectSmartReward(snapshot({budget:10,orders:[{slot:6,requirements:['201']}]}),config);assert.deepEqual(onlySpecial.items,['205']);assert.deepEqual(onlySpecial.bySlot,{});
});
test('an absent level3 score is surfaced as the source configuration fault, never replaced with made-up rewards',()=>{
 const s=snapshot({scoreMap:{'1304':6,'205':10},budget:1,orders:[{slot:1,requirements:['1305']}]}),before=structuredClone(s),r=selectSmartReward(s,config);
 assert.equal(r.ok,false);assert.equal(r.missingType,'1303');assert.deepEqual(r.items,[]);assert.deepEqual(s,before);
});
test('OrderBoost entry ports its weighted slot5/4/8 branch and70-point per-target ceiling',()=>{
 const s=snapshot({mode:'orderBoost',budget:35,orders:[{slot:5,requirements:['207']}],itemWeights:[{type:'205',weight:1}],resultCount:100});
 const r=selectSmartReward(s,config,{random:()=>0});assert.equal(r.ok,true);assert.deepEqual(r.items,['205','205','205','205']);assert.equal(r.remainingScore,-5);assert.equal(r.bySlot['5'].length,4);
 const large=selectSmartReward(snapshot({mode:'orderBoost',budget:200,orders:[{slot:5,requirements:['210']}],itemWeights:[{type:'205',weight:1}]}),config,{random:()=>0});
 assert.equal(large.ok,true);assert.equal(large.trace.weightedStages[0].spent,70);assert.equal(large.trace.weightedStages[0].count,7);
});
test('highest configured reward and binary diagnostic keep their separate source helper semantics',()=>{
 const r=deliverHighestSmartReward(snapshot(), '205',1,config);assert.equal(r.ok,true);assert.deepEqual(r.items,['207']);assert.equal(r.remainingScore,-4);assert.deepEqual(smartLackCodes(5,'2',config),['201','203']);
});
test('typed snapshots reject invalid quantities, unknown requirements and missing data before any RNG or mutation',()=>{
 for(const mutate of [s=>s.budget=-1,s=>s.stock['205']=-1,s=>s.scoreMap['205']=0,s=>s.orders=[{slot:1,requirements:['unknown']}],s=>s.orders=[{slot:1,requirements:[{type:'205',count:0}]}],s=>s.resultCount=0]){
  const s=snapshot();mutate(s);const before=structuredClone(s);assert.equal(validSmartSnapshot(s,config),false);let called=false;const r=selectSmartReward(s,config,{random:()=>{called=true;return 0;}});assert.equal(r.ok,false);assert.equal(called,false);assert.deepEqual(s,before);
 }
});
test('pack wrapper acquisition converts missing-album packs to cached items and defers actual cards until pack consumption',()=>{
 assert.equal(typeof Smart.resolveAlbumPackAllocation,'function');
 for(const [type,replacement]of [['pack_common_5','os_2_1'],['pack_common_3','scratch_a_1'],['pack_laser_5','rc_d_1'],['pack_royal_5','os_2_1']]){
  const r=Smart.resolveAlbumPackAllocation(type,1,{albumPresent:false});assert.equal(r.ok,true);assert.equal(r.kind,'cache-item');assert.equal(r.reward.type,replacement);assert.equal(r.cacheItemType,'Type2');
 }
 const active=Smart.resolveAlbumPackAllocation('pack_common_5',1,{albumPresent:true,albumOpen:true,supportedPacks:['pack_common_5']});assert.equal(active.kind,'property-pack');assert.deepEqual(active.allocation,{type:'pack_common_5',count:1,contents:'unknown'});assert.equal(active.opensCards,false);
 assert.equal(Smart.resolveAlbumPackAllocation('pack_common_5',1,{}).ok,false);
 const royal=Smart.resolveAlbumPackAllocation('pack_royal_5',1,{albumPresent:true,albumOpen:true,royalOngoing:false,supportedPacks:['pack_common_5']});assert.equal(royal.allocation.type,'pack_common_5');
});
