import {tutorialEconomyFor} from './tutorial-economy.mjs';
// Packaged-static ItemSpread model. Event/server snapshots are explicit inputs.
// RNG is the portable research xorshift (or an injected pure random source),
// never a claim about original-game random sequence or live event rates.
const integer=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const ok=(message,extra={})=>({ok:true,message,...extra});
const fail=(message,reason='blocked')=>({ok:false,message,reason});
const item=(c,t)=>c.items?.find(x=>x.type===t);
export const spreadFor=(config,type)=>config.spreadRules?.byType?.[type]||null;
const INSTANCE_FIELDS=['auto','weightType','pool','batch','storage','costEnergy','cooldownSeconds','storageRecoverySeconds','initSeconds','openSeconds','initSpeedUpCost','openSpeedUpCost','itemSpeedUpCost','storageSpeedUpCost','transformAfter','transformPool'];
const snapshotRule=r=>Object.fromEntries(INSTANCE_FIELDS.map(k=>[k,structuredClone(r[k])]));
const baselineRule=(c,t)=>c.productionView?.baseByType?.[t]||spreadFor(c,t);
const poolSignature=pool=>pool.map(p=>`${p.type}-${p.weight}`).join(';');
function knownRules(c,type){return [spreadFor(c,type),c.productionView?.baseByType?.[type],...Object.values(c.productionRules?.boostItemConfigs||{}).map(rows=>rows[type])].filter(Boolean);}
function sameSnapshot(a,r){return !!a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length===INSTANCE_FIELDS.length&&INSTANCE_FIELDS.every(k=>Object.hasOwn(a,k)&&JSON.stringify(a[k])===JSON.stringify(r[k]));}
function effectiveRule(type,v,c){const current=spreadFor(c,type),snapshot=v.ruleSnapshot||snapshotRule(baselineRule(c,type));return durations({...current,...snapshot,...(snapshot.weightType===1?{pool:current.pool}:{})},v);}
const phaseFor=r=>r.initSeconds!==null?'initializing':r.openSeconds!==null?'closed':'opened';
const duration=(r,v)=>v.phase==='initializing'?r.initSeconds:v.phase==='opening'?r.openSeconds:v.phase==='opened'?(v.storage===0?r.storageRecoverySeconds:r.cooldownSeconds):null;
function durations(r,context={}){
 if(context.forcedTimerDuration===undefined)return r;
 if(!integer(context.forcedTimerDuration))throw new TypeError('Invalid tutorial forced timer');
 return {...r,...Object.fromEntries(['initSeconds','openSeconds','cooldownSeconds','storageRecoverySeconds'].map(k=>[k,r[k]===null?null:context.forcedTimerDuration]))};
}
export function createSpreadState(type,config,time=0,context={}){
 const source=spreadFor(config,type);if(!source)return null;
 const r=durations(source,context),phase=phaseFor(r),start=phase==='initializing'?time:null;
 return {charges:r.batch,storage:r.storage,timerStart:start,readyAt:start===null?0:start+r.initSeconds,phase,spreadCount:0,deck:r.weightType===2?r.pool.map(p=>p.weight):null,ruleSnapshot:snapshotRule(source),
  ...(context.forcedTimerDuration===undefined?{}:{forcedTimerDuration:context.forcedTimerDuration})};
}
export function migrateSpreadState(type,old,config,time=0){
 if(!old)return createSpreadState(type,config,time);
 if(old.phase!==undefined)return {...structuredClone(old),...(old.ruleSnapshot?{}:{ruleSnapshot:snapshotRule(baselineRule(config,type)),legacySnapshot:true})};
 const fresh=createSpreadState(type,config,time);if(!fresh)return null;
 // Old16 had no lifetime count. It has no transformAfter dependency, so retain
 // resource/timer fields and label the unavailable historic counter explicitly.
 return {...fresh,...structuredClone(old),phase:'opened',spreadCount:0,legacyCounter:true,ruleSnapshot:snapshotRule(baselineRule(config,type))};
}
function entry(s,index,c){
 const cell=s.board?.[index],r=cell&&spreadFor(c,cell.type);if(!cell||!r||cell.cover||s.bubbles?.[cell.uid])return null;
 const original=s.generatorState?.[cell.uid];if(!original)return null;
 const v=original.phase===undefined||!original.ruleSnapshot?migrateSpreadState(cell.type,original,c,s.wallet.time):original;
 return {cell,r:effectiveRule(cell.type,v,c),v,original};
}
function refresh(r,v,now){
 for(let guard=0;guard<3;guard++){
  if(v.timerStart===null){
   if(v.phase==='initializing'||v.phase==='opening'||v.phase==='opened'&&r.cooldownSeconds!==null&&(v.charges<r.batch||v.storage===0)){
    v.timerStart=now;v.readyAt=now+duration(r,v);
   }
   return;
  }
  const d=duration(r,v);if(d===null){v.timerStart=null;v.readyAt=0;return;}
  v.readyAt=v.timerStart+d;if(now<v.readyAt)return;
  if(v.phase==='initializing'||v.phase==='opening'){v.phase='opened';v.timerStart=null;v.readyAt=0;return;}
  if(v.storage===0){v.charges=r.batch;v.storage=r.storage;v.timerStart=null;v.readyAt=0;return;}
  const recovered=r.batch-v.charges;v.charges=r.batch;v.storage=Math.max(0,v.storage-recovered);
  if(v.storage===0)v.timerStart+=r.cooldownSeconds;else {v.timerStart=null;v.readyAt=0;return;}
 }
}
export function refreshSpread(s,index,c){const e=entry(s,index,c);if(!e)return fail('지원 생성기 상태가 없습니다.');refresh(e.r,e.v,s.wallet.time);Object.assign(e.original,e.v);return ok('생성기 타이머 반영');}
export function openSpreadItem(s,index,c){
 const e=entry(s,index,c);if(!e||e.v.phase!=='closed')return fail('열기를 시작할 닫힌 상자가 없습니다.');
 if(s.board.some((cell,i)=>i!==index&&cell&&s.generatorState[cell.uid]?.phase==='opening'))return fail('다른 상자의 열기가 끝난 뒤 시작하세요.');
 e.v.phase='opening';e.v.timerStart=null;refresh(e.r,e.v,s.wallet.time);Object.assign(e.original,e.v);return ok('상자 열기 시작 · 재화는 소비하지 않습니다.',{cells:[index]});
}
export function getSpeedUpCost(s,index,c,{forcedCost}={}){
 const e=entry(s,index,c);if(!e||e.v.timerStart===null)return fail('진행 중인 타이머가 없습니다.');
 const d=duration(e.r,e.v),base=e.v.phase==='initializing'?e.r.initSpeedUpCost:e.v.phase==='opening'?e.r.openSpeedUpCost:e.v.storage===0?e.r.storageSpeedUpCost:e.r.itemSpeedUpCost;
 const cost=forcedCost??tutorialEconomyFor(s).forcedSkipCost??Math.max(1,Math.ceil((1-(d===0?1:Math.min((s.wallet.time-e.v.timerStart)/d,1)))*(base||0)));
 if(!integer(cost))return fail('검증된 건너뛰기 비용이 필요합니다.');
 return ok('현재 타이머의 원본 비례 비용',{cost});
}
export function speedUpSpread(s,index,c,{free=false,forcedCost}={}){
 const quote=getSpeedUpCost(s,index,c,{forcedCost});if(!quote.ok)return quote;
 const e=entry(s,index,c),d=duration(e.r,e.v),cost=quote.cost;
 if(!free&&s.wallet.gems<cost)return fail(`젬 ${cost}개 필요`,'energy');
 if(!free)s.wallet.gems-=cost;e.v.timerStart=s.wallet.time-d;refresh(e.r,e.v,s.wallet.time);Object.assign(e.original,e.v);
 return ok(`${free?'명시 연구 무료 입력':'젬 −'+cost} · 현재 타이머 건너뛰기`,{cells:[index],cost:free?0:cost});
}
function random(s,h){
 if(h.random){const n=h.random();if(!Number.isFinite(n)||n<0||n>=1)throw new RangeError('Random must be in [0,1)');return n;}
 let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;
}
function pick(s,h,values,weights=values.map(()=>1)){
 const total=weights.reduce((a,b)=>a+b,0);if(total<=0||!values.length)return null;
 let at=Math.floor(random(s,h)*total);for(let i=0;i<values.length;i++){if(at<weights[i])return {value:values[i],index:i};at-=weights[i];}return null;
}
function ring(s,center){let x=center%7,y=Math.floor(center/7);for(let n=1;n<9;n++){x--;y--;for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]])for(let i=0;i<2*n;i++){x+=dx;y+=dy;if(x>=0&&x<7&&y>=0&&y<9&&s.board[y*7+x]===null)return y*7+x;}}return -1;}
function circle(s,center){const x=center%7,y=Math.floor(center/7);for(const [dx,dy]of [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]){const a=x+dx,b=y+dy;if(a>=0&&a<7&&b>=0&&b<9&&s.board[b*7+a]===null)return b*7+a;}return -1;}
/** ItemLandOpt is an explicit server input, absent means original false path.
 * Equal-key Lua sort order is unspecified; row iteration is the research tie
 * policy only where the source has no further comparator. */
