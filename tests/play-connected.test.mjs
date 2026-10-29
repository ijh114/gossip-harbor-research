import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPlay,playAction,generateFrom,advancePlay,validPlay} from '../src/play-model.mjs';
import {orderStatus} from '../src/order-model.mjs';
const c=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
test('inventory actions preserve a charged generator UID and storage state across a real play save boundary',()=>{
 const s=createPlay(c);s.stage='play';s.wallet.level=2;s.selected=0;
 generateFrom(s,0,c);const uid=s.board[0].uid,before=structuredClone(s.generatorState[uid]);
 assert.equal(playAction(s,'inventory',undefined,c).ok,true);
 assert.equal(playAction(s,'inventory-store',undefined,c).ok,true);assert.equal(s.board[0],null);assert.equal(s.inventory.items[0].uid,uid);
 assert.deepEqual(s.generatorState[uid],before);assert.equal(validPlay(s,c),true);
 advancePlay(s,3600,c);assert.deepEqual(s.generatorState[uid],before,'board ticking excludes stored generators');
 const restored=JSON.parse(JSON.stringify(s));assert.equal(validPlay(restored,c),true);
 assert.equal(playAction(restored,'inventory-withdraw','0',c).ok,true);assert.equal(restored.board[0].uid,uid);
 assert.equal(playAction(restored,'close-inventory',undefined,c).ok,true);advancePlay(restored,0,c);
 assert.equal(restored.generatorState[uid].charges,c.items.find(r=>r.type==='106').generator.batch);assert.equal(validPlay(restored,c),true);
});
test('parallel order submission can consume an inventory ingredient and never duplicates the old serial reward',()=>{
 const s=createPlay(c);s.stage='play';s.wallet.level=2;
 s.board[2]={uid:s.nextUid++,type:'203',cover:null};s.selected=2;
 playAction(s,'inventory',undefined,c);playAction(s,'inventory-store',undefined,c);playAction(s,'close-inventory',undefined,c);
 assert.equal(orderStatus(s,1,c).canDeliver,true);const before=s.wallet.coins;
 assert.equal(playAction(s,'deliver','1',c).ok,true);assert.equal(s.wallet.coins,before+2);assert.equal(s.inventory.items.length,0);
 assert.equal(s.orders.deliveredFixed.length,1);assert.equal(s.orderIndex,1);assert.equal(validPlay(s,c),true);
 assert.equal(playAction(s,'deliver','1',c).ok,false);assert.equal(s.wallet.coins,before+2);
});
test('inventory expansion is paid from the shared wallet and modal failures preserve item and currency state',()=>{
 const s=createPlay(c);s.stage='play';s.wallet.level=2;playAction(s,'inventory',undefined,c);
 assert.equal(playAction(s,'inventory-buy',undefined,c).ok,true);assert.equal(s.wallet.gems,150);assert.equal(s.inventory.purchasedSlots,1);
 s.wallet.gems=0;const inventory=structuredClone(s.inventory);
 assert.equal(playAction(s,'inventory-buy',undefined,c).ok,false);assert.equal(s.wallet.gems,0);assert.deepEqual(s.inventory,inventory);
 assert.equal(validPlay(s,c),true);
 const duplicate=structuredClone(s);duplicate.inventory.items.push({...duplicate.board[0]});assert.equal(validPlay(duplicate,c),false);
});
