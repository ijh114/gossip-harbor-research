import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reconcileOnboarding,onboardingEvent,onboardingConstraints,onboardingAllows,validOnboardingState,inventoryGuideCandidates,eligibleOrderItemInfoGuide,eligibleScissorMergeGuide} from '../src/onboarding-model.mjs';
const base=JSON.parse(await readFile(new URL('../src/data/play-config.json',import.meta.url),'utf8'));
function config(){const c=structuredClone(base);c.onboardingRules??={
 schemaVersion:1,nodes:['tutorial_1','tutorial_2','tutorial_3','tutorial_4','tutorial_5','tutorial_6','tutorial_7','tutorial_task','tutorial_cache','tutorial_chest','tutorial_bubble','tutorial_item_detail','tutorial_energy','tutorial_shop','tutorial_back2board'].map(id=>({id,conditions:[]})),
 cache:{targetType:'104',resultType:'105',forcedSpreadType:'301',minLevel:2,maxLevelExclusive:10},chest:{targetTypes:['3501','main_t_chest_new_1'],forcedSkipCost:0},
 bubble:{minLevel:4,forcedUnlockCost:0},itemDetail:{targetType:'404'},shop:{minLevel:3,scene:'map'},backToBoard:{finishLevel:5},functionGates:{inventory:2,shop:3,bubble:4}};
 c.onboardingRules.inventoryGuide??={minLevel:2,maxLevel:30,maxNumericItemCode:2000,collectableTypes:c.specialRules.collectibles.map(x=>x.type),chooseTypes:[]};
 c.onboardingRules.orderItemInfo??={requirementType:'603',unlockType:'405',finishLevel:10};
 c.onboardingRules.scissorMerge??={type:'level_down_piece_1',defaultUses:1};
 for(const id of ['tutorial_inventory','tutorial_order_item_info','tutorial_scissor_merge'])if(!c.onboardingRules.nodes.some(n=>n.id===id))c.onboardingRules.nodes.push({id,conditions:[]});
 return c;}
