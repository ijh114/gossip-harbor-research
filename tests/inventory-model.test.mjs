import test from 'node:test';
import assert from 'node:assert/strict';
import {createInventory,storeItem,withdrawItem,buyInventorySlot,validInventory} from '../src/inventory-model.mjs';

function config(){return {
 inventoryRules:{enabled:true,unlockLevel:2,defaultSlots:5,maxSlots:32,
  unlockCosts:[0,0,0,0,0,50,55,65,80,100,130,165,225,305,420,580,805,1125,1580,2215,3125,4400,6210,8770,12390,17510,24750,34990,49470,69950,69950,69950],
  forbiddenWrapperTypes:['3201','3301','3401','temp_1','locked_1'],timedTransformTypes:[],swallowCannotMoveTypes:[],
  factory:{requiredUnlockTypes:['104','404','705','1006','1205','1705'],fragmentTypes:['101','102','103'],implemented:false}},
 specialRules:{specialTools:{scissors:{type:'level_down_piece_1'}}},
 items:[{type:'101',chainId:'1',chainLevel:1},{type:'104',chainId:'1',chainLevel:4,generator:{batch:80,storage:240,cooldownSeconds:2,storageRecoverySeconds:30}},
  {type:'201',chainId:'2',chainLevel:1},{type:'205',chainId:'2',chainLevel:5},{type:'505',chainId:'5',chainLevel:5},
  {type:'2401',chainId:'24',chainLevel:1},{type:'level_down_piece_1',chainId:'level_down_piece',chainLevel:1},
  ...['3201','3301','3401','temp_1','locked_1','reward_bubble_1'].map(type=>({type}))]};}
function state(c=config()){
 return {board:Array(63).fill(null),inventory:createInventory(c),wallet:{level:2,gems:50,coins:0,energy:80,time:0},
  generatorState:{},bubbles:{},nextUid:1,selected:null,generatorFactoryOpen:false};
}
function place(s,index,type,extra={}){const cell={uid:s.nextUid++,type,cover:null,...extra};s.board[index]=cell;return cell;}

test('five free slots and level2 gate do not charge or remove an item on a failed store',()=>{
 const c=config(),s=state(c),cell=place(s,14,'201');assert.deepEqual(s.inventory,{schema:1,purchasedSlots:0,items:[]});
 s.wallet.level=1;const before=structuredClone(s);assert.equal(storeItem(s,14,c).ok,false);assert.deepEqual(s,before);
 s.wallet.level=2;s.selected=14;assert.equal(storeItem(s,14,c).ok,true);assert.equal(s.board[14],null);assert.equal(s.inventory.items[0],cell);assert.equal(s.selected,null);assert.equal(s.wallet.gems,50);assert.equal(validInventory(s,c),true);
});

test('full inventory preserves the sixth item and all resource and UID state',()=>{
 const c=config(),s=state(c);
 for(let n=0;n<5;n++){place(s,n,'201');assert.equal(storeItem(s,n,c).ok,true);}
 place(s,22,'2401');const before=structuredClone(s);assert.equal(storeItem(s,22,c).ok,false);assert.deepEqual(s,before);assert.equal(validInventory(s,c),true);
});

test('slot purchases use the next total slot price and reject shortage or the UI maximum atomically',()=>{
 const c=config(),s=state(c);s.wallet.gems=49;const poor=structuredClone(s);assert.equal(buyInventorySlot(s,c).ok,false);assert.deepEqual(s,poor);
 s.wallet.gems=50;assert.equal(buyInventorySlot(s,c).ok,true);assert.equal(s.wallet.gems,0);assert.equal(s.inventory.purchasedSlots,1);
 s.wallet.gems=55;assert.equal(buyInventorySlot(s,c).ok,true);assert.equal(s.wallet.gems,0);assert.equal(s.inventory.purchasedSlots,2);
 s.inventory.purchasedSlots=26;s.wallet.gems=69950;assert.equal(buyInventorySlot(s,c).ok,true);assert.equal(s.inventory.purchasedSlots,27);assert.equal(s.wallet.gems,0);
 s.wallet.gems=1e6;const full=structuredClone(s);assert.equal(buyInventorySlot(s,c).ok,false);assert.deepEqual(s,full);
});

test('withdraw selects first valid empty board cell, compacts the dense store and preserves identity',()=>{
 const c=config(),s=state(c),a=place(s,10,'201'),b=place(s,11,'2401');storeItem(s,10,c);storeItem(s,11,c);place(s,0,'205');
 const uid=s.nextUid;assert.equal(withdrawItem(s,0,c).ok,true);assert.equal(s.board[1],a);assert.equal(s.inventory.items[0],b);assert.equal(s.inventory.items.length,1);assert.equal(s.nextUid,uid);
});

test('full board or bad inventory index cannot drop stored stock or consume currency',()=>{
 const c=config(),s=state(c);place(s,10,'201');storeItem(s,10,c);for(let i=0;i<63;i++)place(s,i,'201');
 for(const slot of [0,-1,1,NaN,'0']){const before=structuredClone(s);assert.equal(withdrawItem(s,slot,c).ok,false);assert.deepEqual(s,before);}
});

