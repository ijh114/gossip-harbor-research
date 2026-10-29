// Original local port of the recovered SmartRewardHelper selection algorithms.
// It selects item TYPES from explicit packaged score maps and order/stock
// snapshots. It never allocates card packs, calls servers or invents event odds.
const PRIORITY=Object.freeze([1,2,11,3,8,4,5,18,10,15]);
const SPECIAL_SLOT=6;
const integer=(n,max=1e6)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const typeInfo=(c,type)=>c.items.find(i=>i.type===type);
const requirements=o=>(o.requirements||[]).flatMap(r=>typeof r==='string'?[r]:Array(r.count).fill(r.type));
const rank=slot=>{const index=PRIORITY.indexOf(slot);return index<0?9999:index;};
const stateReady=s=>s===3||s===4||s==='canDeliver'||s==='finished';
const explicitStates=new Set([0,1,2,3,4,'dormant','init','pending','partiallyFinished','canDeliver','finished']);

function typeAt(c,chain,level){return c.items.find(i=>i.chainId===chain&&i.chainLevel===level)?.type??(/^\d+$/.test(chain)?String(Number(chain)*100+level):`${chain}_${level}`);}
function info(c,type){
 const found=typeInfo(c,type);if(found)return found;
 if(/^\d+$/.test(type))return {type,chainId:String(Math.floor(Number(type)/100)),chainLevel:Number(type)%100};
 const match=/^(.*)_(\d+)$/.exec(type);return match?{type,chainId:match[1],chainLevel:Number(match[2])}:null;
}
const units=(c,type)=>2**(info(c,type).chainLevel-1);
const sourceFault=(type,stage)=>Object.assign(new Error(`No packaged score for ${type} at ${stage}`),{reason:'missing-score',missingType:type,stage});
function score(ctx,type,stage){const value=ctx.scores[type];if(value===undefined)throw sourceFault(type,stage);return value;}

