// Selected APK shop/offer/activity paths. No network, SDK, ad or IAP execution.
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const integer=(v,max=1e9)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const nullable=v=>v===null||integer(v);
const money=v=>v===null||Number.isFinite(v)&&v>=0&&v<=1e9;
const rows=v=>Array.isArray(v)?v:[];
const now=s=>s.wallet.time;
const day=t=>Math.floor(t/86400);
const nextDay=t=>(day(t)+1)*86400;
const rule=c=>c?.commerceRules?.rules||c?.commerceRules||c?.rules;
const item=(c,type)=>rows(c.items).find(x=>x.type===type);
const result=(ok,message,extra={})=>({ok,message,...extra});
const walletKey=type=>({gem:'gems',gold:'coins',coin:'coins',energy:'energy'})[type];
const ENERGY_FIELDS=['groupDuration','groupCD','giftDuration','triggerEnergyPrice','dailyTriggerUpper','poptype'];
const emptyEnergy=()=>({state:'None',groupEnd:0,cooldownEnd:0,itemEnd:0,left:0,triggerCount:0,triggerDay:0,rawSignature:null});
const inputDefaults=()=>({dailyVariant:'base',flashRefreshHours:null,flashMode:null,specialOrderChains:[],allGiftSwitch:null,strongTutorial:false,chainEnergy:false,paymentHistory:'unknown',
 energyGift:{enabled:false,groupDuration:null,groupCD:null,giftDuration:null,triggerEnergyPrice:null,dailyTriggerUpper:null,poptype:null},
 candidates:{invite:false,gemOffer:false,plenty:false,chain:false,weekly:false,chainPrice:null,weeklyPrice:null,chainHasNextPayId:true},
 more:{threshold:null,cooldownMinutes:null,nextChainPrice:null,canShowAfterClose:true,popupForLackingEnergy:true,hasServerTime:true},
 levelGift:{enabled:false,levels:[],duration:null},
 activity:{enabled:false,kind:'pass',sLv:null,sTime:null,eTime:null,rTime:null,resourcesReady:true}});

function random(s,hooks){
 const value=hooks?.random?.();
 if(Number.isFinite(value)&&value>=0&&value<1)return value;
 let x=s.commerce.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.commerce.rng=x>>>0||1;
 return s.commerce.rng/4294967296;
}
function weighted(s,list,field,hooks){
 const total=list.reduce((n,x)=>n+Math.max(0,Number(x[field])||0),0);
 if(!total)return null;
 let n=random(s,hooks)*total;
 for(const x of list){n-=Math.max(0,Number(x[field])||0);if(n<0)return x;}
 return list.at(-1)||null;
}
function createCommerce(s){return {schema:1,tab:'item',rng:18031,unlockedTypes:{},daily:{refreshedAt:null,nextAt:null,rows:[]},flash:{refreshedAt:null,nextAt:null,rows:[],unsupported:false},
 inputs:inputDefaults(),energy:emptyEnergy(),levelGift:{lastLevel:s.wallet.level,offer:null},
 activity:{tokens:0,ticketAssumed:false,claims:[],ownedCards:[],duplicateCards:0,metrics:{},passRows:[],taskTarget:'customer',taskCount:2,taskTokens:1,taskProgress:0},
 detail:null,lastRoute:null,lastGenerationCost:1,lastStrongTutorial:false,moreNextAt:0,message:'서버 상품은 미입력 상태입니다. 내장 상점과 연구 가정을 구분합니다.'};}
