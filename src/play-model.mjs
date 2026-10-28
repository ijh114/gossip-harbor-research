import {createState,advanceTime,buyEnergy,energyCost,traceOffers} from './engine.mjs';

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
function makeCell(s,config,type,cover=null){
 const cell={uid:s.nextUid++,type:String(type),cover};
 if(specialFor(config,cell.type)==='scissors')cell.uses=usesFor(config,cell);
 const g=generatorFor(config,cell);
 if(g)s.generatorState[cell.uid]={charges:g.batch,storage:g.storage,timerStart:null,readyAt:0};
 return cell;
}
export function createPlay(config,{scenario='open',seed=42}={}){
 const s={schema:1,stage:'title',scenario,board:Array(63).fill(null),wallet:createState({board:[],level:1,coins:0,gems:200,energy:100}),
  selected:null,nextUid:1,generatorState:{},pools:{},rng:seed>>>0||42,orderIndex:0,questsDone:0,xp:0,queue:[],
  pendingQuest:null,modal:null,offer:null,toolPending:null,bubbles:{},chainActive:false,chainStep:0,chainRewards:[],
  bm:{triggerPrice:20,bundle:true,noPay:false,invite:false,plenty:false,chain:false,weekly:false,popType:1},
  message:'내장 기본값을 읽은 연구 실험입니다. 시작한 뒤 생성기를 선택하세요.',log:[],lastAction:{ok:true,cells:[]}};
 if(scenario==='initial')s.board=config.initialBoard.map(c=>makeCell(s,config,c.type,c.cover));
 else {s.board[0]=makeCell(s,config,'106');s.board[1]=makeCell(s,config,'406');}
 return s;
}
function rng(s){let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function fixedDraw(s,type,g){
 let remaining=s.pools[type];
 if(!remaining||remaining.reduce((a,b)=>a+b,0)===0)remaining=s.pools[type]=g.pool.map(x=>x.weight);
 let position=Math.floor(rng(s)*remaining.reduce((a,b)=>a+b,0));
 for(let i=0;i<remaining.length;i++){if(position<remaining[i]){remaining[i]--;return g.pool[i].type;}position-=remaining[i];}
 throw new Error('Invalid fixed pool');
}
function refreshGenerator(s,cell,config){
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
 // Only explicitly staged research bubbles exist here. Live spawning, sale,
 // tutorial-price and server countdown overrides are deliberately not inferred.
 for(const [uid,b]of Object.entries(s.bubbles||{}))if(s.wallet.time>=b.expiresAt){
  const index=s.board.findIndex(c=>c?.uid===Number(uid));
  if(index>=0)replaceCell(s,index,config.specialRules?.mergeBonus?.type||'2401',config);
  else delete s.bubbles[uid];
 }
 for(const cell of s.board)if(cell)refreshGenerator(s,cell,config);
 return silent?result:event(s,result.ok,result.message+' · 생성기 회복 반영');
}
function eligibleTrace(s,config,closedWithoutPurchase=true){
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
 const r=s.generatorState[cell.uid];
 if(r.charges===0)return event(s,false,`충전 대기 · ${Math.max(0,r.readyAt-s.wallet.time)}초 뒤 회복`);
 const slot=spreadSlot(s,index);if(slot<0)return event(s,false,'보드가 가득 찼습니다. 합성·주문·판매로 공간을 확보하세요.');
 if(s.wallet.energy<g.cost){const early=eligibleTrace(s,config,false);s.offer=early;s.modal=early.earlyBundle?'offer':'energy';return event(s,false,'에너지 부족 · 현재 재화로 충전/오퍼 조건을 평가합니다.');}
 const type=fixedDraw(s,cell.type,g);
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
 if(a.type===b.type&&next&&!itemFor(config,next))return event(s,false,`결과 코드 ${next}의 보상/래퍼 동작은 이번 범위에 없어 합성을 실행하지 않습니다.`);
 if(a.type===b.type&&next){
  removeCell(s,from);replaceCell(s,to,next,config);
  const changed=[from,to,...shockNeighbors(s,to)],bonus=config.specialRules?.mergeBonus;
  // The recovered base merge emits Coin01 at RESULT chain level8+, never EXP.
  // Activity/card/automatic-bubble bonus generation remains outside this model.
  if(bonus&&itemFor(config,next)?.chainLevel>=bonus.minimumResultChainLevel&&itemFor(config,bonus.type)){
   const slot=spreadSlot(s,to);if(slot>=0){s.board[slot]=makeCell(s,config,bonus.type);changed.push(slot);}
  }
  if(tutorial)s.tutorialStep++;
  return event(s,true,`합성 ${a.type} + ${b.type} → ${next} · 인접 상자의 바깥 덮개 해제`,changed);
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
 else s.queue.push({type:r.type,count:r.count});
}
function grantExperience(s,amount,config){
 s.xp+=amount;
 for(let guard=0;guard<config.levels.length;guard++){
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
export function playAction(s,action,value,config){
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
 if(action==='open-energy'){if(s.modal)return event(s,false,'열린 창을 먼저 닫으세요.');s.modal='energy';s.offer=null;return event(s,true,'충전창 · 현재 에너지와 무료 잔여 여부를 사용합니다.');}
 if(action==='close-energy'){if(s.modal!=='energy')return event(s,false,'닫을 충전창이 없습니다.');s.offer=eligibleTrace(s,config);s.modal=s.offer.chosen?'offer':null;return event(s,true,s.offer.chosen?'충전창을 구매 없이 닫아 후속 후보를 선택했습니다.':'충전창 닫기 · 적격 후속 후보 없음');}
 if(action==='buy-energy'){if(s.modal!=='energy')return event(s,false,'충전창에서 구매하세요.');const r=buyEnergy(s.wallet);if(r.ok){s.modal=null;s.offer=null;}return event(s,r.ok,r.message);}
 if(action==='close-offer'||action==='close-shop'){if(s.modal!==(action==='close-offer'?'offer':'shop'))return event(s,false,'해당 창이 열려 있지 않습니다.');s.modal=null;s.offer=null;return event(s,true,'창을 닫았습니다. 실제 결제는 수행하지 않았습니다.');}
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
 if(s.modal)return event(s,false,'열린 창을 먼저 닫으세요.');
 if(s.stage==='title')return event(s,false,'먼저 실험을 시작하세요.');
 if(['cell','generate','deliver','sell','queue','move','collect','confirm-tool','cancel-tool','aid-special','aid-bubble','buy-bubble','skip-tutorial'].includes(action)&&s.stage!=='play')return event(s,false,'퍼즐 화면에서 조작하세요.');
 if(['quest-start','quest-finish'].includes(action)&&s.stage!=='home')return event(s,false,'맵 화면에서 퀘스트를 진행하세요.');
 if(action==='confirm-tool')return confirmTool(s,config);
 if(action==='cancel-tool'){if(!s.toolPending)return event(s,false,'취소할 도구 사용이 없습니다.');s.toolPending=null;return event(s,true,'도구 사용 취소 · 아이템을 유지합니다.');}
 if(action==='skip-tutorial'){
  if(!Array.isArray(config.tutorialSteps))return event(s,false,'선언된 튜토리얼 단계가 없습니다.');
  s.tutorialStep=config.tutorialSteps.length;s.selected=null;return event(s,true,'연구 조작: 튜토리얼 안내를 건너뛰었습니다. 원작 진행 기록과 무관합니다.');
 }
 if(action==='collect')return collectFrom(s,value===null||value===undefined||value===''?s.selected:Number(value),config);
 if(action==='move'){
  if(typeof value!=='string'||!/^\d{1,2},\d{1,2}$/.test(value))return event(s,false,'출발 칸과 도착 칸을 지정하세요.');
  const [from,to]=value.split(',').map(Number),result=moveOrMerge(s,from,to,config);s.selected=null;return result;
 }
 if(action==='aid-special'){
  const type=String(value),kind=specialFor(config,type);
  if(!itemFor(config,type)||!kind&&!collectableFor(config,type))return event(s,false,'규칙이 확인된 특수 아이템 타입만 연구 배치할 수 있습니다.');
  const queued=s.queue.find(r=>r.type===type);
  if(queued?queued.count>=100000:s.queue.length>=1000)return event(s,false,'연구 대기열의 저장 범위에 도달했습니다.');
  if(queued)queued.count++;else s.queue.push({type,count:1});
  return event(s,true,`연구 보조: ${type} 한 개를 대기열에 추가했습니다. 원작 획득·보상 시점이 아닙니다.`);
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
  if(s.wallet.time>=b.expiresAt)return event(s,false,'만료된 버블입니다. 시간 갱신 후 확인하세요.');
  if(s.wallet.gems<b.price)return event(s,false,`버블 구매에 젬 ${b.price}개 필요 · 부족 ${b.price-s.wallet.gems}개`);
  s.wallet.gems-=b.price;replaceCell(s,index,b.innerType,config);
  return event(s,true,`버블 구매 · 젬 −${b.price} · ${b.innerType} 해제. 라이브 세일·튜토리얼 가격은 미적용`,[index]);
 }
 if(action==='cell'){
  const index=Number(value);if(!integer(index,62))return event(s,false,'유효한 보드 칸을 선택하세요.');
  if(s.selected===null){if(!s.board[index])return event(s,false,'아이템이 있는 칸을 먼저 선택하세요.');s.selected=index;return event(s,true,`${itemFor(config,s.board[index].type)?.name||s.board[index].type} 선택`);}
  if(s.selected===index){
   if(bubbleFor(s,s.board[index]))return event(s,false,'버블 구매 버튼을 누르거나 만료를 기다리세요.');
   if(collectableFor(config,s.board[index]?.type))return collectFrom(s,index,config);
   if(generatorFor(config,s.board[index]))return generateFrom(s,index,config);s.selected=null;return event(s,true,'선택 해제');
  }
  const from=s.selected,same=s.board[from]?.type===s.board[index]?.type;
  if(generatorFor(config,s.board[from])&&s.board[index]&&!same&&!s.board[index].cover){s.selected=index;return event(s,true,'아이템 선택 변경');}
  const r=moveOrMerge(s,from,index,config);s.selected=null;return r;
 }
 if(action==='generate')return generateFrom(s,s.selected,config);
 if(action==='deliver')return deliverFixedOrder(s,config);
 if(action==='sell'){
  const cell=s.selected===null?null:s.board[s.selected];if(!cell||cell.cover||bubbleFor(s,cell))return event(s,false,'이동 가능한 아이템을 먼저 선택하세요.');
  const price=itemFor(config,cell.type).sellingPrice;
  if(!price)return event(s,false,'이 아이템은 판매가0으로 선언되어 있습니다.');
  delete s.generatorState[cell.uid];s.board[s.selected]=null;s.selected=null;s.wallet.coins+=price;return event(s,true,`내장 기본 판매가 · 골드 +${price}`);
 }
 if(action==='quest-start'){
  const q=config.quests[s.questsDone];if(!q)return event(s,false,'선정한 첫15개 퀘스트를 완료했습니다.');
  if(s.pendingQuest)return event(s,false,'진행 중인 퀘스트 연출을 먼저 완료하세요.');
  if(s.wallet.coins<q.cost)return event(s,false,`골드 ${q.cost}개 필요 · 현재 ${s.wallet.coins}개`);
  s.pendingQuest={id:q.id,cost:q.cost};return event(s,true,'연출 시작 · 아직 골드를 소비하지 않았습니다. 연출 완료로 확정하세요.');
 }
 if(action==='quest-finish')return finishQuest(s,config);
 if(action==='queue'){
  const slot=s.board.findIndex(x=>x===null);if(slot<0)return event(s,false,'보드가 가득 찼습니다.');
  const index=s.queue.findIndex(r=>itemFor(config,r.type));if(index<0)return event(s,false,'대기열에 이번 범위에서 배치할 타입이 없습니다. 미확인 상자 내용은 생성하지 않습니다.');
  const r=s.queue[index];s.board[slot]=makeCell(s,config,r.type);if(--r.count===0)s.queue.splice(index,1);
  return event(s,true,'연구 대기열에서 지원 타입1개 배치. 미지원 상자는 그대로 보관합니다.',[slot]);
 }
 return event(s,false,'지원하지 않는 실험 동작입니다.');
}
export function validPlay(s,config){
 try{
  if(!s||s.schema!==1||!['title','play','home'].includes(s.stage)||!['open','initial'].includes(s.scenario)||!Array.isArray(s.board)||s.board.length!==63)return false;
  const types=new Set(config.items.map(x=>x.type)),uids=new Set();
  for(const c of s.board)if(c){
   if(!integer(c.uid)||!c.uid||uids.has(c.uid)||!types.has(c.type)||![null,'box','web'].includes(c.cover))return false;
   if(c.uses!==undefined&&(specialFor(config,c.type)!=='scissors'||!integer(c.uses)||c.uses===0))return false;
   uids.add(c.uid);
  }
  if(!integer(s.nextUid)||[...uids].some(uid=>uid>=s.nextUid)||!integer(s.rng,4294967295)||s.rng===0)return false;
  if(s.selected!==null&&(!integer(s.selected,62)||!s.board[s.selected]))return false;
  if(!integer(s.orderIndex,config.orders.length)||!integer(s.questsDone,config.quests.length)||!integer(s.xp)||!integer(s.chainStep,6)||typeof s.chainActive!=='boolean')return false;
  if(![null,'energy','offer','shop'].includes(s.modal)||!Array.isArray(s.log)||s.log.length>60||!Array.isArray(s.queue)||s.queue.length>1000||!Array.isArray(s.chainRewards)||s.chainRewards.length>2)return false;
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
    if(!cell||uid!==String(cell.uid)||cell.cover||!record(b)||Object.keys(b).length!==3||!['expiresAt','price','innerType'].every(k=>Object.hasOwn(b,k)))return false;
    if(b.innerType!==cell.type||!integer(b.price)||!integer(b.expiresAt)||b.expiresAt<s.wallet.time||!bubble)return false;
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
  for(const [type,pool]of Object.entries(s.pools)){const g=itemFor(config,type)?.generator;if(!g||!Array.isArray(pool)||pool.length!==g.pool.length||pool.some((v,i)=>!integer(v,g.pool[i].weight)))return false;}
  for(const [uid,r]of Object.entries(s.generatorState)){
   const cell=s.board.find(c=>c?.uid===Number(uid)),g=generatorFor(config,cell);
   // A partly skipped timer can precede simulated time zero; live source uses
   // absolute server timestamps, whereas this portable clock starts at zero.
   if(!g||bubbleFor(s,cell)||!integer(r.charges,g.batch)||!integer(r.storage,g.storage)||!(r.timerStart===null||Number.isSafeInteger(r.timerStart)&&r.timerStart>=-1e9)||!integer(r.readyAt))return false;
   if(r.timerStart===null){if(r.charges!==g.batch||r.storage===0||r.readyAt!==0)return false;}
   else if(r.timerStart>s.wallet.time||r.readyAt!==r.timerStart+(r.storage===0?g.storageRecoverySeconds:g.cooldownSeconds)||(r.storage>0&&r.charges===g.batch))return false;
  }
  for(const c of s.board)if(generatorFor(config,c)&&!bubbleFor(s,c)&&!s.generatorState[c.uid])return false;
  return s.queue.every(r=>typeof r.type==='string'&&r.type.length<100&&integer(r.count,100000)&&r.count>0);
 }catch{return false;}
}
export {energyCost};
