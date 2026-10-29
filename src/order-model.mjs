// Packaged-default order projection. No network/payment, original RNG or live
// activity creators. Source declarations and limits: order-parity.json.
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const normalSlots=[1,2,3,4,5,8];
const maxResearchNumber=1e9;
const validNumber=n=>Number.isSafeInteger(n)&&n>=0&&n<=maxResearchNumber;
const cache=new WeakMap();
function indexed(config){
 const rules=config.orderRules;
 if(!rules)return null;
 if(!cache.has(rules))cache.set(rules,{rules,items:new Map(rules.itemConfig.map(r=>[r.Code,r])),
  fixed:new Map(rules.fixed.map(r=>[r.id,r])),random:new Map(rules.random.map(r=>[r.Type,r]))});
 return cache.get(rules);
}
const identity=(ctx,type)=>ctx.rules.identities[type];
const codes=order=>order.requirements.flatMap(r=>typeof r==='string'?[r]:Array(r.count).fill(r.type));
const compress=list=>[...new Set(list)].map(type=>({type,count:list.filter(t=>t===type).length}));
const allOrders=s=>s.orders?.slots||[];
const bySlot=(s,slot)=>allOrders(s).find(o=>o.slot===slot);
const usable=(s,cell)=>cell&&!cell.cover&&!s.bubbles?.[cell.uid];
const stored=s=>s.inventory?.items||[];

