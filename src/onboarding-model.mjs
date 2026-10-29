import {orderStatus} from './order-model.mjs';
import {storeItem} from './inventory-model.mjs';

// Tutorial guidance owns no wallet rewards. Opening CG/map animation is a
// separate visual boundary; this module handles explicit logical UI events.
const rules=c=>c.onboardingRules;
const openCell=(s,c)=>c&&!c.cover&&!s.bubbles?.[c.uid];
const indices=(s,type)=>s.board.flatMap((c,i)=>openCell(s,c)&&c.type===type?[i]:[]);
const ctxFor=(s,context)=>({scene:s.stage==='home'?'map':s.stage==='play'?'board':s.stage,
 mapReady:true,allWindowsClosed:!s.modal,cacheVisible:true,resourcesReady:true,inTimeline:!!s.pendingQuest,
 otherStrong:false,chainEnergyOpen:false,freeRefillsUsed:s.wallet.freeUsed||0,...context});
function state(s){
 return s.onboarding??={schema:1,starterCount:Math.min(8,s.tutorialStep||0),registeredFinished:[],completed:[],
  phases:{},targets:{},order1ReadyAt:null,visualsDeferred:true,pendingBubbleUids:[]};
}
const has=(list,id)=>list.includes(id);
function registered(o,id){if(!has(o.registeredFinished,id))o.registeredFinished.push(id);}
function finish(o,id){registered(o,id);if(!has(o.completed,id))o.completed.push(id);delete o.phases[id];delete o.targets[id];}
function begin(o,id,phase,target,registerEarly=false){o.phases[id]=phase;if(target!==undefined)o.targets[id]=target;if(registerEarly)registered(o,id);}
const busy=o=>Object.keys(o.phases).some(id=>!['tutorial_back2board'].includes(id));
function firstFixed(s,c){return s.orders?.slots.find(o=>o.kind==='fixed'&&orderStatus(s,o.slot,c).canDeliver);}
const itemFor=(c,type)=>c.items.find(item=>item.type===type);
const requiredCodes=s=>(s.orders?.slots||[]).flatMap(order=>order.requirements.flatMap(r=>typeof r==='string'?[r]:Array(r.count).fill(r.type)));
function hasMergePair(s,c){
 const groups={};
 for(const cell of s.board){
  if(!cell||cell.cover==='box'||s.bubbles?.[cell.uid])continue;
  // Temp lifecycle is outside the current board model. An unknown pair state
  // must not be read as proof that the original no-pair condition is true.
  if(cell.temporary||cell.type==='temp_1')return null;
  const item=itemFor(c,cell.type);if(!item)return null;
  const spread=c.spreadRules?.byType?.[cell.type],metadata=s.generatorState?.[cell.uid];
  if(spread?.openSeconds!=null){if(metadata?.charges===undefined)return null;if(metadata.charges!==spread.batch)continue;}
  if(s.generatorFactoryOpen===true&&c.inventoryRules?.factory?.fragmentTypes?.includes(cell.type))continue;
  if(cell.cover!=='web'&&!item.next)continue;
  const group=groups[cell.type]??={normal:0,web:0};group[cell.cover==='web'?'web':'normal']++;
 }
 return Object.values(groups).some(group=>group.normal>0&&(group.web>0||group.normal>=2));
}
export function inventoryGuideCandidates(s,c,context={}){
 const rule=rules(c)?.inventoryGuide;if(!rule)return [];
 const ctx=ctxFor(s,context);
 if(ctx.scene!=='board'||!ctx.mapReady||!ctx.allWindowsClosed||ctx.otherStrong||ctx.eventLocked!==false||
  ctx.paperBoxExtraRewardAnimationPlaying!==false||s.wallet.level<rule.minLevel||s.wallet.level>rule.maxLevel||
  !s.inventory||s.inventory.items.length||s.board.includes(null)||hasMergePair(s,c)!==false||
  (s.orders?.slots||[]).some(order=>orderStatus(s,order.slot,c).canDeliver))return [];
 const demand=new Set(requiredCodes(s));let maximum=0,candidates=[];
 for(let index=0;index<s.board.length;index++){
  const cell=s.board[index];if(!openCell(s,cell)||demand.has(cell.type)||Number(cell.type)>rule.maxNumericItemCode||
   rule.collectableTypes.includes(cell.type)||rule.chooseTypes.includes(cell.type))continue;
  // Reuse the real inventory eligibility on a disposable clone. This cannot
  // change selection, UIDs, metadata, RNG, wallet or storage in the live state.
  const copy=structuredClone(s);if(!storeItem(copy,index,c).ok)continue;
  const level=itemFor(c,cell.type)?.chainLevel;if(!Number.isInteger(level))continue;
  if(level>maximum){maximum=level;candidates=[{index,uid:cell.uid,type:cell.type}];}
  else if(level===maximum)candidates.push({index,uid:cell.uid,type:cell.type});
 }
 return candidates;
}
function chooseGuideCandidate(s,candidates){
 // Table.ListRandomSelectOne calls MathUtil.Random even for a singleton.
 let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;
 return candidates[Math.floor(s.rng/4294967296*candidates.length)];
}
function retryBubbleGuide(s,c,context){
 const o=state(s),ctx=ctxFor(s,context),rule=rules(c).bubble;
 if(s.wallet.level<rule.minLevel||has(o.completed,'tutorial_bubble')||busy(o)||ctx.scene!=='board'||!ctx.mapReady||
  !ctx.allWindowsClosed||ctx.otherStrong||ctx.paperBoxExtraRewardAnimationPlaying!==false)return;
 const index=s.board.findIndex(cell=>cell&&(o.pendingBubbleUids||[]).includes(cell.uid)&&s.bubbles?.[cell.uid]);
 if(index>=0){const uid=s.board[index].uid;o.pendingBubbleUids=[];begin(o,'tutorial_bubble','select',{index,uid},true);}
}
export function eligibleOrderItemInfoGuide(s,c,context={}){
 const rule=rules(c)?.orderItemInfo,ctx=ctxFor(s,context);if(!rule||s.wallet.level>=rule.finishLevel||ctx.scene!=='board'||!ctx.mapReady||
  !ctx.allWindowsClosed||ctx.otherStrong||s.itemUnlocks?.[rule.unlockType]!==true)return null;
 const order=s.orders?.slots.find(order=>order.kind==='fixed'&&order.requirements.length===1&&order.requirements[0].type===rule.requirementType&&order.requirements[0].count===1);
 return order?{slot:order.slot,type:rule.requirementType}:null;
}
export function eligibleScissorMergeGuide(s,c,context={}){
 const rule=rules(c)?.scissorMerge,ctx=ctxFor(s,context);if(!rule||ctx.scene!=='board'||!ctx.mapReady||!ctx.allWindowsClosed||ctx.otherStrong)return null;
 const scissors=s.board.flatMap((cell,index)=>openCell(s,cell)&&!cell.temporary&&cell.type===rule.type?[{index,uid:cell.uid,uses:cell.uses??rule.defaultUses}]:[]);
 if(scissors.some(cell=>cell.uses>=2))return {finishWithoutGuide:true};
 if(scissors.length<2)return null;
 let [from,to]=scissors;
 if(from.index%7>to.index%7||Math.floor(from.index/7)>Math.floor(to.index/7))[from,to]=[to,from];
 return {from:from.index,to:to.index,fromUid:from.uid,targetUid:to.uid};
}
function satisfy(node,s,c){
 const o=state(s);
 return node.conditions.every(cond=>{
  if(cond.kind==='TutorialFinished')return cond.args.every(id=>has(o.registeredFinished,id));
  if(cond.kind==='MainLevel')return s.wallet.level>=Number(cond.args[0]);
  if(cond.kind==='FunctionEnabled')return cond.args.every(name=>s.wallet.level>=(rules(c).functionGates[name]??Infinity));
  if(cond.kind==='CachedItemPushed')return s.queue.some(item=>!cond.args.length||cond.args.includes(item.type));
  if(cond.kind==='TaskFinished')return cond.args.every(id=>c.quests.findIndex(q=>q.id===id)<s.questsDone&&c.quests.some(q=>q.id===id));
  return false;
 });
}
export function reconcileOnboarding(s,c,context={}){
 if(!rules(c))return {ok:false,message:'초반 진행 설정이 없습니다.'};
 const o=state(s),ctx=ctxFor(s,context);
 if(o.starterCount>=3)finish(o,'tutorial_3');
 if(o.starterCount>=6)finish(o,'tutorial_4');
 if(o.starterCount>=8)finish(o,'tutorial_5');
 if(o.order1ReadyAt!==null&&s.wallet.time>=o.order1ReadyAt){finish(o,'tutorial_6');o.order1ReadyAt=null;}
 if(s.wallet.level>=rules(c).backToBoard.finishLevel)finish(o,'tutorial_back2board');
 const clean=ctx.mapReady&&ctx.allWindowsClosed&&!ctx.otherStrong;
 if(clean&&ctx.scene==='board'&&o.starterCount>=8&&!busy(o)){
  const eligible=firstFixed(s,c);
  if(!has(o.completed,'tutorial_6')){
   if(eligible)begin(o,'tutorial_6','deliver',eligible.slot);else finish(o,'tutorial_6');
  }else if(!has(o.completed,'tutorial_7')&&eligible)begin(o,'tutorial_7','deliver',eligible.slot,true);
 }
 const q=c.quests[s.questsDone];
 if(clean&&ctx.scene==='board'&&!busy(o)&&!has(o.completed,'tutorial_task')&&q&&s.wallet.coins>=q.cost&&ctx.resourcesReady)
  begin(o,'tutorial_task','open-task');
 const cache=rules(c).cache,top=s.queue[0];
 if(clean&&ctx.scene==='board'&&!busy(o)&&!has(o.completed,'tutorial_cache')&&s.wallet.level>=cache.minLevel&&top?.type===cache.targetType&&s.board.includes(null)){
  if(s.wallet.level>=cache.maxLevelExclusive||!indices(s,cache.targetType).length||!ctx.cacheVisible)finish(o,'tutorial_cache');
  else begin(o,'tutorial_cache','pop');
 }
 if(clean&&ctx.scene==='board'&&!busy(o)&&!has(o.completed,'tutorial_energy')&&s.wallet.energy===0){
  if(ctx.chainEnergyOpen||ctx.freeRefillsUsed!==0)finish(o,'tutorial_energy');
  else begin(o,'tutorial_energy','open-energy',undefined,true);
 }
 if(clean&&ctx.scene==='map'&&!ctx.inTimeline&&!busy(o)&&s.wallet.level>=rules(c).shop.minLevel&&!has(o.completed,'tutorial_shop'))
  begin(o,'tutorial_shop','open-shop',undefined,true);
 const orderInfo=rules(c).orderItemInfo;
 if(orderInfo&&!o.phases.tutorial_order_item_info&&!has(o.completed,'tutorial_order_item_info')&&s.wallet.level>=orderInfo.finishLevel)
  finish(o,'tutorial_order_item_info');
 if(o.starterCount>=8&&!busy(o)){
  const info=!has(o.completed,'tutorial_order_item_info')&&eligibleOrderItemInfoGuide(s,c,context);
  if(info)begin(o,'tutorial_order_item_info','highlight-order',info,true);
 }
 if(o.starterCount>=8&&!busy(o)&&!has(o.completed,'tutorial_scissor_merge')){
  const scissors=eligibleScissorMergeGuide(s,c,context);
  if(scissors?.finishWithoutGuide)finish(o,'tutorial_scissor_merge');
  else if(scissors)begin(o,'tutorial_scissor_merge','highlight-items',scissors,true);
 }
 const inventory=rules(c).inventoryGuide;
 if(inventory&&o.starterCount>=8&&!busy(o)&&!has(o.completed,'tutorial_inventory')&&ctx.scene==='board'&&ctx.mapReady&&!ctx.otherStrong&&
  ctx.paperBoxExtraRewardAnimationPlaying===false&&s.wallet.level>=inventory.minLevel){
  if(s.wallet.level>inventory.maxLevel||s.inventory?.items.length)finish(o,'tutorial_inventory');
  else{
   const candidates=inventoryGuideCandidates(s,c,context);
   if(candidates.length)begin(o,'tutorial_inventory','highlight-entry',chooseGuideCandidate(s,candidates),true);
  }
 }
 if(o.phases.tutorial_inventory==='withdraw'&&!s.inventory?.items.some(cell=>cell.uid===o.targets.tutorial_inventory.uid))finish(o,'tutorial_inventory');
 return {ok:true,active:Object.keys(o.phases),eligibleNodes:rules(c).nodes.filter(n=>satisfy(n,s,c)).map(n=>n.id)};
}
export function onboardingConstraints(s,c,context={}){
 if(!rules(c))return {};
 const o=state(s),ctx=ctxFor(s,context),step=c.tutorialSteps?.[o.starterCount];
 if(step&&has(o.completed,'tutorial_2'))return {tutorialId:step.tutorialId,input:step};
 if(o.phases.tutorial_6==='wait')return {tutorialId:'tutorial_6',waitSeconds:Math.max(0,Math.ceil(o.order1ReadyAt-s.wallet.time))};
 for(const id of ['tutorial_6','tutorial_7'])if(o.phases[id]==='deliver')return {tutorialId:id,input:{kind:'deliver',slot:o.targets[id]}};
 if(o.phases.tutorial_task)return {tutorialId:'tutorial_task',input:{kind:o.phases.tutorial_task==='open-task'?'open-task':'commit-task'}};
 if(o.phases.tutorial_cache==='pop')return {tutorialId:'tutorial_cache',input:{kind:'queue',type:rules(c).cache.targetType}};
 if(o.phases.tutorial_cache==='merge')return {tutorialId:'tutorial_cache',input:{kind:'merge',...o.targets.tutorial_cache}};
 if(o.phases.tutorial_cache==='tap')return {tutorialId:'tutorial_cache',input:{kind:'generate',index:o.targets.tutorial_cache.index},forcedSpreadType:rules(c).cache.forcedSpreadType};
 if(o.phases.tutorial_chest)return {tutorialId:'tutorial_chest',input:{kind:o.phases.tutorial_chest,index:o.targets.tutorial_chest.index},
  ...(o.phases.tutorial_chest==='skip'?{forcedSkipCost:rules(c).chest.forcedSkipCost}:{})};
 if(o.phases.tutorial_bubble)return {tutorialId:'tutorial_bubble',input:{kind:o.phases.tutorial_bubble,index:o.targets.tutorial_bubble.index},forcedBubbleCost:rules(c).bubble.forcedUnlockCost};
 if(o.phases.tutorial_item_detail)return {tutorialId:'tutorial_item_detail',input:{kind:o.phases.tutorial_item_detail,index:o.targets.tutorial_item_detail.index}};
 if(o.phases.tutorial_order_item_info){
  const target=o.targets.tutorial_order_item_info;
  return {tutorialId:'tutorial_order_item_info',input:o.phases.tutorial_order_item_info==='highlight-order'?{kind:'guide-ack',step:'highlight-order',...target}:{kind:'order-item-info',...target}};
 }
 if(o.phases.tutorial_scissor_merge){
  const target=o.targets.tutorial_scissor_merge,phase=o.phases.tutorial_scissor_merge;
  return {tutorialId:'tutorial_scissor_merge',input:phase==='merge'?{kind:'merge',from:target.from,to:target.to}:{kind:'guide-ack',step:phase,...target}};
 }
 if(o.phases.tutorial_inventory){
  const target=o.targets.tutorial_inventory,phase=o.phases.tutorial_inventory;
  if(phase==='highlight-entry')return {tutorialId:'tutorial_inventory',input:{kind:'guide-ack',step:phase,...target}};
  if(phase==='store')return {tutorialId:'tutorial_inventory',input:{kind:'inventory-store',...target,index:s.board.findIndex(cell=>cell?.uid===target.uid)}};
  if(phase==='open')return {tutorialId:'tutorial_inventory',input:{kind:'inventory-open'}};
  return {tutorialId:'tutorial_inventory',input:{kind:'inventory-withdraw',uid:target.uid,slot:s.inventory?.items.findIndex(cell=>cell.uid===target.uid)}};
 }
 if(o.phases.tutorial_energy)return {tutorialId:'tutorial_energy',input:{kind:o.phases.tutorial_energy}};
 if(o.phases.tutorial_shop)return {tutorialId:'tutorial_shop',input:{kind:o.phases.tutorial_shop}};
 const q=c.quests[s.questsDone];
 if(ctx.scene==='map'&&ctx.mapReady&&ctx.allWindowsClosed&&!ctx.otherStrong&&!ctx.inTimeline&&s.wallet.level<rules(c).backToBoard.finishLevel&&q&&s.wallet.coins<q.cost)
  return {tutorialId:'tutorial_back2board',highlight:'main-board'};
 return {};
}
export function onboardingAllows(s,c,action,value){
 const allow=()=>({allowed:true,message:''});
 const deny=()=>({allowed:false,message:'현재 튜토리얼에서 안내한 조작을 먼저 완료하세요. 연구 보조는 안내를 건너뛴 뒤 사용할 수 있습니다.'});
 if(typeof action!=='string')return deny();
 if(!rules(c)||s.tutorialStep===undefined||s.guidanceSkipped)return allow();
 // UI and clock actions do not consume board items or invent tutorial rewards.
 if(['focus','save','export','export-save','export-session','copy-save','skip-tutorial','time'].includes(action))return allow();
 if(action==='start'&&s.stage==='title')return allow();
 const modalClose={energy:'close-energy',offer:'close-offer',shop:'close-shop',inventory:'close-inventory','item-info':'close-info',choice:'close-choice'};
 if(s.modal&&action===modalClose[s.modal])return allow();
 // Do not create or change onboarding state while deciding whether an action
 // is allowed. The caller owns initialization and selection preparation.
 const guide=s.onboarding?onboardingConstraints(s,c):{};
 const input=guide.input;
 const starterPending=(s.onboarding?.starterCount??s.tutorialStep)<8;
 if(action.startsWith('aid-')&&(input||guide.waitSeconds!==undefined||starterPending))return deny();
 if(guide.waitSeconds!==undefined)return deny();
 if(!input)return allow();
 if(s.modal){
  if(input.kind==='refill-energy'&&s.modal==='energy'&&action==='buy-energy')return allow();
  if(input.kind==='inventory-withdraw'&&s.modal==='inventory'&&action==='inventory-withdraw'&&Number(value)===input.slot)return allow();
  if(input.kind==='claim-free-gift'&&s.modal==='shop'){
   if(action==='claim-free-gift')return allow();
   if(action==='commerce-buy'){
    const row=s.commerce?.daily?.rows?.find(r=>r.id===value);
    return row&&row.cost===0&&row.left>0?allow():deny();
   }
  }
  return deny();
 }
 const numeric=value!==undefined&&value!==null&&value!==''?Number(value):s.selected;
 const cellIndex=action==='cell'?Number(value):null;
 const targetIndex=input.index;
 const targetCell=()=>action==='cell'&&cellIndex===targetIndex;
 const onBoard=['merge','generate','deliver','queue','select','open','skip','item-info','buy-bubble','guide-ack','inventory-store','inventory-open','inventory-withdraw','order-item-info'].includes(input.kind);
 if(onBoard&&s.stage!=='play')return action==='main'?allow():deny();
 if(input.kind==='merge'){
  if(action==='move'){
   const match=typeof value==='string'&&/^(\d{1,2}),(\d{1,2})$/.exec(value);
   return match&&Number(match[1])===input.from&&Number(match[2])===input.to?allow():deny();
  }
  // Clicking the source is selection-only. Root clears selected before its
  // cell handler in this case; selecting the target first cannot reverse merge.
  if(action==='cell'&&cellIndex===input.from)return allow();
  if(action==='cell'&&cellIndex===input.to&&s.selected===input.from)return allow();
  return deny();
 }
 if(input.kind==='generate')return targetCell()||action==='generate'&&s.selected===targetIndex?allow():deny();
 if(input.kind==='deliver'){
  const selected=value===undefined||value===null||value===''?
   s.orders?.slots.find(o=>orderStatus(s,o.slot,c).canDeliver)?.slot:Number(value);
  return action==='deliver'&&selected===input.slot?allow():deny();
 }
 if(input.kind==='open-task')return action==='home'?allow():deny();
 if(input.kind==='commit-task'){
  if(s.stage!=='home')return action==='home'?allow():deny();
  return ['quest-start','quest-finish'].includes(action)?allow():deny();
 }
 if(input.kind==='queue')return action==='queue'?allow():deny();
 if(input.kind==='guide-ack')return action==='guide-ack'?allow():deny();
 if(input.kind==='inventory-store'){
  if(targetCell()&&s.selected!==targetIndex)return allow();
  // Original HUD drag identifies its source directly; an exact explicit board
  // index does not require a preceding click selection.
  return action==='inventory-store'&&numeric===targetIndex?allow():deny();
 }
 if(input.kind==='inventory-open'||input.kind==='inventory-withdraw')return action==='inventory'?allow():deny();
 if(input.kind==='order-item-info'){
  const match=typeof value==='string'&&/^([1-9]\d*),([^,]+)$/.exec(value);
  return action==='order-item-info'&&match&&Number(match[1])===input.slot&&match[2]===input.type?allow():deny();
 }
 if(input.kind==='select')return targetCell()?allow():deny();
 if(['open','skip','item-info','buy-bubble'].includes(input.kind)){
  if(targetCell()&&s.selected!==targetIndex)return allow();
  const expected={open:'open-item',skip:'speedup-item','item-info':'item-info','buy-bubble':'buy-bubble'}[input.kind];
  return action===expected&&numeric===targetIndex&&s.selected===targetIndex?allow():deny();
 }
 if(input.kind==='open-energy')return action==='open-energy'?allow():deny();
 if(input.kind==='refill-energy')return action==='open-energy'?allow():deny();
 if(input.kind==='open-shop'||input.kind==='claim-free-gift'){
  if(s.stage!=='home')return action==='home'?allow():deny();
  return action==='shop'?allow():deny();
 }
 return deny();
}
export function onboardingEvent(s,event,c,context={}){
 if(!rules(c))return {ok:false,message:'초반 진행 설정이 없습니다.'};
 const o=state(s),ctx=ctxFor(s,context);
 if(event.type==='guide-ack'){
  const guide=onboardingConstraints(s,c,context);
  if(guide.input?.kind==='guide-ack'&&(!event.tutorialId||event.tutorialId===guide.tutorialId)){
   if(guide.tutorialId==='tutorial_inventory')o.phases.tutorial_inventory='store';
   else if(guide.tutorialId==='tutorial_order_item_info')o.phases.tutorial_order_item_info='inspect-order';
   else if(guide.tutorialId==='tutorial_scissor_merge'){
    const phase=o.phases.tutorial_scissor_merge;
    if(phase==='highlight-items')o.phases.tutorial_scissor_merge='merge';
    else if(phase==='highlight-merged')o.phases.tutorial_scissor_merge='highlight-info';
    else if(phase==='highlight-info')finish(o,'tutorial_scissor_merge');
   }
  }
 }
 if(event.type==='board-entered'){
  // Explicit web UI acknowledgment of logical entry, not original CG playback.
  finish(o,'tutorial_1');finish(o,'tutorial_2');
 }
 const step=c.tutorialSteps?.[o.starterCount];
 if(step&&has(o.completed,'tutorial_2')&&((step.kind==='merge'&&event.type==='merge'&&event.from===step.from&&event.to===step.to&&event.result===step.result)||
  (step.kind==='generate'&&event.type==='generated'&&event.index===step.index&&event.itemType===step.type)))o.starterCount++;
 for(const id of ['tutorial_6','tutorial_7'])if(o.phases[id]==='deliver'&&event.type==='order-submitted'&&event.kind==='fixed'&&event.slot===o.targets[id]){
  if(id==='tutorial_6'){o.phases[id]='wait';o.order1ReadyAt=s.wallet.time+2.5;}else finish(o,id);
 }
 if(o.phases.tutorial_task==='open-task'&&event.type==='task-opened')o.phases.tutorial_task='commit-task';
 if(o.phases.tutorial_task&&event.type==='task-finished')finish(o,'tutorial_task');
 if(o.phases.tutorial_cache==='pop'&&event.type==='queue-popped'&&event.itemType===rules(c).cache.targetType){
  const positions=indices(s,rules(c).cache.targetType);
  if(positions.length<2)finish(o,'tutorial_cache');else{
   let [from,to]=positions;if(from%7>to%7)[from,to]=[to,from];
   begin(o,'tutorial_cache','merge',{from,to});
  }
 }else if(o.phases.tutorial_cache==='merge'&&event.type==='merge'&&event.result===rules(c).cache.resultType){
  const index=indices(s,rules(c).cache.resultType)[0];
  if(index===undefined)finish(o,'tutorial_cache');else begin(o,'tutorial_cache','tap',{index});
 }else if(o.phases.tutorial_cache==='tap'&&['generated','view-opened'].includes(event.type))finish(o,'tutorial_cache');
 if(has(o.completed,'tutorial_cache')&&!has(o.completed,'tutorial_chest')&&event.type==='queue-popped'&&rules(c).chest.targetTypes.includes(event.itemType))
  begin(o,'tutorial_chest','select',{index:event.index,uid:event.uid},true);
 if(o.phases.tutorial_chest&&event.uid===o.targets.tutorial_chest.uid){
  if(event.type==='selected')o.phases.tutorial_chest='open';
  if(event.type==='item-opening')o.phases.tutorial_chest='skip';
  if(event.type==='item-opened')finish(o,'tutorial_chest');
 }
 if(s.wallet.level>=rules(c).bubble.minLevel&&!has(o.completed,'tutorial_bubble')&&event.type==='bubble-spawned'&&!event.instant&&!event.synthetic&&Number.isInteger(event.uid)&&
  s.board.some(cell=>cell?.uid===event.uid)&&s.bubbles?.[event.uid]){
  o.pendingBubbleUids=(o.pendingBubbleUids||[]).filter(uid=>s.board.some(cell=>cell?.uid===uid)&&s.bubbles?.[uid]);
  if(!o.pendingBubbleUids.includes(event.uid))o.pendingBubbleUids.push(event.uid);
 }
 if(o.phases.tutorial_bubble&&event.uid===o.targets.tutorial_bubble.uid){
  if(event.type==='selected')o.phases.tutorial_bubble='buy-bubble';
  if(['bubble-broken','bubble-expired'].includes(event.type))finish(o,'tutorial_bubble');
 }
 if(['bubble-broken','bubble-expired'].includes(event.type)&&o.pendingBubbleUids)o.pendingBubbleUids=o.pendingBubbleUids.filter(uid=>uid!==event.uid);
 if(!has(o.completed,'tutorial_item_detail')&&!o.phases.tutorial_item_detail&&event.type==='merge'&&event.result===rules(c).itemDetail.targetType)
  begin(o,'tutorial_item_detail','generate',{index:event.to},true);
 else if(o.phases.tutorial_item_detail==='generate'&&event.type==='generated')o.phases.tutorial_item_detail='item-info';
 else if(o.phases.tutorial_item_detail&&event.type==='view-opened')finish(o,'tutorial_item_detail');
 if(o.phases.tutorial_energy==='open-energy'&&event.type==='energy-window-opened')o.phases.tutorial_energy='refill-energy';
 if(o.phases.tutorial_energy==='refill-energy'&&event.type==='energy-refilled')finish(o,'tutorial_energy');
 if(event.type==='shop-opened'){
  if(o.phases.tutorial_shop&&ctx.dailyFreeGiftAvailable===false)finish(o,'tutorial_shop');
  else if(o.phases.tutorial_shop==='open-shop'){
   o.phases.tutorial_shop='claim-free-gift';
  }
  else if(!o.phases.tutorial_shop)finish(o,'tutorial_shop');
 }
 if(o.phases.tutorial_shop==='claim-free-gift'&&['reward-window-opened','shop-refreshed'].includes(event.type))finish(o,'tutorial_shop');
 if(o.phases.tutorial_inventory==='store'&&event.type==='inventory-stored'&&event.uid===o.targets.tutorial_inventory.uid)
  o.phases.tutorial_inventory='open';
 else if(o.phases.tutorial_inventory==='open'&&event.type==='inventory-opened')o.phases.tutorial_inventory='withdraw';
 else if(o.phases.tutorial_inventory==='withdraw'&&(event.type==='inventory-closed'||event.type==='inventory-withdrawn'&&event.uid===o.targets.tutorial_inventory.uid))
  finish(o,'tutorial_inventory');
 if(o.phases.tutorial_order_item_info==='inspect-order'&&event.type==='order-item-info-opened'&&
  event.slot===o.targets.tutorial_order_item_info.slot&&event.itemType===o.targets.tutorial_order_item_info.type)finish(o,'tutorial_order_item_info');
 if(o.phases.tutorial_order_item_info&&event.type==='order-submitted'&&event.kind==='fixed'&&event.slot===o.targets.tutorial_order_item_info.slot)
  finish(o,'tutorial_order_item_info');
 const scissors=rules(c).scissorMerge;
 if(scissors&&['merge','scissors-combined'].includes(event.type)&&event.result===scissors.type){
  if(o.phases.tutorial_scissor_merge==='merge'&&event.from===o.targets.tutorial_scissor_merge.from&&event.to===o.targets.tutorial_scissor_merge.to){
   const cell=s.board[event.to];
   if(cell?.type===scissors.type)begin(o,'tutorial_scissor_merge','highlight-merged',{index:event.to,uid:cell.uid});
  }else if(!o.phases.tutorial_scissor_merge)finish(o,'tutorial_scissor_merge');
 }
 // Bubble's source executer retries on every ItemSpread and on CloseView,
 // retaining its pending occurrence across another strong guide/window.
 if(['bubble-spawned','generated','view-closed'].includes(event.type))retryBubbleGuide(s,c,context);
 return reconcileOnboarding(s,c,context);
}
export function validOnboardingState(s,c){
 if(s.onboarding===undefined)return true;
 const o=s.onboarding,ids=new Set(rules(c)?.nodes.map(n=>n.id));
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
 if(!o||o.schema!==1||!Number.isInteger(o.starterCount)||o.starterCount<0||o.starterCount>8||typeof o.visualsDeferred!=='boolean'||
  !Array.isArray(o.completed)||!Array.isArray(o.registeredFinished)||!record(o.phases)||!record(o.targets)||
  !(o.order1ReadyAt===null||Number.isFinite(o.order1ReadyAt)&&o.order1ReadyAt>=0&&o.order1ReadyAt<=1e9))return false;
 for(const list of [o.completed,o.registeredFinished])if(new Set(list).size!==list.length||list.some(id=>!ids.has(id)))return false;
 if(o.completed.some(id=>!o.registeredFinished.includes(id)))return false;
 if(o.pendingBubbleUids!==undefined&&(!Array.isArray(o.pendingBubbleUids)||o.pendingBubbleUids.length>63||new Set(o.pendingBubbleUids).size!==o.pendingBubbleUids.length||
  o.pendingBubbleUids.some(uid=>!Number.isInteger(uid)||uid<1||uid>=s.nextUid)))return false;
 const phases={'tutorial_6':['deliver','wait'],'tutorial_7':['deliver'],'tutorial_task':['open-task','commit-task'],
  'tutorial_cache':['pop','merge','tap'],'tutorial_chest':['select','open','skip'],'tutorial_bubble':['select','buy-bubble'],
  'tutorial_item_detail':['generate','item-info'],'tutorial_energy':['open-energy','refill-energy'],'tutorial_shop':['open-shop','claim-free-gift'],
  'tutorial_inventory':['highlight-entry','store','open','withdraw'],'tutorial_order_item_info':['highlight-order','inspect-order'],
  'tutorial_scissor_merge':['highlight-items','merge','highlight-merged','highlight-info']};
 for(const [id,phase]of Object.entries(o.phases))if(!phases[id]?.includes(phase))return false;
 if(Object.keys(o.targets).some(id=>!phases[id]))return false;
 for(const target of Object.values(o.targets)){
  if(typeof target==='number'){if(!Number.isInteger(target)||target<1||target>19)return false;continue;}
  if(!target||typeof target!=='object'||Array.isArray(target))return false;
  for(const key of ['index','from','to'])if(target[key]!==undefined&&(!Number.isInteger(target[key])||target[key]<0||target[key]>62))return false;
  if(target.slot!==undefined&&(!Number.isInteger(target.slot)||target.slot<1||target.slot>19))return false;
  if(target.type!==undefined&&!itemFor(c,target.type))return false;
  for(const key of ['uid','fromUid','targetUid'])if(target[key]!==undefined&&(!Number.isInteger(target[key])||target[key]<1||target[key]>=s.nextUid))return false;
 }
 return true;
}
