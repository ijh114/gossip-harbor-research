import {createState,advanceTime,buyEnergy,energyCost,traceOffers} from './engine.mjs';
import {reconcileOrders,submitOrder,orderStatus,validOrderState} from './order-model.mjs';
import {createInventory,storeItem,withdrawItem,buyInventorySlot,validInventory} from './inventory-model.mjs';
import {reconcileOnboarding,onboardingEvent,onboardingConstraints,onboardingAllows,validOnboardingState} from './onboarding-model.mjs';
import {spreadFor,createSpreadState,migrateSpreadState,refreshSpread,spreadItem,autoSpread,openSpreadItem,speedUpSpread,getChoices,chooseItem,validSpreadState,validSpreadPools,describeRewardWrapper,collectRewardWrapper} from './spread-model.mjs';
import {resolveSmartReward,resolveAlbumPackAllocation} from './smart-reward-model.mjs';
import {reconcileCommerce,dispatchCommerce,recordCommerceEvent,validCommerce} from './commerce-model.mjs';
import {createProductionModifierPlan,productionConfigFor,validProductionModifiers,discoActivationEffects,noCooldownActivationEffects} from './production-modifiers.mjs';
import {planMergeBubble,bubbleQuote,validBubbleInstance} from './bubble-model.mjs';

// Pure configuration-based research model. No DOM, network, SDK or real payment.
const integer=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
export const itemFor=(config,type)=>config.items.find(x=>x.type===String(type));
const generatorFor=(config,cell)=>cell&&itemFor(config,cell.type)?.generator;
const bubbleFor=(s,cell)=>cell&&s.bubbles?.[cell.uid];
const specialFor=(config,type)=>['rainbow','scissors'].find(kind=>config.specialRules?.specialTools?.[kind]?.type===type);
const usesFor=(config,cell)=>cell.uses??config.specialRules?.specialTools?.scissors?.defaultUses??1;
const currentTutorial=(s,config)=>s.tutorialStep===undefined?null:config.tutorialSteps?.[s.tutorialStep];
const tutorialAllows=(step,kind,from,to)=>!step||(step.kind===kind&&(kind==='generate'?step.index===from:step.from===from&&step.to===to));
const event=(s,ok,message,cells=[])=>{s.message=message;s.lastAction={ok,cells};s.log.unshift({time:s.wallet.time,message,ok});s.log=s.log.slice(0,60);return {ok,message};};
const guideContext=s=>({eventLocked:Boolean(s.toolPending),paperBoxExtraRewardAnimationPlaying:false});
function makeCell(s,config,type,cover=null){
 const wrapper=describeRewardWrapper(String(type),config);
 const cell={uid:s.nextUid++,type:wrapper?.type||String(type),cover,...(wrapper?{rewardType:wrapper.rewardType,rewardCount:wrapper.rewardCount}:{})};
 if(specialFor(config,cell.type)==='scissors')cell.uses=usesFor(config,cell);
 const g=generatorFor(config,cell);
 if(g&&!cover)s.generatorState[cell.uid]=spreadFor(config,cell.type)?createSpreadState(cell.type,productionConfigFor(config,s.modifierInputs),s.wallet.time):{charges:g.batch,storage:g.storage,timerStart:null,readyAt:0};
 return cell;
}
export function createPlay(config,{scenario='open',seed=42,guide=false}={}){
 const s={schema:1,stage:'title',scenario,board:Array(63).fill(null),wallet:createState({board:[],level:1,coins:0,gems:200,energy:100}),
  selected:null,nextUid:1,generatorState:{},pools:{},rng:seed>>>0||42,orderIndex:0,questsDone:0,xp:0,queue:[],
  pendingQuest:null,modal:null,offer:null,toolPending:null,bubbles:{},chainActive:false,chainStep:0,chainRewards:[],
  bm:{triggerPrice:20,bundle:true,noPay:false,invite:false,plenty:false,chain:false,weekly:false,popType:1},
  message:'내장 기본값을 읽은 연구 실험입니다. 시작한 뒤 생성기를 선택하세요.',log:[],lastAction:{ok:true,cells:[]}};
 if(guide&&scenario==='initial')s.tutorialStep=0;
 if(scenario==='initial')s.board=config.initialBoard.map(c=>makeCell(s,config,c.type,c.cover));
 else {s.board[0]=makeCell(s,config,'106');s.board[1]=makeCell(s,config,'406');}
 return reconcilePlay(s,config);
}
// Migration adds only empty storage and pending orders. Currency, cells and
// completed serial orders are never reset or awarded again.
export function reconcilePlay(s,config){
 migratePlayState(s,config);
 if(config.inventoryRules&&!s.inventory)s.inventory=createInventory(config);
 if(config.orderRules)reconcileOrders(s,config);
 if(config.commerceRules)reconcileCommerce(s,config);
 if(config.onboardingRules&&s.tutorialStep!==undefined&&!s.guidanceSkipped){
  if(!s.onboarding&&s.stage==='play')onboardingEvent(s,{type:'board-entered'},config,guideContext(s));
  reconcileOnboarding(s,config,guideContext(s));
 }
 return s;
}
export function migratePlayState(s,config){
 if(!config.spreadRules)return s;
 for(const cell of [...s.board,...(s.inventory?.items||[])])if(cell){
  if(cell.cover||bubbleFor(s,cell)){delete s.generatorState[cell.uid];continue;}
  if(spreadFor(config,cell.type)){
   const existing=s.generatorState[cell.uid];
   if(!existing)s.generatorState[cell.uid]=createSpreadState(cell.type,config,s.wallet.time);
   else if(existing.phase===undefined||!existing.ruleSnapshot)Object.assign(existing,migrateSpreadState(cell.type,existing,config,s.wallet.time));
  }
 }
 return s;
}
const spreadContext=(s,c)=>({orders:s.orders?.slots||[],boostRatio:s.boostRatio||0,
 ...(s.tutorialStep!==undefined&&!s.guidanceSkipped&&onboardingConstraints(s,c).forcedSpreadType?{forceCode:onboardingConstraints(s,c).forcedSpreadType}:{})});
const spreadHooks=(s,c)=>({makeCell:type=>makeCell(s,c,type),removeCell:index=>removeCell(s,index),findSlot:index=>spreadSlot(s,index),
 resolveSmart:snapshot=>resolveSmartReward(snapshot,c,{random:snapshot.random}),allocatePack:payload=>allocatePack(s,payload,c)});