function state(level=1){return {stage:'play',board:Array(63).fill(null),inventory:{items:[]},bubbles:{},wallet:{level,time:0,coins:0,energy:100,freeUsed:0},queue:[],orders:{slots:[]},questsDone:0,pendingQuest:null,modal:null,nextUid:10};}
function completedCore(s,c){reconcileOnboarding(s,c);s.onboarding.starterCount=8;for(const id of ['tutorial_1','tutorial_2','tutorial_3','tutorial_4','tutorial_5','tutorial_6','tutorial_7','tutorial_task']){
 if(!s.onboarding.completed.includes(id))s.onboarding.completed.push(id);if(!s.onboarding.registeredFinished.includes(id))s.onboarding.registeredFinished.push(id);
}s.onboarding.phases={};return s;}
const cell=(uid,type)=>({uid,type,cover:null});
test('authored starter actions advance only matching event, index and result; no tutorial currency reward',()=>{
 const s=state(),c=config(),wallet=structuredClone(s.wallet);onboardingEvent(s,{type:'board-entered'},c);
 assert.equal(onboardingConstraints(s,c).input.from,22);
 onboardingEvent(s,{type:'merge',from:22,to:29,result:'999'},c);assert.equal(s.onboarding.starterCount,0);
 for(const step of c.tutorialSteps)onboardingEvent(s,step.kind==='merge'?{type:'merge',from:step.from,to:step.to,result:step.result}:{type:'generated',index:step.index,itemType:step.type},c);
 assert.equal(s.onboarding.starterCount,8);assert.ok(s.onboarding.completed.includes('tutorial_5'));assert.deepEqual(s.wallet,wallet);
});
test('order1 completion waits2.5s and order2 DB completion remains separate from strong guide completion',()=>{
 const s=state(),c=config();reconcileOnboarding(s,c);s.onboarding.starterCount=8;
 s.board[0]=cell(1,'203');s.orders.slots=[{slot:1,id:1,kind:'fixed',requirements:[{type:'203',count:1}],coins:2}];reconcileOnboarding(s,c);
 assert.equal(onboardingConstraints(s,c).input.slot,1);
 onboardingEvent(s,{type:'order-submitted',kind:'fixed',slot:1},c);assert.equal(onboardingConstraints(s,c).waitSeconds,3);
 s.wallet.time=2;reconcileOnboarding(s,c);assert.ok(!s.onboarding.completed.includes('tutorial_6'));
 s.wallet.time=3;s.board[0]=cell(2,'208');s.orders.slots=[{slot:1,id:2,kind:'fixed',requirements:[{type:'208',count:1}],coins:32}];reconcileOnboarding(s,c);
 assert.ok(s.onboarding.completed.includes('tutorial_6'));assert.ok(s.onboarding.registeredFinished.includes('tutorial_7'));assert.ok(!s.onboarding.completed.includes('tutorial_7'));
 onboardingEvent(s,{type:'order-submitted',kind:'fixed',slot:1},c);assert.ok(s.onboarding.completed.includes('tutorial_7'));
});
test('cache requires top104 and existing104 with free space, then forces only the105 tutorial tap to301',()=>{
 const s=state(2),c=config();completedCore(s,c);s.board[31]=cell(1,'104');s.queue=[{type:'main_e_chest_new_1',count:1},{type:'104',count:1}];
 reconcileOnboarding(s,c);assert.equal(onboardingConstraints(s,c).forcedSpreadType,undefined);
 s.queue=[{type:'104',count:1}];reconcileOnboarding(s,c);assert.equal(onboardingConstraints(s,c).input.kind,'queue');
 s.queue=[];s.board[0]=cell(2,'104');onboardingEvent(s,{type:'queue-popped',itemType:'104',index:0,uid:2},c);
 assert.equal(onboardingConstraints(s,c).input.kind,'merge');
 s.board[0]=null;s.board[31]=cell(3,'105');onboardingEvent(s,{type:'merge',result:'105',from:0,to:31},c);
 assert.equal(onboardingConstraints(s,c).forcedSpreadType,'301');assert.equal(onboardingConstraints(s,c).input.index,31);
 onboardingEvent(s,{type:'generated',index:31,itemType:'301'},c);assert.equal(onboardingConstraints(s,c).forcedSpreadType,undefined);assert.ok(s.onboarding.completed.includes('tutorial_cache'));
});
test('cache tutorial skips atLV10 or missing board104; unrelated open view clears a pending forced draw',()=>{
 const c=config(),s=state(10);completedCore(s,c);s.queue=[{type:'104',count:1}];s.board[31]=cell(1,'104');reconcileOnboarding(s,c);
 assert.ok(s.onboarding.completed.includes('tutorial_cache'));
 const t=state(2);completedCore(t,c);t.onboarding.phases.tutorial_cache='tap';t.onboarding.targets.tutorial_cache={index:31};
 onboardingEvent(t,{type:'view-opened'},c);assert.equal(onboardingConstraints(t,c).forcedSpreadType,undefined);
});
test('chest3501/main_t guide forceSkipCost0 is active only in opening skip step',()=>{
 const s=state(2),c=config();completedCore(s,c);s.onboarding.completed.push('tutorial_cache');s.onboarding.registeredFinished.push('tutorial_cache');
 onboardingEvent(s,{type:'queue-popped',itemType:'main_t_chest_new_1',index:0,uid:1},c);
 assert.equal(onboardingConstraints(s,c).input.kind,'select');assert.equal(onboardingConstraints(s,c).forcedSkipCost,undefined);
 onboardingEvent(s,{type:'selected',uid:1},c);onboardingEvent(s,{type:'item-opening',uid:1},c);
 assert.equal(onboardingConstraints(s,c).forcedSkipCost,0);
 onboardingEvent(s,{type:'item-opened',uid:1},c);assert.equal(onboardingConstraints(s,c).forcedSkipCost,undefined);
 assert.ok(c.onboardingRules.chest.targetTypes.includes('3501'));assert.ok(!c.onboardingRules.chest.targetTypes.includes('1601'));
});
test('first ordinary bubble guide has zero unlock cost; synthetic/instant bubbles do not prove this natural event',()=>{
 const s=state(4),c=config();completedCore(s,c);
 s.board[2]=cell(1,'203');s.bubbles[1]={price:1,expiresAt:60};
 onboardingEvent(s,{type:'bubble-spawned',index:2,uid:1,instant:true},c,{paperBoxExtraRewardAnimationPlaying:false});assert.equal(onboardingConstraints(s,c).forcedBubbleCost,undefined);
 onboardingEvent(s,{type:'bubble-spawned',index:2,uid:1,synthetic:true},c,{paperBoxExtraRewardAnimationPlaying:false});assert.equal(onboardingConstraints(s,c).forcedBubbleCost,undefined);
 onboardingEvent(s,{type:'bubble-spawned',index:2,uid:1},c,{paperBoxExtraRewardAnimationPlaying:false});assert.equal(onboardingConstraints(s,c).forcedBubbleCost,0);
 onboardingEvent(s,{type:'bubble-expired',uid:1},c);assert.equal(onboardingConstraints(s,c).forcedBubbleCost,undefined);
});
test('LV3 shop guide waits for clean map scene; first energy guide only activates at zero with unused first refill',()=>{
 const c=config(),s=state(3);completedCore(s,c);reconcileOnboarding(s,c);assert.equal(onboardingConstraints(s,c).input,undefined);
 s.stage='home';reconcileOnboarding(s,c,{inTimeline:true});assert.notEqual(onboardingConstraints(s,c).input?.kind,'open-shop');
 reconcileOnboarding(s,c,{inTimeline:false});assert.equal(onboardingConstraints(s,c).input.kind,'open-shop');
 onboardingEvent(s,{type:'shop-opened'},c);assert.equal(onboardingConstraints(s,c).input.kind,'claim-free-gift');onboardingEvent(s,{type:'shop-refreshed'},c);assert.ok(s.onboarding.completed.includes('tutorial_shop'));
 s.stage='play';s.wallet.energy=0;reconcileOnboarding(s,c);assert.equal(onboardingConstraints(s,c).input.kind,'open-energy');
 onboardingEvent(s,{type:'energy-window-opened'},c);assert.equal(onboardingConstraints(s,c).input.kind,'refill-energy');onboardingEvent(s,{type:'energy-refilled'},c);assert.ok(s.onboarding.completed.includes('tutorial_energy'));
});
test('map-return hint ends atLV5 and malformed imported onboarding state is rejected',()=>{
 const s=state(4),c=config();completedCore(s,c);s.stage='home';s.onboarding.completed.push('tutorial_shop');s.onboarding.registeredFinished.push('tutorial_shop');
 assert.equal(onboardingConstraints(s,c).highlight,'main-board');s.wallet.level=5;reconcileOnboarding(s,c);assert.equal(onboardingConstraints(s,c).highlight,undefined);
 assert.equal(validOnboardingState(s,c),true);s.onboarding.targets.bad={index:63};assert.equal(validOnboardingState(s,c),false);
});
test('shop guide ends without invented free gift when the current window has no daily gift cell',()=>{
 const s=state(3),c=config();completedCore(s,c);s.stage='home';reconcileOnboarding(s,c);
 const before=structuredClone(s.wallet);onboardingEvent(s,{type:'shop-opened'},c,{dailyFreeGiftAvailable:false});
 assert.ok(s.onboarding.completed.includes('tutorial_shop'));assert.equal(onboardingConstraints(s,c).input,undefined);assert.deepEqual(s.wallet,before);
});

