// Shipped reward semantics; all shop prices and balances require explicit research input.
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>structuredClone(value);
const list=value=>Array.isArray(value)?value:[];
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_:.-]{1,80}$/.test(value);
const canonical=value=>JSON.stringify(value,(_,v)=>isObject(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])):v);
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const assert=(condition,code,message)=>{if(!condition)fail(code,message);};
const positive=(value,max)=>Number.isSafeInteger(value)&&value>0&&value<=max;
const amount=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const busy=new WeakSet();
const skinMap=config=>new Map(config.skins.map(skin=>[skin.skinId,skin]));
async function hash(value){const bytes=new TextEncoder().encode(canonical(value));return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
// Synchronous SHA-256 permits source-snapshot integrity checks during a synchronous render/restore.
// Import also computes WebCrypto SHA-256; all state round trips cross-check both implementations.
function snapshotHash(value){
  const source=new TextEncoder().encode(canonical(value)),bytes=new Uint8Array(Math.ceil((source.length+9)/64)*64);bytes.set(source);bytes[source.length]=128;const view=new DataView(bytes.buffer);view.setUint32(bytes.length-4,source.length*8);
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),rotate=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let offset=0;offset<bytes.length;offset+=64){
    for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,q]=h;
    for(let i=0;i<64;i++){const t1=(q+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;q=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    for(const [i,v] of [a,b,c,d,e,f,g,q].entries())h[i]=(h[i]+v)>>>0;
  }
  return h.map(value=>value.toString(16).padStart(8,'0')).join('');
}

function normalizeReward(reward,config,{stage=false,tokenType}={}){
  assert(isObject(reward),'reward-shape','보상은 Currency/Amount 객체여야 합니다.');
  const type=reward.Currency,count=reward.Amount;
  assert(typeof type==='string'&&positive(count,config.limits.maxAmount),'reward-amount','보상 수량은 양의 안전 정수여야 합니다.');
  if(type.startsWith(config.rewardPrefix)){
    const id=type.slice(config.rewardPrefix.length);
    assert(skinMap(config).has(id),'unknown-skin','선정26개에 없는 Skin ID입니다.');
    assert(count===1,'skin-amount','Skin 보상 수량은1이어야 합니다.');
    assert(!stage,'unsupported-stage-skin','단계 Skin 보상은 이 투영 범위에 없습니다. 원본도 단계 Skin 배정을 오류로 기록합니다.');
  }else{
    assert(stage&&[...config.supportedPropertyRewards,config.genericDecorationToken,tokenType].includes(type),'unsupported-reward','지원하지 않는 보상 카테고리입니다. 일반 보드/아바타 보상을 Skin으로 바꾸지 않습니다.');
  }
  return {Currency:type,Amount:count};
}

