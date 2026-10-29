import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createOrderState,reconcileOrders,submitOrder,orderStatus,orderStock,validOrderState} from '../src/order-model.mjs';

// Small source-derived fixtures exercise semantics separately from the full
// bundled74-item projection checked by the final smoke test.
const candidateRows=[
 ['203',2,2],['204',4,5],['205',8,10],['206',12,19],['207',20,39],['208',32,78],['209',50,146],
 ['301',2,2],['302',4,5],['303',8,10],['304',14,21],['305',24,42]
].map(([Code,Price,DiffScore])=>({Code,Price,DiffScore,Weight:100,UnlockLevel:1}));
const fixedRows=[
 [1,[1],1,['203']],[2,[1],1,['208']],[3,[1],1,['204']],[4,[1],1,['206']],
 [5,[1,2],2,['304']],[6,[1,2],2,['303']],[7,[1,2],2,['303','206']]
].map(([id,slots,unlockLevel,requirements])=>({id,slots,unlockLevel,requirements}));
function fixture(){
 const identities={};
 for(const chain of [1,2,3])for(let level=1;level<=15;level++)identities[String(chain*100+level)]={chainId:String(chain),chainLevel:level};
 return {orderRules:{schemaVersion:1,mode:'packaged-default-normal-orders',fixed:structuredClone(fixedRows),
  itemConfig:structuredClone(candidateRows),identities,chainGenerators:{'2':['104'],'3':['105']},
  random:[{Type:1,UnlockLevel:3,RefreshTime:3600,Point:5,Filters:[{PlayerMin:null,PlayerMax:15,FirstMax:6,SecondMax:5,ThirdMax:3},{PlayerMin:16,PlayerMax:null,FirstMax:6,SecondMax:6,ThirdMax:3}],ItemAmounts:{OneItemWeight:50,TwoItemsWeight:50,ThreeItemsWeight:0}}],
  supportedTypes:[1],typeSlots:{1:[1,2]},slotCount:19,itemNumberWeights:[{Level:1,OneItemWeight:60,TwoItemsWeight:20,ThreeItemsWeight:20}],
  flags:{orderDiffDynamic:false,goldMultiplier:1},clock:{localOffsetSeconds:0}}};
}
function state(level=1){return {board:Array(63).fill(null),inventory:{schema:1,purchasedSlots:0,items:[]},wallet:{level,time:0,coins:0,orders:0},
 generatorState:{},bubbles:{},rng:42,itemUnlocks:{'104':true,'105':true},orders:createOrderState(),nextUid:1,selected:null,orderIndex:0};}
function add(s,type,where='board',cover=null){const c={uid:s.nextUid++,type,cover};if(where==='board')s.board[s.board.indexOf(null)]=c;else s.inventory.items.push(c);return c;}
function satisfy(s,slot){for(const r of s.orders.slots.find(o=>o.slot===slot).requirements)for(let n=0;n<r.count;n++)add(s,r.type);}
function isolatedRandom(s,c){s.orders.nextFixedId=100;c.orderRules.fixed=[];}

