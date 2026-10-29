import test from 'node:test';
import assert from 'node:assert/strict';
import {bubbleChanceFor,planMergeBubble,bubbleQuote,bubbleSaleStatus,bubbleNoPurchaseRatio,validBubbleInstance} from '../src/bubble-model.mjs';

function config(){return {bubbleRules:{schemaVersion:1,functionEnabled:true,unlockLevel:4,defaultDurationSeconds:60,numericCodeOffset:3000000,
 items:[
  {type:'101',chancePercent:0,next:'102',chainId:'1',chainLevel:1,baseGemCost:40,saleGemCost:null},
  {type:'201',chancePercent:null,next:'202',chainId:'2',chainLevel:1,baseGemCost:0,saleGemCost:null},
  {type:'202',chancePercent:0,next:'203',chainId:'2',chainLevel:2,baseGemCost:1,saleGemCost:null},
  {type:'203',chancePercent:5,next:'204',chainId:'2',chainLevel:3,baseGemCost:2,saleGemCost:1},
  {type:'204',chancePercent:10,next:'205',chainId:'2',chainLevel:4,baseGemCost:4,saleGemCost:2},
  {type:'205',chancePercent:33,next:null,chainId:'2',chainLevel:5,baseGemCost:8,saleGemCost:5},
  {type:'custom_1',chancePercent:100,next:null,chainId:'custom',chainLevel:1,baseGemCost:10,saleGemCost:null}],
 boostVariants:{ExtraProduce:[{type:'203',chancePercent:0}],MoreLuckyProduce:[{type:'203',chancePercent:10}]},
 orderItemConfig:[{Code:'203',WeightMultiple:1},{Code:'204',WeightMultiple:1},{Code:'205',WeightMultiple:1}]
 }};}
function state(){return {wallet:{time:100,level:4},board:[{uid:1,type:'203',cover:null},null,null,null],bubbles:{},inventory:{items:[]},orders:{slots:[]}};}
function plan(s=state(),c=config(),extra={}){return planMergeBubble(s,c,{resultType:'203',targetType:'202',centerIndex:0,random:0,...extra});}
const sale={config:{id:'research-only',sLv:4,sTime:90,eTime:120,rTime:150},resourceReady:true};