function guided(id,phase,target,level=2){
 const s=state(level),c=config();completedCore(s,c);s.tutorialStep=8;s.onboarding.phases={[id]:phase};s.onboarding.targets=target===undefined?{}:{[id]:target};return {s,c};
}
test('starter gate distinguishes source selection, exact merge direction and generator tap without mutating state',()=>{
 const s=state(),c=config();s.tutorialStep=0;onboardingEvent(s,{type:'board-entered'},c);
 const before=structuredClone(s);
 assert.equal(onboardingAllows(s,c,'cell',22).allowed,true);assert.equal(onboardingAllows(s,c,'cell',29).allowed,false);
 assert.equal(onboardingAllows(s,c,'move','22,29').allowed,true);assert.equal(onboardingAllows(s,c,'move','29,22').allowed,false);
 for(const action of ['generate','deliver','queue','home','sell','aid-coins'])assert.equal(onboardingAllows(s,c,action,22).allowed,false,action);
 assert.deepEqual(s,before,'both allowed and denied decisions are read-only');
 s.selected=22;assert.equal(onboardingAllows(s,c,'cell',29).allowed,true);
 for(const step of c.tutorialSteps.slice(0,3))onboardingEvent(s,{type:'merge',from:step.from,to:step.to,result:step.result},c);
 s.tutorialStep=3;s.selected=29;
 assert.equal(onboardingAllows(s,c,'cell',31).allowed,true);assert.equal(onboardingAllows(s,c,'generate').allowed,false);
 s.selected=31;assert.equal(onboardingAllows(s,c,'generate').allowed,true);assert.equal(onboardingAllows(s,c,'move','31,30').allowed,false);
});
test('cache merge gate permits source reselection after stale target selection and never permits reverse cell merge',()=>{
 const {s,c}=guided('tutorial_cache','merge',{from:0,to:31});s.selected=31;
 assert.equal(onboardingAllows(s,c,'cell',0).allowed,true,'caller prepares this as source selection only');
 assert.equal(onboardingAllows(s,c,'cell',31).allowed,false);assert.equal(onboardingAllows(s,c,'move','31,0').allowed,false);
 assert.equal(onboardingAllows(s,c,'move','0,31').allowed,true);
 s.selected=0;assert.equal(onboardingAllows(s,c,'cell',31).allowed,true);
});
test('follow-up fixed delivery, task-window entry and task commit each permit only the current flow',()=>{
 const {s,c}=guided('tutorial_7','deliver',1);s.board[0]=cell(1,'203');s.orders.slots=[{slot:1,id:1,kind:'fixed',requirements:[{type:'203',count:1}],coins:2}];
 assert.equal(onboardingAllows(s,c,'deliver',1).allowed,true);assert.equal(onboardingAllows(s,c,'deliver').allowed,true);
 assert.equal(onboardingAllows(s,c,'deliver',2).allowed,false);assert.equal(onboardingAllows(s,c,'generate').allowed,false);
 s.onboarding.phases={tutorial_task:'open-task'};s.onboarding.targets={};
 assert.equal(onboardingAllows(s,c,'home').allowed,true);assert.equal(onboardingAllows(s,c,'quest-start').allowed,false);
 s.onboarding.phases.tutorial_task='commit-task';assert.equal(onboardingAllows(s,c,'home').allowed,true);
 s.stage='home';assert.equal(onboardingAllows(s,c,'quest-start').allowed,true);assert.equal(onboardingAllows(s,c,'quest-finish').allowed,true);
 assert.equal(onboardingAllows(s,c,'main').allowed,false);assert.equal(onboardingAllows(s,c,'shop').allowed,false);
});
test('chest select/open/skip and item-info gates require target selection rather than an unrelated board action',()=>{
 const {s,c}=guided('tutorial_chest','select',{index:15,uid:1});
 assert.equal(onboardingAllows(s,c,'cell',15).allowed,true);assert.equal(onboardingAllows(s,c,'cell',16).allowed,false);
 assert.equal(onboardingAllows(s,c,'open-item',15).allowed,false);
 s.onboarding.phases.tutorial_chest='open';s.selected=null;
 assert.equal(onboardingAllows(s,c,'open-item',15).allowed,false);assert.equal(onboardingAllows(s,c,'cell',15).allowed,true);
 s.selected=15;assert.equal(onboardingAllows(s,c,'open-item',15).allowed,true);assert.equal(onboardingAllows(s,c,'open-item').allowed,true);
 assert.equal(onboardingAllows(s,c,'cell',15).allowed,false,'already-selected chest must use its Open action, not generate through a repeated tap');
 assert.equal(onboardingAllows(s,c,'open-item',16).allowed,false);assert.equal(onboardingAllows(s,c,'generate').allowed,false);
 s.onboarding.phases.tutorial_chest='skip';assert.equal(onboardingAllows(s,c,'speedup-item',15).allowed,true);assert.equal(onboardingAllows(s,c,'open-item',15).allowed,false);
 s.onboarding.phases={tutorial_item_detail:'item-info'};s.onboarding.targets={tutorial_item_detail:{index:15}};
 assert.equal(onboardingAllows(s,c,'item-info').allowed,true);assert.equal(onboardingAllows(s,c,'sell').allowed,false);
 s.modal='item-info';assert.equal(onboardingAllows(s,c,'close-info').allowed,true);assert.equal(onboardingAllows(s,c,'cell',15).allowed,false);
});
test('energy and shop guides allow modal close and reopen recovery without enabling paid-chain experiments',()=>{
 const {s,c}=guided('tutorial_energy','refill-energy');s.modal='energy';
 assert.equal(onboardingAllows(s,c,'buy-energy').allowed,true);assert.equal(onboardingAllows(s,c,'close-energy').allowed,true);
 assert.equal(onboardingAllows(s,c,'close-info').allowed,false);assert.equal(onboardingAllows(s,c,'open-energy').allowed,false);
 s.modal=null;assert.equal(onboardingAllows(s,c,'open-energy').allowed,true);assert.equal(onboardingAllows(s,c,'buy-energy').allowed,false);
 s.modal='offer';assert.equal(onboardingAllows(s,c,'close-offer').allowed,true);assert.equal(onboardingAllows(s,c,'buy-energy').allowed,false);
 s.onboarding.phases={tutorial_shop:'claim-free-gift'};s.onboarding.targets={};s.stage='home';s.modal='shop';
 s.commerce={daily:{rows:[{id:'daily-1',cost:0,left:1},{id:'daily-2',cost:10,left:1},{id:'daily-3',cost:0,left:0}]},flash:{rows:[{id:'flash-1',cost:0,left:1}]}};
 assert.equal(onboardingAllows(s,c,'claim-free-gift').allowed,true);assert.equal(onboardingAllows(s,c,'close-shop').allowed,true);
 assert.equal(onboardingAllows(s,c,'commerce-buy','daily-1').allowed,true);
 for(const id of ['daily-2','daily-3','flash-1','missing'])assert.equal(onboardingAllows(s,c,'commerce-buy',id).allowed,false,id);
 for(const action of ['chain-start','chain-claim','buy-energy','aid-gems'])assert.equal(onboardingAllows(s,c,action).allowed,false,action);
 s.modal=null;assert.equal(onboardingAllows(s,c,'shop').allowed,true);
});
test('UI, clock and explicit research skip stay available during waits; non-strong arrow does not lock gameplay',()=>{
 const {s,c}=guided('tutorial_6','wait',1);s.onboarding.order1ReadyAt=2.5;
 for(const action of ['focus','save','export','skip-tutorial','time'])assert.equal(onboardingAllows(s,c,action,3).allowed,true,action);
 for(const action of ['deliver','main','home','sell','aid-xp'])assert.equal(onboardingAllows(s,c,action,1).allowed,false,action);
 s.guidanceSkipped=true;assert.equal(onboardingAllows(s,c,'aid-xp').allowed,true);
 delete s.guidanceSkipped;s.onboarding.phases={};s.onboarding.targets={};s.stage='home';s.wallet.level=4;
 assert.equal(onboardingConstraints(s,c).highlight,'main-board');assert.equal(onboardingAllows(s,c,'shop').allowed,true);
 const uninitialized=state();assert.equal(onboardingAllows(uninitialized,c,'cell',0).allowed,true);assert.equal(uninitialized.onboarding,undefined);
});