export function normalizeSkinAcquisitionStore(input,config){
  assert(isObject(input)&&input.origin==='explicit-research-input','origin','이 상점은 명시 연구 입력만 받습니다.');
  assert(identifier(input.id),'store-id','연구 상점 ID가 필요합니다.');
  assert(['event_reward','mdNew_store'].includes(input.mode),'store-mode','event_reward 또는 mdNew_store 형식이 필요합니다.');
  assert(['Started','Extend','Ended'].includes(input.activityState),'activity-state','연구 활동 상태는 Started/Extend/Ended 중 하나여야 합니다.');
  assert(identifier(input.tokenType),'token-type','활동 토큰 이름이 필요합니다.');
  assert(amount(input.initialTokens,config.limits.maxAmount),'initial-balance','시작 토큰 잔액을0 이상의 정수로 명시하세요.');
  const normalized={origin:'explicit-research-input',id:input.id,mode:input.mode,activityState:input.activityState,tokenType:input.tokenType,initialTokens:input.initialTokens};
  const rows=list(input[input.mode]);assert(rows.length>0&&rows.length<=config.limits.maxRows,'rows','상점 행 수가 허용 범위를 벗어났습니다.');
  const seen=new Set(),skins=new Set();
  if(input.mode==='event_reward'){
    normalized.event_reward=rows.map(row=>{
      assert(isObject(row)&&identifier(row.id)&&row.type==='decoration','old-row','구형 상점은 ID가 있는 decoration 행만 받습니다.');
      assert(!seen.has(row.id),'duplicate-offer','상점 행 ID가 중복됩니다.');seen.add(row.id);
      assert(amount(row.score,config.limits.maxAmount),'missing-price','score 가격을0 이상의 정수로 명시하세요. 누락 가격을 무료로 처리하지 않습니다.');
      assert(Array.isArray(row.rewards)&&row.rewards.length===1&&typeof row.rewards[0]==='string'&&skinMap(config).has(row.rewards[0]),'old-reward','rewards에는 선정 Skin ID 하나가 필요합니다.');
      assert(!skins.has(row.rewards[0]),'duplicate-skin','같은 상점에서 Skin을 중복 배정할 수 없습니다.');skins.add(row.rewards[0]);
      return {id:row.id,type:'decoration',score:row.score,rewards:[row.rewards[0]]};
    });
  }else{
    normalized.mdNew_store=rows.map(row=>{
      assert(isObject(row)&&Number.isSafeInteger(row.stage)&&row.stage>=0&&row.stage<=100&&Number.isSafeInteger(row.index)&&row.index>=0&&row.index<=100,'stage-index','stage/index는0 이상의 제한된 정수여야 합니다.');
      assert(row.stage>0||row.index===0,'stage-final','최종 단계0은 index0 보상 행만 허용합니다.');
      const key=`${row.stage}:${row.index}`;assert(!seen.has(key),'duplicate-offer','stage/index가 중복됩니다.');seen.add(key);
      assert(Array.isArray(row.reward)&&row.reward.length>0&&row.reward.length<=10,'reward-shape','reward 배열이 필요합니다.');
      const rewards=row.reward.map(reward=>normalizeReward(reward,config,{stage:row.index===0,tokenType:input.tokenType}));
      if(row.index===0){assert(row.stage!==0||rewards.length===1,'final-reward-count','최종 단계0은 보상 하나만 허용합니다.');return {stage:row.stage,index:0,reward:rewards};}
      assert(amount(row.price,config.limits.maxAmount),'missing-price','price를0 이상의 정수로 명시하세요. 누락 가격을 무료로 처리하지 않습니다.');
      assert(rewards.length===1&&rewards[0].Currency.startsWith(config.rewardPrefix),'piece-reward','이 상점의 조각은 선정 Skin 보상 하나만 지원합니다.');
      const skinId=rewards[0].Currency.slice(config.rewardPrefix.length);assert(!skins.has(skinId),'duplicate-skin','같은 상점에서 Skin을 중복 배정할 수 없습니다.');skins.add(skinId);
      return {stage:row.stage,index:row.index,price:row.price,reward:rewards};
    }).sort((a,b)=>a.stage-b.stage||a.index-b.index);
    assert(normalized.mdNew_store.some(row=>row.index>0),'no-pieces','Skin 조각 행이 필요합니다.');
    for(const row of normalized.mdNew_store.filter(row=>row.stage>0&&row.index===0))assert(normalized.mdNew_store.some(piece=>piece.stage===row.stage&&piece.index>0),'empty-stage','조각 없는 단계 보상은 허용하지 않습니다.');
  }
  return normalized;
}