function rememberUnlocks(s,c){
 const target=s.commerce.unlockedTypes;
 for(const [type,unlocked]of Object.entries(s.itemUnlocks||{}))if(unlocked===true&&rule(c).chainInfo[type])target[type]=true;
 for(const cell of [...rows(s.board),...rows(s.inventory?.items)])if(cell&&!cell.cover&&!s.bubbles?.[cell.uid]&&rule(c).chainInfo[cell.type])target[cell.type]=true;
}
function dailyRows(s,c,hooks){
 const r=rule(c),variant=s.commerce.inputs.dailyVariant;
 const configs=variant==='random'?r.daily.randomVariant:r.daily.base;
 const groups=new Map();
 for(const x of configs){if(!groups.has(x.id))groups.set(x.id,[]);groups.get(x.id).push(x);}
 const album=activityState(s,c).effective==='Started'&&s.commerce.inputs.activity.kind==='album';
 return [...groups.entries()].sort((a,b)=>a[0]-b[0]).flatMap(([id,list])=>{
  const available=list.map(x=>({...x,pickWeight:!album&&r.daily.cacheProperties.includes(x.itemCode)?0:x.weight}));
  const row=weighted(s,available,'pickWeight',hooks);
  return row?[{id:'daily-'+id,slot:id,variant,type:row.itemCode,left:row.leftCount,initial:row.leftCount,cost:row.costCount,baseCost:row.costCount,currency:row.costType,increase:row.costIncreasement||0,bought:0,adDeclared:row.ad===1}]:[];
 });
}
function orderCodes(order){return rows(order.requirements).flatMap(x=>typeof x==='string'?[x]:Array.from({length:Math.max(0,Math.min(1000,x.count||0))},()=>x.type));}
function shopStock(s){
 const counts={};
 // GetCodeCountMap(true,false,true): board + store, not reward queue.
 // Wrapped codes are not their inner ordinary Type.
 for(const cell of [...rows(s.board),...rows(s.inventory?.items)])if(cell&&!cell.cover&&!s.bubbles?.[cell.uid])counts[cell.type]=(counts[cell.type]||0)+1;
 return counts;
}
export function flashSelectionContext(s,c,previous=[]){
 const r=rule(c),mode=s.commerce.inputs.flashMode,stock=shopStock(s),orders=rows(s.orders?.slots),info=r.chainInfo;
 const props=new Map(r.flash.items.map(x=>[x.Type,x]));
 const byLevel=new Map(Object.entries(info).map(([type,x])=>[x.chainId+':'+x.chainLevel,type]));
 const coefficients={missingChain:10,targetCode:50,lowerCode:10,unboughtChain:0.33333,unboughtCode:0.33333,...r.flash.weightCoefficients};
 const missing=new Set(),missingByChain={},chainMultipliers={},codeMultipliers={},unbought={},bought={},unknown=[];
 const preferred=new Set();
 for(const order of orders){
  const codes=orderCodes(order);
  for(const type of codes)if(!info[type])unknown.push(type);else if(!stock[type]){missing.add(type);(missingByChain[info[type].chainId]??=new Set()).add(type);}
  if(![...(r.flash.normalOrderSlots||[1,2,3,4,5,8]),r.flash.timedOrderSlot??13].includes(order.slot))continue;
  let highest=null;const need={};
  for(const type of codes){need[type]=(need[type]||0)+1;if(info[type]&&need[type]>(stock[type]||0)&&(!highest||info[type].chainLevel>info[highest].chainLevel))highest=type;}
  if(highest)preferred.add(highest);
 }
 // Mode2 keeps the original missing Type and additionally inserts its nearest
 // lower purchasable Type when the original has no shop property declaration.
 for(const type of [...preferred])if(!props.has(type))for(let level=info[type].chainLevel-1;level>=1;level--){
  const lower=byLevel.get(info[type].chainId+':'+level);if(props.has(lower)){preferred.add(lower);break;}
 }
 if(mode===1){
  for(const row of previous){const prop=props.get(row.type);if(prop?.ShopCount===undefined||!info[row.type])continue;
   const chain=info[row.type].chainId,target=prop.ShopCount===row.left?unbought:bought;(target[chain]??=new Set()).add(row.type);
  }
  const availableChains=new Set(r.flash.items.map(x=>info[x.Type]?.chainId));
  for(const chain of Object.keys(missingByChain))if(availableChains.has(chain))chainMultipliers[chain]=coefficients.missingChain;
  for(const chain of Object.keys(unbought))if(!bought[chain])chainMultipliers[chain]=(chainMultipliers[chain]??1)*coefficients.unboughtChain;
  const setMax=(type,multiple)=>{if(type&&props.has(type))codeMultipliers[type]=Math.max(multiple,codeMultipliers[type]??multiple);};
  for(const type of missing){const x=info[type];if(chainMultipliers[x.chainId]===undefined)continue;
   setMax(type,coefficients.targetCode);
   for(let level=1;level<=x.chainLevel-2;level++)setMax(byLevel.get(x.chainId+':'+level),coefficients.lowerCode);
   for(let level=x.chainLevel-1;level<=x.chainLevel;level++)setMax(byLevel.get(x.chainId+':'+level),coefficients.targetCode);
  }
  for(const types of Object.values(unbought))for(const type of types)codeMultipliers[type]=(codeMultipliers[type]??1)*coefficients.unboughtCode;
  const special=new Set(r.flash.specialWeightChains||r.flash.items.filter(x=>x.IsSpecial===1).map(x=>info[x.Type]?.chainId));
  for(const chain of Object.keys(chainMultipliers))if(special.has(chain))chainMultipliers[chain]=1;
  for(const type of Object.keys(codeMultipliers))if(special.has(info[type].chainId))codeMultipliers[type]=1;
 }
 return {mode:mode??0,stock,missingCodes:[...missing],preferredMissing:[...preferred],unknownRequirements:[...new Set(unknown)],
  chainMultipliers,codeMultipliers,unbought:Object.fromEntries(Object.entries(unbought).map(([k,v])=>[k,[...v]])),
  bought:Object.fromEntries(Object.entries(bought).map(([k,v])=>[k,[...v]])),steps:[]};
}
function flashRows(s,c,hooks,manual=false){
 const r=rule(c),inputs=s.commerce.inputs,mode=inputs.flashMode,selected=new Set(),selectedPreferred=new Set(),max={};
 const context=flashSelectionContext(s,c,manual?s.commerce.flash.rows:[]),info=r.chainInfo;
 const byLevel=new Map(Object.entries(info).map(([type,x])=>[x.chainId+':'+x.chainLevel,type]));
 for(const [type,on]of Object.entries(s.commerce.unlockedTypes))if(on&&r.chainInfo[type]){
  const x=r.chainInfo[type];max[x.chainId]=Math.max(max[x.chainId]||0,x.chainLevel);
 }
 const candidatesFor=slot=>r.flash.items.filter(x=>!selected.has(x.Type)&&x.Slot.includes(slot)&&(x.MinLevel==null||s.wallet.level>=x.MinLevel)&&
   r.chainInfo[x.Type]&&r.chainInfo[x.Type].chainLevel<(max[r.chainInfo[x.Type].chainId]||0)&&
   (!r.flash.specialOrderChains.includes(r.chainInfo[x.Type].chainId)||inputs.specialOrderChains.includes(r.chainInfo[x.Type].chainId)))
  .map(x=>({...x,ShopWeight:mode!==2&&context.codeMultipliers[x.Type]!==undefined?Math.ceil(x.ShopWeight*context.codeMultipliers[x.Type]):x.ShopWeight}));
 const forSlot=slot=>{
  const candidates=candidatesFor(slot),key='Slot'+slot+'Weight';
  const groups=r.flash.slots.filter(x=>x[key]>0&&candidates.some(p=>(p.CustomChain||r.chainInfo[p.Type].chainId)===x.ChainId))
   .map(x=>({...x,[key]:slot!==6&&context.chainMultipliers[x.ChainId]!==undefined?Math.ceil(x[key]*context.chainMultipliers[x.ChainId]):x[key]}));
  const chain=weighted(s,groups,key,hooks);
  if(!chain)return null;
  return weighted(s,candidates.filter(p=>(p.CustomChain||r.chainInfo[p.Type].chainId)===chain.ChainId),'ShopWeight',hooks);
 };
 const output=[];
 const slotSequence=Array.from({length:r.flash.maxSlots},(_,i)=>i+1);if(mode===2)slotSequence.reverse();
 for(const slot of slotSequence){
  let row=null,kind='weighted',preferredType=null,previousLevelChosen=false;
  if(mode===2){
   const candidates=candidatesFor(slot);
   // _IsUnlockedItem indexes the actual ChainId, while valid pools may be
   // grouped by CustomChain. Preserve that distinction for preferred items.
   const isUnlocked=type=>candidates.some(x=>x.Type===type&&(x.CustomChain||info[type].chainId)===info[type].chainId);
   const preferred=context.preferredMissing.filter(type=>!selectedPreferred.has(type)&&isUnlocked(type));
   if(preferred.length){
    preferredType=preferred[Math.floor(random(s,hooks)*preferred.length)];selectedPreferred.add(preferredType);
    let selectedType=preferredType;const lower=byLevel.get(info[selectedType].chainId+':'+(info[selectedType].chainLevel-1));
    if(info[selectedType].chainLevel>=2&&!selected.has(lower)&&lower&&isUnlocked(lower)&&random(s,hooks)>=0.5){selectedType=lower;previousLevelChosen=true;}
    row=r.flash.items.find(x=>x.Type===selectedType);kind='order-priority';
   }
  }
  if(!row)row=forSlot(slot);
  if(!row)for(let fallback=1;fallback<=r.flash.maxSlots&&!row;fallback++){row=forSlot(fallback);if(row)kind='fallback-weighted';}
  if(!row)continue;
  selected.add(row.Type);
  context.steps.push({slot,kind,preferredType,selectedType:row.Type,previousLevelChosen});
  output.push({id:'flash-'+slot,slot,type:row.Type,left:row.ShopCount??r.flash.defaultCount,initial:row.ShopCount??r.flash.defaultCount,
   cost:row.Price,baseCost:row.Price,currency:'gem',increase:0,bought:0});
 }
 if(mode===2)output.reverse();
 s.commerce.flash.selection=context;
 return output;
}
function refresh(s,c,kind,hooks,manual=false){
 const state=s.commerce[kind],t=now(s),hours=s.commerce.inputs.flashRefreshHours;
 state.rows=kind==='daily'?dailyRows(s,c,hooks):flashRows(s,c,hooks,manual);
 state.unsupported=false;
 if(!manual){state.refreshedAt=t;state.nextAt=kind==='flash'&&hours!==null&&hours>0?t+hours*3600:nextDay(t);}
 return true;
}
function configuredGift(input){return input.enabled&&ENERGY_FIELDS.every(k=>integer(input[k]));}
function reconcileEnergy(s){
 const group=s.commerce.energy,input=s.commerce.inputs.energyGift,t=now(s),signature=JSON.stringify(input);
 if(group.rawSignature!==signature){const count=group.triggerCount,triggerDay=group.triggerDay;Object.assign(group,emptyEnergy(),{triggerCount:count,triggerDay,rawSignature:signature});}
 if(day(t)!==group.triggerDay){group.triggerCount=0;group.triggerDay=day(t);}
 if(!configuredGift(input)){group.state='None';group.itemEnd=0;group.left=0;return;}
 if(group.state==='Open'&&t>=group.groupEnd){
  if(t>group.groupEnd+input.groupCD*60){group.state='None';group.itemEnd=0;group.left=0;}
  else {group.state='CoolingDown';group.cooldownEnd=group.groupEnd+input.groupCD*60;}
 }else if(group.state==='CoolingDown'&&t>=group.cooldownEnd){group.state='None';group.itemEnd=0;group.left=0;}
}
function reconcileLevelGift(s){
 const state=s.commerce.levelGift,input=s.commerce.inputs.levelGift,t=now(s),level=s.wallet.level;
 if(level>state.lastLevel&&input.enabled&&integer(input.duration)&&input.duration>0&&(!input.levels.length||input.levels.includes(level)))state.offer={level,createdAt:t,expiresAt:t+input.duration};
 state.lastLevel=level;
 if(state.offer&&t>=state.offer.expiresAt)state.offer=null;
 if(!input.enabled)state.offer=null;
}
export function reconcileCommerce(s,c,hooks={}){
 const r=rule(c);if(!r)return s;
 if(!s.commerce)s.commerce=createCommerce(s);
 if(integer(hooks.generationCost)&&hooks.generationCost>0)s.commerce.lastGenerationCost=hooks.generationCost;
 s.commerce.lastStrongTutorial??=false;
 if(typeof hooks.strongTutorial==='boolean')s.commerce.lastStrongTutorial=hooks.strongTutorial;
 rememberUnlocks(s,c);reconcileEnergy(s);reconcileLevelGift(s);
 if(s.wallet.level>=r.unlockLevel){
  for(const kind of ['daily','flash']){const state=s.commerce[kind];if(state.refreshedAt===null||state.nextAt===null||now(s)>=state.nextAt)refresh(s,c,kind,hooks);}
 }
 return s;
}
export function activityState(s,c){
 const a=s.commerce?.inputs?.activity,t=now(s);
 if(!a?.enabled||!integer(a.sLv)||!integer(a.sTime)||!integer(a.eTime)||!integer(a.rTime)||a.sTime>=a.eTime||a.eTime>a.rTime)return {raw:'Released',effective:'Released',reason:'일정 설정 미입력',nextAt:null};
 if(s.wallet.level<a.sLv)return {raw:'Released',effective:'Released',reason:'시작 레벨 미달',nextAt:null};
 const raw=t<a.sTime?'Preparing':t<a.eTime?'Started':t<a.rTime?'Ended':'Released';
 const nextAt=raw==='Preparing'?a.sTime:raw==='Started'?a.eTime:raw==='Ended'?a.rTime:null;
 return {raw,effective:a.resourcesReady?raw:'Released',reason:a.resourcesReady?'설정·레벨·시간 통과':'필수 자원 미준비',nextAt};
}
export function passProgress(s){
 let remaining=s.commerce.activity.tokens,level=0;
 for(const row of s.commerce.activity.passRows){if(remaining<row.require)break;remaining-=row.require;level++;}
 return {level,remaining};
}
export function energyGiftStatus(s,c,{generationCost,strongTutorial}={}){
 const st=s.commerce,input=st.inputs,g=st.energy,cost=integer(generationCost)&&generationCost>0?generationCost:
  st.lastGenerationCost||item(c,s.board?.[s.selected]?.type)?.generator?.cost||1;
 const free=s.wallet.freeUsed<s.wallet.freeTotal,configured=configuredGift(input.energyGift);
 const existing=g.left>0&&now(s)<g.itemEnd;
 const gates=[
  ['설정·필드 입력',configured],['일일 생성 횟수',configured&&g.triggerCount<input.energyGift.dailyTriggerUpper],
  ['그룹 쿨다운 아님',g.state!=='CoolingDown'],['무료 충전 차례 아님',!free],
  ['현재 일반 충전 원가격이 임계값 이상',configured&&s.wallet.price>=input.energyGift.triggerEnergyPrice],
  ['같은 그룹 유효상품 없음',!existing],['에너지가1회 생성 비용보다 작음',s.wallet.energy<cost],['체인 에너지 비활성',!input.chainEnergy],
 ].map(([label,ok])=>({label,ok}));
 const tutorial=Boolean(input.strongTutorial||(strongTutorial??st.lastStrongTutorial)||(s.tutorialStep!==undefined&&c.tutorialSteps?.[s.tutorialStep]));
 return {configured,gates,canGenerate:gates.every(x=>x.ok),existing,generationCost:cost,
  iapEnabled:input.allGiftSwitch!==0,strongTutorial:tutorial,poptype:input.energyGift.poptype,
  canAttemptFromLack:input.allGiftSwitch!==0&&!tutorial,
  groupRemaining:Math.max(0,g.groupEnd-now(s)),itemRemaining:Math.max(0,g.itemEnd-now(s)),cooldownRemaining:Math.max(0,g.cooldownEnd-now(s))};
}
function offerRoute(s,c,context='close',options={}){
 const e=energyGiftStatus(s,c,options),input=s.commerce.inputs,k=input.candidates,trace=[];
 const test=(label,ok,why)=>{trace.push({label,ok,why});return ok;};
 if(context==='lack'){
  if(test('기존 EnergyGift 선노출',e.canAttemptFromLack&&e.existing&&e.poptype!==1,'강제 튜토리얼·IAP·기존 유효상품·poptype 검사'))return {chosen:'EnergyBundle',trace};
  return {chosen:input.chainEnergy?'ChainEnergy':'BuyEnergy',trace};
 }
 const more=input.more;
 const popupForLackingEnergy=typeof options.popupForLackingEnergy==='boolean'?options.popupForLackingEnergy:more.popupForLackingEnergy;
 const canShowAfterClose=typeof options.canShowAfterClose==='boolean'?options.canShowAfterClose:more.canShowAfterClose;
 const hasServerTime=typeof options.hasServerTime==='boolean'?options.hasServerTime:more.hasServerTime;
 if(test('친구 초대 응답 가정',popupForLackingEnergy&&k.invite,'부족으로 열린 창 + 비동기 적격성 응답 가정'))return {chosen:'InviteFriend',trace};
 if(test('EnergyGemOffer 적격성 가정',canShowAfterClose&&s.wallet.energy<e.generationCost&&k.gemOffer,'에너지 부족 + 서버 설정·자원·횟수/쿨다운 적격성 결과 가정'))return {chosen:'EnergyGemOffer',trace};
 // Global helper has no extra IsIAPEnabled check here; China is a separate chain.
 if(test('기존 EnergyGift 후노출',canShowAfterClose&&e.existing&&e.poptype===1,'글로벌 경로 · 새 생성과 별개인 기존 상품 조회'))return {chosen:'EnergyBundle',trace};
 const normalCost=s.wallet.freeUsed<s.wallet.freeTotal?0:s.wallet.price;
 const compareCost=input.chainEnergy?(more.nextChainPrice===null?null:Math.max(normalCost,more.nextChainPrice)):normalCost;
 const cd=more.cooldownMinutes,expiry=s.commerce.moreNextAt;
 const moreGate=canShowAfterClose&&popupForLackingEnergy&&hasServerTime&&more.threshold!==null&&cd!==null&&compareCost!==null&&
  compareCost>=more.threshold&&(expiry===0||expiry<=now(s)||day(now(s))!==day(expiry-cd*60));
 if(!test('후속 Plenty/Chain/주간 공통 gate',moreGate,'NoEnergyGiftGem/쿨다운/서버시각/부족창 조건. 미입력은 통과하지 않음'))return {chosen:null,trace};
 if(test('Plenty 활성 그룹 가정',k.plenty,'실제 활성 그룹 조회의 결과 가정'))return {chosen:'PlentyBundle',trace};
 if(k.chain&&k.weekly){
  if(!k.chainHasNextPayId)return {chosen:'NewWeeklyBundle',trace};
  if(k.chainPrice===null||k.weeklyPrice===null)return {chosen:null,trace,unknown:'둘 다 활성인 경우 고정 통화가격 비교값 미입력'};
  return {chosen:k.chainPrice<=k.weeklyPrice?'ChainBundle':'NewWeeklyBundle',trace};
 }
 return {chosen:k.chain?'ChainBundle':k.weekly?'NewWeeklyBundle':null,trace};
}
export function commerceSnapshot(s,c,options={}){
 const r=rule(c),st=s.commerce;
 if(!r||!st)return {ready:false};
 const energy=energyGiftStatus(s,c,options),activity=activityState(s,c);
 return {ready:true,level:s.wallet.level,time:now(s),shopOpen:s.wallet.level>=r.unlockLevel,gemOnly:s.wallet.level<=r.gemOnlyMaxLevel,
  iapEnabled:energy.iapEnabled,tabs:s.wallet.level<=r.gemOnlyMaxLevel?[]:energy.iapEnabled?['item','gem']:['item'],
  sequence:s.wallet.level<=r.gemOnlyMaxLevel?['Diamonds']:r.containerSequence,
  daily:st.daily,flash:st.flash,energy,route:st.lastRoute||offerRoute(s,c),activity,pass:passProgress(s),levelOffer:st.levelGift.offer,
  boundary:r.boundary,links:r.links};
}
function notify(s,ok,message,extra={}){s.commerce.message=message;return result(ok,message,extra);}
function rewardOne(hooks,reward){if(typeof hooks.reward!=='function')return false;try{const out=hooks.reward(reward);return out!==false&&out?.ok!==false;}catch{return false;}}
function buy(s,c,id,hooks){
 const r=rule(c);if(s.wallet.level<r.unlockLevel)return notify(s,false,'상점 해금 레벨에 도달하지 않았습니다.');
 const kind=String(id).startsWith('daily-')?'daily':'flash',row=s.commerce[kind].rows.find(x=>x.id===id);
 if(!row||row.left===0)return notify(s,false,'남은 수량이 없습니다.');
 const key=walletKey(row.currency);if(!key)return notify(s,false,'지원하지 않는 비용 재화입니다.');
 if(s.wallet[key]<row.cost)return notify(s,false,'구매 재화가 부족합니다.');
 if(!rewardOne(hooks,{type:row.type,count:1}))return notify(s,false,'보상 대기열 연결이 없어 구매하지 않았습니다.');
 s.wallet[key]-=row.cost;const paid=row.cost;row.bought++;
 if(row.left>0){row.left--;if(kind==='daily')row.cost+=row.increase;}
 if(row.currency==='gem'&&paid>0)recordCommerceEvent(s,c,'gem',paid);
 return notify(s,true,`상점 아이템1개를 대기열로 지급했습니다. ${paid}${row.currency==='gem'?'젬':'재화'} · 남은 ${row.left}`,{queuedReward:{type:row.type,count:1}});
}
function setInput(s,c,field,value){
 const st=s.commerce,i=st.inputs;
 const numeric=new Set(['flashRefreshHours','flashMode','allGiftSwitch',...ENERGY_FIELDS.map(x=>'energyGift.'+x),'levelGift.duration','activity.sLv','activity.sTime','activity.eTime','activity.rTime','candidates.chainPrice','candidates.weeklyPrice','more.threshold','more.cooldownMinutes','more.nextChainPrice']);
 const boolean=new Set(['strongTutorial','chainEnergy','energyGift.enabled','levelGift.enabled','activity.enabled','activity.resourcesReady','candidates.invite','candidates.gemOffer','candidates.plenty','candidates.chain','candidates.weekly','candidates.chainHasNextPayId','more.canShowAfterClose','more.popupForLackingEnergy','more.hasServerTime']);
 const enumMap={dailyVariant:['base','random'],paymentHistory:['unknown','unpaid','paid'],'activity.kind':['pass','album']};
 if(numeric.has(field)){
  if(value===''||value===null)value=null;
  else if(typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value))value=Number(value);
  const valid=['candidates.chainPrice','candidates.weeklyPrice'].includes(field)?money(value):nullable(value);
  if(!valid)return notify(s,false,'0 이상의 유효한 숫자를 입력하세요. 재화/시간은 정수, fixedMoney는 소수도 허용합니다.');
  if(field==='flashMode'&&![null,0,1,2].includes(value))return notify(s,false,'지원하는 상점 분기값이 아닙니다.');
  if(field==='allGiftSwitch'&&![null,0,1].includes(value))return notify(s,false,'IAP 스위치는 미입력/0/1입니다.');
 }else if(boolean.has(field)){if(typeof value!=='boolean')return notify(s,false,'참/거짓 입력이 필요합니다.');}
 else if(enumMap[field]){if(!enumMap[field].includes(value))return notify(s,false,'허용된 선택값이 아닙니다.');}
 else if(field==='levelGift.levels'){
  value=typeof value==='string'?value.split(',').filter(x=>x.trim()!=='').map(Number):value;
  if(!Array.isArray(value)||value.length>100||value.some(x=>!integer(x,100000)))return notify(s,false,'레벨 목록을 쉼표로 입력하세요.');
 }else if(field==='specialOrderChains'){
  value=typeof value==='string'?value.split(',').map(x=>x.trim()).filter(Boolean):value;
  if(!Array.isArray(value)||value.some(x=>!rule(c).flash.specialOrderChains.includes(x)))return notify(s,false,'내장 특수주문 체인만 입력할 수 있습니다.');
 }else return notify(s,false,'알 수 없는 상점 입력입니다.');
 const keys=field.split('.');if(keys.length===1)i[field]=value;else i[keys[0]][keys[1]]=value;
 if(['dailyVariant','flashMode','specialOrderChains'].includes(field))st[field==='dailyVariant'?'daily':'flash'].refreshedAt=null;
 if(field==='flashRefreshHours')st.flash.nextAt=value&&value>0?now(s)+value*3600:nextDay(now(s));
 if(field==='allGiftSwitch'&&value===0)st.tab='item';
 return notify(s,true,'연구 입력을 변경했습니다. 서버 설정으로 간주하지 않습니다.');
}
function prepareActivity(s,kind){
 const t=now(s),st=s.commerce;
 st.inputs.activity={enabled:true,kind,sLv:3,sTime:t,eTime:t+600,rTime:t+900,resourcesReady:true};
 st.activity={tokens:0,ticketAssumed:false,claims:[],ownedCards:[],duplicateCards:0,metrics:{},
  taskTarget:'customer',taskCount:2,taskTokens:1,taskProgress:0,
  passRows:kind==='pass'?[{require:3,reward:{type:'energy',count:5},premium:{type:'gem',count:1}},
   {require:5,reward:{type:'gold',count:10},premium:{type:'energy',count:10}},
   {require:8,reward:{type:'energy',count:10},premium:{type:'gem',count:2}}]:[]};
}
export function recordCommerceEvent(s,c,target,count=1){
 if(!s.commerce||!rule(c)?.activity.passTaskTargets.includes(target)||!integer(count)||activityState(s,c).effective!=='Started')return result(false,'활성 활동의 지원 목표가 아닙니다.');
 const a=s.commerce.activity;a.metrics[target]=(a.metrics[target]||0)+count;
 if(s.commerce.inputs.activity.kind==='pass'&&a.passRows.length&&target===a.taskTarget){a.taskProgress+=count;const completed=Math.floor(a.taskProgress/a.taskCount);a.tokens+=completed*a.taskTokens;a.taskProgress%=a.taskCount;}
 return result(true,'연구 활동 목표를 기록했습니다. 서버 과제표와 별도입니다.');
}
function eventAction(s,c,value,hooks){
 const a=s.commerce.activity;
 if(['example-pass','example-album'].includes(value)){prepareActivity(s,value==='example-pass'?'pass':'album');return notify(s,true,'10분 연구 일정과 예제 상태를 준비했습니다. 원작 일정·보상표가 아닙니다.');}
 if(value==='ticket'){a.ticketAssumed=!a.ticketAssumed;return notify(s,true,'유료 수령권 소유 가정을 바꿨습니다. 실제 결제는 없습니다.');}
 if(value==='token'){if(activityState(s,c).effective!=='Started')return notify(s,false,'활동이 진행 중일 때만 실험 토큰을 추가합니다.');a.tokens++;return notify(s,true,'연구 토큰1을 추가했습니다.');}
 if(String(value).startsWith('claim:')){
  const [,tierText,track]=value.split(':'),tier=Number(tierText),key=tier+':'+track;
  if(!['Started','Ended'].includes(activityState(s,c).effective)||!integer(tier,100)||tier<1||tier>passProgress(s).level||!['free','premium'].includes(track))return notify(s,false,'활동·단계 달성 조건을 통과하지 못했습니다.');
  if(track==='premium'&&!a.ticketAssumed)return notify(s,false,'유료 트랙 수령권 가정이 없습니다.');
  if(a.claims.includes(key))return notify(s,false,'이미 수령한 단계입니다.');
  const row=a.passRows[tier-1],reward=track==='premium'?row.premium:row.reward;
  if(!rewardOne(hooks,reward))return notify(s,false,'보상 연결이 없어 수령하지 않았습니다.');
  a.claims.push(key);return notify(s,true,'예제 패스 보상을 수령했습니다. 원작 서버 보상이 아닙니다.');
 }
 if(String(value).startsWith('card:')){
  const id=value.slice(5);if(!['research-1','research-2','research-3'].includes(id)||s.commerce.inputs.activity.kind!=='album'||activityState(s,c).effective!=='Started')return notify(s,false,'활성 연구 앨범에서만 기록합니다.');
  if(a.ownedCards.includes(id)){a.duplicateCards++;return notify(s,true,'중복 카드를 기록했습니다. 완성 진행은 증가하지 않습니다.');}
  a.ownedCards.push(id);return notify(s,true,'첫 보유 진행을 기록했습니다. 드롭 확률·완성 보상은 미확인입니다.');
 }
 return notify(s,false,'지원하지 않는 활동 실험입니다.');
}
export function dispatchCommerce(s,c,action,value,hooks={}){
 if(!rule(c))return result(false,'검증한 상점 설정이 없습니다.');
 reconcileCommerce(s,c,hooks);
 if(integer(hooks.generationCost)&&hooks.generationCost>0)s.commerce.lastGenerationCost=hooks.generationCost;
 let out;
 if(action==='commerce-input')out=setInput(s,c,value?.field,value?.value);
 else if(action==='commerce-tab'){
  if(!['item','gem'].includes(value)||value==='gem'&&s.commerce.inputs.allGiftSwitch===0)return notify(s,false,'열 수 없는 상점 탭입니다.');
  s.commerce.tab=value;out=notify(s,true,'상점 탭을 변경했습니다.');
 }else if(action==='commerce-buy')out=buy(s,c,value,hooks);
 else if(action==='commerce-refresh'){
  const cost=rule(c).flash.manualRefreshGem;
  if(s.wallet.level<rule(c).unlockLevel)return notify(s,false,'상점 해금 레벨을 확인하세요.');
  if(s.wallet.gems<cost)return notify(s,false,'수동 갱신에 필요한 젬이 부족합니다.');
  if(refresh(s,c,'flash',hooks,true)){s.wallet.gems-=cost;recordCommerceEvent(s,c,'gem',cost);out=notify(s,true,`${cost}젬으로 FlashSale을 갱신했습니다. 자동 갱신 시각은 유지합니다.`);}
 }else if(action==='commerce-detail'){
  const allowed=[...rule(c).iap.map(x=>x.purchaseId),'energy-gift','level-gift','chain','weekly','starter'];
  if(!allowed.includes(value))return notify(s,false,'알 수 없는 상품입니다.');
  s.commerce.detail=s.commerce.detail===value?null:value;out=notify(s,true,'내장 선언과 미확인 서버값을 표시합니다. 실제 결제는 비활성입니다.');
 }else if(action==='commerce-assume'){
  if(value==='energy')s.commerce.inputs.energyGift={enabled:true,groupDuration:60,groupCD:30,giftDuration:10,triggerEnergyPrice:20,dailyTriggerUpper:3,poptype:1};
  else if(value==='level')s.commerce.inputs.levelGift={enabled:true,levels:[],duration:3600};
  else return notify(s,false,'알 수 없는 예제입니다.');
  out=notify(s,true,'예제 숫자를 연구 가정으로 입력했습니다. 내장 또는 서버 기본값이 아닙니다.');
 }else if(action==='commerce-trigger'){
  const e=energyGiftStatus(s,c,hooks),g=s.commerce.energy,input=s.commerce.inputs.energyGift;
  if(value!=='close'&&e.canAttemptFromLack&&e.canGenerate){if(g.state==='None'){g.state='Open';g.groupEnd=now(s)+input.groupDuration*60;}g.itemEnd=now(s)+input.giftDuration*60;g.left=1;g.triggerCount++;}
  s.commerce.lastRoute=offerRoute(s,c,value==='close'?'close':'lack',hooks);
  if(value==='close'&&['PlentyBundle','ChainBundle','NewWeeklyBundle'].includes(s.commerce.lastRoute.chosen))s.commerce.moreNextAt=now(s)+s.commerce.inputs.more.cooldownMinutes*60;
  out=notify(s,true,'현재 시간·레벨·재화로 생성 적격성과 기존 상품 노출을 평가했습니다.',{route:s.commerce.lastRoute});
 }else if(action==='commerce-event')out=eventAction(s,c,value,hooks);
 else return notify(s,false,'지원하지 않는 상점 동작입니다.');
 reconcileCommerce(s,c,hooks);
 return out||notify(s,false,'상점 동작을 처리하지 못했습니다.');
}

