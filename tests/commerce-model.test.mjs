import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileCommerce,dispatchCommerce,commerceSnapshot,energyGiftStatus,activityState,passProgress,recordCommerceEvent,validCommerce,flashSelectionContext} from '../src/commerce-model.mjs';
import {renderCommerceSections} from '../src/commerce-page.mjs';

// Small source-shaped fixtures; runtime logic never relies on the private
// analysis directory, a live shop, a payment provider, or random global state.
function config(){return {items:[{type:'101',name:'가방',generator:{}},{type:'106',name:'생성기',generator:{cost:1}},
 {type:'203',name:'반죽'},{type:'204',name:'빵'},{type:'205',name:'상위빵'}],tutorialSteps:[],commerceRules:{schemaVersion:1,
 unlockLevel:3,gemOnlyMaxLevel:2,containerSequence:['OrderItem','DailyDeals','FlashSale','Bundles','Diamonds'],
 tabs:{item:['DailyDeals','FlashSale'],gem:['OrderItem','Bundles','Diamonds']},
 daily:{base:[{id:1,itemCode:'3101',leftCount:1,weight:1,costType:'gem',costCount:25},
  {id:2,itemCode:'2901',leftCount:1,weight:1,costType:'gem',costCount:10,ad:1},
  {id:3,itemCode:'ShopNewChest_1',leftCount:1,weight:1,costType:'gem',costCount:0}],
 randomVariant:[{id:1,itemCode:'level_down_piece_1',leftCount:1,weight:2,costType:'gem',costCount:30},
  {id:1,itemCode:'level_up_piece_1',leftCount:1,weight:4,costType:'gem',costCount:150},
  {id:1,itemCode:'pack_common_3',leftCount:1,weight:1,costType:'gem',costCount:50}],cacheProperties:['pack_common_3']},
 flash:{maxSlots:6,defaultCount:5,manualRefreshGem:20,items:[
  {Type:'101',ShopWeight:100,ShopCount:1,Slot:[6],CustomChain:'0',Price:40},
  {Type:'203',ShopWeight:100,ShopCount:5,Slot:[1,2,3],Price:1},
  {Type:'204',ShopWeight:100,ShopCount:5,Slot:[1,2,3],Price:2}],
  slots:[{ChainId:'0',Slot6Weight:25},{ChainId:'2',Slot1Weight:20,Slot2Weight:20,Slot3Weight:20}],specialOrderChains:[]},
 chainInfo:{'101':{chainId:'1',chainLevel:1},'106':{chainId:'1',chainLevel:6},'203':{chainId:'2',chainLevel:3},'204':{chainId:'2',chainLevel:4},'205':{chainId:'2',chainLevel:5}},
 iap:[{purchaseId:'getgem_1',goods:['gem-100']}],starterVariants:{},activity:{passTaskTargets:['merge','customer','gold','gem','energy']},links:[],sources:{},boundary:['테스트의 연구 입력']}};}
function state(c,overrides={}){const s={wallet:{time:0,level:3,gems:200,coins:0,energy:0,price:20,freeUsed:1,freeTotal:1,...overrides},
 board:[{uid:1,type:'106',cover:null}],selected:0,inventory:{items:[]},itemUnlocks:{'205':true},bubbles:{}};reconcileCommerce(s,c,{random:()=>0});return s;}
function input(s,c,field,value,hooks={}){return dispatchCommerce(s,c,'commerce-input',{field,value},hooks);}

test('shop level gate, gem-only layout and IAP nil/zero are separate predicates',()=>{
 const c=config(),s=state(c,{level:2});let v=commerceSnapshot(s,c);
 assert.equal(v.shopOpen,false);assert.equal(v.gemOnly,true);assert.deepEqual(v.sequence,['Diamonds']);assert.deepEqual(v.tabs,[]);
 s.wallet.level=3;reconcileCommerce(s,c);v=commerceSnapshot(s,c);assert.equal(v.shopOpen,true);assert.equal(v.gemOnly,false);
 assert.equal(v.iapEnabled,true);input(s,c,'allGiftSwitch',0);assert.deepEqual(commerceSnapshot(s,c).tabs,['item']);
 assert.equal(dispatchCommerce(s,c,'commerce-tab','gem').ok,false);
 assert.equal(validCommerce(s.commerce,c),true);
});

