// Static production modifier algorithms. Configuration, activity flags and
// persisted counters are explicit snapshots; no live odds are inferred.
const integer=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const item=(c,t)=>c.items?.find(i=>i.type===t);
const spread=(c,t)=>c.spreadRules?.byType?.[t];
const reqs=o=>(o.requirements||[]).flatMap(r=>typeof r==='string'?[r]:Array(r.count).fill(r.type));
const at=(c,chain,level)=>c.items.find(i=>i.chainId===chain&&i.chainLevel===level)?.type;
function bad(message,reason='invalid-modifier-snapshot'){throw Object.assign(new Error(message),{reason});}
function random(fn){if(typeof fn!=='function')bad('연구 난수 콜백이 필요합니다.','missing-rng');const n=fn();if(!Number.isFinite(n)||n<0||n>=1)bad('난수는0이상1미만이어야 합니다.');return n;}
const roll=(fn,n)=>Math.floor(random(fn)*n)+1;
function weighted(pool,fn,weights=pool.map(p=>p.weight)){let p=random(fn)*weights.reduce((a,b)=>a+b,0);for(let i=0;i<pool.length;i++){if(p<weights[i])return pool[i].type;p-=weights[i];}bad('선택 가능한 가중치가 없습니다.');}
function counts(s,boardOnly=false){const out={};for(const cell of [...s.board,...(boardOnly?[]:s.inventory?.items||[])])if(cell&&!cell.cover&&!s.bubbles?.[cell.uid])out[cell.type]=(out[cell.type]||0)+1;return out;}
function exactLack(orders,stock){const need={};for(const order of orders)if(![4,'finished'].includes(order.state))for(const t of reqs(order))need[t]=(need[t]||0)+1;return Object.fromEntries(Object.entries(need).filter(([t,n])=>n>(stock[t]||0)).map(([t,n])=>[t,n-(stock[t]||0)]));}
function mergeLack(c,type,stock){const target=item(c,type);if(!target)bad(`알 수 없는 요구 타입 ${type}`);let need=1,previous=target.chainLevel;for(let level=target.chainLevel;level>=1;level--){need*=2**(previous-level);const t=at(c,target.chainId,level),n=stock[t]||0;if(n>=need){stock[t]=n-need;return 0;}if(t)stock[t]=0;need-=n;previous=level;}return need;}
function mergeLacks(c,orders,stock,levelOrder=false){const requirements=orders.filter(o=>![4,'finished'].includes(o.state)).flatMap(reqs);if(levelOrder)requirements.sort((a,b)=>item(c,a).chainLevel-item(c,b).chainLevel);const out={};for(const t of requirements){const n=mergeLack(c,t,stock);if(n>0)out[t]=(out[t]||0)+n;}return out;}
const slotsFree=s=>s.board.filter(c=>c===null).length;

export function createProductionModifiers(){return {schema:1,lucky:{buckets:{},energyCost:0,resetAt:0,freeThresholds:[],rangeIndex:null,continuation:null,boostHistory:[],boostConfigActive:false},disco:null,generatorBoost:{extraBucket:{totalLeft:0,luckyLeft:0},extraCached:false,extraLuckyCached:false}};}
/** Always pass the original packaged config, not a previous returned view.
 * Current fixed/smart generation reads this view; existing instance timer/max
 * fields remain its creation snapshot, whereas newly created cells use this view. */