const boardContext={eventLocked:false,paperBoxExtraRewardAnimationPlaying:false};
function pressureBoard(){
 const c=config(),s=state(2);s.inventory={schema:1,purchasedSlots:0,items:[]};s.generatorState={};s.rng=42;s.itemUnlocks={};
 s.board=Array.from({length:63},(_,i)=>({uid:i+1,type:i===0?'206':'201',cover:i===0?null:'box'}));s.nextUid=64;
 completedCore(s,c);s.tutorialStep=8;return {s,c};
}
test('inventory guide uses the complete pressure predicate and requires explicit web busy snapshots',()=>{
 const {s,c}=pressureBoard(),before=structuredClone(s);
 assert.deepEqual(inventoryGuideCandidates(s,c),[],'missing UI snapshots are not silently false');
 assert.deepEqual(inventoryGuideCandidates(s,c,boardContext),[{index:0,uid:1,type:'206'}]);assert.deepEqual(s,before);
 assert.deepEqual(inventoryGuideCandidates(s,c,{...boardContext,eventLocked:true}),[]);
 assert.deepEqual(inventoryGuideCandidates(s,c,{...boardContext,paperBoxExtraRewardAnimationPlaying:true}),[]);
 s.board[1]={uid:2,type:'206',cover:'web'};assert.deepEqual(inventoryGuideCandidates(s,c,boardContext),[],'one normal plus matching web is a merge pair');
 s.board[1]={uid:2,type:'201',cover:'box'};s.board[62]=null;assert.deepEqual(inventoryGuideCandidates(s,c,boardContext),[],'board must be full');
});
test('inventory candidate excludes order demand, collectible/choose types and numeric codes above2000; chooses maximum eligible level',()=>{
 const {s,c}=pressureBoard();s.board[1]={uid:2,type:'505',cover:null};
 assert.deepEqual(inventoryGuideCandidates(s,c,boardContext).map(x=>x.type),['206']);
 s.orders.slots=[{slot:1,id:1,kind:'fixed',requirements:[{type:'206',count:2}],coins:24}];
 assert.deepEqual(inventoryGuideCandidates(s,c,boardContext).map(x=>x.type),['505'],'a partial order still protects its existing matching type');
 s.orders.slots=[];s.board[0].type='2401';assert.deepEqual(inventoryGuideCandidates(s,c,boardContext).map(x=>x.type),['505']);
 c.onboardingRules.inventoryGuide.chooseTypes.push('505');assert.deepEqual(inventoryGuideCandidates(s,c,boardContext),[]);
});
test('inventory original callback path stores before opening modal, then opens and withdraws the same UID without rewards',()=>{
 const {s,c}=pressureBoard(),wallet=structuredClone(s.wallet);reconcileOnboarding(s,c,boardContext);
 assert.equal(onboardingConstraints(s,c).input.kind,'guide-ack');assert.ok(s.onboarding.registeredFinished.includes('tutorial_inventory'));assert.ok(!s.onboarding.completed.includes('tutorial_inventory'));
 onboardingEvent(s,{type:'guide-ack'},c,boardContext);assert.equal(onboardingConstraints(s,c).input.kind,'inventory-store');
 assert.equal(onboardingAllows(s,c,'inventory-store',0).allowed,true,'HUD drag carries the exact source index without a preceding selection');
 assert.equal(onboardingAllows(s,c,'inventory-store',1).allowed,false);s.selected=0;assert.equal(onboardingAllows(s,c,'inventory-store').allowed,true);assert.equal(onboardingAllows(s,c,'inventory').allowed,false);
 const stored=s.board[0];s.board[0]=null;s.inventory.items.push(stored);
 onboardingEvent(s,{type:'inventory-stored',uid:stored.uid,fromIndex:0},c,boardContext);
 assert.equal(onboardingConstraints(s,c).input.kind,'inventory-open');assert.equal(onboardingAllows(s,c,'inventory').allowed,true);
 s.modal='inventory';onboardingEvent(s,{type:'inventory-opened'},c,boardContext);
 assert.equal(onboardingConstraints(s,c).input.kind,'inventory-withdraw');assert.equal(onboardingAllows(s,c,'inventory-withdraw',0).allowed,true);
 assert.equal(onboardingAllows(s,c,'inventory-withdraw',1).allowed,false);
 s.inventory.items=[];s.board[0]=stored;onboardingEvent(s,{type:'inventory-withdrawn',uid:stored.uid},c,boardContext);
 assert.ok(s.onboarding.completed.includes('tutorial_inventory'));assert.deepEqual(s.wallet,wallet);assert.equal(validOnboardingState(s,c),true);
});
test('inventory guide can finish on close after stored-item step and skips for used storage or level>30',()=>{
 const {s,c}=pressureBoard();reconcileOnboarding(s,c,boardContext);onboardingEvent(s,{type:'guide-ack'},c,boardContext);
 const stored=s.board[0];s.board[0]=null;s.inventory.items=[stored];onboardingEvent(s,{type:'inventory-stored',uid:stored.uid},c,boardContext);
 s.modal='inventory';onboardingEvent(s,{type:'inventory-opened'},c,boardContext);onboardingEvent(s,{type:'inventory-closed'},c,boardContext);
 assert.ok(s.onboarding.completed.includes('tutorial_inventory'));assert.equal(s.inventory.items[0].uid,stored.uid,'closing does not invent withdrawal');
 const t=pressureBoard();t.s.wallet.level=31;reconcileOnboarding(t.s,t.c,boardContext);assert.ok(t.s.onboarding.completed.includes('tutorial_inventory'));
 const u=pressureBoard();u.s.board[0]=null;u.s.inventory.items=[{uid:1,type:'206',cover:null}];reconcileOnboarding(u.s,u.c,boardContext);assert.ok(u.s.onboarding.completed.includes('tutorial_inventory'));
});
test('order requirement info guide requires unlocked405 and a single603 fixed order, locks delivery until matching info opens',()=>{
 const {s,c}=guided('tutorial_7','deliver',1,4);s.onboarding.phases={};s.onboarding.targets={};s.itemUnlocks={};
 s.orders.slots=[{slot:1,id:14,kind:'fixed',requirements:[{type:'603',count:1}],coins:8}];s.board[0]=cell(1,'603');
 assert.equal(eligibleOrderItemInfoGuide(s,c),null);s.itemUnlocks['405']=true;
 assert.deepEqual(eligibleOrderItemInfoGuide(s,c),{slot:1,type:'603'});reconcileOnboarding(s,c,boardContext);
 assert.equal(onboardingConstraints(s,c).input.kind,'guide-ack');assert.equal(onboardingAllows(s,c,'deliver',1).allowed,false);
 onboardingEvent(s,{type:'guide-ack'},c,boardContext);assert.equal(onboardingConstraints(s,c).input.kind,'order-item-info');
 assert.equal(onboardingAllows(s,c,'order-item-info','1,603').allowed,true);assert.equal(onboardingAllows(s,c,'order-item-info','2,603').allowed,false);
 onboardingEvent(s,{type:'order-item-info-opened',slot:1,itemType:'604'},c,boardContext);assert.ok(!s.onboarding.completed.includes('tutorial_order_item_info'));
 onboardingEvent(s,{type:'order-item-info-opened',slot:1,itemType:'603'},c,boardContext);assert.ok(s.onboarding.completed.includes('tutorial_order_item_info'));
 assert.equal(onboardingAllows(s,c,'deliver',1).allowed,true);
});
test('order info cutoff and fixed-order completion do not invent a detail visit or reward',()=>{
 const {s,c}=guided('tutorial_7','deliver',1,10);s.onboarding.phases={};s.onboarding.targets={};s.itemUnlocks={'405':true};
 const before=structuredClone(s.wallet);reconcileOnboarding(s,c,boardContext);assert.ok(s.onboarding.completed.includes('tutorial_order_item_info'));assert.deepEqual(s.wallet,before);
 const t=guided('tutorial_order_item_info','highlight-order',{slot:1,type:'603'},4);onboardingEvent(t.s,{type:'order-submitted',kind:'fixed',slot:1},t.c,boardContext);
 assert.ok(t.s.onboarding.completed.includes('tutorial_order_item_info'));
});
test('scissor guide follows mask acknowledgment, source-oriented combine, merged highlight and info acknowledgment',()=>{
 const {s,c}=guided('tutorial_7','deliver',1);s.onboarding.phases={};s.onboarding.targets={};const type=c.onboardingRules.scissorMerge.type;
 s.board[2]={uid:1,type,cover:null,uses:1};s.board[8]={uid:2,type,cover:null,uses:1};
 assert.deepEqual(eligibleScissorMergeGuide(s,c),{from:8,to:2,fromUid:2,targetUid:1});
 const wallet=structuredClone(s.wallet);reconcileOnboarding(s,c,boardContext);assert.equal(onboardingConstraints(s,c).input.kind,'guide-ack');
 onboardingEvent(s,{type:'guide-ack'},c,boardContext);assert.deepEqual(onboardingConstraints(s,c).input,{kind:'merge',from:8,to:2});
 assert.equal(onboardingAllows(s,c,'move','8,2').allowed,true);assert.equal(onboardingAllows(s,c,'move','2,8').allowed,false);
 s.board[8]=null;s.board[2]={uid:3,type,cover:null,uses:2};onboardingEvent(s,{type:'merge',from:8,to:2,result:type},c,boardContext);
 assert.equal(onboardingConstraints(s,c).input.step,'highlight-merged');onboardingEvent(s,{type:'guide-ack'},c,boardContext);
 assert.equal(onboardingConstraints(s,c).input.step,'highlight-info');assert.equal(onboardingAllows(s,c,'item-info',2).allowed,false,'source asks mask acknowledgment rather than opening a detail window');
 onboardingEvent(s,{type:'guide-ack'},c,boardContext);assert.ok(s.onboarding.completed.includes('tutorial_scissor_merge'));assert.equal(s.board[2].uses,2);assert.deepEqual(s.wallet,wallet);
});
test('scissor guide skips already-combined scissors and waits while other strong guidance is active',()=>{
 const {s,c}=guided('tutorial_7','deliver',1);s.onboarding.phases={};s.onboarding.targets={};const type=c.onboardingRules.scissorMerge.type;
 s.board[0]={uid:1,type,cover:null,uses:2};assert.deepEqual(eligibleScissorMergeGuide(s,c),{finishWithoutGuide:true});
 reconcileOnboarding(s,c,boardContext);assert.ok(s.onboarding.completed.includes('tutorial_scissor_merge'));
 const t=guided('tutorial_7','deliver',1);t.s.board[0]={uid:1,type,cover:null,uses:1};t.s.board[1]={uid:2,type,cover:null,uses:1};
 assert.equal(eligibleScissorMergeGuide(t.s,t.c,{otherStrong:true}),null);
});
test('first ordinary bubble occurrence is retained across another guide and retries on a later view close',()=>{
 const {s,c}=guided('tutorial_item_detail','item-info',{index:0},4);s.board[2]=cell(1,'203');s.bubbles[1]={price:1,expiresAt:60};
 onboardingEvent(s,{type:'bubble-spawned',index:2,uid:1},c,boardContext);assert.deepEqual(s.onboarding.pendingBubbleUids,[1]);
 assert.equal(s.onboarding.phases.tutorial_bubble,undefined);
 s.modal='item-info';onboardingEvent(s,{type:'view-opened'},c,boardContext);assert.equal(s.onboarding.phases.tutorial_bubble,undefined);
 s.modal=null;onboardingEvent(s,{type:'view-closed'},c,boardContext);assert.equal(onboardingConstraints(s,c).forcedBubbleCost,0);
 assert.deepEqual(s.onboarding.pendingBubbleUids,[]);
});