export function validSmartSnapshot(s,c){
 try{
  if(!record(s)||!Array.isArray(c?.items)||!record(s.scoreMap)||!Object.keys(s.scoreMap).length||!integer(s.budget)||!record(s.stock)||!Array.isArray(s.orders)||s.orders.length>100)return false;
  if(s.mode!==undefined&&!['itemSpread','plane','orderBoost'].includes(s.mode))return false;
  if(s.resultCount!==undefined&&(!integer(s.resultCount,1000)||s.resultCount===0)||s.isNeedUpFind!==undefined&&typeof s.isNeedUpFind!=='boolean')return false;
  for(const [type,n]of Object.entries(s.scoreMap))if(!typeInfo(c,type)||!integer(n)||n===0)return false;
  for(const [type,n]of Object.entries(s.stock))if(typeof type!=='string'||!type||type.length>128||!integer(n))return false;
  const slots=new Set();
  for(const order of s.orders){
   if(!record(order)||!integer(order.slot,100)||order.slot===0||slots.has(order.slot)||!Array.isArray(order.requirements)||order.requirements.length>100||order.state!==undefined&&!explicitStates.has(order.state))return false;
   slots.add(order.slot);
   for(const r of order.requirements){const type=typeof r==='string'?r:r?.type;if(!typeInfo(c,type))return false;const i=typeInfo(c,type);if(typeof i.chainId!=='string'||!integer(i.chainLevel,30)||i.chainLevel===0)return false;if(typeof r!=='string'&&(!record(r)||!integer(r.count,1000)||r.count===0))return false;}
  }
  if(s.mode==='orderBoost'&&!Array.isArray(s.itemWeights))return false;
  if(s.itemWeights!==undefined&&(!Array.isArray(s.itemWeights)||s.itemWeights.some(p=>!p||!typeInfo(c,p.type)||!integer(p.weight)||p.weight===0)))return false;
  return true;
 }catch{return false;}
}
export function equivalentSmartCode(origin,scores,c){
 if(scores[origin]!==undefined)return {type:origin,multiple:1,score:scores[origin]};
 const i=info(c,origin);if(!i)return null;
 for(let level=i.chainLevel-1;level>=1;level--){const type=typeAt(c,i.chainId,level);if(scores[type]!==undefined){const multiple=2**(i.chainLevel-level);return {type,multiple,score:scores[type]*multiple};}}
 return null;
}
export function highestSmartCode(origin,scores,c){
 const chain=info(c,origin)?.chainId;let chosen=null,level=-1;
 for(const type of Object.keys(scores)){const i=info(c,type);if(i?.chainId===chain&&i.chainLevel>level){chosen=type;level=i.chainLevel;}}
 return chosen;
}
function exactReady(order,stock){const remaining={...stock};for(const t of order.requirements){if(!(remaining[t]>0))return false;remaining[t]--;}return true;}
function append(ctx,type,slot){
 score(ctx,type,'append');if(!typeInfo(ctx.config,type))throw Object.assign(new Error('Unknown configured reward type'),{reason:'unknown-type',missingType:type});
 if(ctx.items.length>=1000)throw Object.assign(new Error('Portable output bound1000'),{reason:'output-bound'});
 ctx.items.push(type);if(slot!==undefined&&slot!==null)(ctx.bySlot[slot]??=[]).push(type);
}
function helped(ctx,type){ctx.helpedItems.push(type);}
function lackFor(ctx,type,stock){
 const target=info(ctx.config,type);let need=1,previous=target.chainLevel;
 for(let level=target.chainLevel;level>=1;level--){need*=2**(previous-level);const t=typeAt(ctx.config,target.chainId,level),count=stock[t]||0;if(need<=count){stock[t]=count-need;return 0;}stock[t]=0;need-=count;previous=level;}
 return need;
}
function markOrders(ctx,priorSlots){
 const unfinished=[],finished=[];
 const ordered=[...ctx.orders].sort((a,b)=>rank(a.slot)-rank(b.slot));
 for(const order of ordered){
  if(order.slot===SPECIAL_SLOT||priorSlots&&!priorSlots.includes(order.slot))continue;
  let ready=false;
  if(stateReady(order.state)){
   const deleted={};ready=true;
   for(const type of order.requirements){if((ctx.stock[type]||0)>0){ctx.stock[type]--;deleted[type]=(deleted[type]||0)+1;}else {for(const [t,n]of Object.entries(deleted))ctx.stock[t]=(ctx.stock[t]||0)+n;ready=false;break;}}
  }
  for(const type of order.requirements)(ready?finished:unfinished).push({Code:type,Slot:order.slot});
  if(ready)ctx.trace.finishedSlots.push(order.slot);
 }
 return {unfinished,finished};
}
function sortLevelSlot(ctx,items,slotTie=true){items.sort((a,b)=>info(ctx.config,a.Code).chainLevel-info(ctx.config,b.Code).chainLevel||(slotTie?rank(a.Slot)-rank(b.Slot):0));}
function calculateLacks(ctx,items){for(const data of items)if(data.LackNum===undefined)data.LackNum=lackFor(ctx,data.Code,ctx.stock);return items.filter(data=>data.LackNum!==0);}
function equivalent(ctx,type){if(!Object.hasOwn(ctx.split,type))ctx.split[type]=equivalentSmartCode(type,ctx.scores,ctx.config);return ctx.split[type];}
function supplyScore(ctx,type,lack,upFind){
 let total=0,bit=0,remaining=lack;const chain=info(ctx.config,type).chainId;
 while(remaining>0){
  if(remaining%2===1){const current=typeAt(ctx.config,chain,bit+1);
   if(ctx.scores[current]!==undefined)total+=ctx.scores[current];
   else {const e=equivalent(ctx,current);if(e)total+=e.score;else if(upFind)for(let level=bit+2;level<=bit+6;level++){const t=typeAt(ctx.config,chain,level);if(ctx.scores[t]!==undefined){total+=ctx.scores[t];break;}}}
  }
  remaining=Math.floor(remaining/2);bit++;
 }
 return total;
}
function groupSupply(ctx,items,upFind){
 const groups=new Map();
 for(const data of items){const supply=supplyScore(ctx,data.Code,data.LackNum,upFind);const entry={...data,SupplyScore:supply};if(!groups.has(data.Slot))groups.set(data.Slot,{slot:data.Slot,supply:0,items:[]});const group=groups.get(data.Slot);group.supply+=supply;group.items.push(entry);}
 const ordered=[...groups.values()].sort((a,b)=>a.supply-b.supply);for(const group of ordered)group.items.sort((a,b)=>a.SupplyScore-b.SupplyScore);
 ctx.trace.slotSupply=ordered.map(g=>({slot:g.slot,score:g.supply}));return ordered;
}
function calculateRewards(ctx,lack,chain,slot,data){
 let remaining=lack,bit=0;
 while(remaining>0&&ctx.remainingScore>0&&data.resultCount>0){
  if(remaining%2===1){
   const type=typeAt(ctx.config,chain,bit+1);
   if(ctx.scores[type]!==undefined){append(ctx,type,slot);ctx.remainingScore-=ctx.scores[type];data.resultCount--;}
   else {const e=equivalent(ctx,type);
    if(e){let n=0;for(let j=0;j<e.multiple;j++){append(ctx,e.type,slot);data.resultCount--;n++;if(data.resultCount<=0)break;}ctx.remainingScore-=n*ctx.scores[e.type];}
    else if(data.isNeedUpFind)for(let level=bit+2;level<=bit+6;level++){const t=typeAt(ctx.config,chain,level);if(ctx.scores[t]!==undefined){append(ctx,t,slot);ctx.remainingScore-=ctx.scores[t];data.resultCount--;break;}}
   }
  }
  remaining=Math.floor(remaining/2);bit++;
 }
}
function tryReward(ctx,target,slot,data){
 if(target.SupplyScore>ctx.remainingScore+10){ctx.skipped.push({Code:target.Code,Slot:slot});return;}
 calculateRewards(ctx,target.LackNum,info(ctx.config,target.Code).chainId,slot,data);helped(ctx,target.Code);
}
function allocateGroups(ctx,groups,data){for(const group of groups){if(ctx.remainingScore<=0)break;for(const target of group.items){if(ctx.remainingScore<=0||data.resultCount<=0)break;tryReward(ctx,target,group.slot,data);}}}
function deliverSkipped(ctx,unfinished,data){
 for(const tuple of ctx.skipped){
  if(ctx.remainingScore<=0||data.resultCount<=0)break;
  const target=info(ctx.config,tuple.Code);let found=false;
  for(let level=target.chainLevel;level>=1;level--){
   const type=typeAt(ctx.config,target.chainId,level),value=ctx.scores[type];if(value===undefined||ctx.remainingScore<value)continue;
   if(level>=3){const missing=unfinished.find(d=>d.Code===tuple.Code),n1=missing?Math.ceil(missing.LackNum/units(ctx.config,type)):0,n2=Math.ceil(ctx.remainingScore/value),n=Math.min(n1,n2,data.resultCount);if(n===n1&&n>0)helped(ctx,tuple.Code);for(let i=0;i<n;i++){append(ctx,type,tuple.Slot);ctx.remainingScore-=value;data.resultCount--;if(data.resultCount<=0)break;}}
   else {const third=typeAt(ctx.config,target.chainId,3);append(ctx,third,tuple.Slot);ctx.remainingScore-=score(ctx,third,'skipped-level3');data.resultCount--;if(unfinished.some(d=>d.Code===tuple.Code&&d.LackNum<=units(ctx.config,third)))helped(ctx,tuple.Code);}
   found=true;break;
  }
  if(!found){const third=typeAt(ctx.config,target.chainId,3);append(ctx,third,tuple.Slot);ctx.remainingScore-=score(ctx,third,'skipped-no-affordable');data.resultCount--;if(unfinished.some(d=>d.Code===tuple.Code&&d.LackNum<=units(ctx.config,third)))helped(ctx,tuple.Code);}
 }
}
function nextRandom(ctx){if(typeof ctx.random!=='function')throw Object.assign(new Error('Research random callback required for this source branch'),{reason:'missing-rng'});const n=ctx.random();if(!Number.isFinite(n)||n<0||n>=1)throw Object.assign(new Error('Random must be in[0,1)'),{reason:'invalid-rng'});return n;}
function fallback(ctx,data){
 while(ctx.remainingScore>0&&data.resultCount>0){let type='205';const base=score(ctx,'205','fallback205');if(ctx.remainingScore>base&&ctx.scores['206']!==undefined)type=nextRandom(ctx)<0.5?'205':'206';append(ctx,type,null);ctx.remainingScore-=score(ctx,type,'fallback');data.resultCount--;}
}
function weightedFor(ctx,target,slot,weights){
 let lack=lackFor(ctx,target,ctx.stock);if(lack<=0)return lack;
 const chain=info(ctx.config,target).chainId,available=weights.filter(p=>info(ctx.config,p.type).chainId===chain&&info(ctx.config,p.type).chainLevel>=3&&ctx.scores[p.type]>5);
 if(!available.length)return lack;
 let limit=70,count=0;
 while(true){let at=nextRandom(ctx)*available.reduce((a,p)=>a+p.weight,0),type=available.at(-1).type;for(const p of available){if(at<p.weight){type=p.type;break;}at-=p.weight;}
  append(ctx,type,slot);count++;ctx.remainingScore-=ctx.scores[type];limit-=ctx.scores[type];lack-=units(ctx.config,type);
  if(lack<=0){helped(ctx,target);break;}if(ctx.remainingScore<=0||limit<=0)break;
 }
 ctx.trace.weightedStages.push({slot,spent:70-limit,count,remainingLack:lack});
 return lack;
}
function deliverHighest(ctx,type,slot){
 const highest=highestSmartCode(type,ctx.scores,ctx.config);if(!highest)return;
 const lack=lackFor(ctx,type,ctx.stock),n1=Math.ceil(lack/units(ctx.config,highest)),n2=Math.ceil(ctx.remainingScore/ctx.scores[highest]),n=Math.min(n1,n2);
 for(let i=0;i<n;i++){append(ctx,highest,slot);ctx.remainingScore-=ctx.scores[highest];}if(n===n1&&n>0)helped(ctx,type);
}
function runPlane(ctx,data){
 let {unfinished}=markOrders(ctx);sortLevelSlot(ctx,unfinished);unfinished=calculateLacks(ctx,unfinished);
 allocateGroups(ctx,groupSupply(ctx,unfinished,data.isNeedUpFind),data);deliverSkipped(ctx,unfinished,data);fallback(ctx,data);
}
function runOrderBoost(ctx,weights){
 const data={resultCount:1000,isNeedUpFind:false};let {unfinished}=markOrders(ctx,[1,2]);sortLevelSlot(ctx,unfinished);unfinished=calculateLacks(ctx,unfinished);
 allocateGroups(ctx,groupSupply(ctx,unfinished,false),data);const shortages={};
 if(ctx.remainingScore>0)for(const slot of [5,4,8]){const order=ctx.orders.find(o=>o.slot===slot);if(ctx.remainingScore>0&&order?.requirements[0])shortages[slot]=weightedFor(ctx,order.requirements[0],slot,weights);}
 if(ctx.remainingScore>0){
  unfinished=ctx.skipped.map(r=>({...r}));
  for(const order of ctx.orders)if(![SPECIAL_SLOT,1,2].includes(order.slot))for(let i=0;i<order.requirements.length;i++){
   if([5,4,8].includes(order.slot)&&i===0){if(shortages[order.slot]>0)unfinished.push({Code:order.requirements[i],Slot:order.slot,LackNum:shortages[order.slot]});}
   else unfinished.push({Code:order.requirements[i],Slot:order.slot});
  }
  sortLevelSlot(ctx,unfinished,false);unfinished=calculateLacks(ctx,unfinished);for(const r of unfinished)r.SupplyScore=supplyScore(ctx,r.Code,r.LackNum,false);unfinished.sort((a,b)=>a.SupplyScore-b.SupplyScore);
  for(const target of unfinished){if(ctx.remainingScore<=0)break;tryReward(ctx,target,target.Slot,data);}
 }
 deliverSkipped(ctx,unfinished,data);fallback(ctx,data);
}