export function productionConfigFor(config,input={}){
 const gb=input.generatorBoost;if(!gb?.active)return config;
 const itemMode=gb.moreLucky?'MoreLuckyProduce':gb.extraLuckyProduce?'ExtraLuckyProduce':gb.extraProduce?'ExtraProduce':null;
 const luckyMode=gb.moreLucky?'MoreLuckyProduce':gb.extraLuckyProduce?'ExtraLuckyProduce':null;
 const items=config.productionRules?.boostItemConfigs?.[itemMode]||{},lucky=config.productionRules?.boostLuckyConfigs?.[luckyMode];
 const baseByType=Object.fromEntries(Object.keys(items).map(t=>[t,config.spreadRules.byType[t]]));
 return {...config,spreadRules:{...config.spreadRules,byType:{...config.spreadRules?.byType,...items}},productionRules:{...config.productionRules,...(lucky?{luckyConfigs:lucky}:{})},productionView:{itemMode,luckyMode,changedTypes:Object.keys(items),baseByType}};
}
export function validProductionModifiers(s,c){
 try{
  const m=s.productionModifiers;if(m===undefined)return true;
  if(!object(m)||m.schema!==1||!object(m.lucky)||!object(m.generatorBoost))return false;
  const l=m.lucky,g=m.generatorBoost;
  if(l.boostConfigActive!==undefined&&typeof l.boostConfigActive!=='boolean')return false;
  if(!object(l.buckets)||!integer(l.energyCost)||!integer(l.resetAt)||!(l.rangeIndex===null||integer(l.rangeIndex,10000))||!Array.isArray(l.freeThresholds)||l.freeThresholds.some(n=>!integer(n))||!Array.isArray(l.boostHistory)||l.boostHistory.length>4||l.boostHistory.some(n=>!integer(n,3)))return false;
  for(const [type,b]of Object.entries(l.buckets))if(!item(c,type)||!object(b)||!integer(b.totalLeft)||!integer(b.luckyLeft,b.totalLeft))return false;
  if(l.continuation!==null){const k=l.continuation;if(!object(k)||!item(c,k.type)||![1,2].includes(k.maxCount)||!integer(k.count,k.maxCount)||!integer(k.expiresAt))return false;}
  if(m.disco!==null&&(!object(m.disco)||!integer(m.disco.score)||typeof m.disco.property!=='string'||!m.disco.property||m.disco.property.length>100||!integer(m.disco.difficultyLevel,100)))return false;
  if(!object(g.extraBucket)||!integer(g.extraBucket.totalLeft)||!integer(g.extraBucket.luckyLeft,g.extraBucket.totalLeft)||typeof g.extraCached!=='boolean'||typeof g.extraLuckyCached!=='boolean')return false;
  return true;
 }catch{return false;}
}
function validChance(chance){return Array.isArray(chance)&&chance.length===2&&integer(chance[0],1e6)&&chance[0]>0&&integer(chance[1],chance[0]);}
// Current MainBoard adapter supports 19 slots and the packaged normal-order
// table chooses 1/2/3 pieces. These are snapshot bounds, not a claim about every
// activity creator. Validate before reqs() can allocate Array(count).
function validateOrders(orders,c){
 if(!Array.isArray(orders)||orders.length>19)bad('주문 스냅샷은 최대19개 슬롯이어야 합니다.');
 const seen=new Set();let total=0;
 for(const order of orders){
  if(!object(order)||!integer(order.slot,19)||order.slot===0||seen.has(order.slot)||!Array.isArray(order.requirements)||order.requirements.length===0||order.requirements.length>3)bad('주문 슬롯·요구 목록을 확인하세요.');
  seen.add(order.slot);let count=0;
  for(const r of order.requirements){
   const type=typeof r==='string'?r:object(r)?r.type:null,n=typeof r==='string'?1:r?.count;
   if(typeof type!=='string'||!item(c,type)||!integer(n,3)||n===0)bad('주문 요구는 알려진 타입과1–3개 수량이어야 합니다.');
   count+=n;
  }
  if(count>3||(total+=count)>57)bad('현재 주문 스냅샷은 슬롯당3개·전체57개를 넘을 수 없습니다.');
  if(order.state!==undefined&&!(integer(order.state,4)||['dormant','init','partially-finished','can-deliver','finished'].includes(order.state)))bad('주문 상태 스냅샷이 올바르지 않습니다.');
 }
}
function validateInputs(s,c,input){
 if(!object(input)||!validProductionModifiers(s,c))bad('생산 보정 상태를 확인하지 못했습니다.');
 for(const name of ['lucky','disco','smartProduce','fishNet','generatorBoost'])if(input[name]!==undefined&&(!object(input[name])||input[name].active!==undefined&&typeof input[name].active!=='boolean'))bad('활동 활성 상태는 명시 boolean이어야 합니다.');
 if(input.buffNoCooldown!==undefined&&typeof input.buffNoCooldown!=='boolean')bad('NoCD 상태 입력이 올바르지 않습니다.');
 if(input.energyInfinite!==undefined&&typeof input.energyInfinite!=='boolean')bad('무한 에너지 상태 입력이 올바르지 않습니다.');
 if(input.itemLandOpt!==undefined&&typeof input.itemLandOpt!=='boolean')bad('아이템 배치 서버 플래그는 boolean 입력이어야 합니다.');
 if(Object.hasOwn(input,'orders'))validateOrders(input.orders,c);
 else if(s.orders?.slots!==undefined)validateOrders(s.orders.slots,c);
 if(['lucky','disco','smartProduce','fishNet','generatorBoost'].some(k=>input[k]?.active===true)&&!item(c,input.generatorType))bad('명시 활성 연구에는 현재 생성기 타입이 필요합니다.');
 const rules=c.productionRules;if(['lucky','disco','smartProduce','fishNet','generatorBoost'].some(k=>input[k]?.active===true)&&!rules)bad('검증된 보정 규칙 projection이 필요합니다.');
 const lucky=input.lucky||{};
 for(const key of ['adjustBoostRatio'])if(lucky[key]!==undefined&&typeof lucky[key]!=='boolean')bad('럭키 보정 상태는 boolean이어야 합니다.');
 if(lucky.active){for(const r of lucky.configs||rules.luckyConfigs){if(!Array.isArray(r.generators)||!validChance(r.chance)||!Array.isArray(r.pool)||!r.pool.length||r.pool.some(p=>!item(c,p.type)||!integer(p.weight)||p.weight===0))bad('럭키 생성기 설정·가중치·bucket이 필요합니다.');}}
 if(lucky.smartRatio!==undefined&&(!integer(lucky.smartRatio,1e6)))bad('스마트 가중치 배수가 올바르지 않습니다.');
 if(lucky.specialRanges!==undefined&&(!Array.isArray(lucky.specialRanges)||lucky.specialRanges.some(r=>!r||!Array.isArray(r.range)||r.range.length!==2||!integer(r.range[0])||!integer(r.range[1])||r.range[1]<r.range[0]||!integer(r.extraLucky)||!integer(r.tripleChance,10000)||!integer(r.doubleChance,10000))))bad('추가럭키 범위·확률 스냅샷을 모두 입력하세요.');
 const gb=input.generatorBoost||{};
 for(const key of ['smart','noCooldown','extraProduce','extraLuckyProduce','moreLucky'])if(gb[key]!==undefined&&typeof gb[key]!=='boolean')bad('생성기 활동 보정 상태는 boolean이어야 합니다.');
 if(gb.active&&gb.extraProduce&&!validChance(gb.extraChance))bad('추가생산 유한bucket 설정이 필요합니다.');
 if((input.smartProduce?.active||gb.active&&gb.smart||lucky.active&&lucky.smartRatio>=1||input.disco?.active)&&!Array.isArray(input.orders??s.orders?.slots))bad('명시 활성 보정에 현재 주문 스냅샷이 필요합니다.');
 if(input.generatorUid!==undefined&&(!integer(input.generatorUid)||input.generatorUid===0))bad('생성기 UID가 올바르지 않습니다.');
 const d=input.disco;if(d?.active){const old=s.productionModifiers?.disco;if(!old&&(!integer(d.score)||d.score===0||typeof d.property!=='string'||!d.property||!integer(d.difficultyLevel,100)))bad('디스코 점수·속성·서버 difficulty_level이 필요합니다.');}
}
function sourceSupports(c,type){const r=spread(c,type);return !!r&&((r.costEnergy&&r.cooldownSeconds!==null)||type===c.productionRules?.rawFishType);}
function rangeIndex(ranges,cost){const n=ranges.findIndex(r=>cost>=r.range[0]&&cost<=r.range[1]);return n<0?0:n+1;}
function sampleUnique(size,n,fn){const used=new Set(),values=[];for(let i=0;i<n;i++){let selected=roll(fn,size-i);for(const k of [...used].sort((a,b)=>a-b))if(k<selected)selected++;while(used.has(selected))selected++;used.add(selected);values.push(selected);}return values.sort((a,b)=>a-b);}
function updateEnergy(ctx,receipt,fn){
 if(ctx.energyRecorded)return;ctx.energyRecorded=true;
 const cost=receipt.energy||0,l=ctx.next.lucky;if(!integer(cost))bad('실제 에너지 소비량을 확인하지 못했습니다.');
 if(ctx.ranges.length){const previous=l.rangeIndex??rangeIndex(ctx.ranges,l.energyCost);l.energyCost+=cost;const next=rangeIndex(ctx.ranges,l.energyCost);if(previous!==next){const last=next===0?ctx.ranges.length:next;for(let index=previous+1;index<=last;index++){const r=ctx.ranges[index-1],size=r.range[1]-r.range[0]+1;for(const n of sampleUnique(size,Math.min(size,r.extraLucky),fn))l.freeThresholds.push(n+r.range[0]-1);}l.rangeIndex=next;}}
 if(ctx.input.lucky?.adjustBoostRatio&&(receipt.costEnergy??cost>0)&&!receipt.automatic&&!receipt.extra&&ctx.config.spreadRules?.boostTargetTypes?.includes(ctx.input.generatorType)&&(['fixed','tutorial'].includes(receipt.branch)||receipt.branch==='smart-produce'&&ctx.input.generatorBoost?.active&&ctx.input.generatorBoost.smart)){
  if(!integer(receipt.boostRatio,3))bad('기록할 부스트 지수가 올바르지 않습니다.');l.boostHistory.push(receipt.boostRatio);l.boostHistory=l.boostHistory.slice(-4);
 }
}
function triggerContinuation(ctx,type,fn){const r=ctx.ranges[ctx.next.lucky.rangeIndex-1];if(!r)return;if(r.tripleChance>=roll(fn,10000))ctx.next.lucky.continuation={type,maxCount:2,count:0,expiresAt:ctx.now+10};else if(r.doubleChance>=roll(fn,10000))ctx.next.lucky.continuation={type,maxCount:1,count:0,expiresAt:ctx.now+10};}
function selectLucky(ctx,type,maxRatio,fn){
 if(!ctx.context.luckyActive||ctx.context.discoActive)return null;
 if(!integer(maxRatio,3))bad('현재 최대 부스트 지수가 필요합니다.');
 const input=ctx.input.lucky||{},config=(input.configs||ctx.config.productionRules.luckyConfigs).find(r=>r.generators.includes(type)&&(r.minLevel===null||r.minLevel===undefined||ctx.level>=r.minLevel)&&(r.maxLevel===null||r.maxLevel===undefined||ctx.level<=r.maxLevel));if(!config)return null;
 const l=ctx.next.lucky,gb=ctx.next.generatorBoost,extra=ctx.input.generatorBoost?.active&&ctx.input.generatorBoost.extraLuckyProduce&&sourceSupports(ctx.config,type);
 let kind=null,free=false,continuation=l.continuation;
 if(continuation&&(continuation.type!==type||continuation.maxCount<=continuation.count||ctx.now>continuation.expiresAt)){l.continuation=null;continuation=null;}
 if(continuation){kind=continuation.maxCount===1?'double-lucky':continuation.count===0?'triple-lucky-1':'triple-lucky-2';continuation.count++;continuation.expiresAt=ctx.now+10;}
 else if(extra&&gb.extraLuckyCached){if(slotsFree(ctx.state)<2)return null;gb.extraLuckyCached=false;triggerContinuation(ctx,type,fn);}
 else {
  let bucket=l.buckets[type];if(!bucket||bucket.totalLeft===0)bucket=l.buckets[type]={totalLeft:config.chance[0],luckyLeft:config.chance[1]};
  let lucky=bucket.luckyLeft>=roll(fn,bucket.totalLeft);
  if(!lucky&&l.freeThresholds[0]!==undefined&&l.energyCost>=l.freeThresholds[0]){lucky=true;free=true;l.freeThresholds.shift();}
  else if(lucky)bucket.luckyLeft--;
  if(!free)bucket.totalLeft--;
  if(!lucky)return null;
  if(extra&&slotsFree(ctx.state)<2){gb.extraLuckyCached=true;return null;}
  triggerContinuation(ctx,type,fn);
 }
 const ratio=input.adjustBoostRatio&&l.boostHistory.length?Math.ceil(l.boostHistory.reduce((a,b)=>a+b,0)/l.boostHistory.length):maxRatio;
 let weights=config.pool.map(p=>p.weight);
 if(input.smartRatio>=1){const lacks=exactLack(ctx.orders,counts(ctx.state)),boost=ctx.config.spreadRules.boostTargetTypes?.includes(type)?maxRatio:0;weights=weights.map((w,i)=>{const info=item(ctx.config,config.pool[i].type);return w*(Object.keys(lacks).some(t=>item(ctx.config,t)?.chainId===info.chainId&&item(ctx.config,t).chainLevel>=info.chainLevel+boost)?input.smartRatio:1);});}
 const code=weighted(config.pool,fn,weights),superLucky=config.superItems?.includes(code);
 kind=kind||(free?(superLucky?'free-super-lucky':'free-lucky'):(superLucky?'super-lucky':'lucky'));
 ctx.extraLucky=!!extra&&!kind.startsWith('double')&&!kind.startsWith('triple');ctx.luckyKind=kind;
 return {type:code,adjustedBoostRatio:ratio,kind};
}
function selectSmartProduce(ctx,type,fn){
 if(!ctx.context.smartProduceActive)return null;
 const r=spread(ctx.config,type),source=item(ctx.config,type),sub=ctx.config.productionRules.subChainMap[source?.chainId];if(!r||!sub)return null;
 const subPool=r.pool.filter(p=>item(ctx.config,p.type)?.chainId===sub),mainPool=r.pool.filter(p=>item(ctx.config,p.type)?.chainId!==sub);if(!subPool.length)return null;
 const main=item(ctx.config,mainPool.at(-1)?.type)?.chainId,lacks=exactLack(ctx.orders,counts(ctx.state));if(!Object.keys(lacks).some(t=>[sub,main].includes(item(ctx.config,t)?.chainId)))return null;
 let subMissing=false,mainMissing=false;const stock=counts(ctx.state);
 for(const order of ctx.orders)if(![4,'finished'].includes(order.state))for(const t of reqs(order))if(mergeLack(ctx.config,t,stock)>0){if(item(ctx.config,t).chainId===sub){subMissing=true;break;}if(item(ctx.config,t).chainId===main)mainMissing=true;}
 return subMissing?weighted(subPool,fn):mainMissing?weighted(mainPool,fn):null;
}
function difficulty(ctx,type){const row=ctx.config.orderRules?.itemConfig?.find(i=>i.Code===type);return row?.DifficultyLevel??item(ctx.config,type)?.chainLevel;}
function reduceDisco(ctx,n){const d=ctx.next.disco;d.score=Math.max(0,d.score-n);if(d.score===0){d.closed=true;ctx.discoClosed=true;}}
function selectDisco(ctx,type,fn){
 if(!ctx.context.discoActive)return null;
 const r=spread(ctx.config,type),d=ctx.next.disco,c=ctx.config,source=item(c,type),subchains=new Set(Object.values(c.productionRules.subChainMap));
 const lacks=mergeLacks(c,ctx.orders,counts(ctx.state),true),list=Object.entries(lacks).map(([type,num])=>({type,num})).sort((a,b)=>item(c,a.type).chainLevel-item(c,b.type).chainLevel||(subchains.has(item(c,a.type).chainId)===subchains.has(item(c,b.type).chainId)?0:subchains.has(item(c,a.type).chainId)?-1:1));
 const chains=new Set(r.pool.map(p=>item(c,p.type)?.chainId)),maxLevel=Math.floor(Math.log2(d.score+8))+1;
 for(const lack of list){const target=item(c,lack.type);if(!chains.has(target.chainId))continue;let chosen=null;
  if(difficulty(ctx,lack.type)<=d.difficultyLevel&&type!==c.productionRules.rawFishType&&!c.productionRules.specialGeneratorChains.includes(source.chainId)){
   chosen=lack.type;if(difficulty(ctx,chosen)>maxLevel)for(let level=target.chainLevel-1;level>=1;level--){chosen=at(c,target.chainId,level);if(chosen&&difficulty(ctx,chosen)<=maxLevel)break;}
  }else {
   const pool=r.pool.filter(p=>item(c,p.type)?.chainId===target.chainId);if(!pool.length)continue;const origin=item(c,weighted(pool,fn));
   for(let level=Math.min(origin.chainLevel+3,maxLevel);level>=1;level--)if(lack.num>=2**(level-1)){chosen=at(c,target.chainId,level);break;}
  }
  if(chosen){reduceDisco(ctx,2**(difficulty(ctx,chosen)-1));return {type:chosen,level:item(c,chosen).chainLevel};}
 }
 return null;
}
function limitDisco(ctx,plan){
 if(!ctx.context.discoActive)return {type:plan.type,ratio:plan.ratio,costCount:0};
 let type=plan.type,ratio=plan.ratio,level=item(ctx.config,type)?.chainLevel;const chain=item(ctx.config,type)?.chainId;if(!level)bad('디스코 보정 결과 타입이 없습니다.');
 const budget=ctx.next.disco.score+8;let cost=2**(difficulty(ctx,type)-1);
 while(budget<cost){level--;type=at(ctx.config,chain,level);if(!type)bad('디스코 하위 보정 타입이 없습니다.');cost=2**(difficulty(ctx,type)-1);ratio--;if(level===1)break;}
 reduceDisco(ctx,cost);return {type,ratio,costCount:0};
}
function fishNet(ctx,type,ratio){
 if(!ctx.context.fishNetSmartActive)return type;
 const c=ctx.config,info=item(c,type);if(info?.chainId!==c.productionRules.rawFishChain)return type;
 const max=Math.max(...c.items.filter(i=>i.chainId===info.chainId).map(i=>i.chainLevel)),stock=counts(ctx.state,true);let total=0;
 for(let level=1;level<max;level++)total+=(stock[at(c,info.chainId,level)]||0)*2**(level-1);
 const cap=2**(max-1),gap=cap-total%cap;if(gap===cap||!Number.isInteger(Math.log2(gap)))return type;
 if(gap>=2**ratio)for(let level=1+ratio;level<=Math.min(3+ratio,max);level++)if(2**(level-1)===gap&&level<info.chainLevel)return at(c,info.chainId,level);
 return type;
}
function extraBase(ctx,snapshot,fn){
 const gb=ctx.input.generatorBoost||{},state=ctx.next.generatorBoost;if(!gb.active||!gb.extraProduce||!sourceSupports(ctx.config,snapshot.generatorType))return {extra:false};
 // BuffSmart returns before TryExtraProduceItem; only GeneratorBoostSmart
 // invokes that extra-production selector for a smart result.
 if(snapshot.smart&&!gb.smart)return {extra:false};
 let selected=state.extraCached;
 if(!selected){let b=state.extraBucket;if(b.totalLeft===0)b=state.extraBucket={totalLeft:gb.extraChance[0],luckyLeft:gb.extraChance[1]};selected=b.luckyLeft>=roll(fn,b.totalLeft);b.totalLeft--;if(selected)b.luckyLeft--;}
 if(!selected)return {extra:false};
 if(slotsFree(ctx.state)>=2){state.extraCached=false;ctx.extra=true;return {extra:true};}
 state.extraCached=true;return {extra:false};
}
export function discoActivationEffects(state,c){
 const rules=c.productionRules;if(!rules)return [];
 return [...state.board,...(state.inventory?.items||[])].filter(cell=>cell&&!cell.cover&&rules.generatorItemTypes.includes(cell.type)&&spread(c,cell.type)?.costEnergy&&state.generatorState[cell.uid]?.charges===0&&state.generatorState[cell.uid]?.timerStart!==null&&state.generatorState[cell.uid]?.timerStart!==undefined).map(cell=>cell.uid);
}
/** Source logic activation only. Board skips require zero charges, whereas
 * stored generators receive OnTimeSkip for any active timer. The later played
 * animation events are separate and are not synthesized by this helper. */