export function findEmptySpreadPosition(s,type,c,center=null){
 const info=item(c,type);if(!info)return -1;
 const directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]],distance=i=>Math.abs(i%7-(center??0)%7)+Math.abs(Math.floor(i/7)-Math.floor((center??0)/7));
 const cells=s.board.map((cell,index)=>({cell,index})).filter(x=>x.cell),plain=x=>!x.cell.cover&&!s.bubbles?.[x.cell.uid];
 const same=cells.filter(x=>x.cell.type===type&&(plain(x)||x.cell.cover==='web')).sort((a,b)=>distance(a.index)-distance(b.index)||a.index%7-b.index%7||Math.floor(a.index/7)-Math.floor(b.index/7));
 const neighbor=(i,[dx,dy])=>{const x=i%7+dx,y=Math.floor(i/7)+dy;return x>=0&&x<7&&y>=0&&y<9&&s.board[y*7+x]===null?y*7+x:-1;};
 for(const dir of directions)for(const x of same){const target=neighbor(x.index,dir);if(target>=0)return target;}
 const chain=cells.filter(x=>plain(x)&&item(c,x.cell.type)?.chainId===info.chainId).sort((a,b)=>Math.abs(info.chainLevel-item(c,a.cell.type).chainLevel)-Math.abs(info.chainLevel-item(c,b.cell.type).chainLevel)||item(c,a.cell.type).chainLevel-item(c,b.cell.type).chainLevel);
 for(const x of chain)for(const dir of directions){const target=neighbor(x.index,dir);if(target>=0)return target;}
 return center===null?s.board.findIndex(cell=>cell===null):ring(s,center);
}
const reqs=o=>(o.requirements||[]).flatMap(r=>typeof r==='string'?[r]:Array(r.count).fill(r.type));
function stock(s,cache=false){
 const counts={};for(const cell of [...s.board,...(s.inventory?.items||[])])if(cell&&!cell.cover&&!s.bubbles?.[cell.uid])counts[cell.type]=(counts[cell.type]||0)+1;
 if(cache)for(const r of s.queue||[])counts[r.type]=(counts[r.type]||0)+r.count;return counts;
}
const configMap=c=>Object.fromEntries((c.orderRules?.itemConfig||[]).map(r=>[r.Code,r]));
function unlockedChain(s,c,chain,context){
 if(Array.isArray(context.unlockedGeneratorChains))return context.unlockedGeneratorChains.includes(chain);
 if(!s.itemUnlocks)return null;
 return (c.orderRules?.chainGenerators?.[chain]||[]).some(t=>s.itemUnlocks[t]===true);
}
function orderCode(s,r,c,h,context){
 if(!Array.isArray(context.orders))return {error:'주문형 상자는 전체 활성 주문 스냅샷이 필요합니다.'};
 const cfg=configMap(c),have=stock(s),lacks={};
 // CalculateOrderCodeLackNumMap uses mergeable lower-level stock as well as
 // exact pieces; this differs from the ordinary deliverable-stock check.
 for(const order of context.orders)for(const type of reqs(order)){
  const target=item(c,type);if(!target)continue;let need=1,previous=target.chainLevel;
  for(let level=target.chainLevel;level>=1;level--){
   need*=2**(previous-level);const lower=c.items.find(i=>i.chainId===target.chainId&&i.chainLevel===level),count=lower?have[lower.type]||0:0;
   if(count>=need){have[lower.type]=count-need;need=0;break;}
   if(lower)have[lower.type]=0;need-=count;previous=level;
  }
  if(need>0)lacks[type]=(lacks[type]||0)+need;
 }
 let candidates=Object.keys(lacks).filter(t=>cfg[t]).map(type=>({type,weight:Math.min(cfg[type].DiffScore,300)*(context.boostOrderTypes?.includes(type)?1000:1)}));
 while(candidates.length){const chosen=pick(s,h,candidates,candidates.map(x=>x.weight));candidates.splice(chosen.index,1);const target=item(c,chosen.value.type),lower=r.pool.filter(p=>item(c,p.type)?.chainId===target?.chainId&&item(c,p.type).chainLevel<target.chainLevel);if(lower.length){const p=pick(s,h,lower).value;return {type:p.type,costCount:p.weight};}}
 const valid=r.pool.filter(p=>item(c,p.type)&&unlockedChain(s,c,item(c,p.type).chainId,context)===true);
 if(!s.itemUnlocks&&!Array.isArray(context.unlockedGeneratorChains))return {error:'주문형 fallback의 생산기 해금 정보가 필요합니다.'};
 const p=pick(s,h,valid.length?valid:r.pool)?.value;return p?{type:p.type,costCount:p.weight}:{error:'선택 가능한 주문형 아이템이 없습니다.'};
}
function customCode(s,r,v,c,h,context){
 if(!Array.isArray(context.orders))return {error:'커스텀 상자에 활성 주문·보관 재고 스냅샷이 필요합니다.'};
 if(!s.itemUnlocks&&!Array.isArray(context.unlockedGeneratorChains))return {error:'커스텀 fallback의 생산기 해금 정보가 필요합니다.'};
 const cfg=configMap(c),have=stock(s),orders=[];
 for(const order of context.orders){const missing=[];for(const type of reqs(order))if(cfg[type]){if((have[type]||0)>0)have[type]--;else missing.push(type);}const score=missing.reduce((a,t)=>a+cfg[t].DiffScore,0);if(score>0)orders.push({missing,score});}
 orders.sort((a,b)=>a.score-b.score);let budget=v.charges;const out=[];
 for(const order of orders){if(budget<=0)break;if(budget+10>=order.score){out.push(...order.missing);budget-=order.score;continue;}
  for(const type of [...order.missing].sort((a,b)=>cfg[a].DiffScore-cfg[b].DiffScore)){
   if(budget<=0)break;if(budget>=cfg[type].DiffScore){out.push(type);budget-=cfg[type].DiffScore;continue;}
   const target=item(c,type);let chosen=type;
   for(let level=target.chainLevel;level>=1;level--){const lower=c.items.find(i=>i.chainId===target.chainId&&i.chainLevel===level);if(lower&&cfg[lower.type]){chosen=lower.type;if(cfg[chosen].DiffScore<=21)break;}}
   const n=Math.ceil(budget/cfg[chosen].DiffScore);for(let i=0;i<n;i++){out.push(chosen);budget-=cfg[chosen].DiffScore;}
  }
 }
 const fifth=Object.keys(cfg).filter(t=>cfg[t].UnlockLevel<=s.wallet.level&&item(c,t)?.chainLevel===5&&unlockedChain(s,c,item(c,t).chainId,context)===true);
 if(!fifth.length)fifth.push('205');
 while(budget>0){const type=pick(s,h,fifth)?.value;if(!cfg[type])return {error:'커스텀 fallback의 205 DiffScore가 없습니다.'};out.push(type);budget-=cfg[type].DiffScore;}
 return out[0]?{type:out[0],costCount:cfg[out[0]].DiffScore}:{error:'커스텀 상자 결과가 없습니다.'};
}
function normalCode(s,r,v,c,h,context){
 if(context.forceCode!==undefined)return {type:context.forceCode,canBoost:false,branch:'tutorial'};
 if(r.weightType===1){
  const after=(code,smart)=>h.afterBaseGeneration?.({generatorType:r.type,outputType:code,smart,random:()=>random(s,h)})?.extra===true;
  if(context.smartProduceActive){if(!h.resolveSmartProduce)return {error:'스마트 생산 알고리즘 연결이 필요합니다.'};const resolved=h.resolveSmartProduce({type:r.type,orders:context.orders,stock:stock(s),random:()=>random(s,h)});if(resolved)return {type:resolved,canBoost:true,branch:'smart-produce',extra:after(resolved,true)};}
  const signature=poolSignature(r.pool),previous=s.poolSignatures[r.type]??poolSignature(baselineRule(c,r.type).pool);
  let pool=s.pools[r.type];if(!pool||previous!==signature||pool.reduce((a,b)=>a+b,0)===0)pool=s.pools[r.type]=r.pool.map(p=>p.weight);s.poolSignatures[r.type]=signature;
  const selected=pick(s,h,r.pool,pool);if(!selected)return {error:'고정 덱이 비어 있습니다.'};pool[selected.index]--;return {type:selected.value.type,canBoost:true,branch:'fixed',extra:after(selected.value.type,false)};
 }
 if(r.weightType===2){const selected=pick(s,h,r.pool,v.deck);if(!selected)return {error:'감소 덱이 비어 있습니다.'};v.deck[selected.index]--;return {type:selected.value.type,canBoost:false,branch:'decremental'};}
 if(r.weightType===3)return {...orderCode(s,r,c,h,context),canBoost:false,branch:'order'};
 if(r.weightType===4)return {...customCode(s,r,v,c,h,context),canBoost:false,branch:'custom'};
 if(r.weightType===5){
  if(!h.resolveSmart)return {error:'SmartRewardHelper 전체 포팅이 남아 있어 검증된 resolver가 필요합니다.'};
  if(!Array.isArray(context.orders))return {error:'스마트 보상에는 활성 주문 스냅샷이 필요합니다.'};
  const scoreMap=Object.fromEntries(Object.entries(configMap(c)).filter(([,i])=>i.DiffScore<=r.storage).map(([t,i])=>[t,i.DiffScore]));
  const type=h.resolveSmart({scoreMap,budget:v.charges,orders:context.orders,stock:stock(s),resultCount:1,isNeedUpFind:true,random:()=>random(s,h)});
  return type&&scoreMap[type]!==undefined?{type,costCount:scoreMap[type],canBoost:false,branch:'smart-external'}:{error:'검증 resolver 결과가 스마트 점수표에 없습니다.'};
 }
 return {error:'정의되지 않은 생산 가중치 타입입니다.'};
}
function boostCode(s,code,ratio,c,context){
 const start=item(c,code);if(!start)return {type:code,ratio};
 const have={};for(const cell of s.board)if(cell&&!cell.cover&&!s.bubbles?.[cell.uid])have[cell.type]=(have[cell.type]||0)+1;
 const required={};for(const order of context.orders||[])for(const t of reqs(order))required[t]=(required[t]||0)+1;
 const totalStock=stock(s),lack=context.orderLackCounts??Object.fromEntries(Object.entries(required).filter(([t,n])=>n>(totalStock[t]||0)));
 let actual=ratio;
 for(let i=0;i<=ratio;i++){
  const next=c.items.find(x=>x.chainId===start.chainId&&x.chainLevel===start.chainLevel+i);if(!next)continue;
  if(Object.hasOwn(lack,next.type)&&lack[next.type]!==false&&lack[next.type]!==null||start.chainLevel+i<ratio+1&&have[next.type]!==undefined&&Math.max(have[next.type]-(required[next.type]||0),0)%2===1){actual=i;break;}
 }
 for(let n=0;n<actual;n++)code=item(c,code)?.next||code;return {type:code,ratio:actual};
}
function planCode(s,r,v,c,h,context,ratio){
 if(context.luckyActive&&!context.discoActive){
  if(!h.resolveLucky)return {error:'럭키 생산은 활동 상태를 보존하는 검증 resolver가 필요합니다.'};
  const lucky=h.resolveLucky({type:r.type,maxBoostRatio:ratio,random:()=>random(s,h)});
  if(lucky){let code=lucky.type;const adjusted=lucky.adjustedBoostRatio??ratio;for(let i=0;i<adjusted;i++)code=item(c,code)?.next||code;return {type:code,ratio:adjusted,skipCounters:true,branch:'lucky-external'};}
 }
 if(context.discoActive){
  if(!h.resolveDisco)return {error:'디스코 생산의 검증 resolver가 필요합니다.'};
  const disco=h.resolveDisco({type:r.type,random:()=>random(s,h)});if(disco?.type)return {type:disco.type,ratio:0,skipCounters:true,branch:'disco-external'};
  ratio=3;
 }
 let plan=normalCode(s,r,v,c,h,context);if(plan.error)return plan;
 const boosted=plan.canBoost?boostCode(s,plan.type,ratio,c,context):{type:plan.type,ratio:0};plan={...plan,...boosted};
 if(context.fishNetSmartActive){if(!h.resolveFishNet)return {error:'어망 스마트 보정 resolver가 필요합니다.'};plan.type=h.resolveFishNet({type:plan.type,ratio:plan.ratio,stock:stock(s)});}
 if(context.discoActive){if(!h.resolveDiscoLimit)return {error:'디스코 최종 보정 알고리즘 연결이 필요합니다.'};plan={...plan,...h.resolveDiscoLimit({...plan,random:()=>random(s,h)}),costCount:0};}
 return plan;
}
function applyCount(s,r,v,plan,context){
 if(plan.skipCounters)return;
 v.spreadCount++;
 let count=plan.costCount;
 if(count===undefined){
  if(r.weightType===3)count=r.pool.find(p=>p.type===plan.type)?.weight;
  else if(r.cooldownSeconds===null)count=2**plan.ratio;
  else if(context.boostRatio>0&&Array.isArray(context.boostCostSequence)&&context.boostCostSequence.length){
   const key=String(2**plan.ratio),at=s.boostIndices[key]||0;count=context.boostCostSequence[at]??context.boostCostSequence[0];s.boostIndices[key]=(at+1)%context.boostCostSequence.length;
  }else count=1;
 }
 if(!integer(count))throw new RangeError('Invalid spread score cost');v.charges=Math.max(0,v.charges-count);
 refresh(r,v,s.wallet.time);
}
function perform(s,index,c,h,context,automatic){
 if(!integer(index,62)||typeof h?.makeCell!=='function'||typeof h?.removeCell!=='function')return fail('생성·제거 콜백과 보드 칸이 필요합니다.');
 const e=entry(s,index,c);if(!e)return fail('생성 가능한 지원 아이템이 아닙니다.');
 const {cell,r}=e;if(e.v.phase!=='opened'||e.v.charges===0)return fail(e.v.phase==='closed'?'먼저 상자 열기를 시작하세요.':'충전·초기화·오픈 완료를 기다리세요.','state');
 if(automatic&&!r.auto)return fail('자동 생성 타입이 아닙니다.');
 const neighbor=r.auto?circle(s,index):-1;
 if(!automatic&&r.auto&&neighbor>=0)return fail('빈 인접 칸에는 자동 생성이 먼저 진행됩니다.');
 const slot=automatic?neighbor:(h.findSlot?h.findSlot(index):ring(s,index));if(slot<0)return fail('생성할 빈칸이 없습니다.','board-full');
 if(context.unresolvedBranches?.length)return fail('미확인 활동 분기가 있어 기본 생산으로 대체하지 않습니다.');
 const requested=context.discoActive?3:(c.spreadRules.boostTargetTypes?.includes(cell.type)?context.boostRatio??0:0);
 if(!integer(requested,3))return fail('부스트 지수는 검증 연구 입력0–3 범위입니다.');
 const costEnergy=(context.forceCostEnergy??r.costEnergy)&&!automatic&&!context.discoActive;
 if(context.energyInfinite!==undefined&&typeof context.energyInfinite!=='boolean')return fail('무한 에너지 상태는 명시 boolean 입력이어야 합니다.');
 if(context.itemLandOpt!==undefined&&typeof context.itemLandOpt!=='boolean'||context.tutorialBoard!==undefined&&typeof context.tutorialBoard!=='boolean')return fail('아이템 배치 서버·튜토리얼 보드 입력은 boolean이어야 합니다.');
 if(costEnergy&&!context.energyInfinite&&s.wallet.energy<2**requested)return fail(`요청 부스트의 최대 에너지 ${2**requested}개가 필요합니다.`,'energy');
 // Plan decks, RNG and counters in a draft; blocked subsystems cannot consume
 // partial resources. Injected resolvers/random must be pure planning callbacks.
 const draft={...s,wallet:{...s.wallet},pools:structuredClone(s.pools||{}),poolSignatures:{...(s.poolSignatures||{})},rng:s.rng,boostIndices:{...(s.boostIndices||{})}},v=structuredClone(e.v);
 let plan;try{plan=planCode(draft,r,v,c,h,context,automatic?0:requested);}catch{return fail('입력 resolver 또는 연구 난수 값이 올바르지 않습니다.');}
 if(plan.error)return fail(plan.error);
 if(!item(c,plan.type)||!(integer(plan.ratio,3)||context.discoActive&&Number.isSafeInteger(plan.ratio)&&plan.ratio>=-30&&plan.ratio<=3))return fail('지원 타입으로 검증된 생산 결과가 필요합니다.');
 const transform=!plan.skipCounters&&r.transformAfter!==null&&v.spreadCount+1===r.transformAfter;
 if(transform&&(!r.transformPool.length||r.transformPool.some(p=>!item(c,p.type))))return fail('다음 변형 타입 근거가 없습니다.');
 const requestedEnergy=costEnergy?2**plan.ratio:0,debitSucceeded=!costEnergy||context.energyInfinite===true||s.wallet.energy>=requestedEnergy;
 // EnergyModel.SubtractEnergy returns false for insufficient actual Lucky
 // adjusted cost; source SpreadCostEnergy ignores that return. Preserve the
 // produced item and zero debit instead of creating a negative wallet.
 const energy=costEnergy&&debitSucceeded&&!context.energyInfinite?requestedEnergy:0;
 let replacement=null,additional=[],outputSlot=slot;
 try{
  applyCount(draft,r,v,plan,context);
  if(!automatic)h.afterEnergyConsumed?.({type:plan.type,energy,requestedEnergy,costEnergy,debitSucceeded,boostRatio:plan.ratio,branch:plan.branch,extra:plan.extra===true,automatic,energyAfter:s.wallet.energy-energy,random:()=>random(draft,h)});
  if(!automatic&&context.itemLandOpt&&!context.tutorialBoard){const preferred=findEmptySpreadPosition(s,plan.type,c,index);if(preferred>=0)outputSlot=preferred;}
  const requests=h.planAdditionalSpreads?.({type:plan.type,sourceIndex:index,sourceUid:cell.uid})?.additionalSpreads||[];
  if(!Array.isArray(requests)||requests.some(r=>!item(c,r.type)||!integer(r.count,16)||r.count===0||r.costEnergy!==false))throw new Error('Invalid additional spread plan');
  const temporary={...s,board:[...s.board]};temporary.board[outputSlot]={type:plan.type};
  for(const request of requests)for(let n=0;n<request.count;n++){const target=context.itemLandOpt&&request.reason!=='generator-boost-extra-lucky'?findEmptySpreadPosition(temporary,request.type,c,index):ring(temporary,index);if(target>=0){additional.push({slot:target,type:request.type,reason:request.reason});temporary.board[target]={type:request.type};}}
  if(transform)replacement=pick(draft,h,r.transformPool,r.transformPool.map(p=>p.weight))?.value.type;
 }catch{return fail('생산 예산·보정 이벤트·변형 설정을 확인하지 못했습니다.');}
 const made=h.makeCell(plan.type);s.board[outputSlot]=made;s.pools=draft.pools;s.rng=draft.rng;
 if(Object.keys(draft.boostIndices).length)s.boostIndices=draft.boostIndices;
 if(Object.keys(draft.poolSignatures).length)s.poolSignatures=draft.poolSignatures;
 Object.assign(e.original,v);s.wallet.energy-=energy;s.wallet.generated=(s.wallet.generated||0)+1;
 const changed=[outputSlot];
 // ExtraItemSpread is dispatched while the original source still exists.
 // It copies the final type without generating/debiting again; no queue fallback.
 for(const extra of additional){s.board[extra.slot]=h.makeCell(extra.type);changed.push(extra.slot);s.wallet.generated++;}
 if(replacement){h.removeCell(index);s.board[index]=h.makeCell(replacement);changed.push(index);}
 else if(!automatic&&v.charges===0&&r.cooldownSeconds===null){h.removeCell(index);changed.push(index);}
 return ok(`정적 생산 ${cell.type} → ${plan.type} · 에너지 −${energy}${debitSucceeded?'':' · 원문 실제 차감 실패 분기'}`,{cells:changed,type:plan.type,sourceUid:cell.uid,sourceIndex:index,additionalSpreads:additional,branch:plan.branch,energy,requestedEnergy,debitSucceeded,costEnergy,extra:plan.extra===true,automatic,boostRatio:plan.ratio,researchRng:true});
}
export const spreadItem=(s,index,c,h,context={})=>perform(s,index,c,h,context,false);
export const autoSpread=(s,index,c,h,context={})=>perform(s,index,c,h,context,true);
export function getChoices(s,index,c,context={}){
 const cell=s.board[index],row=cell&&c.spreadRules?.choices?.[cell.type];if(!row||cell.cover||s.bubbles?.[cell.uid])return fail('선택 상자가 아닙니다.');
 if(!row.dynamic)return ok('기본 세 가지 선택',{choices:[...row.choices]});
 if(!Array.isArray(context.orders))return fail('동적 선택에는 전체 활성 주문 스냅샷이 필요합니다.');
 if(!context.orders.length)return ok('현재 주문 없음 · 원문 첫 세 항목 fallback',{choices:row.choices.slice(0,3)});
 const have=stock(s,true),missing=[];for(const order of context.orders)for(const type of reqs(order)){if((have[type]||0)>0)have[type]--;else missing.push(type);}
 const ranked=row.choices.flatMap((type,i)=>{const candidate=item(c,type),diffs=missing.filter(t=>item(c,t)?.chainId===candidate?.chainId).map(t=>candidate.chainLevel-item(c,t).chainLevel).filter(d=>d<=0);return diffs.length?[{type,i,diff:Math.max(...diffs)}]:[];}).sort((a,b)=>b.diff-a.diff||a.i-b.i);
 const selected=ranked.slice(0,3).map(r=>r.type);for(const t of row.choices)if(selected.length<3&&!selected.includes(t))selected.push(t);
 return ok('주문·보드·창고·캐시를 반영한 선택',{choices:selected});
}
export function chooseItem(s,index,choice,c,h,context={}){
 const options=getChoices(s,index,c,context);if(!options.ok)return options;
 if(!integer(choice,options.choices.length-1)||typeof h?.makeCell!=='function'||typeof h?.removeCell!=='function')return fail('유효한 선택과 생성 콜백이 필요합니다.');
 const type=options.choices[choice];if(!item(c,type))return fail('선택 결과 타입이 지원되지 않습니다.');
 h.removeCell(index);s.board[index]=h.makeCell(type);return ok('선택 상자를 해당 아이템으로 교체했습니다.',{cells:[index],type});
}
export function describeRewardWrapper(code,c){
 const row=Object.values(c.spreadRules?.wrapperMerges||{}).find(r=>r.code===code);
 return row?{type:row.wrapperType,rewardType:row.rewardType,rewardCount:row.rewardCount,opaque:row.opaque}:null;
}
export function collectRewardWrapper(s,index,c,h){
 const cell=integer(index,62)?s.board[index]:null;
 if(!cell||cell.cover||s.bubbles?.[cell.uid]||cell.type!=='reward_bubble_1')return fail('해제할 보상 래퍼가 없습니다.');
 const row=Object.values(c.spreadRules?.wrapperMerges||{}).find(r=>r.wrapperType===cell.type&&r.rewardType===cell.rewardType&&r.rewardCount===cell.rewardCount);
 if(!row)return fail('보상 래퍼 payload의 근거가 없습니다.');
 if(typeof h?.makeCell!=='function'||typeof h?.removeCell!=='function')return fail('아이템 생성·제거 콜백이 필요합니다.');
 if(row.opaque){
  if(typeof h.allocatePack!=='function')return fail('카드팩 배분 스냅샷이 없어 래퍼를 소비하지 않습니다.','opaque-pack');
  const allocation=h.allocatePack({type:row.rewardType,count:row.rewardCount});
  if(!allocation?.ok)return fail(allocation?.message||'카드팩 배분 조건을 확인하세요.','opaque-pack');
  h.removeCell(index);return ok(allocation.message||'카드팩 획득을 기록했습니다. 카드 내용은 개봉하지 않습니다.',{cells:[index],allocation:allocation.kind});
 }
 if(!item(c,row.rewardType))return fail('검증된 보드 보상 타입이 없습니다.');
 // ItemCollectable removes itself first, then the include-center search returns
 // its own now-empty cell. This grants a board item, never invented pack cards.
 h.removeCell(index);s.board[index]=h.makeCell(row.rewardType);
 return ok('검증된 보상 래퍼에서 보드 아이템 한 개를 해제했습니다.',{cells:[index],type:row.rewardType});
}
export function validSpreadState(type,v,c,time){
 try{
  const raw=spreadFor(c,type);if(!raw||!v||typeof v!=='object'||Array.isArray(v))return false;
  if(v.phase===undefined){if(raw.weightType!==1||raw.initSeconds!==null||raw.openSeconds!==null)return false;v=migrateSpreadState(type,v,c,time);}
  else if(!v.ruleSnapshot)v=migrateSpreadState(type,v,c,time);
  if(!knownRules(c,type).some(r=>sameSnapshot(v.ruleSnapshot,r)))return false;
  const r=effectiveRule(type,v,c);if(!integer(v.charges,r.batch)||!(r.storage===null?v.storage===null:integer(v.storage,r.storage))||!['closed','opening','opened','initializing'].includes(v.phase)||!integer(v.spreadCount)||!integer(v.readyAt))return false;
  if(v.phase==='closed'&&r.openSeconds===null||v.phase==='opening'&&r.openSeconds===null||v.phase==='initializing'&&r.initSeconds===null)return false;
  if(v.timerStart!==null&&(!Number.isSafeInteger(v.timerStart)||v.timerStart< -1e9||v.timerStart>time||duration(r,v)===null||v.readyAt!==v.timerStart+duration(r,v)))return false;
  if(v.timerStart===null&&(v.readyAt!==0||['initializing','opening'].includes(v.phase)))return false;
  if(v.phase==='opened'&&r.cooldownSeconds!==null&&(v.timerStart===null&&(v.charges!==r.batch||v.storage===0)||v.timerStart!==null&&v.storage>0&&v.charges===r.batch))return false;
  if(v.phase==='closed'&&(v.timerStart!==null||v.charges!==r.batch))return false;
  if(r.weightType===2&&(!Array.isArray(v.deck)||v.deck.length!==r.pool.length||v.deck.some((n,i)=>!integer(n,r.pool[i].weight))))return false;
  if(r.weightType!==2&&v.deck!==null)return false;
  return true;
 }catch{return false;}
}
export function validSpreadPools(s,c){
 try{
  if(!s.pools||s.poolSignatures!==undefined&&(!s.poolSignatures||typeof s.poolSignatures!=='object'||Array.isArray(s.poolSignatures)))return false;
  for(const [type,pool]of Object.entries(s.pools)){
   const signature=s.poolSignatures?.[type]??poolSignature(baselineRule(c,type).pool),row=knownRules(c,type).find(r=>r.weightType===1&&poolSignature(r.pool)===signature);
   if(!row||!Array.isArray(pool)||pool.length!==row.pool.length||pool.some((n,i)=>!integer(n,row.pool[i].weight)))return false;
  }
  return Object.keys(s.poolSignatures||{}).every(type=>Object.hasOwn(s.pools,type));
 }catch{return false;}
}