/** ItemSpread defaults: resultCount1 and isNeedUpFind=true. The generic plane
 * and OrderBoost entry points are selected explicitly by snapshot.mode.
 * random is an injected PURE planning callback, normally the spread draft RNG. */
export function selectSmartReward(snapshot,config,{random}={}){
 if(!validSmartSnapshot(snapshot,config))return {ok:false,reason:'invalid-snapshot',items:[],message:'활성 주문·재고·점수표 입력 형식을 확인하세요.'};
 const ctx={config,scores:{...snapshot.scoreMap},remainingScore:snapshot.budget,stock:{...snapshot.stock},items:[],helpedItems:[],bySlot:{},skipped:[],split:{},random,
  trace:{finishedSlots:[],slotSupply:[],weightedStages:[],slotPriority:[...PRIORITY],specialSlot:SPECIAL_SLOT,tiePolicy:'stable input order; original Lua equal-key sort order is unspecified'}};
 ctx.orders=snapshot.orders.map(o=>({...o,requirements:requirements(o)})).map(o=>({...o,state:o.state??(exactReady(o,snapshot.stock)?3:2)}));
 try{
  const mode=snapshot.mode||'itemSpread';
  if(mode==='orderBoost')runOrderBoost(ctx,snapshot.itemWeights);
  else runPlane(ctx,{resultCount:snapshot.resultCount??(mode==='itemSpread'?1:1000),isNeedUpFind:snapshot.isNeedUpFind??mode==='itemSpread'});
  return {ok:true,items:ctx.items,remainingScore:ctx.remainingScore,helpedItems:ctx.helpedItems,bySlot:ctx.bySlot,trace:ctx.trace,researchRng:typeof random==='function'};
 }catch(error){return {ok:false,reason:error.reason||'source-precondition',missingType:error.missingType,stage:error.stage,items:[],message:error.message,trace:ctx.trace};}
}
export function resolveSmartReward(snapshot,config,options={}){const result=selectSmartReward(snapshot,config,options);return result.ok?result.items[0]??null:null;}
export function deliverHighestSmartReward(snapshot,target,slot,config){
 if(!validSmartSnapshot(snapshot,config)||!typeInfo(config,target))return {ok:false,items:[],reason:'invalid-snapshot'};
 const ctx={config,scores:{...snapshot.scoreMap},remainingScore:snapshot.budget,stock:{...snapshot.stock},items:[],helpedItems:[],bySlot:{}};
 try{deliverHighest(ctx,target,slot);return {ok:true,items:ctx.items,remainingScore:ctx.remainingScore,helpedItems:ctx.helpedItems,bySlot:ctx.bySlot};}catch(e){return {ok:false,items:[],reason:e.reason||'source-precondition'};}
}
export function smartLackCodes(num,chain,config){
 if(!Number.isSafeInteger(num)||num<0)return null;
 const types=[];for(let level=1;num>0;level++,num=Math.floor(num/2))if(num%2===1)types.push(typeAt(config,chain,level));
 return types;
}
/** Bounded four pack payloads reachable from the five rb# merges. Dynamic
 * conversion precedes category splitting, so converted items go to Type2 cache;
 * supported album packs are counted now and cards are selected only on consume. */