function offers(snapshot,config){
  if(snapshot.mode==='event_reward')return snapshot.event_reward.map(row=>({id:row.id,skinId:row.rewards[0],cost:row.score,reward:[{Currency:config.rewardPrefix+row.rewards[0],Amount:1}],stage:null,index:null}));
  return snapshot.mdNew_store.filter(row=>row.index>0).map(row=>({id:`${row.stage}:${row.index}`,skinId:row.reward[0].Currency.slice(config.rewardPrefix.length),cost:row.price,reward:row.reward,stage:row.stage,index:row.index}));
}
function completeSets(owned,config){return config.sets.filter(set=>set.skinIds.every(id=>owned.has(id))).map(set=>set.id);}
function initialContext(state,config){
  return {owned:new Set(),stores:new Map(state.stores.map(store=>[store.snapshot.id,{...store,balance:store.snapshot.initialTokens,claimed:new Set(),stageClaims:new Set(),propertyRewards:{}}])),allReceipts:[],config};
}
function addChecked(a,b,config){const total=a+b;assert(amount(total,config.limits.maxAmount),'overflow','격리 장부 수량이 허용 범위를 넘습니다.');return total;}
function applyStageRewards(store,rewards,config){
  const granted=[];
  for(const reward of rewards){
    const type=[config.genericDecorationToken,store.snapshot.tokenType].includes(reward.Currency)?store.snapshot.tokenType:reward.Currency;
    if(type===store.snapshot.tokenType)store.balance=addChecked(store.balance,reward.Amount,config);
    else store.propertyRewards[type]=addChecked(store.propertyRewards[type]||0,reward.Amount,config);
    granted.push({Currency:type,Amount:reward.Amount});
  }
  return granted;
}
function stagePreparation(store,context){
  if(store.snapshot.mode!=='mdNew_store')return [];
  const restored=[],all=offers(store.snapshot,context.config),stages=[...new Set(all.map(row=>row.stage))].sort((a,b)=>a-b);
  for(const stage of stages){
    const pieces=all.filter(row=>row.stage===stage);let recovered=false;
    for(const piece of pieces)if(context.owned.has(piece.skinId)&&!store.claimed.has(piece.id)){store.claimed.add(piece.id);recovered=true;restored.push(piece.id);}
    if(recovered&&pieces.every(piece=>store.claimed.has(piece.id)))store.stageClaims.add(stage);
  }
  return restored;
}
function purchaseEffect(context,request,sequence){
  const config=context.config,store=context.stores.get(request.storeId);assert(store,'store-missing','선택한 연구 상점이 없습니다.');
  const snapshot=store.snapshot,all=offers(snapshot,config),offer=all.find(row=>row.id===request.offerId);assert(offer,'offer-missing','선택한 상품 행이 없습니다.');
  assert(snapshot.activityState==='Started'||snapshot.activityState==='Extend'||snapshot.mode==='mdNew_store'&&snapshot.activityState==='Ended','activity-closed','이 원본 거래 경로가 허용하는 활동 상태가 아닙니다.');
  assert(!context.owned.has(offer.skinId),'already-owned','이미 획득한 Skin입니다. 다시 비용을 차감하지 않습니다.');
  const recoveredClaims=stagePreparation(store,context);
  assert(!store.claimed.has(offer.id),'already-claimed','이미 처리한 상품 행입니다.');
  if(snapshot.mode==='mdNew_store'){
    const stages=[...new Set(all.map(row=>row.stage))].sort((a,b)=>a-b),index=stages.indexOf(offer.stage);
    assert(index===0||store.stageClaims.has(stages[index-1]),'stage-locked','앞 단계의 조각·단계 보상 완료가 필요합니다. 단계 보상 행이 빠졌는지도 확인하세요.');
  }
  assert(store.balance>=offer.cost,'insufficient-balance','격리 활동 토큰이 부족합니다.');
  const before=store.balance,setsBefore=completeSets(context.owned,config);store.balance-=offer.cost;store.claimed.add(offer.id);context.owned.add(offer.skinId);
  const stageRewardGrants=[],stageClaims=[];
  if(snapshot.mode==='mdNew_store'){
    const stageRow=snapshot.mdNew_store.find(row=>row.stage===offer.stage&&row.index===0);
    if(stageRow&&!store.stageClaims.has(offer.stage)&&all.filter(row=>row.stage===offer.stage).every(row=>store.claimed.has(row.id))){
      const rewards=applyStageRewards(store,stageRow.reward,config);store.stageClaims.add(offer.stage);stageClaims.push(offer.stage);stageRewardGrants.push({stage:offer.stage,rewards});
    }
    const stages=[...new Set(all.map(row=>row.stage))],final=snapshot.mdNew_store.find(row=>row.stage===0&&row.index===0);
    if(final&&!store.stageClaims.has(0)&&stages.every(stage=>store.stageClaims.has(stage))){const rewards=applyStageRewards(store,final.reward,config);store.stageClaims.add(0);stageClaims.push(0);stageRewardGrants.push({stage:0,rewards});}
  }
  const completedSetIds=completeSets(context.owned,config).filter(id=>!setsBefore.includes(id));
  return {sequence,receiptId:`skin-acq:${request.requestId}`,requestId:request.requestId,storeId:request.storeId,offerId:request.offerId,snapshotHash:store.snapshotHash,kind:'source-rule-projection-from-explicit-research-input',configRevision:config.revision,cost:{Currency:snapshot.tokenType,Amount:offer.cost},balanceBefore:before,balanceAfter:store.balance,skinIds:[offer.skinId],rewardPath:['skin_rwd_ID','RewardApi','SkinRewardCategoryHandler','MapDataModel.AcquireSkin'],rewards:clone(offer.reward),recoveredClaims,stageClaims,stageRewardGrants,completedSetIds};
}

