import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,advanceTime,buyEnergy,generateItem,mergeItems,deliverOrder,energyCost,traceOffers,activityState} from '../src/engine.mjs';
test('recovery is discrete, capped, and cannot bank time at the cap',()=>{
 const s=createState({energy:99});advanceTime(s,119);assert.equal(s.energy,99);advanceTime(s,1);assert.equal(s.energy,100);
 advanceTime(s,86400);generateItem(s);advanceTime(s,119);assert.equal(s.energy,99);advanceTime(s,1);assert.equal(s.energy,100);
});
test('default free refill changes first paid price, overfill allowed; daily reset does not restore free refill',()=>{
 const s=createState();assert.equal(energyCost(s),0);buyEnergy(s);assert.equal(s.energy,200);assert.equal(s.price,20);assert.equal(s.freeUsed,1);
 buyEnergy(s);assert.equal(s.gems,180);assert.equal(s.price,40);advanceTime(s,86400);assert.equal(s.price,10);assert.equal(s.freeUsed,1);
});
test('failed purchase does not advance price; price caps at160',()=>{
 const s=createState({gems:0,freeUsed:1,price:160});assert.equal(buyEnergy(s).ok,false);assert.equal(s.price,160);
 s.gems=500;buyEnergy(s);assert.equal(s.price,160);assert.equal(s.gems,340);
});
test('merge conserves base item units and order consumes a qualifying item',()=>{
 const s=createState();s.board[0]={family:'tea',level:3};s.board[1]={family:'tea',level:3};
 assert.equal(mergeItems(s,0,1).ok,true);assert.equal(s.board[0],null);assert.equal(s.board[1].level,4);
 assert.equal(deliverOrder(s).ok,true);assert.equal(s.coins,40);assert.equal(s.orders,1);
});
test('full board / zero energy cannot consume energy or mint items',()=>{
 const s=createState({energy:0});assert.equal(generateItem(s).ok,false);assert.equal(s.generated,0);
 s.energy=4;s.board=Array.from({length:30},()=>({family:'bread',level:1}));assert.equal(generateItem(s).ok,false);assert.equal(s.energy,4);
});
test('early popType path and close-only cascade are different',()=>{
 assert.match(traceOffers({popType:2,closedWithoutPurchase:false}).chosen,/충전창 이전/);
 assert.equal(traceOffers({closedWithoutPurchase:false,popType:1}).chosen,null);
 assert.equal(traceOffers({invite:true,noPay:true}).chosen,'친구 초대');
 assert.equal(traceOffers({noPay:true}).chosen,'EnergyGemOffer');
});
test('free refill blocks energy bundle; tie between chain and weekly selects chain',()=>{
 const r=traceOffers({freeAvailable:true,chain:true,weekly:true,chainPrice:4.99,weeklyPrice:4.99});
 assert.equal(r.steps.find(x=>x.id==='energy-bundle').ok,false);assert.equal(r.chosen,'체인 패키지');
 assert.equal(traceOffers({bundle:false,chain:true,weekly:true,chainPrice:9.99,weeklyPrice:4.99}).chosen,'신규 주간 패키지');
});
test('event time and level boundaries remain explicit',()=>{
 const x={level:5,startLevel:5,start:100,end:200,settle:300};
 assert.equal(activityState({...x,now:99}).state,'upcoming');assert.equal(activityState({...x,now:100}).state,'active');
 assert.equal(activityState({...x,now:200}).state,'settlement');assert.equal(activityState({...x,now:300}).state,'closed');
 assert.equal(activityState({...x,now:150,downloaded:false}).state,'resources');
  assert.equal(activityState({...x,now:50,downloaded:false}).state,'resources');
 assert.equal(activityState({...x,now:150,level:4}).state,'locked');
});