test('daily purchase costs and stock commit only with a connected reward hook; day refresh restores stock',()=>{
 const c=config(),s=state(c),received=[];
 assert.equal(dispatchCommerce(s,c,'commerce-buy','daily-1').ok,false);assert.equal(s.wallet.gems,200);
 assert.equal(dispatchCommerce(s,c,'commerce-buy','daily-1',{reward:()=>({ok:false})}).ok,false);assert.equal(s.wallet.gems,200);
 assert.equal(dispatchCommerce(s,c,'commerce-buy','daily-1',{reward:r=>received.push(r)}).ok,true);
 assert.equal(s.wallet.gems,175);assert.equal(s.commerce.daily.rows[0].left,0);assert.equal(received.length,1);
 assert.equal(dispatchCommerce(s,c,'commerce-buy','daily-1',{reward:r=>received.push(r)}).ok,false);
 s.wallet.time=86400;reconcileCommerce(s,c);assert.equal(s.commerce.daily.rows[0].left,1);assert.equal(s.commerce.daily.nextAt,172800);
 assert.equal(validCommerce(s.commerce,c),true);
});

test('group weighted daily variant filters cached packs without a started album',()=>{
 const c=config(),s=state(c);
 input(s,c,'dailyVariant','random',{random:()=>0.99});assert.equal(s.commerce.daily.rows[0].type,'level_up_piece_1');
 dispatchCommerce(s,c,'commerce-event','example-album');s.wallet.time=86400; // the example has expired: still no cache pack
 reconcileCommerce(s,c,{random:()=>0.99});assert.equal(s.commerce.daily.rows[0].type,'level_up_piece_1');
 dispatchCommerce(s,c,'commerce-event','example-album');input(s,c,'dailyVariant','base');input(s,c,'dailyVariant','random',{random:()=>0.99});
 assert.equal(s.commerce.daily.rows[0].type,'pack_common_3');assert.equal(validCommerce(s.commerce,c),true);
});

test('flash uses strict discovered-chain ceiling, no duplicate type, fallback slots and minimum level',()=>{
 const c=config();c.commerceRules.flash.items[2].MinLevel=4;const s=state(c);
 assert.deepEqual(new Set(s.commerce.flash.rows.map(r=>r.type)),new Set(['101','203']));
 assert.equal(s.commerce.flash.rows.length,2); // other source slots fallback, but already-selected types never duplicate
 s.wallet.level=4;dispatchCommerce(s,c,'commerce-refresh',undefined,{random:()=>0});
 assert.equal(s.commerce.flash.rows.length,3);assert.ok(s.commerce.flash.rows.some(r=>r.type==='204'));
 delete s.itemUnlocks['205'];delete s.commerce.unlockedTypes['205'];s.itemUnlocks['204']=true;
 dispatchCommerce(s,c,'commerce-refresh',undefined,{random:()=>0});assert.ok(!s.commerce.flash.rows.some(r=>r.type==='204'));
 assert.equal(validCommerce(s.commerce,c),true);
});

test('manual flash refresh costs20 and preserves automatic clock in base and adaptive modes',()=>{
 const c=config(),s=state(c);input(s,c,'flashRefreshHours',2);const automatic=s.commerce.flash.nextAt;
 s.wallet.time=500;dispatchCommerce(s,c,'commerce-refresh');assert.equal(s.wallet.gems,180);assert.equal(s.commerce.flash.nextAt,automatic);
 input(s,c,'flashMode',1);assert.equal(s.commerce.flash.unsupported,false);const gems=s.wallet.gems,changedModeClock=s.commerce.flash.nextAt;
 assert.equal(dispatchCommerce(s,c,'commerce-refresh').ok,true);assert.equal(s.wallet.gems,gems-20);assert.equal(s.commerce.flash.nextAt,changedModeClock);
});

test('mode1 missing-order and manual unbought multipliers preserve bought-chain and special exceptions',()=>{
 const c=config(),s=state(c);s.orders={slots:[{slot:1,requirements:[{type:'205',count:1}]}]};input(s,c,'flashMode',1);
 let ctx=flashSelectionContext(s,c,[{type:'203',left:5}]);
 assert.equal(ctx.chainMultipliers['2'],10*0.33333);assert.equal(ctx.codeMultipliers['203'],10*0.33333);assert.equal(ctx.codeMultipliers['204'],50);
 ctx=flashSelectionContext(s,c,[{type:'203',left:5},{type:'204',left:4}]);assert.equal(ctx.chainMultipliers['2'],10);assert.equal(ctx.codeMultipliers['203'],10*0.33333);
 c.commerceRules.flash.specialWeightChains=['2'];ctx=flashSelectionContext(s,c,[{type:'203',left:5}]);assert.equal(ctx.chainMultipliers['2'],1);assert.equal(ctx.codeMultipliers['203'],1);assert.equal(ctx.codeMultipliers['204'],1);
});