function replay(state,config){
  assert(isObject(state)&&state.schema===1&&state.configRevision===config.revision,'invalid-state','연구 저장 버전이 다릅니다.');
  assert(Object.keys(state).every(key=>['schema','configRevision','stores','receipts','activeStoreId'].includes(key)),'invalid-state','검증되지 않은 소유권 필드가 저장에 있습니다.');
  assert(Array.isArray(state.stores)&&state.stores.length<=config.limits.maxStores&&Array.isArray(state.receipts)&&state.receipts.length<=config.limits.maxReceipts,'state-limit','격리 장부 저장 한도를 벗어났습니다.');
  const storeIds=new Set();
  for(const store of state.stores){assert(isObject(store)&&canonical(normalizeSkinAcquisitionStore(store.snapshot,config))===canonical(store.snapshot)&&snapshotHash(store.snapshot)===store.snapshotHash,'invalid-store','상점 저장의 설정 또는 SHA-256이 올바르지 않습니다.');assert(!storeIds.has(store.snapshot.id),'duplicate-store','상점 ID가 중복됩니다.');storeIds.add(store.snapshot.id);}
  assert(state.activeStoreId===null||storeIds.has(state.activeStoreId),'active-store','선택 상점이 없습니다.');
  const context=initialContext(state,config),seen=new Set();
  for(const [index,receipt] of state.receipts.entries()){
    assert(isObject(receipt)&&identifier(receipt.requestId)&&!seen.has(receipt.requestId),'duplicate-receipt','영수증 요청 ID가 중복되거나 잘못됐습니다.');seen.add(receipt.requestId);
    const expected=purchaseEffect(context,receipt,index+1);assert(canonical(receipt)===canonical(expected),'receipt-mismatch','영수증의 비용·보상·소유권 전이가 재계산과 일치하지 않습니다.');context.allReceipts.push(expected);
  }
  return context;
}
export function createSkinAcquisitionState(config){return {schema:1,configRevision:config.revision,stores:[],receipts:[],activeStoreId:null};}
export function validSkinAcquisitionState(state,config){try{replay(state,config);return true;}catch{return false;}}
export function summarizeSkinAcquisition(state,config){
  const context=replay(state,config);return {ownedSkinIds:[...context.owned],verifiedAcquiredIds:[...context.owned],completedSetIds:completeSets(context.owned,config),receiptCount:state.receipts.length,receipts:clone(state.receipts),activeStoreId:state.activeStoreId,stores:[...context.stores.values()].map(store=>({id:store.snapshot.id,mode:store.snapshot.mode,activityState:store.snapshot.activityState,tokenType:store.snapshot.tokenType,initialTokens:store.snapshot.initialTokens,balance:store.balance,snapshotHash:store.snapshotHash,claims:[...store.claimed],stageClaims:[...store.stageClaims],propertyRewards:clone(store.propertyRewards),offers:offers(store.snapshot,config).map(row=>({...row,owned:context.owned.has(row.skinId)}))}))};
}
export function getVerifiedSkinAcquisitions(state,config){const summary=summarizeSkinAcquisition(state,config);return {skinIds:summary.ownedSkinIds,receipts:summary.receipts,completedSetIds:summary.completedSetIds};}
export function exportSkinAcquisition(state,config){assert(validSkinAcquisitionState(state,config),'invalid-state','잘못된 저장은 내보낼 수 없습니다.');return JSON.stringify({kind:'isolated-skin-acquisition-research',serverOwnershipVerified:false,state:clone(state)},null,2);}
export function restoreSkinAcquisition(serialized,config){const parsed=typeof serialized==='string'?JSON.parse(serialized):serialized;const state=parsed?.kind==='isolated-skin-acquisition-research'?parsed.state:parsed;assert(validSkinAcquisitionState(state,config),'invalid-state','영수증 재검증을 통과하지 못했습니다. 기존 저장을 보존하세요.');return clone(state);}