export function noCooldownActivationEffects(state,c,previousInput={},nextInput={}){
 const previousGB=previousInput?.generatorBoost,nextGB=nextInput?.generatorBoost;
 const buff=nextInput?.buffNoCooldown===true&&previousInput?.buffNoCooldown!==true,
  generator=nextGB?.active===true&&nextGB.noCooldown===true&&!(previousGB?.active===true&&previousGB.noCooldown===true);
 if(!buff&&!generator)return [];
 const selected=[];
 for(const [cells,stored]of [[state.board,false],[state.inventory?.items||[],true]])for(const cell of cells){
  if(!cell||cell.cover||state.bubbles?.[cell.uid])continue;
  const v=state.generatorState?.[cell.uid],base=spread(c,cell.type),r=v?.ruleSnapshot||base;
  if(!r||v?.timerStart===null||v?.timerStart===undefined||!stored&&v.charges!==0)continue;
  const supportsBuff=r.costEnergy&&r.cooldownSeconds!==null,
   supportsGenerator=supportsBuff||cell.type===c.productionRules?.rawFishType;
  // Board GeneratorBoost logic dispatches OnTimeSkipInZeroRestNumber, which
  // adds IsGeneratorItem + CostEnergy guards. Store dispatches OnTimeSkip.
  const generatorEligible=supportsGenerator&&(stored||r.costEnergy&&c.productionRules?.generatorItemTypes?.includes(cell.type));
  if(buff&&supportsBuff||generator&&generatorEligible)selected.push(cell.uid);
 }
 return [...new Set(selected)];
}
export function createProductionModifierPlan(state,config,input={}){
 try{
  config=productionConfigFor(config,input);
  validateInputs(state,config,input);const original=structuredClone(state.productionModifiers??createProductionModifiers()),next=structuredClone(original),rules=config.productionRules||{};
  if(input.lucky?.active){const current=!!config.productionView?.luckyMode&&!!rules.boostLuckyConfigs?.[config.productionView.luckyMode],previous=next.lucky.boostConfigActive??false;if(current!==previous)for(const r of rules.luckyConfigs)for(const t of r.generators)delete next.lucky.buckets[t];next.lucky.boostConfigActive=current;}
  const now=state.wallet.time,level=state.wallet.level,ranges=[...(input.lucky?.specialRanges||[])].sort((a,b)=>a.range[0]-b.range[0]);
  if(ranges.length&&Math.floor(now/86400)!==Math.floor(next.lucky.resetAt/86400)){next.lucky.energyCost=0;next.lucky.freeThresholds=[];next.lucky.rangeIndex=null;next.lucky.resetAt=now;}
  if(ranges.length&&next.lucky.rangeIndex===null)next.lucky.rangeIndex=rangeIndex(ranges,next.lucky.energyCost);
  if(input.disco?.active&&next.disco===null)next.disco={score:input.disco.score,property:input.disco.property,difficultyLevel:input.disco.difficultyLevel};
  const source=input.generatorType,r=spread(config,source),discoActive=!!input.disco?.active&&next.disco?.score>0&&rules.generatorItemTypes?.includes(source)&&r?.costEnergy===true;
  const gb=input.generatorBoost||{},context={luckyActive:input.lucky?.active===true,discoActive:!!discoActive,smartProduceActive:!!(input.smartProduce?.active||gb.active&&gb.smart)&&sourceSupports(config,source),fishNetSmartActive:input.fishNet?.active===true,...(input.energyInfinite===undefined?{}:{energyInfinite:input.energyInfinite}),...(input.itemLandOpt===undefined?{}:{itemLandOpt:input.itemLandOpt})};
  const ctx={state,config,input,original,next,now,level,ranges,context,orders:input.orders??state.orders?.slots??[],energyRecorded:false,extra:false,extraLucky:false,discoClosed:false,lastRandom:null};let finalized=null;
  function invoke(fn,snapshot){const random=snapshot.random;ctx.lastRandom=random||ctx.lastRandom;return fn(random);}
  return {ok:true,context,hooks:{
   resolveLucky:s=>invoke(fn=>selectLucky(ctx,s.type,s.maxBoostRatio,fn),s),
   resolveDisco:s=>invoke(fn=>selectDisco(ctx,s.type,fn),s),
   resolveDiscoLimit:s=>limitDisco(ctx,s),
   resolveSmartProduce:s=>invoke(fn=>selectSmartProduce(ctx,s.type,fn),s),
   resolveFishNet:s=>fishNet(ctx,s.type,s.ratio),
   afterBaseGeneration:s=>invoke(fn=>extraBase(ctx,s,fn),s),
   afterEnergyConsumed:s=>{ctx.lastRandom=s.random||ctx.lastRandom;updateEnergy(ctx,s,s.random||ctx.lastRandom);},
   planAdditionalSpreads:s=>{const additionalSpreads=[];if(ctx.extra)additionalSpreads.push({type:s.type,count:1,costEnergy:false,reason:'generator-boost-extra'});if(ctx.extraLucky)additionalSpreads.push({type:s.type,count:1,costEnergy:false,reason:'generator-boost-extra-lucky'});ctx.extraApplied=true;return {additionalSpreads};},
  },getState:()=>structuredClone(next),
  finalize(receipt){
   if(finalized)return structuredClone(finalized);
   if(!receipt.ok)return {ok:false,state:structuredClone(original),effects:{}};
   updateEnergy(ctx,receipt,ctx.lastRandom);
   const uid=input.generatorUid??receipt.sourceUid,chosen=uid!==undefined?state.board.find(c=>c?.uid===uid):state.board.filter(c=>c?.type===source).length===1?state.board.find(c=>c?.type===source):null;
   const current=chosen&&state.generatorState[chosen.uid],noCD=(input.buffNoCooldown&&r?.costEnergy&&r.cooldownSeconds!==null||gb.active&&gb.noCooldown&&sourceSupports(config,source));
   const additionalSpreads=[];
   if(ctx.extra&&!ctx.extraApplied)additionalSpreads.push({type:receipt.type,count:1,costEnergy:false,reason:'generator-boost-extra'});
   if(ctx.extraLucky&&!ctx.extraApplied)additionalSpreads.push({type:receipt.type,count:1,costEnergy:false,reason:'generator-boost-extra-lucky'});
   finalized={ok:true,state:structuredClone(next),effects:{additionalSpreads,skipSourceCooldown:!!noCD&&current?.charges===0&&current.timerStart!==null&&current.timerStart!==undefined,discoClosed:ctx.discoClosed}};
   return structuredClone(finalized);
  }};
 }catch(error){return {ok:false,message:error.message,reason:error.reason||'invalid-modifier-snapshot'};}
}