function skipCooldownUid(s,uid,c){
 const index=s.board.findIndex(cell=>cell?.uid===uid);if(index>=0)return speedUpSpread(s,index,c,{free:true});
 const stored=s.inventory?.items.find(cell=>cell.uid===uid);if(!stored)return {ok:false};
 // Adapt the model reference only; no item is moved into the actual board.
 return speedUpSpread({...s,board:[stored,...Array(62).fill(null)]},0,c,{free:true});
}
function produce(s,index,c,automatic=false){
 const cell=s.board[index],inputs={...(s.modifierInputs||{}),generatorType:cell?.type,generatorUid:cell?.uid},plan=createProductionModifierPlan(s,c,inputs);
 if(!plan.ok)return plan;
 const context={...spreadContext(s,c),...plan.context,...(inputs.boostCostSequence?{boostCostSequence:inputs.boostCostSequence}:{}),...(inputs.energyInfinite===undefined?{}:{energyInfinite:inputs.energyInfinite})};
 const result=(automatic?autoSpread:spreadItem)(s,index,productionConfigFor(c,inputs),{...spreadHooks(s,c),...plan.hooks},context);
 if(result.ok){const committed=plan.finalize(result);s.productionModifiers=committed.state;
  if(committed.effects.skipSourceCooldown)skipCooldownUid(s,cell.uid,c);
 }
 return result;
}
function allocatePack(s,payload,c){
 const allocation=resolveAlbumPackAllocation(payload.type,payload.count,s.packInputs||{albumPresent:false});
 if(!allocation.ok)return {ok:false,message:'앨범/카드팩 설정 입력이 부족합니다. 보상을 소비하지 않았습니다.'};
 if(allocation.kind==='cache-item'){
  if(!itemFor(c,allocation.reward.type)||s.queue.length>=1000)return {ok:false,message:'대체 아이템을 대기열에 넣을 수 없습니다.'};
  reward(s,allocation.reward);return {ok:true,kind:allocation.kind,message:`앨범 대체 보상 ${allocation.reward.type} ×${allocation.reward.count}을 대기열로 받았습니다.`};
 }
 if(allocation.kind==='property-pack'){
  if((s.packLedger?.length||0)>=1000)return {ok:false,message:'카드팩 기록 범위에 도달했습니다.'};
  (s.packLedger??=[]).push(allocation.allocation);
 }
 return {ok:true,kind:allocation.kind,message:allocation.kind==='property-pack'?'카드팩 획득 수량을 기록했습니다. 카드 내용은 서버 설정 미확인으로 개봉하지 않습니다.':'비활성 앨범의 원본 무지급 분기를 적용했습니다.'};
}
function commerceHooks(s,c){
 const guide=s.tutorialStep!==undefined&&!s.guidanceSkipped?onboardingConstraints(s,c):{},cell=s.board[s.selected];
 return {generationCost:(generatorFor(c,cell)?.cost||1)*2**(s.boostRatio||0),strongTutorial:Boolean(guide.input||guide.waitSeconds!==undefined),popupForLackingEnergy:Boolean(s.energyFromLack),
  reward:r=>{
   if(!r||!integer(r.count,100000)||r.count===0)return false;
   if(!['gold','gem','energy','main_energy'].includes(r.type)&&(!itemFor(c,r.type)||s.queue.length>=1000))return false;
   reward(s,r);return true;
  }};
}
function rng(s){let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function bubbleInputs(s,c){
 const input={...(s.modifierInputs?.bubble||{})},view=productionConfigFor(c,s.modifierInputs);
 if(c.bubbleRules?.boostVariants?.[view.productionView?.itemMode])input.generatorBoost=view.productionView.itemMode;
 return input;
}
export function currentBubbleQuote(s,c,b){
 if(b?.kind!=='natural')return {status:'known',price:b?.price,expiresAt:b?.expiresAt,durationSeconds:c.specialRules?.bubble.defaultDurationSeconds};
 const guide=s.tutorialStep!==undefined&&!s.guidanceSkipped?onboardingConstraints(s,c):{},inputs=bubbleInputs(s,c);
 if(guide.forcedBubbleCost!==undefined)inputs.tutorialCost=guide.forcedBubbleCost;
 const quote=bubbleQuote(s,c,b.innerType,inputs);
 return {...quote,...(quote.status==='known'?{expiresAt:b.source.createdAt+quote.durationSeconds}:{})};
}
function fixedDraw(s,type,g){
 let remaining=s.pools[type];
 if(!remaining||remaining.reduce((a,b)=>a+b,0)===0)remaining=s.pools[type]=g.pool.map(x=>x.weight);
 let position=Math.floor(rng(s)*remaining.reduce((a,b)=>a+b,0));
 for(let i=0;i<remaining.length;i++){if(position<remaining[i]){remaining[i]--;return g.pool[i].type;}position-=remaining[i];}
 throw new Error('Invalid fixed pool');
}
function refreshGenerator(s,cell,config){
 if(bubbleFor(s,cell))return;
 if(spreadFor(config,cell?.type)){const index=s.board.indexOf(cell);if(index>=0)refreshSpread(s,index,config);return;}
 const g=generatorFor(config,cell),r=g&&s.generatorState[cell.uid];if(!g||!r||bubbleFor(s,cell))return;
 for(let guard=0;r.timerStart!==null&&guard<3;guard++){
  const duration=r.storage===0?g.storageRecoverySeconds:g.cooldownSeconds;
  r.readyAt=r.timerStart+duration;
  if(s.wallet.time<r.readyAt)return;
  if(r.storage===0){r.charges=g.batch;r.storage=g.storage;r.timerStart=null;r.readyAt=0;}
  else {const recovered=g.batch-r.charges;r.charges=g.batch;r.storage=Math.max(0,r.storage-recovered);
   if(r.storage===0)r.timerStart+=g.cooldownSeconds;else {r.timerStart=null;r.readyAt=0;}}
 }
}
export function advancePlay(s,seconds,config,{silent=false}={}){
 if(!integer(seconds,7*86400))return event(s,false,'경과 시간은0초부터7일까지 입력하세요.');
 const result=advanceTime(s.wallet,seconds);
 // Natural bubbles use packaged probabilities; explicit activity snapshots may
 // change their current quote. Staged research bubbles retain legacy metadata.
 for(const [uid,b]of Object.entries(s.bubbles||{}))if(s.board[s.selected]?.uid!==Number(uid)&&s.wallet.time>=(currentBubbleQuote(s,config,b).expiresAt??b.expiresAt)){
  const index=s.board.findIndex(c=>c?.uid===Number(uid));
  if(index>=0){replaceCell(s,index,config.specialRules?.mergeBonus?.type||'2401',config);
   if(s.tutorialStep!==undefined&&!s.guidanceSkipped)onboardingEvent(s,{type:'bubble-expired',uid:Number(uid),index},config);}
  else delete s.bubbles[uid];
 }
 for(const cell of s.board)if(cell){const before=s.generatorState[cell.uid]?.phase;refreshGenerator(s,cell,config);
  if(before==='opening'&&s.generatorState[cell.uid]?.phase==='opened'&&s.tutorialStep!==undefined&&!s.guidanceSkipped)
   onboardingEvent(s,{type:'item-opened',uid:cell.uid},config);
 }
 if(config.spreadRules){let guard=0;for(let index=0;index<63;index++)if(spreadFor(config,s.board[index]?.type)?.auto){
  while(guard++<63&&produce(s,index,config,true).ok){}
 }}
 reconcilePlay(s,config);
 return silent?result:event(s,result.ok,result.message+' · 생성기 회복 반영');
}
function eligibleTrace(s,config,closedWithoutPurchase=true){
 if(config.commerceRules){
  const result=dispatchCommerce(s,config,'commerce-trigger',closedWithoutPurchase?'close':'lack',commerceHooks(s,config)),route=result.route;
  return {chosen:route?.chosen||null,earlyBundle:!closedWithoutPurchase&&route?.chosen==='EnergyBundle',
   steps:(route?.trace||[]).map((r,i)=>({id:'commerce-'+i,label:r.label,ok:r.ok,reason:r.why}))};
 }
 const cell=s.selected===null?null:s.board[s.selected],cost=generatorFor(config,cell)?.cost||1;
 return traceOffers({...s.bm,level:s.wallet.level,energy:s.wallet.energy,price:s.wallet.price,
  freeAvailable:s.wallet.freeUsed<s.wallet.freeTotal,generationCost:cost,closedWithoutPurchase});
}
export function generateFrom(s,index,config){
 if(!integer(index,62))return event(s,false,'생성기를 먼저 선택하세요.');
 if(s.toolPending)return event(s,false,'도구 사용을 확인하거나 취소하세요.');
 const tutorial=currentTutorial(s,config);
 if(!tutorialAllows(tutorial,'generate',index))return event(s,false,'튜토리얼에서 안내한 생성기를 사용하세요.');
 const cell=s.board[index],g=generatorFor(config,cell);
 if(!g)return event(s,false,'선택한 타입은 이번 실험의 생성기 범위가 아닙니다.');
 if(cell.cover||bubbleFor(s,cell))return event(s,false,'덮개·거미줄·버블을 먼저 해제하세요.');
 refreshGenerator(s,cell,config);
 if(spreadFor(config,cell.type)){
  const result=produce(s,index,config);
  if(!result.ok&&result.reason==='energy'){s.energyFromLack=true;const early=eligibleTrace(s,config,false);s.offer=early;s.modal=early.earlyBundle||early.chosen==='ChainEnergy'?'offer':'energy';}
  if(result.ok&&tutorial)s.tutorialStep++;
  return {...result,...event(s,result.ok,result.message,result.cells||[]),...(result.ok?{generatedType:result.type,sourceIndex:index}:{})};
 }
 const r=s.generatorState[cell.uid];
 if(r.charges===0)return event(s,false,`충전 대기 · ${Math.max(0,r.readyAt-s.wallet.time)}초 뒤 회복`);
 const slot=spreadSlot(s,index);if(slot<0)return event(s,false,'보드가 가득 찼습니다. 합성·주문·판매로 공간을 확보하세요.');
 if(s.wallet.energy<g.cost){s.energyFromLack=true;const early=eligibleTrace(s,config,false);s.offer=early;s.modal=early.earlyBundle?'offer':'energy';return event(s,false,'에너지 부족 · 현재 재화로 충전/오퍼 조건을 평가합니다.');}
 const forced=s.tutorialStep!==undefined&&!s.guidanceSkipped?onboardingConstraints(s,config).forcedSpreadType:null;
 const type=forced&&itemFor(config,forced)?forced:fixedDraw(s,cell.type,g);
 s.wallet.energy-=g.cost;s.wallet.generated++;r.charges--;
 if(r.timerStart===null)r.timerStart=s.wallet.time;
 r.readyAt=r.timerStart+(r.storage===0?g.storageRecoverySeconds:g.cooldownSeconds);
 s.board[slot]=makeCell(s,config,type);
 if(tutorial)s.tutorialStep++;
 return event(s,true,`${itemFor(config,type)?.name||type} 생성 · 에너지 −${g.cost}`, [slot]);
}
// BaseItemLayerModel: ring starts one up/left, then right/down/left/up.
// Visit after each step; the initial corner is visited at the end of the ring.
function spreadSlot(s,center){
 let x=center%7,y=Math.floor(center/7);
 for(let ring=1;ring<9;ring++){
  x--;y--;
  for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]])for(let step=0;step<2*ring;step++){
   x+=dx;y+=dy;
   if(x>=0&&x<7&&y>=0&&y<9&&s.board[y*7+x]===null)return y*7+x;
  }
 }
 return -1;
}
function removeCell(s,index){
 const cell=s.board[index];if(!cell)return;
 delete s.generatorState[cell.uid];if(s.bubbles)delete s.bubbles[cell.uid];s.board[index]=null;
 if(s.selected===index)s.selected=null;
}
function replaceCell(s,index,type,config){
 const selected=s.selected===index;removeCell(s,index);s.board[index]=makeCell(s,config,type);
 if(selected)s.selected=index;
 return s.board[index];
}
function shockNeighbors(s,index){
 const x=index%7,y=Math.floor(index/7),changed=[];
 for(const n of [x>0?index-1:-1,x<6?index+1:-1,y>0?index-7:-1,y<8?index+7:-1])
  if(n>=0&&s.board[n]?.cover==='box'){s.board[n].cover='web';changed.push(n);}
 return changed;
}
function toolPlan(s,from,to,config){
 const a=s.board[from],b=s.board[to],kind=a&&specialFor(config,a.type);
 if(!kind||!b||a.cover||b.cover||bubbleFor(s,a)||bubbleFor(s,b))return null;
 if(kind==='scissors'&&specialFor(config,b.type)==='scissors')return {kind:'combine'};
 const targets=config.specialRules.specialTools.targetProjection;
 if(!targets?.[kind==='rainbow'?'levelUpTypes':'levelDownTypes']?.includes(b.type))return null;
 if(kind==='scissors'&&!s.board.includes(null))return null;
 const result=kind==='rainbow'?itemFor(config,b.type)?.next:
  config.items.find(x=>x.next===b.type&&(itemFor(config,b.type)?.chainLevel===undefined||x.chainLevel===itemFor(config,b.type).chainLevel-1))?.type;
 return {kind,result};
}
function confirmTool(s,config){
 const pending=s.toolPending;if(!pending)return event(s,false,'확인할 도구 사용이 없습니다.');
 const from=s.board.findIndex(c=>c?.uid===pending.fromUid),to=s.board.findIndex(c=>c?.uid===pending.targetUid);
 const plan=from>=0&&to>=0?toolPlan(s,from,to,config):null;s.toolPending=null;
 if(!plan||plan.kind!==pending.kind||!itemFor(config,plan.result))return event(s,false,'대상·빈칸 조건이 달라져 도구를 소비하지 않았습니다.');
 const tool=s.board[from],target=s.board[to];
 if(plan.kind==='rainbow'){
  removeCell(s,from);replaceCell(s,to,plan.result,config);
  return event(s,true,`무지개 사용 · ${target.type} → ${plan.result}`,[from,to,...shockNeighbors(s,to)]);
 }
 const uses=usesFor(config,tool);if(uses===1)removeCell(s,from);else tool.uses=uses-1;
 replaceCell(s,to,plan.result,config);const other=spreadSlot(s,to);s.board[other]=makeCell(s,config,plan.result);
 return event(s,true,`가위 사용 · ${target.type} → ${plan.result} 두 개 · 잔여 ${uses-1}회`,[from,to,other]);
}
function collectableFor(config,type){
 const c=config.specialRules?.collectibles?.find(r=>r.type===type);
 if(c&&['gold','gem','energy'].includes(c.reward?.type)&&integer(c.reward.amount)&&c.reward.amount>0)return c.reward;
 const skip=config.specialRules?.timeSkip?.items?.find(r=>r.type===type);
 return skip&&integer(skip.seconds)&&skip.seconds>0?{type:'skip',amount:skip.seconds}:null;
}
function collectFrom(s,index,config){
 const cell=integer(index,62)?s.board[index]:null,r=cell&&collectableFor(config,cell.type);
 if(!cell||cell.cover||bubbleFor(s,cell)||!r)return event(s,false,'수집 가능한 재화 조각이나 시간 건너뛰기 아이템을 선택하세요.');
 removeCell(s,index);
 if(r.type==='skip'){
  // OnTimeSkip changes active ItemSpread start times, not the world clock.
  // refreshGenerator follows the finite reservoir transitions; this never
  // grants one batch per elapsed cooldown or changes inactive generators.
  for(const c of s.board)if(c&&!bubbleFor(s,c)){
   const state=s.generatorState[c.uid];if(state?.timerStart!==null&&state?.timerStart!==undefined){state.timerStart-=r.amount;refreshGenerator(s,c,config);}
  }
 }else reward(s,{type:r.type,count:r.amount});
 return event(s,true,r.type==='skip'?`시간 건너뛰기 ${r.amount}초 · 진행 중인 생성기 타이머 반영`:`조각 수집 · ${r.type} +${r.amount}`,[index]);
}
export function moveOrMerge(s,from,to,config){
 if(!integer(from,62)||!integer(to,62)||from===to)return event(s,false,'서로 다른 두 칸을 선택하세요.');
 const a=s.board[from],b=s.board[to];if(!a)return event(s,false,'출발 칸이 비어 있습니다.');
 if(s.toolPending)return event(s,false,'도구 사용을 확인하거나 취소하세요.');
 if(bubbleFor(s,a)||bubbleFor(s,b))return event(s,false,'버블은 구매 또는 만료 후 사용할 수 있습니다.');
 if(a.cover)return event(s,false,'상자/거미줄 안의 아이템은 이동할 수 없습니다.');
 if(b?.cover==='box')return event(s,false,'상자는 인접 합성의 충격으로 먼저 벗겨야 합니다.');
 const next=itemFor(config,a.type)?.next;
 const tutorial=currentTutorial(s,config),merging=b&&a.type===b.type&&next;
 if(!tutorialAllows(tutorial,merging?'merge':'move',from,to))return event(s,false,'튜토리얼에서 안내한 두 칸을 합성하세요.');
 if(!b){s.board[to]=a;s.board[from]=null;return event(s,true,'아이템 이동',[from,to]);}
 const plan=toolPlan(s,from,to,config);
 if(plan?.kind==='combine'){
  const uses=usesFor(config,a)+usesFor(config,b);if(!integer(uses))return event(s,false,'가위 횟수의 연구 저장 범위를 초과합니다.');
  removeCell(s,from);const cell=replaceCell(s,to,b.type,config);cell.uses=uses;
  return event(s,true,`가위 횟수 합산 · ${uses}회`,[from,to]);
 }
 if(plan){
  if(!itemFor(config,plan.result))return event(s,false,'결과 타입이 지원되지 않아 도구를 소비하지 않습니다.');
  s.toolPending={kind:plan.kind,fromUid:a.uid,targetUid:b.uid};
  return event(s,true,`${plan.kind==='rainbow'?'무지개':'가위'} 사용 확인 · ${b.type} → ${plan.result}${plan.kind==='scissors'?' 두 개':''}`,[from,to]);
 }
 if(a.type===b.type&&next&&!itemFor(config,next)&&!describeRewardWrapper(next,config))return event(s,false,`결과 코드 ${next}의 보상/래퍼 근거가 없습니다.`);
 if(a.type===b.type&&next){
  removeCell(s,from);replaceCell(s,to,next,config);
  const changed=[from,to,...shockNeighbors(s,to)],bonus=config.specialRules?.mergeBonus;
  let bubbleMessage='';
  if(config.bubbleRules){
   const {earlierSpawn=false,...overrides}=bubbleInputs(s,config),plan=planMergeBubble(s,config,{resultType:s.board[to].type,targetType:b.type,centerIndex:to,earlierSpawn,overrides,random:()=>rng(s)});
   s.lastBubblePlan={status:plan.status,reason:plan.reason,chancePercent:plan.chancePercent,roll:plan.roll};
   if(plan.status==='spawn'){
    const slot=spreadSlot(s,to);if(slot>=0){
     const made=makeCell(s,config,plan.spawn.innerType);delete s.generatorState[made.uid];s.board[slot]=made;(s.bubbles??={})[made.uid]=plan.spawn;changed.push(slot);
     if(s.tutorialStep!==undefined&&!s.guidanceSkipped)onboardingEvent(s,{type:'bubble-spawned',index:slot,uid:made.uid,instant:false,synthetic:false},config,guideContext(s));
     bubbleMessage=' · 내장 기본 자연 버블 생성';
    }
   }else if(plan.status==='unknown')bubbleMessage=' · 버블 조건 입력 미확인';
  }
  // The recovered base merge emits Coin01 at RESULT chain level8+, never EXP.
  // Activity/card bonuses precede bubbles only when explicitly modeled; their
  // absent-server default does not suppress the independent merge coin.
  if(bonus&&itemFor(config,next)?.chainLevel>=bonus.minimumResultChainLevel&&itemFor(config,bonus.type)){
   const slot=spreadSlot(s,to);if(slot>=0){s.board[slot]=makeCell(s,config,bonus.type);changed.push(slot);}
  }
  if(tutorial)s.tutorialStep++;
  return event(s,true,`합성 ${a.type} + ${b.type} → ${next} · 인접 상자의 바깥 덮개 해제${bubbleMessage}`,changed);
 }
 if(b.cover)return event(s,false,'거미줄 아이템은 같은 타입의 합성 목표로만 사용할 수 있습니다.');
 s.board[from]=b;s.board[to]=a;return event(s,true,'서로 다른 아이템 위치 교환',[from,to]);
}
export function deliverFixedOrder(s,config){
 const order=config.orders[s.orderIndex];if(!order)return event(s,false,'처음16개 고정 주문 범위를 완료했습니다. 후속 랜덤 주문은 미구현입니다.');
 if(s.wallet.level<order.level)return event(s,false,`고정 주문 해금 Lv${order.level} 필요. 맵 퀘스트로 성장하세요.`);
 const slots=[];
 for(const req of order.requirements){
  const found=s.board.flatMap((cell,i)=>cell&&!cell.cover&&!bubbleFor(s,cell)&&cell.type===req.type?[i]:[]).slice(0,req.count);
  if(found.length<req.count)return event(s,false,`${itemFor(config,req.type)?.name||req.type} ${req.count}개가 필요합니다.`);
  slots.push(...found);
 }
 for(const i of slots){delete s.generatorState[s.board[i].uid];s.board[i]=null;}
 if(slots.includes(s.selected))s.selected=null;
 s.wallet.coins+=order.coins;s.wallet.orders++;s.orderIndex++;
 return event(s,true,`고정 주문 ${order.id} 완료 · 기본 골드 +${order.coins}`,slots);
}
function reward(s,r){
 if(r.type==='gem')s.wallet.gems+=r.count;
 else if(r.type==='gold')s.wallet.coins+=r.count;
 else if(r.type==='energy'||r.type==='main_energy')s.wallet.energy+=r.count;
 // ItemCacheModel: Type2 is ahead of Type1, and newer Type2 IDs sort first.
 // RewardApi keeps reward-array insertion order, so its final item becomes top.
 else s.queue.unshift({type:r.type,count:r.count,cacheType:2});
}
function grantExperience(s,amount,config){
 s.xp+=amount;
 for(let guard=0;guard<config.levels.length;guard++){
  if(s.wallet.level>=Math.max(...config.levels.map(r=>r.level)))break;
  const level=config.levels.find(r=>r.level===s.wallet.level);
  if(!level||s.xp<level.exp)break;
  s.xp-=level.exp;for(const r of level.rewards)reward(s,r);s.wallet.level++;
 }
}
export function finishQuest(s,config){
 const q=config.quests[s.questsDone];
 if(!q||!s.pendingQuest||s.pendingQuest.id!==q.id)return event(s,false,'먼저 현재 퀘스트의 연출 시작을 선택하세요.');
 if(s.wallet.coins<s.pendingQuest.cost)return event(s,false,'퀘스트 확정에 필요한 골드가 부족합니다.');
 s.wallet.coins-=s.pendingQuest.cost;s.pendingQuest=null;s.questsDone++;
 for(const r of q.rewards)reward(s,r);grantExperience(s,q.exp,config);
 return event(s,true,`${q.name} 확정 · 기본 골드 −${q.cost}, EXP +${q.exp}. 다음 퀘스트 해제`);
}
function applyPlayAction(s,action,value,config){
 const allowance=onboardingAllows(s,config,action,value);if(!allowance.allowed)return event(s,false,allowance.message);
 const guide=s.tutorialStep!==undefined&&!s.guidanceSkipped?onboardingConstraints(s,config):{},input=guide.input;
 if(action==='cell'&&input){const index=Number(value);
  if(input.kind==='merge'&&index===input.from||input.kind==='select'&&index===input.index||['generate','item-info','open','skip','buy-bubble','inventory-store'].includes(input.kind)&&index===input.index&&s.selected!==index)s.selected=null;
 }
 if(s.toolPending&&!['confirm-tool','cancel-tool','time','focus'].includes(action))return event(s,false,'도구 사용을 확인하거나 취소하세요.');
 if(action==='start'){s.stage='play';return event(s,true,'생성기를 선택하고 생성하세요. 클릭 두 번으로 이동·합성을 수행합니다.');}
 if(action==='focus'){s.focused=!s.focused;return event(s,true,s.focused?'보드 집중 모드 · 종료 버튼으로 연구 메뉴를 복원합니다.':'연구 화면 배치로 돌아왔습니다.');}
 if(action==='scenario')return event(s,false,'배치 변경은 새 실험을 만드는 동작입니다.');
 if(action==='time')return advancePlay(s,Number(value),config);
 if(action==='main'||action==='home'){s.stage=action==='home'?'home':'play';s.selected=null;return event(s,true,action==='home'?'맵 기본값 시나리오 · 연출 시작과 비용 확정을 구분합니다.':'보드로 돌아왔습니다.');}
 if(action==='aid-energy'){s.wallet.energy=0;return event(s,true,'연구 보조: 에너지를0으로 설정했습니다. 생성기를 눌러 부족 분기를 확인하세요.');}
 if(action==='aid-coins'){s.wallet.coins+=200;return event(s,true,'연구 보조: 골드200 지급. 원작 보상이 아닌 실험 입력입니다.');}
 if(action==='aid-gems'){s.wallet.gems+=200;return event(s,true,'연구 보조: 젬200 지급. 원작 보상이 아닌 실험 입력입니다.');}
 if(action==='aid-xp'){grantExperience(s,15,config);return event(s,true,'연구 보조: EXP15 지급. 선정 퀘스트 이후의 레벨 게이트를 비교하는 실험 입력입니다.');}
 if(action==='shop'){if(s.modal)return event(s,false,'열린 창을 먼저 닫으세요.');if(s.wallet.level<config.functionGates.shop)return event(s,false,`내장 상점 해금은 Lv${config.functionGates.shop}입니다.`);s.modal='shop';return event(s,true,'상점 실험 · 실제 결제는 연결하지 않습니다.');}
 if(action==='open-energy'){if(s.modal)return event(s,false,'열린 창을 먼저 닫으세요.');s.energyFromLack=false;s.modal='energy';s.offer=null;return event(s,true,'충전창 · 현재 에너지와 무료 잔여 여부를 사용합니다.');}
 if(action==='close-energy'){if(s.modal!=='energy')return event(s,false,'닫을 충전창이 없습니다.');s.offer=eligibleTrace(s,config);s.modal=s.offer.chosen?'offer':null;return event(s,true,s.offer.chosen?'충전창을 구매 없이 닫아 후속 후보를 선택했습니다.':'충전창 닫기 · 적격 후속 후보 없음');}
 if(action==='buy-energy'){if(s.modal!=='energy')return event(s,false,'충전창에서 구매하세요.');const r=buyEnergy(s.wallet);if(r.ok){s.modal=null;s.offer=null;s.energyFromLack=false;}return event(s,r.ok,r.message);}
 if(action==='close-offer'||action==='close-shop'){if(s.modal!==(action==='close-offer'?'offer':'shop'))return event(s,false,'해당 창이 열려 있지 않습니다.');s.modal=null;s.offer=null;s.energyFromLack=false;return event(s,true,'창을 닫았습니다. 실제 결제는 수행하지 않았습니다.');}
 if(action==='chain-start'){if(s.modal!=='shop')return event(s,false,'상점의 관측 체인 실험에서 준비하세요.');if(s.chainActive)return event(s,false,'이 실험에서 이미 준비한 체인입니다.');s.chainActive=true;return event(s,true,'과거 관측 체인의 단계 규칙을 현재 실험 재화에 적용합니다.');}
 if(action==='chain-claim'){
  if(s.modal!=='shop'||!s.chainActive)return event(s,false,'상점에서 먼저 관측 체인 시나리오를 준비하세요.');
  const step=config.chainSteps[s.chainStep];
  if(!step||step.kind==='waiting-unpurchased')return event(s,false,'80보석 단계 이후는 구매 미관측 범위이므로 실행하지 않습니다.');
  if(s.wallet.gems<(step.cost||0))return event(s,false,`젬 ${step.cost}개 필요`);
  s.wallet.gems-=step.cost||0;s.wallet.energy+=step.energy||0;
  if(step.kind==='free-pack')s.chainRewards.push({appearance:step.packAppearance,contents:'unknown'});
  s.chainStep++;return event(s,true,`관측 체인 ${s.chainStep}단계 수령 · ${step.cost?step.cost+'젬 소비':'무료'}${step.energy?' / 에너지 +'+step.energy:''}. 카드팩 내용은 미확인`);
 }
 if(action==='inventory'){
  if(s.modal)return event(s,false,'열린 창을 먼저 닫으세요.');
  if(s.stage!=='play')return event(s,false,'퍼즐 화면에서 보관함을 여세요.');
  if(s.wallet.level<config.inventoryRules.unlockLevel)return event(s,false,`보관함은 레벨${config.inventoryRules.unlockLevel}에서 열립니다.`);
  s.modal='inventory';return event(s,true,'보관함 · 보드의 선택 아이템을 넣거나 보관한 아이템을 꺼내세요.');
 }
 if(action==='guide-ack')return event(s,true,'진행 안내를 확인했습니다.');
 if(action==='order-item-info'){
  if(s.modal||s.stage!=='play')return event(s,false,'퍼즐 주문에서 아이템 정보를 여세요.');
  const match=typeof value==='string'&&/^(\d{1,2}),([A-Za-z0-9_]+)$/.exec(value),slot=match&&Number(match[1]),type=match?.[2];
  if(!itemFor(config,type)||!s.orders?.slots.find(q=>q.slot===slot)?.requirements.some(r=>r.type===type))return event(s,false,'현재 주문의 요구 아이템만 확인할 수 있습니다.');
  s.infoType=type;s.infoOrderSlot=slot;s.modal='item-info';return event(s,true,'주문 요구 아이템의 합성 정보를 열었습니다.');
 }
 if(action==='item-info'||action==='open-choice'){
  if(s.modal)return event(s,false,'열린 창을 먼저 닫으세요.');
  if(s.selected===null||!s.board[s.selected])return event(s,false,'먼저 보드 아이템을 선택하세요.');
  if(action==='open-choice'){const choices=getChoices(s,s.selected,config,spreadContext(s,config));if(!choices.ok)return event(s,false,choices.message);}
  if(action==='item-info'){s.infoType=s.board[s.selected].type;delete s.infoOrderSlot;}
  s.modal=action==='item-info'?'item-info':'choice';return event(s,true,action==='item-info'?'아이템 합성 정보를 열었습니다.':'선택 상자 후보를 확인하세요.');
 }
 if(action==='close-info'||action==='close-choice'){
  if(s.modal!==(action==='close-info'?'item-info':'choice'))return event(s,false,'해당 창이 열려 있지 않습니다.');
  s.modal=null;delete s.infoType;delete s.infoOrderSlot;return event(s,true,'아이템 창을 닫았습니다.');
 }
 if(action==='choose-item'){
  if(s.modal!=='choice')return event(s,false,'먼저 선택 상자를 여세요.');
  const result=chooseItem(s,s.selected,Number(value),config,spreadHooks(s,config),spreadContext(s,config));
  if(result.ok)s.modal=null;return event(s,result.ok,result.message,result.cells||[]);
 }
 if(action==='close-inventory'){
  if(s.modal!=='inventory')return event(s,false,'열린 보관함이 없습니다.');
  s.modal=null;return event(s,true,'보관함을 닫았습니다.');
 }
 if(['inventory-store','inventory-withdraw','inventory-buy'].includes(action)){
  const direct=action==='inventory-store'&&!s.modal&&s.stage==='play'&&s.wallet.level>=config.inventoryRules.unlockLevel;
  if(s.modal!=='inventory'&&!direct)return event(s,false,'먼저 보관함을 여세요.');
  const result=action==='inventory-buy'?buyInventorySlot(s,config):action==='inventory-store'?storeItem(s,value===undefined?s.selected:Number(value),config):withdrawItem(s,Number(value),config);
  return event(s,result.ok,result.message,result.cells||[]);
 }
 if(action.startsWith('commerce-')){
  if(s.modal!=='shop')return event(s,false,'상점 안에서 연구 조건을 조작하세요.');
  const result=dispatchCommerce(s,config,action,value,commerceHooks(s,config));
  return event(s,result.ok,result.message);
 }
 if(s.modal)return event(s,false,'열린 창을 먼저 닫으세요.');
 if(s.stage==='title')return event(s,false,'먼저 실험을 시작하세요.');
 if(['cell','generate','deliver','sell','queue','move','collect','confirm-tool','cancel-tool','aid-special','aid-bubble','buy-bubble','skip-tutorial','open-item','speedup-item','choose-item','collect-wrapper','set-boost'].includes(action)&&s.stage!=='play')return event(s,false,'퍼즐 화면에서 조작하세요.');
 if(action==='set-boost'){const ratio=Number(value);if(!integer(ratio,3))return event(s,false,'지원하는 부스트 지수는0–3입니다.');s.boostRatio=ratio;return event(s,true,`부스트 연구 입력 ×${2**ratio} · 서버 배율 선택과 별도입니다.`);}
 if(action==='set-modifiers'){
  let input;try{input=typeof value==='string'?JSON.parse(value):value;}catch{return event(s,false,'생성 보정 입력은 올바른 JSON이어야 합니다.');}
  if(!record(input)||JSON.stringify(input).length>50000)return event(s,false,'생성 보정 입력 형식·크기를 확인하세요.');
  const cell=s.board[s.selected],plan=createProductionModifierPlan(s,config,{...input,generatorType:cell?.type,generatorUid:cell?.uid});
  if(!plan.ok)return event(s,false,plan.message);
  const activate=input.disco?.active&&!s.modifierInputs?.disco?.active,cooldownUids=noCooldownActivationEffects(s,config,s.modifierInputs,input);s.modifierInputs=structuredClone(input);s.productionModifiers=plan.getState();
  for(const uid of cooldownUids)skipCooldownUid(s,uid,config);
  if(activate)for(const uid of discoActivationEffects(s,config))skipCooldownUid(s,uid,config);
  return event(s,true,'생성 보정 연구 스냅샷을 적용했습니다. 실제 계정의 활성 상태나 확률을 뜻하지 않습니다.');
 }
 if(action==='modifier-preset'){
  const presets={none:{},lucky:{lucky:{active:true}},smart:{smartProduce:{active:true}},fishnet:{fishNet:{active:true}},nocd:{buffNoCooldown:true},
   extra:{generatorBoost:{active:true,extraProduce:true,extraChance:[2,1]}},disco:{disco:{active:true,score:32,property:'research-disco',difficultyLevel:8}}};
  if(!Object.hasOwn(presets,value))return event(s,false,'정의된 연구 예제를 선택하세요.');
  return applyPlayAction(s,'set-modifiers',presets[value],config);
 }
 if(action==='set-pack-context'){
  if(!['absent','active'].includes(value))return event(s,false,'정의된 앨범 연구 입력을 선택하세요.');
  const active=value==='active';s.packInputs={albumPresent:active,albumOpen:active,royalOngoing:active,supportedPacks:active?['pack_common_5','pack_common_3','pack_laser_5','pack_royal_5']:[]};
  return event(s,true,active?'앨범과4종 팩 지원을 연구 가정으로 입력했습니다. 카드 추첨은 하지 않습니다.':'앨범 미연결의 원본 대체 보상 분기를 사용합니다.');
 }
 if(action==='open-item'||action==='speedup-item'){
  const index=value===undefined?s.selected:Number(value),guide=s.tutorialStep!==undefined&&!s.guidanceSkipped?onboardingConstraints(s,config):{};
  const result=action==='open-item'?openSpreadItem(s,index,config):speedUpSpread(s,index,config,{forcedCost:guide.forcedSkipCost});
  return event(s,result.ok,result.message,result.cells||[]);
 }
 if(action==='collect-wrapper'){const result=collectRewardWrapper(s,s.selected,config,spreadHooks(s,config));return event(s,result.ok,result.message,result.cells||[]);}
 if(['quest-start','quest-finish'].includes(action)&&s.stage!=='home')return event(s,false,'맵 화면에서 퀘스트를 진행하세요.');
 if(action==='confirm-tool')return confirmTool(s,config);
 if(action==='cancel-tool'){if(!s.toolPending)return event(s,false,'취소할 도구 사용이 없습니다.');s.toolPending=null;return event(s,true,'도구 사용 취소 · 아이템을 유지합니다.');}
 if(action==='skip-tutorial'){
  if(!Array.isArray(config.tutorialSteps))return event(s,false,'선언된 튜토리얼 단계가 없습니다.');
  s.tutorialStep=config.tutorialSteps.length;s.guidanceSkipped=true;delete s.onboarding;s.selected=null;return event(s,true,'연구 조작: 튜토리얼 안내를 건너뛰었습니다. 원작 진행 기록과 무관합니다.');
 }
 if(action==='collect')return collectFrom(s,value===null||value===undefined||value===''?s.selected:Number(value),config);
 if(action==='move'){
  if(typeof value!=='string'||!/^\d{1,2},\d{1,2}$/.test(value))return event(s,false,'출발 칸과 도착 칸을 지정하세요.');
  const [from,to]=value.split(',').map(Number),result=moveOrMerge(s,from,to,config);s.selected=null;return result;
 }
 if(action==='aid-special'||action==='aid-type'){
  const type=String(value),kind=specialFor(config,type);
  if(!itemFor(config,type)||action==='aid-special'&&!kind&&!collectableFor(config,type))return event(s,false,'규칙이 확인된 아이템 타입만 연구 배치할 수 있습니다.');
  const queued=s.queue[0]?.type===type&&s.queue[0]?.origin==='research-aid'?s.queue[0]:null;
  if(queued?queued.count>=100000:s.queue.length>=1000)return event(s,false,'연구 대기열의 저장 범위에 도달했습니다.');
  if(queued)queued.count++;else s.queue.unshift({type,count:1,cacheType:2,origin:'research-aid'});
  return event(s,true,`연구 보조: ${type} 한 개를 대기열 맨 앞에 추가했습니다. 원작 획득·보상 시점이 아닙니다.`);
 }
 if(action==='aid-bubble'){
  const type=String(value),bubble=config.specialRules?.bubble,price=bubble?.basePriceProjection?.find(r=>r.type===type)?.baseGemCost;
  if(!itemFor(config,type)||!integer(price)||!integer(bubble?.defaultDurationSeconds)||bubble.defaultDurationSeconds===0)return event(s,false,'기본 가격과 내부 타입이 확인된 버블만 연구 배치할 수 있습니다.');
  const slot=s.board.findIndex(c=>c===null);if(slot<0)return event(s,false,'버블 연구 배치에 빈칸이 필요합니다.');
  const cell=makeCell(s,config,type);delete s.generatorState[cell.uid];s.board[slot]=cell;
  s.bubbles??={};s.bubbles[cell.uid]={expiresAt:s.wallet.time+bubble.defaultDurationSeconds,price,innerType:type};
  return event(s,true,'연구 보조: 기본 가격·시간의 버블을 배치했습니다. 자연 생성 확률·세일·서버 상태는 적용하지 않습니다.',[slot]);
 }
 if(action==='buy-bubble'){
  const index=value===null||value===undefined||value===''?s.selected:Number(value),cell=integer(index,62)?s.board[index]:null,b=bubbleFor(s,cell);
  if(!b)return event(s,false,'구매할 연구 버블을 선택하세요.');
  const quote=currentBubbleQuote(s,config,b);if(quote.status!=='known')return event(s,false,'현재 버블 가격·기간의 명시 조건을 확인하세요.');
  if(s.wallet.time>=quote.expiresAt&&s.selected!==index)return event(s,false,'만료된 버블입니다. 시간 갱신 후 확인하세요.');
  const price=s.tutorialStep!==undefined&&!s.guidanceSkipped?(onboardingConstraints(s,config).forcedBubbleCost??quote.price):quote.price;
  if(s.wallet.gems<price)return event(s,false,`버블 구매에 젬 ${price}개 필요 · 부족 ${price-s.wallet.gems}개`);
  s.wallet.gems-=price;replaceCell(s,index,b.innerType,config);
  return event(s,true,`버블 구매 · 젬 −${price} · ${b.innerType} 해제${quote.sale?' · 명시 할인 일정 가정 적용':''}`,[index]);
 }
 if(action==='cell'){
  const index=Number(value);if(!integer(index,62))return event(s,false,'유효한 보드 칸을 선택하세요.');
  if(s.selected===null){if(!s.board[index])return event(s,false,'아이템이 있는 칸을 먼저 선택하세요.');s.selected=index;return event(s,true,`${itemFor(config,s.board[index].type)?.name||s.board[index].type} 선택`);}
  if(s.selected===index){
   if(bubbleFor(s,s.board[index]))return event(s,false,'버블 구매 버튼을 누르거나 만료를 기다리세요.');
   if(collectableFor(config,s.board[index]?.type))return collectFrom(s,index,config);
   if(s.board[index]?.type==='reward_bubble_1'){const r=collectRewardWrapper(s,index,config,spreadHooks(s,config));return event(s,r.ok,r.message,r.cells||[]);}
   if(generatorFor(config,s.board[index]))return generateFrom(s,index,config);s.selected=null;return event(s,true,'선택 해제');
  }
  const from=s.selected,same=s.board[from]?.type===s.board[index]?.type;
  if(generatorFor(config,s.board[from])&&s.board[index]&&!same&&!s.board[index].cover){s.selected=index;return event(s,true,'아이템 선택 변경');}
  const r=moveOrMerge(s,from,index,config);s.selected=null;return r;
 }
 if(action==='generate')return generateFrom(s,s.selected,config);
 if(action==='deliver'){
  if(!config.orderRules)return deliverFixedOrder(s,config);
  const slot=value===undefined||value===null||value===''?(s.orders?.slots.find(o=>orderStatus(s,o.slot,config).canDeliver)?.slot||s.orders?.slots[0]?.slot):Number(value);
  const result=submitOrder(s,slot,config);return event(s,result.ok,result.message,result.cells||[]);
 }
 if(action==='sell'){
  const cell=s.selected===null?null:s.board[s.selected];if(!cell||cell.cover||bubbleFor(s,cell))return event(s,false,'이동 가능한 아이템을 먼저 선택하세요.');
  const price=itemFor(config,cell.type).sellingPrice;
  if(!price)return event(s,false,'이 아이템은 판매가0으로 선언되어 있습니다.');
  delete s.generatorState[cell.uid];s.board[s.selected]=null;s.selected=null;s.wallet.coins+=price;return event(s,true,`내장 기본 판매가 · 골드 +${price}`);
 }
 if(action==='quest-start'){
  const q=config.quests[s.questsDone];if(!q)return event(s,false,`내장 기본 과제${config.quests.length}개를 완료했습니다.`);
  if(s.pendingQuest)return event(s,false,'진행 중인 퀘스트 연출을 먼저 완료하세요.');
  if(s.wallet.coins<q.cost)return event(s,false,`골드 ${q.cost}개 필요 · 현재 ${s.wallet.coins}개`);
  s.pendingQuest={id:q.id,cost:q.cost};return event(s,true,'연출 시작 · 아직 골드를 소비하지 않았습니다. 연출 완료로 확정하세요.');
 }
 if(action==='quest-finish')return finishQuest(s,config);
 if(action==='queue'){
  const slot=s.board.findIndex(x=>x===null);if(slot<0)return event(s,false,'보드가 가득 찼습니다.');
  const r=s.queue[0];if(!r||!itemFor(config,r.type))return event(s,false,'대기열 맨 앞 타입이 지원 범위 밖입니다. 순서를 건너뛰거나 미확인 보상을 생성하지 않습니다.');
  s.board[slot]=makeCell(s,config,r.type);if(--r.count===0)s.queue.shift();
  return event(s,true,'보상 대기열 맨 앞 아이템1개를 배치했습니다.',[slot]);
 }
 return event(s,false,'지원하지 않는 실험 동작입니다.');
}
export function playAction(s,action,value,config){
 const previousWallet={...s.wallet};
 const oldSelected=s.selected,oldFrom=action==='move'?Number(String(value).split(',')[0]):oldSelected,
  oldTo=action==='move'?Number(String(value).split(',')[1]):action==='cell'?Number(value):null;
 const oldTypes=oldFrom!==null&&oldTo!==null?[s.board[oldFrom]?.type,s.board[oldTo]?.type]:[];
 const oldUids=new Set(s.board.filter(Boolean).map(c=>c.uid));
 const orderSlot=action==='deliver'?(value===undefined||value===null||value===''?(s.orders?.slots.find(o=>orderStatus(s,o.slot,config).canDeliver)?.slot||s.orders?.slots[0]?.slot):Number(value)):null;
 const oldOrder=s.orders?.slots.find(o=>o.slot===orderSlot);
 const targeted=['open-item','speedup-item','buy-bubble'].includes(action)&&value!==undefined&&value!==null&&value!==''?Number(value):oldSelected;
 const oldSelectedUid=s.board[targeted]?.uid;
 const storedFrom=action==='inventory-store'?(value===undefined?s.selected:Number(value)):null,storedUid=s.board[storedFrom]?.uid,
  withdrawnUid=action==='inventory-withdraw'?s.inventory?.items[Number(value)]?.uid:null;
 const result=applyPlayAction(s,action,value,config);
 if(result.ok){
  reconcilePlay(s,config);
  if(config.commerceRules&&!action.startsWith('commerce-')){
   const count=s.wallet.orders-previousWallet.orders;if(count>0)recordCommerceEvent(s,config,'customer',count);
   const earned=s.wallet.coins-previousWallet.coins;if(earned>0&&action!=='sell'&&!action.startsWith('aid-'))recordCommerceEvent(s,config,'gold',earned);
   for(const [field,target]of [['energy','energy'],['gems','gem']]){const spent=field==='energy'&&result.costEnergy&&result.debitSucceeded?result.requestedEnergy:previousWallet[field]-s.wallet[field];if(spent>0&&!action.startsWith('aid-'))recordCommerceEvent(s,config,target,spent);}
   if(oldTypes[0]&&oldTypes[0]===oldTypes[1]&&oldTo!==null&&s.board[oldTo]&&!oldUids.has(s.board[oldTo].uid))recordCommerceEvent(s,config,'merge',1);
  }
  if(config.onboardingRules&&s.tutorialStep!==undefined&&!s.guidanceSkipped){
   const send=event=>onboardingEvent(s,event,config,guideContext(s));
   if(action==='guide-ack')send({type:'guide-ack'});
   if(action==='inventory')send({type:'inventory-opened'});
   if(action==='close-inventory')send({type:'inventory-closed'});
   if(action==='inventory-store')send({type:'inventory-stored',uid:storedUid,fromIndex:storedFrom});
   if(action==='inventory-withdraw')send({type:'inventory-withdrawn',uid:withdrawnUid});
   if(action==='order-item-info')send({type:'order-item-info-opened',slot:s.infoOrderSlot,itemType:s.infoType});
   if(['start','main'].includes(action))send({type:'board-entered'});
   if(action==='home'||action==='quest-start')send({type:'task-opened'});
   if(action==='quest-finish')send({type:'task-finished'});
   if(action==='deliver'&&oldOrder)send({type:'order-submitted',kind:oldOrder.kind,slot:oldOrder.slot});
   if(oldTypes[0]&&oldTypes[0]===oldTypes[1]&&oldFrom!==oldTo&&oldTo!==null&&s.board[oldTo]&&!s.board[oldFrom])
    send({type:'merge',from:oldFrom,to:oldTo,result:s.board[oldTo].type,targetUid:s.board[oldTo].uid});
   const fresh=s.board.findIndex(c=>c&&!oldUids.has(c.uid));
   if(result.generatedType)send({type:'generated',index:result.sourceIndex,itemType:result.generatedType});
   else if(action==='generate'&&fresh>=0)send({type:'generated',index:oldSelected,itemType:s.board[fresh].type});
   if(action==='queue'&&fresh>=0)send({type:'queue-popped',index:fresh,uid:s.board[fresh].uid,itemType:s.board[fresh].type});
   if(action==='cell'&&s.selected!==null)send({type:'selected',uid:s.board[s.selected].uid});
   if(action==='open-energy')send({type:'energy-window-opened'});
   if(action==='buy-energy')send({type:'energy-refilled'});
   if(action==='shop')onboardingEvent(s,{type:'shop-opened'},config,{dailyFreeGiftAvailable:Boolean(s.commerce?.daily.rows.some(r=>r.cost===0&&r.left>0))});
   if(action==='commerce-buy'&&s.onboarding?.phases.tutorial_shop==='claim-free-gift')send({type:'reward-window-opened'});
   if(action==='item-info')send({type:'view-opened'});
   if(action==='open-item')send({type:'item-opening',uid:oldSelectedUid});
   if(action==='speedup-item')send({type:'item-opened',uid:oldSelectedUid});
   if(action==='buy-bubble'&&oldSelected!==null)send({type:'bubble-broken',uid:oldSelectedUid,index:oldSelected});
   if(action.startsWith('close-')||['buy-energy','choose-item'].includes(action))send({type:'view-closed'});
  }
 }
 return result;
}
export function validPlay(s,config){
 try{
  if(!s||s.schema!==1||!['title','play','home'].includes(s.stage)||!['open','initial'].includes(s.scenario)||!Array.isArray(s.board)||s.board.length!==63)return false;
  const types=new Set(config.items.map(x=>x.type)),uids=new Set();
  const cells=[...s.board,...(s.inventory?.items||[])];
  for(const c of cells)if(c){
   if(!integer(c.uid)||!c.uid||uids.has(c.uid)||!types.has(c.type)||![null,'box','web'].includes(c.cover))return false;
   if(c.uses!==undefined&&(specialFor(config,c.type)!=='scissors'||!integer(c.uses)||c.uses===0))return false;
   if(c.rewardType!==undefined||c.rewardCount!==undefined){
    if(!Object.values(config.spreadRules?.wrapperMerges||{}).some(r=>r.wrapperType===c.type&&r.rewardType===c.rewardType&&r.rewardCount===c.rewardCount))return false;
   }
   uids.add(c.uid);
  }
  if(!integer(s.nextUid)||[...uids].some(uid=>uid>=s.nextUid)||!integer(s.rng,4294967295)||s.rng===0)return false;
  if(s.selected!==null&&(!integer(s.selected,62)||!s.board[s.selected]))return false;
  if(!integer(s.orderIndex,config.orders.length)||!integer(s.questsDone,config.quests.length)||!integer(s.xp)||!integer(s.chainStep,6)||typeof s.chainActive!=='boolean')return false;
  if(![null,'energy','offer','shop','inventory','item-info','choice'].includes(s.modal)||!Array.isArray(s.log)||s.log.length>60||!Array.isArray(s.queue)||s.queue.length>1000||!Array.isArray(s.chainRewards)||s.chainRewards.length>2)return false;
  if(typeof s.message!=='string'||s.message.length>5000||s.log.some(r=>!r||!integer(r.time)||typeof r.message!=='string'||r.message.length>5000||typeof r.ok!=='boolean'))return false;
  if(s.offer!==null&&(!s.offer||!(s.offer.chosen===null||typeof s.offer.chosen==='string')||!Array.isArray(s.offer.steps)||s.offer.steps.length>20||s.offer.steps.some(r=>!r||typeof r.ok!=='boolean'||['id','label','reason'].some(k=>typeof r[k]!=='string'||r[k].length>3000))))return false;
  if(s.modal==='offer'&&(!s.offer||!s.offer.chosen))return false;
  if(s.chainRewards.some(r=>!r||!['green','blue'].includes(r.appearance)||r.contents!=='unknown'))return false;
  for(const k of ['energy','gems','coins','level','time','recoveryRemainder','energyBuys','freeUsed','freeTotal','price','generated','orders'])if(!integer(s.wallet[k]))return false;
  if(s.wallet.level<1||s.wallet.level>1000||s.wallet.price<1||s.wallet.price>160||s.wallet.freeTotal!==1||s.wallet.freeUsed>1||s.wallet.recoveryRemainder>=120)return false;
  // These optional fields allow older schema1 saves to remain readable, but
  // reject orphaned references or invented tool/bubble inventory on new saves.
  if(s.tutorialStep!==undefined&&(!Array.isArray(config.tutorialSteps)||!integer(s.tutorialStep,config.tutorialSteps.length)))return false;
  if(s.bubbles!==undefined){
   if(!record(s.bubbles)||Object.keys(s.bubbles).length>63)return false;
   for(const [uid,b]of Object.entries(s.bubbles)){
    const cell=s.board.find(c=>c?.uid===Number(uid)),bubble=config.specialRules?.bubble;
    if(!cell||uid!==String(cell.uid)||cell.cover||!record(b))return false;
    if(b.kind==='natural'){
     if(b.innerType!==cell.type||!validBubbleInstance(b,config,s.wallet.time)||s.generatorState?.[uid])return false;
     continue;
    }
    if(Object.keys(b).length!==3||!['expiresAt','price','innerType'].every(k=>Object.hasOwn(b,k)))return false;
    if(b.innerType!==cell.type||!integer(b.price)||!integer(b.expiresAt)||b.expiresAt<s.wallet.time&&s.board[s.selected]?.uid!==cell.uid||!bubble)return false;
    if(b.price!==bubble.basePriceProjection?.find(r=>r.type===b.innerType)?.baseGemCost||b.expiresAt>s.wallet.time+bubble.defaultDurationSeconds)return false;
    if(s.generatorState?.[uid])return false;
   }
  }
  if(s.toolPending!==undefined&&s.toolPending!==null){
   const p=s.toolPending;
   if(!record(p)||Object.keys(p).length!==3||!['kind','fromUid','targetUid'].every(k=>Object.hasOwn(p,k))||!['rainbow','scissors'].includes(p.kind)||!integer(p.fromUid)||!integer(p.targetUid)||p.fromUid===p.targetUid||s.modal!==null||s.stage!=='play')return false;
   const from=s.board.findIndex(c=>c?.uid===p.fromUid),to=s.board.findIndex(c=>c?.uid===p.targetUid),plan=toolPlan(s,from,to,config);
   if(!plan||plan.kind!==p.kind||!itemFor(config,plan.result))return false;
  }
  if(s.pendingQuest&&(s.pendingQuest.id!==config.quests[s.questsDone]?.id||s.pendingQuest.cost!==config.quests[s.questsDone]?.cost))return false;
  if(!s.pools||!s.generatorState||!s.bm||!integer(s.bm.triggerPrice,1e6)||![1,2].includes(s.bm.popType))return false;
  for(const k of ['bundle','noPay','invite','plenty','chain','weekly'])if(typeof s.bm[k]!=='boolean')return false;
  if(config.spreadRules){if(!validSpreadPools(s,config))return false;}
  else for(const [type,pool]of Object.entries(s.pools)){const g=itemFor(config,type)?.generator;if(!g||!Array.isArray(pool)||pool.length!==g.pool.length||pool.some((v,i)=>!integer(v,g.pool[i].weight)))return false;}
  for(const [uid,r]of Object.entries(s.generatorState)){
   // TutorialBoardHelper supports a separate timer override. This MainBoard
   // simulator never creates it; accepting it from a save would forge cooldowns.
   if(r.forcedTimerDuration!==undefined)return false;
   const cell=cells.find(c=>c?.uid===Number(uid)),g=generatorFor(config,cell);
   if(config.spreadRules){
    if(!cell||cell.cover||bubbleFor(s,cell)||!validSpreadState(cell.type,r,config,s.wallet.time))return false;
    continue;
   }
   // A partly skipped timer can precede simulated time zero; live source uses
   // absolute server timestamps, whereas this portable clock starts at zero.
   if(!g||bubbleFor(s,cell)||!integer(r.charges,g.batch)||!integer(r.storage,g.storage)||!(r.timerStart===null||Number.isSafeInteger(r.timerStart)&&r.timerStart>=-1e9)||!integer(r.readyAt))return false;
   if(r.timerStart===null){if(r.charges!==g.batch||r.storage===0||r.readyAt!==0)return false;}
   else if(r.timerStart>s.wallet.time||r.readyAt!==r.timerStart+(r.storage===0?g.storageRecoverySeconds:g.cooldownSeconds)||(r.storage>0&&r.charges===g.batch))return false;
  }
  for(const c of cells)if(!c?.cover&&generatorFor(config,c)&&!bubbleFor(s,c)&&!s.generatorState[c.uid])return false;
  if(s.boostRatio!==undefined&&!integer(s.boostRatio,3))return false;
  if(s.boostIndices!==undefined&&(!record(s.boostIndices)||Object.entries(s.boostIndices).some(([k,v])=>!['1','2','4','8'].includes(k)||!integer(v))))return false;
  if(config.inventoryRules&&!validInventory(s,config))return false;
  if(config.orderRules&&!validOrderState(s,config))return false;
  if(config.onboardingRules&&!validOnboardingState(s,config))return false;
  if(s.guidanceSkipped!==undefined&&typeof s.guidanceSkipped!=='boolean')return false;
  if(s.energyFromLack!==undefined&&typeof s.energyFromLack!=='boolean')return false;
  if(s.infoType!==undefined&&(!types.has(s.infoType)||s.modal!=='item-info'))return false;
  if(s.infoOrderSlot!==undefined&&(!integer(s.infoOrderSlot,19)||s.infoOrderSlot<1||!s.infoType))return false;
  if(s.commerce!==undefined&&!validCommerce(s.commerce,config))return false;
  if(s.packInputs!==undefined&&(!record(s.packInputs)||['albumPresent','albumOpen','royalOngoing'].some(k=>typeof s.packInputs[k]!=='boolean')||!Array.isArray(s.packInputs.supportedPacks)||s.packInputs.supportedPacks.some(t=>!['pack_common_5','pack_common_3','pack_laser_5','pack_royal_5'].includes(t))))return false;
  if(s.packLedger!==undefined&&(!Array.isArray(s.packLedger)||s.packLedger.length>1000||s.packLedger.some(r=>!record(r)||!['pack_common_5','pack_common_3','pack_laser_5','pack_royal_5'].includes(r.type)||!integer(r.count,100000)||!r.count||r.contents!=='unknown')))return false;
  if(!validProductionModifiers(s,config))return false;
  if(s.modifierInputs!==undefined){
   if(!record(s.modifierInputs)||JSON.stringify(s.modifierInputs).length>50000)return false;
   const type=config.items.find(r=>r.generator)?.type;
   if(!createProductionModifierPlan(s,config,{...s.modifierInputs,generatorType:type}).ok)return false;
  }
  return s.queue.every(r=>typeof r.type==='string'&&r.type.length<100&&integer(r.count,100000)&&r.count>0&&
   (r.cacheType===undefined||[1,2].includes(r.cacheType))&&(r.origin===undefined||r.origin==='research-aid'));
 }catch{return false;}
}
export {energyCost};