async function commit(state,draft,options){
  if(options.persist){const saved=await options.persist(clone(draft),{expectedState:clone(state)});assert(saved!==false,'save-failed','저장 실패로 비용·보상·소유권을 모두 보존했습니다.');}
  for(const key of Object.keys(state))delete state[key];Object.assign(state,draft);
}
async function guarded(state,config,operation){
  if(busy.has(state))return {ok:false,code:'busy',message:'다른 격리 거래가 저장 중입니다.'};busy.add(state);
  try{replay(state,config);for(const store of state.stores)assert(await hash(store.snapshot)===store.snapshotHash,'snapshot-hash','상점 설정 해시가 일치하지 않습니다.');return await operation();}
  catch(error){return {ok:false,code:error.code||'transaction-failed',message:error.message||'거래에 실패해 기존 저장을 유지했습니다.'};}
  finally{busy.delete(state);}
}
export async function importSkinAcquisitionStore(state,input,config,options={}){
  return guarded(state,config,async()=>{const snapshot=normalizeSkinAcquisitionStore(input,config),snapshotHash=await hash(snapshot),existing=state.stores.find(store=>store.snapshot.id===snapshot.id);
    if(existing){assert(existing.snapshotHash===snapshotHash,'store-id-conflict','같은 상점 ID의 다른 가격/잔액 설정은 덮어쓰지 않습니다.');return {ok:true,replayed:true,snapshotHash,message:'이미 등록한 같은 연구 설정입니다.'};}
    assert(state.stores.length<config.limits.maxStores,'store-limit','연구 상점 저장 한도에 도달했습니다.');const draft=clone(state);draft.stores.push({snapshot,snapshotHash});draft.activeStoreId=snapshot.id;await commit(state,draft,options);return {ok:true,snapshotHash,message:'명시 연구 설정을 등록했습니다. 실제 서버 상품 배정은 아닙니다.'};
  });
}
export async function selectSkinAcquisitionStore(state,storeId,config,options={}){return guarded(state,config,async()=>{assert(state.stores.some(store=>store.snapshot.id===storeId),'store-missing','연구 상점이 없습니다.');const draft=clone(state);draft.activeStoreId=storeId;await commit(state,draft,options);return {ok:true};});}
export async function purchaseSkinAcquisition(state,request,config,options={}){
  return guarded(state,config,async()=>{
    assert(isObject(request)&&identifier(request.requestId)&&identifier(request.storeId)&&identifier(request.offerId),'request','거래 요청 ID·상점·행이 필요합니다.');
    const existing=state.receipts.find(receipt=>receipt.requestId===request.requestId);
    if(existing){assert(existing.storeId===request.storeId&&existing.offerId===request.offerId,'request-id-conflict','같은 요청 ID가 다른 거래에 사용됐습니다.');return {ok:true,replayed:true,receipt:clone(existing),message:'같은 요청은 재차 차감하거나 지급하지 않습니다.'};}
    assert(state.receipts.length<config.limits.maxReceipts,'receipt-limit','영수증 저장 한도에 도달했습니다.');
    if(request.expectedReceiptCount!==undefined)assert(request.expectedReceiptCount===state.receipts.length,'stale-request','영수증이 변경됐습니다. 현재 잔액과 상품 상태를 다시 확인하세요.');
    const context=replay(state,config),receipt=purchaseEffect(context,request,state.receipts.length+1),draft=clone(state);draft.receipts.push(receipt);assert(validSkinAcquisitionState(draft,config),'invalid-draft','거래 후 장부 검증에 실패했습니다.');await commit(state,draft,options);
    let callbackError=null;if(options.onAcquire){try{await options.onAcquire({skinIds:clone(receipt.skinIds),receipt:clone(receipt)});}catch(error){callbackError=error.message||'소유권 연결 콜백 실패';}}
    return {ok:true,receipt:clone(receipt),callbackError,durableSaved:Boolean(options.persist),message:callbackError?'격리 거래 저장은 완료했습니다. 맵 연결은 영수증에서 다시 동기화할 수 있습니다.':'격리 토큰 거래와 Skin 획득 영수증을 저장했습니다.'};
  });
}