export function createOrderState({completedFixed=0}={}){
 const completed=validNumber(completedFixed)?completedFixed:0;
 return {schema:1,nextFixedId:completed+1,slots:[],timers:{},points:{},lastFinished:{},repeatWeights:{},
  totalDiffScore:0,nextDiffResetAt:null,nextRandomId:1,deliveredFixed:Array.from({length:completed},(_,i)=>i+1),
  unsupported:[],monthPay:0};
}
function ensure(s,ctx){
 if(!s.orders)s.orders=createOrderState({completedFixed:Math.min(ctx.rules.fixed.length,s.orderIndex||0)});
 s.itemUnlocks??={};
 for(const cell of [...s.board,...stored(s)])if(usable(s,cell))s.itemUnlocks[cell.type]=true;
 // Research clock phase is explicit. Live locale/server epoch is not inferred.
 const localTime=s.wallet.time+(ctx.rules.clock?.localOffsetSeconds||0);
 if(s.orders.nextDiffResetAt==null||localTime>=s.orders.nextDiffResetAt){
  s.orders.totalDiffScore=0;
  s.orders.nextDiffResetAt=Math.floor((localTime-7200)/86400+1)*86400+7200;
 }
}
function random(s){let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function weighted(s,list){
 const pool=list.filter(x=>Number.isFinite(x.weight)&&x.weight>0);
 const total=pool.reduce((a,x)=>a+x.weight,0);if(!total)return null;
 let choice=random(s)*total;
 for(const entry of pool){if(choice<entry.weight)return entry.value;choice-=entry.weight;}
 return pool.at(-1).value;
}
export function orderStock(s){
 const stock={};
 for(const cell of [...s.board,...stored(s)])if(usable(s,cell))stock[cell.type]=(stock[cell.type]||0)+1;
 return stock;
}
function requiredCounts(s,selected=[]){
 const required={};
 for(const code of [...allOrders(s).flatMap(codes),...selected])required[code]=(required[code]||0)+1;
 return required;
}
function available(s,slot,selected,ctx){
 const stock=orderStock(s),required=requiredCounts(s,selected),chainInfo={};
 for(const row of ctx.items.values())if(row.WeightMultiple===1){
  const item=identity(ctx,row.Code);if(!item)continue;
  const info=chainInfo[item.chainId]??={required:false,lack:false,minStock:null};
  if(required[row.Code]){info.required=true;if(required[row.Code]>(stock[row.Code]||0))info.lack=true;}
  if(stock[row.Code])info.minStock=info.minStock===null?item.chainLevel:Math.min(info.minStock,item.chainLevel);
 }
 const last=s.orders.lastFinished[slot]||[],result=[];
 for(const row of ctx.items.values()){
  const item=identity(ctx,row.Code);if(!item)continue;
  if(s.wallet.level<row.UnlockLevel||row.Weight<=0||row.ForbiddenSlot?.includes(slot)||required[row.Code]||last.includes(row.Code))continue;
  if(row.ProgressUnlock===1){
   const previous=Object.keys(ctx.rules.identities).find(t=>identity(ctx,t).chainId===item.chainId&&identity(ctx,t).chainLevel===item.chainLevel-1);
   if(item.chainLevel<=1||!previous||!s.itemUnlocks[previous])continue;
  }
  if(!ctx.rules.chainGenerators[item.chainId]?.some(t=>s.itemUnlocks[t]))continue;
  const info=chainInfo[item.chainId];let multiple=1;
  if(info?.required){if(!info.lack)multiple=100;}
  else if(info){
   multiple=1000;
   if(info.minStock!==null&&item.chainLevel>=info.minStock){
    multiple=10000;
    if(ctx.rules.flags?.orderDiffDynamic){
     let lowerPresent=0;
     for(const [type,count]of Object.entries(stock))if(count&&identity(ctx,type)?.chainId===item.chainId&&identity(ctx,type).chainLevel>=info.minStock&&identity(ctx,type).chainLevel<item.chainLevel)lowerPresent++;
     multiple*=10**lowerPresent;
    }
   }
  }
  result.push({type:row.Code,weight:row.Weight*multiple});
 }
 return result;
}
const difficulty=(ctx,type)=>ctx.items.get(type)?.DifficultyLevel??identity(ctx,type).chainLevel;
function dynamicLimits(s,candidates,min,max,dynamic,selected,ctx){
 const result={level:max,chains:[]};
 if(dynamic==null||max==null||dynamic<=max)return result;
 const stock=orderStock(s),required=requiredCounts(s,selected);let highest=0,items=[];
 for(const [type,count]of Object.entries(stock)){
  if(!count||!ctx.items.has(type))continue;
  const level=difficulty(ctx,type),item=identity(ctx,type);
  if(level<max||level>=dynamic||level<highest)continue;
  const usableStock=Object.entries(required).every(([r,n])=>identity(ctx,r)?.chainId!==item.chainId||identity(ctx,r).chainLevel<item.chainLevel||(stock[r]||0)>n);
  if(!usableStock)continue;
  if(level>highest){highest=level;items=[type];}else items.push(type);
 }
 for(const type of items){
  const item=identity(ctx,type);
  const next=Object.keys(ctx.rules.identities).find(t=>identity(ctx,t).chainId===item.chainId&&identity(ctx,t).chainLevel===item.chainLevel+1)||type;
  const candidate=candidates.find(c=>c.type===next);
  if(candidate){candidate.weight*=50;result.chains.push(item.chainId);}
 }
 if(result.chains.length)result.level=highest+1;
 return result;
}
function filterFor(s,config){
 const level=s.wallet.level,diff=s.orders.totalDiffScore,pay=s.orders.monthPay||0;
 return config.Filters.find(f=>(f.PlayerMin==null||level>=f.PlayerMin)&&(f.PlayerMax==null||level<=f.PlayerMax)&&
  (f.DiffSumMin==null||diff>=f.DiffSumMin)&&(f.DiffSumMax==null||diff<=f.DiffSumMax)&&
  (f.sMonthPay==null||pay>=f.sMonthPay)&&(f.eMonthPay==null||pay<=f.eMonthPay));
}
function chooseRequirements(s,slot,config,ctx){
 const filter=filterFor(s,config);if(!filter)return null;
 const selected=[],repeatFlags={};
 for(const prefix of ['First','Second','Third']){
  const min=filter[prefix+'Min'],max=filter[prefix+'Max'];
  let candidates=available(s,slot,selected,ctx);
  const limits=dynamicLimits(s,candidates,min,max,filter['Dynamic'+prefix+'Max'],selected,ctx);
  candidates=candidates.filter(c=>{
   const level=difficulty(ctx,c.type),upper=limits.chains.includes(identity(ctx,c.type).chainId)?limits.level:max;
   return (min==null||level>=min)&&(upper==null||level<=upper);
  });
  for(const candidate of candidates){
   const row=ctx.items.get(candidate.type),chain=identity(ctx,candidate.type).chainId;
   if(own(s.orders.repeatWeights,chain)&&row.RepeatWeightDecrease!==undefined){candidate.weight/=row.RepeatWeightDecrease;repeatFlags[chain]=true;}
  }
  const type=weighted(s,candidates.map(c=>({value:c.type,weight:c.weight})));if(!type)break;
  selected.push(type);
  const chain=identity(ctx,type).chainId;
  if(own(s.orders.repeatWeights,chain)&&ctx.items.get(type).RepeatWeightDecrease!==undefined)repeatFlags[chain]=false;
 }
 if(!selected.length)return null;
 let weights=config.ItemAmounts;
 if(!weights||!['OneItemWeight','TwoItemsWeight','ThreeItemsWeight'].some(k=>weights[k]!==undefined))
  weights=ctx.rules.itemNumberWeights.filter(r=>s.wallet.level>=r.Level).at(-1);
 if(!weights)return null;
 const count=weighted(s,selected.map((_,i)=>({value:i+1,weight:weights[['OneItemWeight','TwoItemsWeight','ThreeItemsWeight'][i]]||0})));
 if(!count)return null;
 for(const [chain,flag]of Object.entries(repeatFlags)){
  if(!flag)s.orders.repeatWeights[chain]=3;
  else if(s.orders.repeatWeights[chain]>1)s.orders.repeatWeights[chain]--;
  else delete s.orders.repeatWeights[chain];
 }
 return selected.slice(0,count);
}
function pointGate(s,type,config){
 const o=s.orders,now=s.wallet.time,timer=o.timers[type];
 // Source nil/zero timestamps are represented as explicit phases so t=0 is valid.
 if(!timer||(timer.phase==='cooldown'&&now-timer.startedAt>=config.RefreshTime)){
  const active=type===1?o.slots.filter(x=>x.innerType===1).length:0;
  o.points[type]=(config.Point??1)-active;o.timers[type]={phase:'ready',startedAt:null};
 }
 const current=o.timers[type];
 if(current.phase==='cooldown')return false;
 if(type!==1&&!own(o.points,type))o.points[type]=config.Point??1;
 if(!(o.points[type]>0)){o.timers[type]={phase:'cooldown',startedAt:now};return false;}
 o.points[type]--;return true;
}
function randomCanCreate(s,slot,config){
 if(s.wallet.level<config.UnlockLevel)return false;
 if(config.Type===2){
  const other=allOrders(s).some(o=>o.slot!==18&&![5,21].includes(o.innerType));
  if(!other){s.orders.timers[2]={phase:'ready',startedAt:null};return true;}
 }
 return pointGate(s,config.Type,config);
}
function makeOrder(s,slot,requirements,kind,id,innerType,ctx){
 if(requirements.some(type=>!ctx.items.has(type)))return null;
 return {slot,id,kind,innerType,requirements:compress(requirements),
  coins:requirements.reduce((n,t)=>n+ctx.items.get(t).Price,0),
  diffScore:requirements.reduce((n,t)=>n+(ctx.items.get(t).DiffScore||0),0),createdAt:s.wallet.time};
}

export function reconcileOrders(s,config){
 const ctx=indexed(config);if(!ctx)return {ok:false,message:'주문 설정이 없습니다.',created:[]};
 ensure(s,ctx);const created=[];s.orders.unsupported=[];
 let filled;
 do{
  filled=false;
  for(let slot=1;slot<=(ctx.rules.slotCount||19);slot++){
   if(bySlot(s,slot))continue;
   const next=ctx.fixed.get(s.orders.nextFixedId);let order=null;
   if(next&&next.slots.includes(slot)&&s.wallet.level>=next.unlockLevel){
    order=makeOrder(s,slot,next.requirements,'fixed',next.id,0,ctx);
    if(order)s.orders.nextFixedId++;
   }
   if(!order&&s.orders.activeCreators?.[slot]){
    s.orders.unsupported.push({slot,creator:s.orders.activeCreators[slot],reason:'활성 creator가 지원 범위 밖이므로 랜덤 fallback을 차단했습니다.'});continue;
   }
   if(!order){
    const type=ctx.rules.supportedTypes.find(t=>ctx.rules.typeSlots[t]?.includes(slot));
    const rule=ctx.random.get(type);
    if(rule&&randomCanCreate(s,slot,rule)){
     const requirements=chooseRequirements(s,slot,rule,ctx);
     if(requirements){order=makeOrder(s,slot,requirements,'random','random:'+s.orders.nextRandomId,rule.Type,ctx);if(order)s.orders.nextRandomId++;}
    }
   }
   if(order){s.orders.slots.push(order);created.push(order);filled=true;}
  }
 }while(filled);
 s.orders.slots.sort((a,b)=>a.slot-b.slot);
 return {ok:true,message:`주문 ${s.orders.slots.length}개 · 새 주문 ${created.length}개`,created};
}

export function orderStatus(s,slot,config){
 const order=bySlot(s,slot);if(!order)return {canDeliver:false,missing:[],message:'해당 슬롯의 주문이 없습니다.'};
 const stock=orderStock(s),missing=order.requirements.map(r=>({type:r.type,count:Math.max(0,r.count-(stock[r.type]||0))})).filter(r=>r.count);
 return {canDeliver:!missing.length,missing,requirements:order.requirements,coins:order.coins,order};
}
export function submitOrder(s,slot,config){
 const ctx=indexed(config),order=bySlot(s,slot);
 if(!ctx||!order)return {ok:false,message:'납품할 주문이 없습니다.',cells:[]};
 const requirements=codes(order);
 if(!requirements.length||requirements.some(t=>!ctx.items.has(t)))return {ok:false,message:'주문 요구 설정이 유효하지 않습니다.',cells:[]};
 const boardIndices=[],inventoryIndices=[],usedBoard=new Set(),usedInventory=new Set();
 for(const type of requirements){
  const boardIndex=s.board.findIndex((c,i)=>!usedBoard.has(i)&&usable(s,c)&&c.type===type);
  if(boardIndex>=0){usedBoard.add(boardIndex);boardIndices.push(boardIndex);continue;}
  const storeIndex=stored(s).findIndex((c,i)=>!usedInventory.has(i)&&usable(s,c)&&c.type===type);
  if(storeIndex<0)return {ok:false,message:`아이템 ${type}가 부족합니다. 보드·보관함의 열린 아이템을 확인하세요.`,cells:[]};
  usedInventory.add(storeIndex);inventoryIndices.push(storeIndex);
 }
 const price=requirements.reduce((n,t)=>n+ctx.items.get(t).Price,0);
 const multiplier=ctx.rules.flags?.goldMultiplier??1;
 const coins=Math.ceil(price*multiplier);
 if(!Number.isFinite(multiplier)||multiplier<0||!validNumber(coins)||!validNumber(s.wallet.coins+coins))
  return {ok:false,message:'주문 보상 값이 연구 저장 범위를 벗어납니다.',cells:[]};
 // Validate every requirement before deleting cells or awarding currency.
 const cleanup=cell=>{if(s.generatorState)delete s.generatorState[cell.uid];if(s.bubbles)delete s.bubbles[cell.uid];};
 for(const index of boardIndices){cleanup(s.board[index]);s.board[index]=null;if(s.selected===index)s.selected=null;}
 for(const index of inventoryIndices.sort((a,b)=>b-a))cleanup(stored(s).splice(index,1)[0]);
 s.wallet.coins+=coins;s.wallet.orders=(s.wallet.orders||0)+1;
 if(normalSlots.includes(slot))s.orders.totalDiffScore+=requirements.reduce((n,t)=>n+(ctx.items.get(t).DiffScore||0),0);
 for(const type of requirements)if(ctx.items.get(type).RepeatWeightDecrease>0)s.orders.repeatWeights[identity(ctx,type).chainId]=3;
 s.orders.lastFinished[slot]=requirements;
 s.orders.slots=s.orders.slots.filter(o=>o.slot!==slot);
 if(order.kind==='fixed'&&!s.orders.deliveredFixed.includes(order.id))s.orders.deliveredFixed.push(order.id);
 s.orderIndex=s.orders.deliveredFixed.length;
 const refill=reconcileOrders(s,config);
 return {ok:true,message:`${order.kind==='fixed'?'고정':'랜덤'} 주문 ${order.id} 완료 · 골드 +${coins}`,cells:boardIndices,
  removedInventory:inventoryIndices.length,coins,order,created:refill.created};
}

export function validOrderState(s,config){
 // Old saves have no parallel-order state; migration happens before reconcile.
 if(s.orders===undefined)return true;
 const ctx=indexed(config),o=s.orders;
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
 const positive=n=>validNumber(n)&&n>0;
 if(!ctx||!record(o)||o.schema!==1||!positive(o.nextFixedId)||o.nextFixedId>Math.max(0,...ctx.fixed.keys())+1||
  !positive(o.nextRandomId)||!Array.isArray(o.slots)||o.slots.length>(ctx.rules.slotCount||19)||
  !record(o.timers)||!record(o.points)||!record(o.lastFinished)||!record(o.repeatWeights)||
  !validNumber(o.totalDiffScore)||!(o.nextDiffResetAt===null||validNumber(o.nextDiffResetAt))||
  !Array.isArray(o.deliveredFixed)||!Array.isArray(o.unsupported)||o.unsupported.length>(ctx.rules.slotCount||19)||
  !Number.isInteger(s.rng)||s.rng<=0||s.rng>4294967295)return false;
 if(o.monthPay!==undefined&&(!Number.isFinite(o.monthPay)||o.monthPay<0||o.monthPay>maxResearchNumber))return false;
 if(s.itemUnlocks!==undefined&&(!record(s.itemUnlocks)||Object.entries(s.itemUnlocks).some(([type,value])=>!identity(ctx,type)||value!==true)))return false;
 const seenSlots=new Set(),fixedIds=new Set(),randomIds=new Set();
 for(const order of o.slots){
  if(!record(order)||!positive(order.slot)||order.slot>(ctx.rules.slotCount||19)||seenSlots.has(order.slot)||
   !Array.isArray(order.requirements)||!order.requirements.length||order.requirements.length>3||
   !validNumber(order.createdAt)||order.createdAt>s.wallet.time||!validNumber(order.coins)||!validNumber(order.diffScore))return false;
  seenSlots.add(order.slot);const seenTypes=new Set();let quantity=0;
  for(const req of order.requirements){
   if(!record(req)||!ctx.items.has(req.type)||!positive(req.count)||req.count>3||seenTypes.has(req.type))return false;
   quantity+=req.count;seenTypes.add(req.type);
  }
  if(quantity>3)return false;
  const list=codes(order),price=list.reduce((n,t)=>n+ctx.items.get(t).Price,0),diff=list.reduce((n,t)=>n+(ctx.items.get(t).DiffScore||0),0);
  if(order.coins!==price||order.diffScore!==diff)return false;
  if(order.kind==='fixed'){
   const row=ctx.fixed.get(order.id);
   if(!row||order.innerType!==0||!row.slots.includes(order.slot)||s.wallet.level<row.unlockLevel||
    order.id>=o.nextFixedId||fixedIds.has(order.id)||JSON.stringify(order.requirements)!==JSON.stringify(compress(row.requirements)))return false;
   fixedIds.add(order.id);
  }else if(order.kind==='random'){
   const row=ctx.random.get(order.innerType),match=typeof order.id==='string'&&/^random:([1-9]\d*)$/.exec(order.id);
   if(!row||!ctx.rules.supportedTypes.includes(order.innerType)||!ctx.rules.typeSlots[order.innerType]?.includes(order.slot)||
    s.wallet.level<row.UnlockLevel||!match||Number(match[1])>=o.nextRandomId||randomIds.has(order.id)||
    order.requirements.some(r=>r.count!==1||s.wallet.level<ctx.items.get(r.type).UnlockLevel||ctx.items.get(r.type).Weight<=0||ctx.items.get(r.type).ForbiddenSlot?.includes(order.slot)))return false;
   randomIds.add(order.id);
  }else return false;
 }
 const completed=new Set();
 for(const id of o.deliveredFixed){if(!ctx.fixed.has(id)||id>=o.nextFixedId||completed.has(id)||fixedIds.has(id))return false;completed.add(id);}
 for(const id of ctx.fixed.keys())if(id<o.nextFixedId&&!completed.has(id)&&!fixedIds.has(id))return false;
 for(const [key,timer]of Object.entries(o.timers))if(String(Number(key))!==key||!ctx.rules.supportedTypes.includes(Number(key))||!record(timer)||
  !['ready','cooldown'].includes(timer.phase)||(timer.phase==='ready'?timer.startedAt!==null:!validNumber(timer.startedAt)||timer.startedAt>s.wallet.time))return false;
 for(const [key,points]of Object.entries(o.points))if(String(Number(key))!==key||!ctx.random.has(Number(key))||!validNumber(points)||points>(ctx.random.get(Number(key)).Point??1))return false;
 const repeatChains=new Set([...ctx.items.values()].filter(r=>r.RepeatWeightDecrease>0).map(r=>identity(ctx,r.Code)?.chainId));
 for(const [chain,count]of Object.entries(o.repeatWeights))if(!repeatChains.has(chain)||!positive(count)||count>3)return false;
 for(const [slot,last]of Object.entries(o.lastFinished))if(!positive(Number(slot))||Number(slot)>(ctx.rules.slotCount||19)||
  !Array.isArray(last)||!last.length||last.length>3||last.some(t=>!ctx.items.has(t)))return false;
 if(o.activeCreators!==undefined&&(!record(o.activeCreators)||Object.entries(o.activeCreators).some(([slot,creator])=>
  !positive(Number(slot))||Number(slot)>(ctx.rules.slotCount||19)||!ctx.rules.unsupportedCreators?.includes(creator))))return false;
 return o.unsupported.every(row=>record(row)&&positive(row.slot)&&row.slot<=(ctx.rules.slotCount||19)&&
  typeof row.creator==='string'&&row.creator.length<120&&typeof row.reason==='string'&&row.reason.length<300);
}