export function validCommerce(v,c){
 const r=rule(c);if(!r||!record(v)||v.schema!==1||!['item','gem'].includes(v.tab)||!integer(v.rng,4294967295)||!record(v.unlockedTypes)||Object.entries(v.unlockedTypes).some(([k,x])=>!r.chainInfo[k]||x!==true))return false;
 const i=v.inputs;if(!record(i)||!['base','random'].includes(i.dailyVariant)||!nullable(i.flashRefreshHours)||![null,0,1,2].includes(i.flashMode)||![null,0,1].includes(i.allGiftSwitch)||!['unknown','unpaid','paid'].includes(i.paymentHistory))return false;
 if(!Array.isArray(i.specialOrderChains)||i.specialOrderChains.some(x=>!r.flash.specialOrderChains.includes(x))||['strongTutorial','chainEnergy'].some(x=>typeof i[x]!=='boolean'))return false;
 if(!record(i.energyGift)||typeof i.energyGift.enabled!=='boolean'||ENERGY_FIELDS.some(k=>!nullable(i.energyGift[k])))return false;
 if(!record(i.levelGift)||typeof i.levelGift.enabled!=='boolean'||!nullable(i.levelGift.duration)||!Array.isArray(i.levelGift.levels)||i.levelGift.levels.length>100||i.levelGift.levels.some(x=>!integer(x,100000)))return false;
 if(!record(i.activity)||typeof i.activity.enabled!=='boolean'||typeof i.activity.resourcesReady!=='boolean'||!['pass','album'].includes(i.activity.kind)||['sLv','sTime','eTime','rTime'].some(k=>!nullable(i.activity[k])))return false;
 if(!record(i.candidates)||['invite','gemOffer','plenty','chain','weekly','chainHasNextPayId'].some(k=>typeof i.candidates[k]!=='boolean')||!money(i.candidates.chainPrice)||!money(i.candidates.weeklyPrice))return false;
 if(!record(i.more)||['threshold','cooldownMinutes','nextChainPrice'].some(k=>!nullable(i.more[k]))||['canShowAfterClose','popupForLackingEnergy','hasServerTime'].some(k=>typeof i.more[k]!=='boolean')||!integer(v.moreNextAt))return false;
 for(const kind of ['daily','flash']){
  const st=v[kind];if(!record(st)||!nullable(st.refreshedAt)||!nullable(st.nextAt)||!Array.isArray(st.rows)||st.rows.length>6||new Set(st.rows.map(x=>x.id)).size!==st.rows.length)return false;
  if(kind==='flash'&&(typeof st.unsupported!=='boolean'||new Set(st.rows.map(x=>x.type)).size!==st.rows.length))return false;
  for(const row of st.rows){
   if(!record(row)||!integer(row.left,100000)||!integer(row.initial,100000)||!integer(row.bought,100000)||row.left+row.bought!==row.initial||!integer(row.cost)||!integer(row.baseCost)||!integer(row.increase)||row.cost!==row.baseCost+row.increase*row.bought)return false;
   if(kind==='daily'){
    if(!['base','random'].includes(row.variant))return false;
    const list=row.variant==='base'?r.daily.base:r.daily.randomVariant;
    const d=list.find(x=>x.id===row.slot&&x.itemCode===row.type);if(!d||row.id!=='daily-'+row.slot||row.initial!==d.leftCount||row.baseCost!==d.costCount||row.currency!==d.costType||row.increase!==(d.costIncreasement||0)||row.adDeclared!==(d.ad===1))return false;
   }else {const d=r.flash.items.find(x=>x.Type===row.type);if(!d||row.id!=='flash-'+row.slot||!integer(row.slot,6)||row.slot<1||row.initial!==(d.ShopCount??r.flash.defaultCount)||row.currency!=='gem'||row.baseCost!==d.Price||row.increase!==0)return false;}
  }
 }
 const text=x=>typeof x==='string'&&x.length<=2000;
 const stringArray=(x,max=1000)=>Array.isArray(x)&&x.length<=max&&x.every(text);
 const multipliers=x=>record(x)&&Object.entries(x).every(([k,n])=>text(k)&&Number.isFinite(n)&&n>=0&&n<=1e6);
 const selection=v.flash.selection;
 if(selection!==undefined){
  if(!record(selection)||![0,1,2].includes(selection.mode)||!record(selection.stock)||Object.entries(selection.stock).some(([k,n])=>!text(k)||!integer(n))||
   !stringArray(selection.missingCodes)||!stringArray(selection.preferredMissing)||!stringArray(selection.unknownRequirements)||
   !multipliers(selection.chainMultipliers)||!multipliers(selection.codeMultipliers)||
   !record(selection.unbought)||!record(selection.bought)||[selection.unbought,selection.bought].some(x=>Object.values(x).some(a=>!stringArray(a)))||
   !Array.isArray(selection.steps)||selection.steps.length>6||selection.steps.some(x=>!record(x)||!integer(x.slot,6)||x.slot<1||
    !['weighted','fallback-weighted','order-priority'].includes(x.kind)||!(x.preferredType===null||text(x.preferredType))||
    !r.flash.items.some(p=>p.Type===x.selectedType)||typeof x.previousLevelChosen!=='boolean'))return false;
 }
 const g=v.energy;if(!record(g)||!['None','Open','CoolingDown'].includes(g.state)||['groupEnd','cooldownEnd','itemEnd','left','triggerCount','triggerDay'].some(k=>!integer(g[k]))||g.left>1||!(g.rawSignature===null||typeof g.rawSignature==='string'&&g.rawSignature.length<2000))return false;
 if(!record(v.levelGift)||!integer(v.levelGift.lastLevel))return false;
 if(v.levelGift.offer!==null&&(!record(v.levelGift.offer)||['level','createdAt','expiresAt'].some(k=>!integer(v.levelGift.offer[k]))))return false;
 const a=v.activity;if(!record(a)||!integer(a.tokens)||typeof a.ticketAssumed!=='boolean'||!integer(a.duplicateCards)||!Array.isArray(a.claims)||a.claims.length>6||a.claims.some(x=>!/^[1-3]:(free|premium)$/.test(x))||new Set(a.claims).size!==a.claims.length)return false;
 if(!Array.isArray(a.ownedCards)||a.ownedCards.length>3||a.ownedCards.some(x=>!['research-1','research-2','research-3'].includes(x))||new Set(a.ownedCards).size!==a.ownedCards.length||!record(a.metrics)||Object.entries(a.metrics).some(([k,x])=>!r.activity.passTaskTargets.includes(k)||!integer(x)))return false;
 if(!Array.isArray(a.passRows)||a.passRows.length>3||a.passRows.some(x=>!record(x)||!integer(x.require)||x.require<1||['reward','premium'].some(k=>!record(x[k])||!['energy','gem','gold'].includes(x[k].type)||!integer(x[k].count,1000)))||!r.activity.passTaskTargets.includes(a.taskTarget)||!integer(a.taskCount)||a.taskCount<1||!integer(a.taskTokens)||!integer(a.taskProgress)||a.taskProgress>=a.taskCount)return false;
 if(v.lastRoute!==null&&(!record(v.lastRoute)||!(v.lastRoute.chosen===null||['EnergyBundle','ChainEnergy','BuyEnergy','InviteFriend','EnergyGemOffer','PlentyBundle','ChainBundle','NewWeeklyBundle'].includes(v.lastRoute.chosen))||
  !Array.isArray(v.lastRoute.trace)||v.lastRoute.trace.length>20||v.lastRoute.trace.some(x=>!record(x)||!text(x.label)||typeof x.ok!=='boolean'||!text(x.why))||
  !(v.lastRoute.unknown===undefined||text(v.lastRoute.unknown))))return false;
 return integer(v.lastGenerationCost)&&v.lastGenerationCost>0&&(v.lastStrongTutorial===undefined||typeof v.lastStrongTutorial==='boolean')&&(v.detail===null||typeof v.detail==='string'&&v.detail.length<100)&&typeof v.message==='string'&&v.message.length<1000;
}