test('generator storage preserves reservoirs, absolute timer, deck metadata and UID without a reset',()=>{
 const c=config(),s=state(c),cell=place(s,31,'104');
 s.generatorState[cell.uid]={charges:79,storage:240,timerStart:0,readyAt:2,spreadCount:9,remainingDeck:[3,1]};
 const saved=structuredClone(s.generatorState[cell.uid]),uid=s.nextUid;
 assert.equal(storeItem(s,31,c).ok,true);assert.deepEqual(s.generatorState[cell.uid],saved);assert.equal(s.inventory.items[0],cell);
 s.wallet.time=100;assert.equal(validInventory(s,c),true);assert.equal(withdrawItem(s,0,c).ok,true);
 assert.equal(s.board[0],cell);assert.deepEqual(s.generatorState[cell.uid],saved,'root performs overdue recovery on the next board tick');assert.equal(s.nextUid,uid);
});

test('scissors charges survive storage and withdrawal without reverting to default one use',()=>{
 const c=config(),s=state(c),cell=place(s,13,'level_down_piece_1',{uses:7});storeItem(s,13,c);withdrawItem(s,0,c);
 assert.equal(s.board[0],cell);assert.equal(s.board[0].uses,7);assert.equal(validInventory(s,c),true);
});

test('component guards block wrappers, live bubbles, opening and timed transforms without consuming them',()=>{
 const c=config();
 for(const setup of [
  s=>place(s,1,'201',{cover:'box'}),s=>place(s,1,'201',{cover:'web'}),
  ...['3201','3301','3401','temp_1','locked_1'].map(type=>s=>place(s,1,type)),
  s=>{const cell=place(s,1,'201');s.bubbles[cell.uid]={expiresAt:60,price:1,innerType:'201'};},
  s=>{const cell=place(s,1,'104');s.generatorState[cell.uid]={spreadState:2};},
  s=>{const cell=place(s,1,'104');s.generatorState[cell.uid]={phase:'opening'};},
  s=>place(s,1,'201',{transformDuration:0}),s=>place(s,1,'201',{locked:true}),
 ]){const s=state(c);setup(s);const before=structuredClone(s);assert.equal(storeItem(s,1,c).ok,false);assert.deepEqual(s,before);}
 const reward=state(c);place(reward,1,'reward_bubble_1');assert.equal(storeItem(reward,1,c).ok,true,'reward bubble uses Collectable, not ItemBubble');
});

test('initializing is not opening and closed generators are not banned merely by their name',()=>{
 const c=config(),s=state(c),cell=place(s,1,'104');s.generatorState[cell.uid]={spreadState:4,charges:80,storage:240,timerStart:0,readyAt:20};
 assert.equal(storeItem(s,1,c).ok,true);assert.equal(s.inventory.items[0].uid,cell.uid);
});

test('factory fragments remain separate and unresolved live state never invents a transfer',()=>{
 const c=config(),s=state(c);place(s,1,'101');s.generatorFactoryOpen=null;let before=structuredClone(s);assert.equal(storeItem(s,1,c).ok,false);assert.deepEqual(s,before);
 s.generatorFactoryOpen=true;before=structuredClone(s);assert.equal(storeItem(s,1,c).ok,false);assert.deepEqual(s,before);
 s.generatorFactoryOpen=false;assert.equal(storeItem(s,1,c).ok,true);s.generatorFactoryOpen=true;
 before=structuredClone(s);assert.equal(withdrawItem(s,0,c).ok,false);assert.deepEqual(s,before,'active factory has a separate UI transfer path');
 const fresh=state(c);delete fresh.generatorFactoryOpen;fresh.itemUnlocks={'104':true};place(fresh,1,'101');assert.equal(storeItem(fresh,1,c).ok,true,'incomplete six unlocks prove factory closed');
});

test('explicit inventoryOrder groups first-seen chains then orders levels without consuming or reidentifying cells',()=>{
 const c=config(),s=state(c);s.inventoryOrder=true;
 for(const [i,type]of ['205','505','201'].entries()){place(s,i,type);storeItem(s,i,c);}
 assert.deepEqual(s.inventory.items.map(x=>x.type),['201','205','505']);assert.equal(new Set(s.inventory.items.map(x=>x.uid)).size,3);
});

test('validation rejects capacity violations, duplicate UIDs, covers and orphaned generator state but permits old saves',()=>{
 const c=config(),s=state(c);place(s,1,'201');storeItem(s,1,c);assert.equal(validInventory(s,c),true);
 for(const mutate of [x=>x.inventory.purchasedSlots=-1,x=>x.inventory.purchasedSlots=28,x=>x.inventory.items.push(null),x=>x.inventory.items.push({...x.inventory.items[0]}),x=>x.board[0]={...x.inventory.items[0]},x=>x.inventory.items[0].cover='web',x=>x.inventory.items[0].type='unknown',x=>x.inventory.items[0].uses=2]){
  const bad=structuredClone(s);mutate(bad);assert.equal(validInventory(bad,c),false);
 }
 const gen=state(c);const cell=place(gen,1,'104');gen.generatorState[cell.uid]={charges:80,storage:240,timerStart:null,readyAt:0};storeItem(gen,1,c);delete gen.generatorState[cell.uid];assert.equal(validInventory(gen,c),false);
 const old=state(c);delete old.inventory;assert.equal(validInventory(old,c),true);
});