const e=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function skinAcquisitionTemplate(config,skinId=config.skins[0].skinId){return {origin:'explicit-research-input',id:'research-decor',mode:'event_reward',activityState:'Started',tokenType:config.genericDecorationToken,initialTokens:null,event_reward:[{id:`skin-${skinId}`,type:'decoration',score:null,rewards:[skinId]}]};}
export function renderSkinAcquisition(state,config,{selectedSkinId}={}){
  if(!validSkinAcquisitionState(state,config))return '<section class="skin-acquisition"><h2>Skin 획득 장부를 보존했습니다</h2><p>저장 검증에 실패했습니다. 기존 JSON을 보관하고 새 장부와 분리하세요.</p></section>';
  const summary=summarizeSkinAcquisition(state,config),store=summary.stores.find(row=>row.id===state.activeStoreId),selected=skinMap(config).has(selectedSkinId)?selectedSkinId:config.skins[0].skinId;
  return `<section class="skin-acquisition" data-skin-acquisition><header><p class="skin-acquisition-eyebrow">3.21 · 원본 규칙 / 명시 연구 거래</p><h2>${e(config.title)}</h2><p>구매·보상 처리 후 생긴 영수증으로 소유권을 연결합니다. 실제 상품 가격은 미확보이며, 아래 격리 상점은 입력한 연구 잔액과 가격만 사용합니다.</p></header><dl class="skin-acquisition-metrics"><div><dt>거래로 획득한 Skin</dt><dd>${summary.ownedSkinIds.length} / 26</dd></div><div><dt>완성한 선정 세트</dt><dd>${summary.completedSetIds.length} / 2</dd></div><div><dt>저장된 거래 영수증</dt><dd>${summary.receiptCount}</dd></div><div><dt>실제 가격 배정</dt><dd>0건 · 자료 필요</dd></div></dl>
    <p data-skin-acq-status role="status" aria-live="polite">원작 계정·메인 지갑·현금 결제는 변경하지 않습니다.</p>
    <details class="skin-acquisition-setup"${store?'':' open'}><summary>연구 상점 설정 · 가격과 잔액을 직접 명시</summary><form data-skin-acq-simple><label>선정 Skin<select name="skinId">${config.skins.map(skin=>`<option value="${e(skin.skinId)}"${selected===skin.skinId?' selected':''}>Skin ${e(skin.skinId)} · ${e(skin.slot)}</option>`).join('')}</select></label><label>가격을 적용할 범위<select name="scope"><option value="single">선택한 Skin 하나</option><option value="set">선택한 Skin의13개 세트</option><option value="all">선정26개 전체</option></select></label><label>연구 시작 토큰<input name="initialTokens" type="number" min="0" max="${config.limits.maxAmount}" step="1" required inputmode="numeric" placeholder="잔액 입력"></label><label>장식 하나당 연구 토큰 가격<input name="score" type="number" min="0" max="${config.limits.maxAmount}" step="1" required inputmode="numeric" placeholder="가격 입력"></label><button type="submit">입력한 값으로 격리 상점 만들기</button></form><p>여러 장식을 고르면 입력한 동일 연구 가격을 각 행에 적용합니다. 실제 원작 가격이나 신규 게임의 확정 가격으로 저장되지 않습니다. 상품·잔액을 비워 두면 거래할 수 없습니다.</p><details><summary>여러 상품·단계 상점 JSON 입력</summary><label>명시 연구 설정<textarea data-skin-acq-json rows="12" spellcheck="false">${e(JSON.stringify(skinAcquisitionTemplate(config,selected),null,2))}</textarea></label><button type="button" data-skin-acq-action="import">설정 검증·등록</button><p>구형은 event_reward의 decoration/score/rewards, 신형은 mdNew_store의 stage/index/price/reward를 사용합니다. 실제 보상 객체 키는 Currency/Amount입니다. null 가격은 자동 무료가 아니며 거절합니다.</p></details></details>
    ${summary.stores.length?`<label class="skin-acquisition-store">등록한 격리 상점<select data-skin-acq-store>${summary.stores.map(row=>`<option value="${e(row.id)}"${row.id===state.activeStoreId?' selected':''}>${e(row.id)} · ${e(row.mode)}</option>`).join('')}</select></label>`:''}
    ${store?`<section class="skin-acquisition-shop"><h3>${e(store.id)} · ${e(store.tokenType)} ${store.balance}</h3><p>명시 연구 상태 ${e(store.activityState)} · 설정 SHA-256 <code>${e(store.snapshotHash)}</code></p><div class="skin-acquisition-offers">${store.offers.map(offer=>{const skin=skinMap(config).get(offer.skinId);return `<article><h4>Skin ${e(offer.skinId)} · ${e(skin.slot)}</h4><p>${e(skin.area)} / item_id ${e(skin.itemId)}</p><p>연구 가격 <strong>${offer.cost} ${e(store.tokenType)}</strong>${offer.stage===null?'':` · 단계 ${offer.stage}-${offer.index}`}</p><p><code>${e(config.rewardPrefix+offer.skinId)}</code> → 소유권</p><button type="button" data-skin-acq-buy="${e(offer.id)}"${offer.owned?' disabled':''}>${offer.owned?'영수증으로 획득 완료':'격리 토큰으로 구매'}</button></article>`;}).join('')}</div>${Object.keys(store.propertyRewards).length?`<p>단계 보상의 격리 장부: ${Object.entries(store.propertyRewards).map(([type,value])=>e(type)+' '+value).join(' · ')}. 메인 지갑과 분리됩니다.</p>`:''}</section>`:'<p class="skin-acquisition-empty">가격을 발명하지 않기 위해 기본 상품을 판매하지 않습니다. 명시 연구 입력으로 거래 동선을 확인할 수 있습니다.</p>'}
    <details><summary>획득 영수증 ${summary.receiptCount}건 · 저장·재접속 대조</summary>${summary.receipts.length?`<ol class="skin-acquisition-receipts">${summary.receipts.map(receipt=>`<li><strong>${e(receipt.receiptId)}</strong><p>Skin ${e(receipt.skinIds.join(', '))} · ${receipt.cost.Amount} ${e(receipt.cost.Currency)} · 잔액 ${receipt.balanceBefore} → ${receipt.balanceAfter}</p><p>${e(receipt.rewardPath.join(' → '))}</p>${receipt.completedSetIds.length?`<p>세트 완성 ${e(receipt.completedSetIds.join(', '))}</p>`:''}<code>${e(receipt.snapshotHash)}</code></li>`).join('')}</ol>`:'<p>획득 거래가 없습니다. 기존 연구 소유 명시 버튼은 이 장부에 기록되지 않습니다.</p>'}<button type="button" data-skin-acq-action="export">영수증·상태 JSON 내려받기</button></details>
    <details><summary>원본 근거와 남아 있는 완료 조건</summary><ul>${config.boundaries.map(text=>`<li>${e(text)}</li>`).join('')}</ul><h3>3.21에 남아 있는 것</h3><ul>${config.remaining.map(text=>`<li>${e(text)}</li>`).join('')}</ul>${config.sources.filter(source=>['reward-prefix','reward-skin-handler','skin-own','skin-set','old-store-buy','new-store-buy'].includes(source.id)).map(source=>`<p><code>${e(source.path)}:${source.lineStart}</code><br><small>SHA-256 ${e(source.sha256)}</small></p>`).join('')}</details></section>`;
}