test('mode1 ceil-adjusted item weight is used for the actual weighted draw',()=>{
 const c=config(),s=state(c);s.orders={slots:[{slot:1,requirements:[{type:'205',count:1}]}]};input(s,c,'flashMode',1);
 const a=s.commerce.flash.rows.find(x=>x.type==='203'),b=s.commerce.flash.rows.find(x=>x.type==='204');
 s.commerce.flash.rows=[{...a,left:5,bought:0},{...b,left:4,bought:1}];
 const randoms=[0,0.0626];dispatchCommerce(s,c,'commerce-refresh',undefined,{random:()=>randoms.shift()??0});
 // ceil(100*10*.33333)=334, so .0626 selects203 from334+5000.
 // Keeping the unrounded333.33 would instead select204 at this boundary.
 assert.equal(s.commerce.flash.selection.steps[0].selectedType,'203');assert.equal(validCommerce(s.commerce,c),true);
});

test('mode1 counts complete absence, while mode2 detects repeated requirements and excludes branch slots',()=>{
 const c=config(),s=state(c);s.inventory.items=[{uid:2,type:'205'}];s.board.push({uid:3,type:'203',cover:'web'});s.queue=[{type:'204',count:3}];
 s.orders={slots:[{slot:1,requirements:[{type:'205',count:2},{type:'203',count:1}]},{slot:7,requirements:[{type:'204',count:1}]}]};
 const ctx=flashSelectionContext(s,c);assert.deepEqual(new Set(ctx.missingCodes),new Set(['203','204']));
 assert.ok(ctx.preferredMissing.includes('205'));assert.ok(ctx.preferredMissing.includes('204')); // nearest purchasable below205, not slot7's independent preference
 assert.equal(ctx.stock['203'],undefined);assert.equal(ctx.stock['204'],undefined);assert.equal(ctx.stock['205'],1);
 s.orders.slots=[{slot:7,requirements:[{type:'203',count:1}]}];assert.deepEqual(flashSelectionContext(s,c).preferredMissing,[]);
});

test('mode2 walks slots backwards, prefers highest shortage fallback, and applies the lower-level50 percent branch once',()=>{
 const c=config();for(const x of c.commerceRules.flash.items)if(['203','204'].includes(x.Type))x.Slot=[1,2,3,4,5,6];
 Object.assign(c.commerceRules.flash.slots.find(x=>x.ChainId==='2'),{Slot4Weight:20,Slot5Weight:20,Slot6Weight:20});
 const s=state(c);s.orders={slots:[{slot:1,requirements:[{type:'205',count:1}]}]};
 const randoms=[0,.75];input(s,c,'flashMode',2,{random:()=>randoms.shift()??0});
 const steps=s.commerce.flash.selection.steps;assert.equal(steps[0].slot,6);assert.equal(steps[0].kind,'order-priority');assert.equal(steps[0].preferredType,'204');assert.equal(steps[0].selectedType,'203');assert.equal(steps[0].previousLevelChosen,true);
 assert.equal(steps[1].kind,'weighted');assert.equal(steps[1].selectedType,'204');
 assert.deepEqual(s.commerce.flash.rows.map(x=>x.slot),[...s.commerce.flash.rows.map(x=>x.slot)].sort((a,b)=>a-b));
 assert.equal(validCommerce(s.commerce,c),true);
});

test('mode2 preserves CustomChain vs actual chain distinction in preferred lookup',()=>{
 const c=config(),s=state(c);s.orders={slots:[{slot:1,requirements:[{type:'101',count:1}]}]};input(s,c,'flashMode',2,{random:()=>0});
 assert.ok(s.commerce.flash.selection.preferredMissing.includes('101'));
 assert.notEqual(s.commerce.flash.selection.steps.find(x=>x.selectedType==='101').kind,'order-priority');
});

test('EnergyGift has no invented server fallback; raw minutes and actual generation cost govern new creation',()=>{
 const c=config(),s=state(c,{energy:2});assert.equal(energyGiftStatus(s,c).configured,false);
 dispatchCommerce(s,c,'commerce-trigger','lack');assert.equal(s.commerce.energy.left,0);
 dispatchCommerce(s,c,'commerce-assume','energy');assert.equal(energyGiftStatus(s,c).canGenerate,false);
 dispatchCommerce(s,c,'commerce-trigger','lack',{generationCost:4});assert.equal(s.commerce.energy.left,1);
 assert.equal(s.commerce.energy.groupEnd,3600);assert.equal(s.commerce.energy.itemEnd,600);
 assert.equal(energyGiftStatus(s,c).generationCost,4);assert.equal(s.commerce.energy.triggerCount,1);
 assert.equal(validCommerce(s.commerce,c),true);
});