test('fixed cursor advances on creation; LV2 fills two allowed slots in parallel',()=>{
 const s=state(),c=fixture();reconcileOrders(s,c);
 assert.equal(s.orders.nextFixedId,2);assert.deepEqual(s.orders.slots.map(o=>[o.slot,o.id]),[[1,1]]);assert.equal(s.wallet.coins,0);
 for(let n=1;n<=3;n++){satisfy(s,1);assert.equal(submitOrder(s,1,c).ok,true);}
 assert.equal(s.orders.slots[0].id,4);
 s.wallet.level=2;satisfy(s,1);submitOrder(s,1,c);
 assert.deepEqual(s.orders.slots.map(o=>[o.slot,o.id]),[[1,5],[2,6]]);assert.equal(s.orders.nextFixedId,7);
 assert.equal(s.wallet.coins,50);assert.equal(s.wallet.orders,4);
});
test('slot3-only fixed id must be created before later ids; current slots remain pending',()=>{
 const s=state(4),c=fixture();c.orderRules.supportedTypes=[];
 c.orderRules.fixed=[{id:14,slots:[1,2],unlockLevel:4,requirements:['303']},{id:15,slots:[3],unlockLevel:4,requirements:['204']},{id:16,slots:[1,2],unlockLevel:4,requirements:['206']}];
 s.orders.nextFixedId=14;reconcileOrders(s,c);
 assert.deepEqual(s.orders.slots.map(o=>[o.slot,o.id]),[[1,14],[2,16],[3,15]]);assert.equal(s.orders.nextFixedId,17);
 assert.equal(s.wallet.orders,0);assert.equal(s.wallet.coins,0);
});
test('insufficient delivery is atomic; success consumes board first then inventory and preserves other UIDs',()=>{
 const s=state(),c=fixture();c.orderRules.supportedTypes=[];reconcileOrders(s,c);
 s.orders.slots[0].requirements=[{type:'203',count:2},{type:'303',count:1}];
 const board=add(s,'203'),web=add(s,'203','board','web'),storedCell=add(s,'203','store'),kept=add(s,'204','store');
 s.generatorState[storedCell.uid]={charges:7};s.selected=0;
 const before=structuredClone(s);assert.equal(submitOrder(s,1,c).ok,false);assert.deepEqual(s,before);
 add(s,'303');const result=submitOrder(s,1,c);assert.equal(result.ok,true);assert.equal(result.coins,12);assert.equal(result.removedInventory,1);
 assert.equal(s.board.some(x=>x?.uid===board.uid),false);assert.equal(s.board.some(x=>x?.uid===web.uid),true);
 assert.deepEqual(s.inventory.items.map(x=>x.uid),[kept.uid]);assert.equal(s.generatorState[storedCell.uid],undefined);assert.equal(s.selected,null);
});
test('wrappers, bubbles and reward cache are excluded from stock and cannot satisfy an order',()=>{
 const s=state(),c=fixture();reconcileOrders(s,c);
 add(s,'203','board','web');add(s,'203','board','box');const b=add(s,'203');s.bubbles[b.uid]={expiresAt:60};s.queue=[{type:'203',count:1}];
 assert.deepEqual(orderStock(s),{});assert.equal(orderStatus(s,1,c).canDeliver,false);
 const before=structuredClone(s);assert.equal(submitOrder(s,1,c).ok,false);assert.deepEqual(s,before);
 add(s,'203','store');assert.equal(orderStatus(s,1,c).canDeliver,true);
});
test('random1 shares five points across slots1/2 and starts cooldown only on exhausted next attempt',()=>{
 const s=state(3),c=fixture();isolatedRandom(s,c);reconcileOrders(s,c);
 assert.equal(s.orders.slots.length,2);assert.equal(s.orders.points[1],3);
 for(let n=0;n<3;n++){satisfy(s,1);assert.equal(submitOrder(s,1,c).ok,true);}
 assert.equal(s.orders.points[1],0);assert.equal(s.orders.timers[1].phase,'ready');
 satisfy(s,1);submitOrder(s,1,c);assert.equal(s.orders.timers[1].phase,'cooldown');assert.equal(s.orders.timers[1].startedAt,0);
 assert.equal(s.orders.slots.some(o=>o.slot===1),false);
 s.wallet.time=3599;reconcileOrders(s,c);assert.equal(s.orders.slots.some(o=>o.slot===1),false);
 s.wallet.time=3600;reconcileOrders(s,c);assert.equal(s.orders.slots.some(o=>o.slot===1),true);assert.equal(s.orders.points[1],3);
});
test('unlocks, generator identity and predecessor progress gate random creation without uniform fallback',()=>{
 const s=state(2),c=fixture();isolatedRandom(s,c);s.itemUnlocks={};
 c.orderRules.itemConfig=[{Code:'209',UnlockLevel:1,Price:50,Weight:100,DiffScore:146,ProgressUnlock:1}];
 c.orderRules.random[0].Filters=[{FirstMax:15,SecondMax:15,ThirdMax:15}];
 reconcileOrders(s,c);assert.equal(s.orders.slots.length,0);
 s.wallet.level=3;reconcileOrders(s,c);assert.equal(s.orders.slots.length,0);
 s.itemUnlocks['104']=true;reconcileOrders(s,c);assert.equal(s.orders.slots.length,0);
 s.itemUnlocks['208']=true;delete s.orders.timers[1];delete s.orders.points[1];reconcileOrders(s,c);
 assert.equal(s.orders.slots.length,1);assert.deepEqual(s.orders.slots[0].requirements,[{type:'209',count:1}]);
});
test('source last-order and already-required exclusions remain strict when no candidate exists',()=>{
 const s=state(3),c=fixture();isolatedRandom(s,c);
 c.orderRules.itemConfig=[{Code:'203',UnlockLevel:1,Price:2,Weight:100,DiffScore:2}];
 s.orders.lastFinished[1]=['203'];s.orders.lastFinished[2]=['203'];reconcileOrders(s,c);
 assert.equal(s.orders.slots.length,0);
 s.orders.lastFinished={};delete s.orders.timers[1];delete s.orders.points[1];reconcileOrders(s,c);
 assert.equal(s.orders.slots.length,1,'second slot cannot repeat an already requested code');
});
test('slot3 safety creator can refill with no other order even while generic cooldown is pending',()=>{
 const s=state(3),c=fixture();isolatedRandom(s,c);
 c.orderRules.supportedTypes=[2];c.orderRules.typeSlots={2:[3]};c.orderRules.random=[{Type:2,UnlockLevel:3,RefreshTime:1800,Filters:[{FirstMin:7,FirstMax:7}],ItemAmounts:{OneItemWeight:50,TwoItemsWeight:50,ThreeItemsWeight:0}}];
 s.orders.timers[2]={phase:'cooldown',startedAt:0};reconcileOrders(s,c);
 assert.equal(s.orders.slots[0].slot,3);assert.equal(s.orders.slots[0].requirements[0].type,'207');
 satisfy(s,3);submitOrder(s,3,c);
 assert.equal(s.orders.slots.length,0,'strict last-code exclusion can prevent safety refill; no substitute is invented');
});
test('inactive unsupported creator assumption is visible and active creator blocks random fallback',()=>{
 const s=state(3),c=fixture();isolatedRandom(s,c);s.orders.activeCreators={1:'lucky',2:'new-item tutorial order'};
 const result=reconcileOrders(s,c);assert.equal(result.created.length,0);assert.equal(s.orders.unsupported.length,2);
});
test('legacy serial completed fixed count migrates without currency, EXP or completion rewards',()=>{
 const s=state(2),c=fixture();delete s.orders;s.orderIndex=4;s.xp=17;reconcileOrders(s,c);
 assert.deepEqual(s.orders.deliveredFixed,[1,2,3,4]);assert.deepEqual(s.orders.slots.map(o=>o.id),[5,6]);
 assert.equal(s.wallet.coins,0);assert.equal(s.wallet.orders,0);assert.equal(s.xp,17);
});
test('difficulty sum uses source scores and resets at explicit research-clock local2AM',()=>{
 const s=state(),c=fixture();reconcileOrders(s,c);satisfy(s,1);submitOrder(s,1,c);assert.equal(s.orders.totalDiffScore,2);
 s.wallet.time=7199;reconcileOrders(s,c);assert.equal(s.orders.totalDiffScore,2);
 s.wallet.time=7200;reconcileOrders(s,c);assert.equal(s.orders.totalDiffScore,0);assert.equal(s.orders.nextDiffResetAt,93600);
});
test('price is recomputed from source config and explicit Gold buff; cached displayed coins cannot mint currency',()=>{
 const s=state(),c=fixture();c.orderRules.flags.goldMultiplier=2;reconcileOrders(s,c);s.orders.slots[0].coins=999999;satisfy(s,1);
 const result=submitOrder(s,1,c);assert.equal(result.coins,4);assert.equal(s.wallet.coins,4);
});
test('save validation accepts generated states and rejects forged cursor, duplicate slot, requirements, rewards and timers',()=>{
 const s=state(),c=fixture();reconcileOrders(s,c);assert.equal(validOrderState(s,c),true);
 for(const mutate of [
  x=>x.orders.slots.push(structuredClone(x.orders.slots[0])),
  x=>x.orders.nextFixedId=5,
  x=>x.orders.slots[0].requirements[0].count=2,
  x=>x.orders.slots[0].coins=99999,
  x=>x.orders.deliveredFixed=[1],
  x=>x.orders.timers[1]={phase:'cooldown',startedAt:1},
  x=>x.orders.points[1]=6,
  x=>x.orders.repeatWeights['2']=4,
  x=>x.itemUnlocks['not-a-real-type']=true,
  x=>x.rng=0
 ]){const invalid=structuredClone(s);mutate(invalid);assert.equal(validOrderState(invalid,c),false);}
 const legacy=structuredClone(s);delete legacy.orders;assert.equal(validOrderState(legacy,c),true);
});
test('stock priority uses source weight multipliers and repeat counters update on creation and delivery',()=>{
 const s=state(3),c=fixture();isolatedRandom(s,c);c.orderRules.typeSlots={1:[1]};
 c.orderRules.itemConfig=[{Code:'208',Price:32,DiffScore:78,UnlockLevel:1,Weight:100,WeightMultiple:1},
  {Code:'209',Price:50,DiffScore:146,UnlockLevel:1,Weight:100,WeightMultiple:1,RepeatWeightDecrease:10}];
 c.orderRules.random[0].Filters=[{FirstMin:8,FirstMax:9}];c.orderRules.random[0].ItemAmounts={OneItemWeight:100,TwoItemsWeight:0,ThreeItemsWeight:0};
 s.orders.repeatWeights['2']=3;add(s,'208','store');reconcileOrders(s,c);
 assert.equal(s.orders.slots.length,1);assert.equal(s.orders.slots[0].requirements[0].type,'208');
 assert.equal(s.orders.repeatWeights['2'],3,'209 is preselected second even when count weights retain only the first requirement; source still resets its chain history');
 s.orders.slots[0].requirements=[{type:'209',count:1}];s.orders.slots[0].coins=50;s.orders.slots[0].diffScore=146;add(s,'209');submitOrder(s,1,c);
 assert.equal(s.orders.repeatWeights['2'],3,'delivery resets3; last-order exclusion removes209 from replacement selection');
});
test('generic random cooldown has an independent clock and nullable high-level filter bound remains open',()=>{
 const s=state(16),c=fixture();isolatedRandom(s,c);c.orderRules.supportedTypes=[3];c.orderRules.typeSlots={3:[4]};
 c.orderRules.random=[{Type:3,UnlockLevel:4,RefreshTime:900,Filters:[{PlayerMin:16,PlayerMax:null,FirstMax:6}],ItemAmounts:{OneItemWeight:100}}];
 reconcileOrders(s,c);assert.equal(s.orders.slots[0].slot,4);satisfy(s,4);submitOrder(s,4,c);
 assert.equal(s.orders.timers[3].phase,'cooldown');s.wallet.time=899;reconcileOrders(s,c);assert.equal(s.orders.slots.length,0);
 s.wallet.time=900;reconcileOrders(s,c);assert.equal(s.orders.slots.length,1);
});
test('generic ready timer left by safety path defaults missing points to the configured quota',()=>{
 const s=state(3),c=fixture();isolatedRandom(s,c);c.orderRules.supportedTypes=[2];c.orderRules.typeSlots={2:[3]};
 c.orderRules.random=[{Type:2,UnlockLevel:3,RefreshTime:1800,Filters:[{FirstMax:7}],ItemAmounts:{OneItemWeight:100}}];
 s.orders.timers[2]={phase:'ready',startedAt:null};
 s.orders.slots=[{slot:1,id:1,kind:'fixed',innerType:0,requirements:[{type:'208',count:1}],coins:32,diffScore:78,createdAt:0}];
 reconcileOrders(s,c);assert.equal(s.orders.slots.some(o=>o.slot===3),true);assert.equal(s.orders.points[2],0);
});
test('full bundled projection generates only source-legal candidates across levels and seeded runs',async t=>{
 const full=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
 if(!full.orderRules)return t.skip('Root integration has not yet embedded orderRules');
 assert.equal(full.orderRules.itemConfig.length,74);assert.equal(full.orderRules.fixed.length,16);
 for(const level of [2,3,4,5,10,16,36,61])for(let seed=1;seed<=12;seed++){
  const s=state(level);s.orders.nextFixedId=17;s.rng=seed;
  s.itemUnlocks=Object.fromEntries(Object.keys(full.orderRules.identities).map(type=>[type,true]));
  reconcileOrders(s,full);
  for(const o of s.orders.slots){
   const rule=full.orderRules.random.find(r=>r.Type===o.innerType);assert.ok(rule);assert.ok(level>=rule.UnlockLevel);
   assert.ok(full.orderRules.typeSlots[o.innerType].includes(o.slot));
   const filter=rule.Filters.find(f=>(f.PlayerMin==null||level>=f.PlayerMin)&&(f.PlayerMax==null||level<=f.PlayerMax)&&
    (f.DiffSumMin==null||0>=f.DiffSumMin)&&(f.DiffSumMax==null||0<=f.DiffSumMax));
   let number=0;
   for(const req of o.requirements){
    const row=full.orderRules.itemConfig.find(r=>r.Code===req.type);assert.ok(row.Weight>0);assert.ok(level>=row.UnlockLevel);assert.ok(!row.ForbiddenSlot?.includes(o.slot));
    const depth=row.DifficultyLevel??full.orderRules.identities[req.type].chainLevel;
    const prefix=['First','Second','Third'][number++];assert.ok(filter[prefix+'Min']==null||depth>=filter[prefix+'Min']);assert.ok(filter[prefix+'Max']==null||depth<=filter[prefix+'Max']);
   }
   assert.equal(o.coins,o.requirements.reduce((n,r)=>n+full.orderRules.itemConfig.find(x=>x.Code===r.type).Price*r.count,0));
  }
 }
});