export function resolveAlbumPackAllocation(type,count,context={}){
 const replacements={pack_common_5:'os_2_1',pack_common_3:'scratch_a_1',pack_laser_5:'rc_d_1'};
 if(!integer(count)||count===0||!['pack_common_5','pack_common_3','pack_laser_5','pack_royal_5'].includes(type))return {ok:false,reason:'unsupported-pack'};
 if(typeof context.albumPresent!=='boolean')return {ok:false,reason:'missing-album-snapshot'};
 const original=type;
 if(type==='pack_royal_5'){
  if(context.albumPresent&&typeof context.royalOngoing!=='boolean')return {ok:false,reason:'missing-royal-snapshot'};
  if(!context.albumPresent||!context.royalOngoing)type='pack_common_5';
 }
 const convert=replacements[type];
 if(convert){
  if(context.albumPresent&&!Array.isArray(context.supportedPacks))return {ok:false,reason:'missing-pack-config-snapshot'};
  if(!context.albumPresent||!context.supportedPacks.includes(type))return {ok:true,kind:'cache-item',sourceType:original,reward:{type:convert,count},cacheItemType:'Type2',opensCards:false};
 }
 if(typeof context.albumOpen!=='boolean')return {ok:false,reason:'missing-album-open-snapshot'};
 if(!context.albumOpen)return {ok:true,kind:'ignored-inactive-album',sourceType:original,opensCards:false};
 return {ok:true,kind:'property-pack',sourceType:original,allocation:{type,count,contents:'unknown'},opensCards:false};
}