test('root forced-guide hooks, legacy tutorial and explicit input are ORed for lack-entry gating',()=>{
 const c=config(),s=state(c);dispatchCommerce(s,c,'commerce-assume','energy');
 dispatchCommerce(s,c,'commerce-trigger','lack',{strongTutorial:true});assert.equal(s.commerce.energy.left,0);assert.equal(energyGiftStatus(s,c).strongTutorial,true);
 dispatchCommerce(s,c,'commerce-trigger','lack',{strongTutorial:false});assert.equal(s.commerce.energy.left,1);
 input(s,c,'strongTutorial',true);assert.equal(energyGiftStatus(s,c,{strongTutorial:false}).strongTutorial,true);
 input(s,c,'strongTutorial',false);s.tutorialStep=0;c.tutorialSteps=[{kind:'merge'}];assert.equal(energyGiftStatus(s,c,{strongTutorial:false}).strongTutorial,true);
});

test('existing EnergyGift exposure survives quota; close never generates; group cooldown and date quota are separate',()=>{
 const c=config(),s=state(c);dispatchCommerce(s,c,'commerce-assume','energy');input(s,c,'energyGift.dailyTriggerUpper',1);
 dispatchCommerce(s,c,'commerce-trigger','lack');assert.equal(energyGiftStatus(s,c).canGenerate,false);
 let out=dispatchCommerce(s,c,'commerce-trigger','close');assert.equal(out.route.chosen,'EnergyBundle');assert.equal(s.commerce.energy.triggerCount,1);
 s.wallet.time=3600;reconcileCommerce(s,c);assert.equal(s.commerce.energy.state,'CoolingDown');
 s.wallet.time=5400;reconcileCommerce(s,c);assert.equal(s.commerce.energy.state,'None');assert.equal(s.commerce.energy.triggerCount,1);
 s.wallet.time=86400;reconcileCommerce(s,c);assert.equal(s.commerce.energy.triggerCount,0);
 input(s,c,'allGiftSwitch',0);dispatchCommerce(s,c,'commerce-trigger','lack');assert.equal(s.commerce.energy.left,0);
});

test('free opportunity blocks new gift, while candidate priority and price tie remain source-shaped',()=>{
 const c=config(),s=state(c,{freeUsed:0});dispatchCommerce(s,c,'commerce-assume','energy');dispatchCommerce(s,c,'commerce-trigger','lack');assert.equal(s.commerce.energy.left,0);
 s.wallet.freeUsed=1;input(s,c,'more.threshold',0);input(s,c,'more.cooldownMinutes',0);
 input(s,c,'candidates.chain',true);input(s,c,'candidates.weekly',true);
 let route=dispatchCommerce(s,c,'commerce-trigger','close').route;assert.equal(route.chosen,null);assert.match(route.unknown,/미입력/);
 input(s,c,'candidates.chainPrice',10);input(s,c,'candidates.weeklyPrice',10);assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,'ChainBundle');
 input(s,c,'candidates.chainHasNextPayId',false);assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,'NewWeeklyBundle');
 input(s,c,'candidates.invite',true);assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,'InviteFriend');
});

test('global default close does not add China IAP gate; more-bundle cooldown resets on source day boundary',()=>{
 const c=config(),s=state(c);dispatchCommerce(s,c,'commerce-assume','energy');dispatchCommerce(s,c,'commerce-trigger','lack');input(s,c,'allGiftSwitch',0);
 assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,'EnergyBundle');
 input(s,c,'energyGift.enabled',false);input(s,c,'more.threshold',20);input(s,c,'more.cooldownMinutes',10);input(s,c,'candidates.plenty',true);
 s.wallet.time=86399;assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,'PlentyBundle');
 assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,null);
 s.wallet.time=86400;assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,'PlentyBundle');
 input(s,c,'more.canShowAfterClose',false);assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,null);
});

test('chain-vs-weekly compares fractional fixedMoney values, never assumes a localized price',()=>{
 const c=config(),s=state(c);input(s,c,'more.threshold',0);input(s,c,'more.cooldownMinutes',0);input(s,c,'candidates.chain',true);input(s,c,'candidates.weekly',true);
 assert.equal(input(s,c,'candidates.chainPrice','4.99').ok,true);input(s,c,'candidates.weeklyPrice','9.99');
 assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,'ChainBundle');
 input(s,c,'candidates.chainPrice',10.01);assert.equal(dispatchCommerce(s,c,'commerce-trigger','close').route.chosen,'NewWeeklyBundle');
 assert.equal(validCommerce(s.commerce,c),true);
});