export function mountSkinAcquisition(root,state,config,options={}){
  const initial=root?.matches?.('[data-skin-acquisition]')?root:root?.querySelector?.('[data-skin-acquisition]');if(!initial)return ()=>{};
  const host=initial.parentElement;const Controller=initial.ownerDocument.defaultView.AbortController,abort=new Controller();let scope=initial,disposed=false,working=false;
  const status=message=>{const output=scope.querySelector('[data-skin-acq-status]');if(output)output.textContent=message;};
  const redraw=message=>{if(disposed)return;const wrapper=scope.ownerDocument.createElement('div');wrapper.innerHTML=renderSkinAcquisition(state,config,options);const next=wrapper.firstElementChild;scope.replaceWith(next);scope=next;status(message);options.onChange?.(state);};
  const execute=async operation=>{if(working){status('다른 거래가 저장 중입니다.');return;}working=true;const buttons=[...scope.querySelectorAll('button')].map(button=>({button,disabled:button.disabled}));for(const {button}of buttons)button.disabled=true;try{const result=await operation();const message=result.message||(result.ok?'장부를 갱신했습니다.':'거래를 진행하지 못했습니다.');if(result.ok)redraw(message);else status(message);}catch(error){status(error.message||'기존 저장을 유지했습니다.');}finally{working=false;for(const {button,disabled}of buttons)button.disabled=disabled;}};
  const ownOptions={persist:options.persist,onAcquire:options.onAcquire};
  host.addEventListener('submit',event=>{if(!scope.contains(event.target)||!event.target.matches('[data-skin-acq-simple]'))return;event.preventDefault();const form=event.target;execute(()=>{const value=name=>form.elements.namedItem(name).value;assert(value('initialTokens').trim()!==''&&value('score').trim()!=='','missing-price','잔액과 가격을 명시하세요.');const input=skinAcquisitionTemplate(config,value('skinId'));input.id=`research-${globalThis.crypto.randomUUID()}`;input.initialTokens=Number(value('initialTokens'));const ids=value('scope')==='all'?config.skins.map(row=>row.skinId):value('scope')==='set'?config.sets.find(set=>set.skinIds.includes(value('skinId'))).skinIds:[value('skinId')];input.event_reward=ids.map(id=>({id:`skin-${id}`,type:'decoration',score:Number(value('score')),rewards:[id]}));return importSkinAcquisitionStore(state,input,config,ownOptions);});},{signal:abort.signal});
  host.addEventListener('change',event=>{if(scope.contains(event.target)&&event.target.matches('[data-skin-acq-store]'))execute(()=>selectSkinAcquisitionStore(state,event.target.value,config,ownOptions));},{signal:abort.signal});
  host.addEventListener('click',event=>{
    if(!scope.contains(event.target))return;const buy=event.target.closest('[data-skin-acq-buy]');if(buy){execute(()=>purchaseSkinAcquisition(state,{requestId:globalThis.crypto.randomUUID(),storeId:state.activeStoreId,offerId:buy.dataset.skinAcqBuy,expectedReceiptCount:state.receipts.length},config,ownOptions));return;}
    const action=event.target.closest('[data-skin-acq-action]')?.dataset.skinAcqAction;
    if(action==='import')execute(()=>{const text=scope.querySelector('[data-skin-acq-json]').value;assert(text.length<60000,'input-limit','연구 설정이 너무 큽니다.');return importSkinAcquisitionStore(state,JSON.parse(text),config,ownOptions);});
    if(action==='export'){const text=exportSkinAcquisition(state,config);if(options.onExport)options.onExport(text);else{const win=scope.ownerDocument.defaultView,url=win.URL.createObjectURL(new win.Blob([text],{type:'application/json'})),link=scope.ownerDocument.createElement('a');link.href=url;link.download='skin-acquisition-research.json';link.click();win.URL.revokeObjectURL(url);}status('영수증과 격리 연구 상태를 내보냈습니다.');}
  },{signal:abort.signal});
  return ()=>{disposed=true;abort.abort();};
}