test('packaged level gate, zero and absent probabilities do not consume RNG',()=>{
 const s=state(),c=config();let calls=0;const random=()=>{calls++;return 0;};
 s.wallet.level=3;assert.equal(plan(s,c,{random}).reason,'function-locked');
 s.wallet.level=4;assert.equal(plan(s,c,{resultType:'101',random}).reason,'no-base-chance');
 assert.equal(plan(s,c,{resultType:'201',random}).reason,'no-base-chance');assert.equal(calls,0);
 assert.equal(plan(s,c,{resultType:'missing'}).status,'unknown');
});
test('source integer roll is 1..100 inclusive with exact threshold boundary',()=>{
 const c=config(),s=state();assert.equal(plan(s,c,{random:0.049999999}).status,'spawn');
 assert.equal(plan(s,c,{random:0.05}).status,'none');assert.equal(plan(s,c,{random:0.05}).roll,6);
 const guaranteed=plan(s,c,{resultType:'custom_1',random:0.999999});assert.equal(guaranteed.status,'spawn');assert.equal(guaranteed.roll,100);
});
test('successful plan has numeric/string wrapper codes, real default duration and immutable state',()=>{
 const s=state(),c=config(),before=structuredClone(s),p=plan(s,c);assert.equal(p.spawn.type,'3000203');
 assert.equal(p.spawn.innerType,'203');assert.equal(p.spawn.expiresAt,160);assert.equal(p.spawn.price,2);
 assert.equal(p.spawn.kind,'natural');assert.equal(p.spawn.source.mode,'apk-default');assert.deepEqual(s,before);
 assert.equal(plan(s,c,{resultType:'custom_1'}).spawn.type,'b#custom_1');
});
test('priority, full-board and same-inner-type bubble suppress all rolls',()=>{
 const s=state();assert.equal(plan(s,config(),{earlierSpawn:'card-item'}).reason,'earlier-spawn');
 assert.equal(plan(s,config(),{earlierSpawn:null}).status,'unknown');
 s.board=s.board.map((cell,i)=>cell||{uid:i+1,type:'101',cover:null});assert.equal(plan(s).reason,'board-full');
 s.board[3]=null;s.bubbles[1]={innerType:'203'};assert.equal(plan(s).reason,'same-type-bubble');
 // A different type in a bubble is allowed; its inner type does not count as stock.
 s.bubbles[1]={innerType:'204'};assert.equal(plan(s).status,'spawn');
});
test('no supplied RNG or invalid RNG returns typed unknown without inventing a rate',()=>{
 for(const random of [undefined,-0.01,1,NaN,Infinity,()=>{throw new Error('rng');}])assert.equal(plan(state(),config(),{random}).status,'unknown');
});
test('order bonus 1 targets a missing NEXT type, current type must WeightMultiple=1',()=>{
 const s=state();s.orders.slots=[{requirements:[{type:'204',count:1}]}];
 const p=plan(s,config(),{random:0.99,overrides:{bubbleOrderBonus:1}});assert.equal(p.status,'spawn');assert.equal(p.chancePercent,100);
 s.inventory.items.push({uid:2,type:'204',cover:null});assert.equal(plan(s,config(),{random:0.99,overrides:{bubbleOrderBonus:1}}).status,'none');
});
test('order bonus 2 requires fewer than two plain copies, excludes queue and wrappers',()=>{
 const s=state();s.orders.slots=[{requirements:['204']}];s.queue=[{type:'204'}];
 s.inventory.items=[{uid:3,type:'203',cover:null}];assert.equal(bubbleChanceFor(s,config(),{resultType:'203',overrides:{bubbleOrderBonus:2}}).chancePercent,5);
 s.inventory.items[0].cover='locked';assert.equal(bubbleChanceFor(s,config(),{resultType:'203',overrides:{bubbleOrderBonus:2}}).chancePercent,100);
});
test('order decrease applies only when all weighted demand in same chain is covered',()=>{
 const s=state(),opts={resultType:'203',overrides:{bubbleOrderDecrease:0.5}};
 assert.equal(bubbleChanceFor(s,config(),opts).chancePercent,2.5); // vacuous sufficient demand is source behavior.
 s.orders.slots=[{requirements:[{type:'204',count:2}]}];s.inventory.items=[{uid:2,type:'204',cover:null}];
 assert.equal(bubbleChanceFor(s,config(),opts).chancePercent,5);
 s.inventory.items.push({uid:3,type:'204',cover:null});assert.equal(bubbleChanceFor(s,config(),opts).chancePercent,2.5);
});
test('chain decrease compounds per bubble above the configured chain index; floor is 1%',()=>{
 const s=state();s.board.push({uid:6,type:'204',cover:'bubble'},{uid:7,type:'205',cover:'bubble'});
 s.bubbles[6]={innerType:'204'};s.bubbles[7]={innerType:'205'};
 const p=bubbleChanceFor(s,config(),{resultType:'203',overrides:{bubbleChainDecreaseLevel:3,bubbleChainDecreaseRatio:0.5}});
 assert.equal(p.chancePercent,1.25);assert.equal(p.trace.find(t=>t.id==='chain-decrease').count,2);
 const floor=bubbleChanceFor(s,config(),{resultType:'203',overrides:{bubbleChainDecreaseLevel:3,bubbleChainDecreaseRatio:0.1}});assert.equal(floor.chancePercent,1);
});
test('explicit count maps can supply exact host GetCode counts and cached lack counts',()=>{
 const s=state();const r=bubbleChanceFor(s,config(),{resultType:'203',overrides:{bubbleOrderBonus:1,stockCounts:{},orderLackCounts:{'204':1}}});assert.equal(r.chancePercent,100);
 assert.equal(bubbleChanceFor(s,config(),{resultType:'203',overrides:{stockCounts:{'203':-1}}}).status,'unknown');
});
test('no-purchase day threshold is strict, percentage precision /100 and empty/disabled is identity',()=>{
 const rows=[{no_purchase_days:0,decrease_ratio:80},{no_purchase_days:3,decrease_ratio:40},{no_purchase_days:7,decrease_ratio:10}];
 assert.equal(bubbleNoPurchaseRatio({enabled:true,noPurchaseLoginDays:3,rows}).ratio,0.8);
 assert.equal(bubbleNoPurchaseRatio({enabled:true,noPurchaseLoginDays:4,rows}).ratio,0.4);
 assert.equal(bubbleNoPurchaseRatio({enabled:true,noPurchaseLoginDays:0,rows}).ratio,1);
 assert.equal(bubbleNoPurchaseRatio({enabled:false}).ratio,1);
 assert.equal(bubbleNoPurchaseRatio({enabled:true,noPurchaseLoginDays:10,rows:[]}).ratio,1);
 assert.equal(bubbleNoPurchaseRatio({enabled:true}).status,'unknown');
});
test('purchase decrease composes after other decreases, but order guarantee bypasses it',()=>{
 const s=state(),overrides={bubbleOrderDecrease:0.5,bubbleDecrease:{enabled:true,noPurchaseLoginDays:2,rows:[{no_purchase_days:0,decrease_ratio:50}]}};
 assert.equal(bubbleChanceFor(s,config(),{resultType:'203',overrides}).chancePercent,1.25);
 s.orders.slots=[{requirements:['204']}];assert.equal(bubbleChanceFor(s,config(),{resultType:'203',overrides:{...overrides,bubbleOrderBonus:1}}).chancePercent,100);
});
test('explicit unresolved server inputs return typed unknown; absent values use original fallbacks',()=>{
 for(const overrides of [{bubbleOrderBonus:null},{bubbleOrderDecrease:null},{bubbleChainDecreaseLevel:null},{bubbleChainDecreaseRatio:null},{bubbleDecrease:null},{generatorBoost:null},{generatorBoost:'ExtraLuckyProduce'}]){
  const p=bubbleChanceFor(state(),config(),{resultType:'203',overrides});assert.equal(p.status,'unknown');assert.ok(p.unknowns.length);
 }
 assert.equal(bubbleChanceFor(state(),config(),{resultType:'203'}).chancePercent,5);
});
test('ordinary merge clears last broken type, so purchase bonus does not become invented 100%',()=>{
 const s=state();s.lastBreakBubbleType='202';const p=bubbleChanceFor(s,config(),{resultType:'203',targetType:'202',overrides:{bubbleBuyBonus:true}});
 assert.equal(p.chancePercent,5);assert.ok(p.trace.find(t=>t.id==='buy-bonus-reset'));
});
test('packaged generator boost variant replaces config chance, never arbitrary extra multiplier',()=>{
 assert.equal(plan(state(),config(),{overrides:{generatorBoost:'ExtraProduce'}}).reason,'no-base-chance');
 assert.equal(plan(state(),config(),{overrides:{generatorBoost:'MoreLuckyProduce'},random:0.09}).status,'spawn');
});
test('sale state uses explicit level, resource and exact start/end/release boundaries',()=>{
 const s=state();for(const [time,expected]of [[89,'Preparing'],[90,'Started'],[119,'Started'],[120,'Ended'],[150,'Released']]){s.wallet.time=time;assert.equal(bubbleSaleStatus(s,sale).state,expected);}
 s.wallet.time=100;s.wallet.level=3;assert.equal(bubbleSaleStatus(s,sale).state,'Released');
 s.wallet.level=4;assert.equal(bubbleSaleStatus(s,{...sale,resourceReady:false}).active,false);
 assert.equal(bubbleSaleStatus(s,undefined).active,false);assert.equal(bubbleSaleStatus(s,{}).status,'unknown');
});
test('tutorial zero overrides sale; sale discount requires actual lower config price and active input',()=>{
 const s=state(),c=config();assert.equal(bubbleQuote(s,c,'203').price,2);
 assert.equal(bubbleQuote(s,c,'203',{bubbleSale:sale}).price,1);
 assert.equal(bubbleQuote(s,c,'203',{bubbleSale:sale,tutorialCost:0}).price,0);
 s.wallet.time=120;assert.equal(bubbleQuote(s,c,'203',{bubbleSale:sale}).price,2);
 c.bubbleRules.items[2].saleGemCost=5;assert.equal(bubbleQuote(s,c,'202',{bubbleSale:null}).price,1);
 assert.equal(bubbleQuote(s,c,'203',{bubbleSale:null}).status,'unknown');
});
test('duration fallback uses 60 for nonpositive zero, positive explicit custom value is retained',()=>{
 assert.equal(plan(state(),config(),{overrides:{durationSeconds:0}}).spawn.expiresAt,160);
 assert.equal(plan(state(),config(),{overrides:{durationSeconds:75}}).spawn.expiresAt,175);
 assert.equal(plan(state(),config(),{overrides:{durationSeconds:null}}).status,'unknown');
});
test('natural metadata validates creation quote and rejects manipulated costs, duration, type or source',()=>{
 const c=config(),p=plan(state(),c).spawn;assert.equal(validBubbleInstance(p,c,100),true);assert.equal(validBubbleInstance(p,c,200),true);
 for(const edit of [b=>b.price=0,b=>b.expiresAt++,b=>b.durationSeconds=999,b=>b.basePrice=100,b=>b.innerType='204',b=>b.source.createdAt=101,b=>b.source.type='204',b=>b.source.inputs.unverified=true,b=>b.source.mode='explicit-input',b=>b.kind='research',b=>b.source.level=3]){
  const b=structuredClone(p);edit(b);assert.equal(validBubbleInstance(b,c,100),false);
 }
 assert.equal(validBubbleInstance({innerType:'203',price:2,expiresAt:160},c,100),false);
});
test('explicit tutorial/duration/sale inputs remain verifiable, including sale minimum level >4',()=>{
 const s=state(),c=config();s.wallet.level=20;
 for(const overrides of [{tutorialCost:0},{durationSeconds:75},{bubbleSale:{...sale,config:{...sale.config,sLv:20}}},{bubbleSale:sale,tutorialCost:0,durationSeconds:90}]){
  const b=plan(s,c,{overrides}).spawn;assert.equal(validBubbleInstance(b,c,100),true);assert.equal(b.source.mode,'explicit-input');
 }
 const b=plan(s,c).spawn;b.source.mode='explicit-input';b.source.inputs.bubbleSale={config:null,resourceReady:true,arbitrary:'x'};assert.equal(validBubbleInstance(b,c,100),false);
});