test('level-up offer needs explicit config and an actual later level increase, with seconds duration',()=>{
 const c=config(),s=state(c);s.wallet.level=4;reconcileCommerce(s,c);assert.equal(s.commerce.levelGift.offer,null);
 dispatchCommerce(s,c,'commerce-assume','level');assert.equal(s.commerce.levelGift.offer,null);
 s.wallet.time=10;s.wallet.level=5;reconcileCommerce(s,c);assert.deepEqual(s.commerce.levelGift.offer,{level:5,createdAt:10,expiresAt:3610});
 s.wallet.time=3610;reconcileCommerce(s,c);assert.equal(s.commerce.levelGift.offer,null);
});

test('activity start/end/release, level and resources use exact boundary predicates',()=>{
 const c=config(),s=state(c);dispatchCommerce(s,c,'commerce-event','example-pass');input(s,c,'activity.sTime',10);
 assert.equal(activityState(s,c).effective,'Preparing');s.wallet.time=10;assert.equal(activityState(s,c).effective,'Started');
 s.wallet.time=600;assert.equal(activityState(s,c).effective,'Ended');s.wallet.time=900;assert.equal(activityState(s,c).effective,'Released');
 s.wallet.time=100;input(s,c,'activity.resourcesReady',false);assert.equal(activityState(s,c).raw,'Started');assert.equal(activityState(s,c).effective,'Released');
 input(s,c,'activity.resourcesReady',true);s.wallet.level=2;assert.equal(activityState(s,c).reason,'시작 레벨 미달');
});

test('research pass subtracts per-tier requirements, separates entitlement/claims, and allows end-period claims',()=>{
 const c=config(),s=state(c),received=[];dispatchCommerce(s,c,'commerce-event','example-pass');
 recordCommerceEvent(s,c,'customer',6);assert.equal(s.commerce.activity.tokens,3);assert.deepEqual(passProgress(s),{level:1,remaining:0});
 const hooks={reward:r=>received.push(r)};
 assert.equal(dispatchCommerce(s,c,'commerce-event','claim:1:premium',hooks).ok,false);
 assert.equal(dispatchCommerce(s,c,'commerce-event','claim:1:free',hooks).ok,true);assert.equal(dispatchCommerce(s,c,'commerce-event','claim:1:free',hooks).ok,false);
 dispatchCommerce(s,c,'commerce-event','ticket');s.wallet.time=600;assert.equal(dispatchCommerce(s,c,'commerce-event','claim:1:premium',hooks).ok,true);
 assert.equal(received.length,2);assert.equal(validCommerce(s.commerce,c),true);
 s.wallet.time=900;assert.equal(dispatchCommerce(s,c,'commerce-event','claim:2:free',hooks).ok,false);
});

test('research album increments progress only on first ownership; inactive/unknown cards never draw',()=>{
 const c=config(),s=state(c);dispatchCommerce(s,c,'commerce-event','example-album');
 dispatchCommerce(s,c,'commerce-event','card:research-1');dispatchCommerce(s,c,'commerce-event','card:research-1');
 assert.deepEqual(s.commerce.activity.ownedCards,['research-1']);assert.equal(s.commerce.activity.duplicateCards,1);
 assert.equal(dispatchCommerce(s,c,'commerce-event','card:actual-unknown').ok,false);
 input(s,c,'activity.resourcesReady',false);assert.equal(dispatchCommerce(s,c,'commerce-event','card:research-2').ok,false);
});

test('commerce save validation rejects forged cost, schema and prototype-like input; renderer escapes labels',()=>{
 const c=config(),s=state(c);assert.equal(validCommerce(s.commerce,c),true);
 for(const mutate of [x=>x.schema=2,x=>x.daily.rows[0].cost=0,x=>x.daily.rows[0].type='999999',x=>x.energy.state='Paid',
  x=>x.flash.selection='bad',x=>x.flash.selection.steps='bad',x=>x.lastRoute={chosen:null,trace:'bad'}]){
  const clone=structuredClone(s.commerce);mutate(clone);assert.equal(validCommerce(clone,c),false);
 }
 assert.equal(input(s,c,'__proto__.polluted',true).ok,false);assert.equal({}.polluted,undefined);
 c.items.find(x=>x.type==='203').name='<img src=x onerror=alert(1)>';const html=renderCommerceSections(s,c,{media:{entries:[]}});
 assert.ok(!html.includes('<img src=x'));assert.match(html,/&lt;img src=x/);assert.match(html,/data-commerce-field/);assert.match(html,/실제 결제/);
});
