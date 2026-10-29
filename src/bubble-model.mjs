// APK 4.10.5 main-board bubble consumption rules. Pure plans: no state, DOM,
// timers, network, payments or global RNG are changed here. The caller applies
// a successful plan after the merge and before the independent merge-coin step.
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const number=n=>Number.isFinite(n)&&n>=0&&n<=1e12;
const integer=n=>Number.isSafeInteger(n)&&number(n);
const rulesFor=c=>c?.bubbleRules?.rules||c?.bubbleRules;
const rowFor=(c,type)=>rulesFor(c)?.items?.find(r=>r.type===String(type));
const nil=v=>v===undefined||v===null;
const unknown=(field,reason)=>({field,reason});
const no=(reason,trace=[],extra={})=>({status:'none',reason,chancePercent:null,roll:null,spawn:null,trace,unknowns:[],...extra});
const unresolved=(reason,fields,trace=[])=>({status:'unknown',reason,chancePercent:null,roll:null,spawn:null,trace,unknowns:fields});
const codeFor=(type,offset)=>/^\d+$/.test(type)?String(Number(type)+offset):`b#${type}`;
const orders=s=>(s.orders?.slots||[]).filter(o=>o.state!=='Finished'&&o.state!=='finished');
const requirementCodes=o=>(o.requirements||[]).flatMap(r=>typeof r==='string'?[r]:Array.from({length:Math.min(1000,r.count||0)},()=>r.type));
function plainStock(s){
 const stock={};
 for(const cell of [...(s.board||[]),...(s.inventory?.items||[])]){
  if(cell&&!cell.cover&&!s.bubbles?.[cell.uid])stock[cell.type]=(stock[cell.type]||0)+1;
 }
 return stock;
}
function requirements(s){const counts={};for(const o of orders(s))for(const type of requirementCodes(o))counts[type]=(counts[type]||0)+1;return counts;}
function validCountMap(map){return record(map)&&Object.keys(map).length<=2000&&Object.values(map).every(integer);}

/** Explicit activity input, never an inferred live schedule. Missing config is
 * the source's Released fallback; malformed/unknown config stays unknown. */
export function bubbleSaleStatus(s,input){
 if(input===undefined||input===false)return {status:'known',active:false,state:'Released',mode:'apk-default'};
 if(input===null||!record(input))return {status:'unknown',active:null,state:null,unknowns:[unknown('bubbleSale','버블 할인 이벤트 입력이 미확인입니다.')]};
 if(input.config===null||input.resourceReady===false)return {status:'known',active:false,state:'Released',mode:'explicit-input'};
 const cfg=input.config;
 if(!record(cfg)||!['sTime','eTime','rTime'].every(k=>number(cfg[k]))||cfg.eTime<cfg.sTime||cfg.rTime<cfg.eTime||(!nil(cfg.sLv)&&!integer(cfg.sLv))||typeof input.resourceReady!=='boolean'||!number(s.wallet?.time)||!integer(s.wallet?.level))
  return {status:'unknown',active:null,state:null,unknowns:[unknown('bubbleSale.config/resourceReady','서버 일정·시작 레벨·리소스 준비 상태를 명시해야 합니다.')]};
 const now=s.wallet.time;
 const state=(!nil(cfg.sLv)&&s.wallet.level<cfg.sLv)?'Released':now<cfg.sTime?'Preparing':now<cfg.eTime?'Started':now<cfg.rTime?'Ended':'Released';
 return {status:'known',active:state==='Started',state,mode:'explicit-input'};
}

/** BubbleDecrease uses strictly day < accumulated login days, ratios /100.
 * Days are logged-in UTC day transitions, not wall-clock days since purchase. */
export function bubbleNoPurchaseRatio(input){
 if(input===undefined)return {status:'known',ratio:1,mode:'apk-default'};
 if(!record(input)||typeof input.enabled!=='boolean')return {status:'unknown',unknowns:[unknown('bubbleDecrease.enabled','장기 미구매 감소 스위치가 미확인입니다.')]};
 if(!input.enabled)return {status:'known',ratio:1,mode:'explicit-input'};
 if(!integer(input.noPurchaseLoginDays)||!Array.isArray(input.rows)||input.rows.length>1000||!input.rows.every(r=>record(r)&&integer(r.no_purchase_days)&&number(r.decrease_ratio)))
  return {status:'unknown',unknowns:[unknown('bubbleDecrease.rows/noPurchaseLoginDays','서버 감소표와 누적 로그인 일수가 필요합니다.')]};
 let selected=null;
 for(const row of [...input.rows].sort((a,b)=>a.no_purchase_days-b.no_purchase_days))if(row.no_purchase_days<input.noPurchaseLoginDays)selected=row;
 return {status:'known',ratio:input.noPurchaseLoginDays>0&&selected?selected.decrease_ratio/100:1,selectedDay:selected?.no_purchase_days??null,mode:'explicit-input'};
}

/** Current item price/duration. A tutorial price takes precedence over a sale.
 * No match in ItemProperty intentionally has the source's initial cost zero. */
export function bubbleQuote(s,c,type,overrides={}){
 const rules=rulesFor(c),row=rowFor(c,type);
 if(!rules||!row)return unresolved('missing-item-rules',[unknown('bubbleRules.items','이 타입의 내장 버블 설정이 없습니다.')]);
 if(!record(overrides))return unresolved('invalid-input',[unknown('overrides','명시 입력은 객체여야 합니다.')]);
 let durationSeconds=rules.defaultDurationSeconds;
 if(own(overrides,'durationSeconds')){
  if(!number(overrides.durationSeconds))return unresolved('unknown-duration',[unknown('durationSeconds','사용자 지정 지속 시간이 미확인입니다.')]);
  if(overrides.durationSeconds>0)durationSeconds=overrides.durationSeconds;
 }
 if(!number(durationSeconds)||durationSeconds<=0)return unresolved('missing-duration',[unknown('bubbleRules.defaultDurationSeconds','내장 지속 시간이 없습니다.')]);
 const basePrice=row.baseGemCost;
 if(!number(basePrice))return unresolved('missing-price',[unknown('baseGemCost','내장 보석 가격이 미확인입니다.')]);
 let price=basePrice,sale=false,saleState='Released';
 if(own(overrides,'tutorialCost')){
  if(!integer(overrides.tutorialCost))return unresolved('unknown-tutorial-price',[unknown('tutorialCost','강제 튜토리얼 해제 가격이 미확인입니다.')]);
  price=overrides.tutorialCost;
 }else if(number(row.saleGemCost)&&row.saleGemCost<basePrice){
  const activity=bubbleSaleStatus(s,overrides.bubbleSale);saleState=activity.state;
  if(activity.status==='unknown')return unresolved('unknown-sale',activity.unknowns);
  if(activity.active){price=row.saleGemCost;sale=true;}
 }
 return {status:'known',innerType:String(type),price,basePrice,durationSeconds,sale,saleState,mode:Object.keys(overrides).length?'explicit-input':'apk-default'};
}

/** Compute the source's exact integer-roll threshold, without rolling. A null
 * explicit input means unknown; omission means the verified absent-server
 * fallback. Order overrides are maps of actual GetCode() counts, never queue. */
export function bubbleChanceFor(s,c,{resultType,targetType,earlierSpawn=false,overrides={}}={}){
 const rules=rulesFor(c),type=String(resultType??''),row=rowFor(c,type),trace=[];
 if(!rules||!row)return unresolved('missing-item-rules',[unknown('resultType','이 합성 결과의 버블 확률 설정이 없습니다.')]);
 if(!record(overrides))return unresolved('invalid-input',[unknown('overrides','명시 입력은 객체여야 합니다.')]);
 if(earlierSpawn===null)return unresolved('unknown-earlier-spawn',[unknown('earlierSpawn','앞선 임시·카드·에너지 버블 생성 결과가 미확인입니다.')]);
 if(earlierSpawn)return no('earlier-spawn',[{id:'priority',label:'앞선 활동 아이템 생성',ok:false}]);
 if(!Array.isArray(s.board)||!s.board.some(cell=>cell===null))return no('board-full',[{id:'space',label:'빈 칸',ok:false}]);
 if(!integer(s.wallet?.level))return unresolved('unknown-level',[unknown('level','현재 플레이어 레벨이 없습니다.')]);
 if(!rules.functionEnabled||s.wallet.level<rules.unlockLevel)return no('function-locked',[{id:'level',label:`레벨 ${rules.unlockLevel} 버블 개방`,ok:false}]);
 trace.push({id:'level',label:`레벨 ${rules.unlockLevel} 버블 개방`,ok:true});
 let chance=row.chancePercent;
 if(own(overrides,'generatorBoost')){
  if(overrides.generatorBoost===null)return unresolved('unknown-boost',[unknown('generatorBoost','활성 생성기 부스트 변형이 미확인입니다.')],trace);
  if(overrides.generatorBoost!==false){
   const variant=rules.boostVariants?.[overrides.generatorBoost];
   if(!variant)return unresolved('missing-boost-variant',[unknown('generatorBoost','이 부스트 변형의 내장 설정이 없습니다.')],trace);
   const changed=variant.find(x=>x.type===type);if(changed)chance=changed.chancePercent;
  }
 }
 if(nil(chance)||chance<=0)return no('no-base-chance',trace,{chancePercent:chance??0});
 if(!number(chance))return unresolved('invalid-chance',[unknown('chancePercent','내장 확률 값이 잘못되었습니다.')],trace);
 const same=(s.board||[]).some(cell=>cell&&s.bubbles?.[cell.uid]?.innerType===type);
 if(same)return no('same-type-bubble',trace.concat({id:'duplicate',label:'동일한 내용물의 버블이 이미 있음',ok:false}),{chancePercent:0});
 const stock=own(overrides,'stockCounts')?overrides.stockCounts:plainStock(s);
 const lack=own(overrides,'orderLackCounts')?overrides.orderLackCounts:null;
 if(!validCountMap(stock)||(own(overrides,'orderLackCounts')&&!validCountMap(lack)))return unresolved('invalid-stock',[unknown('stockCounts/orderLackCounts','일반 보드·창고 수량 또는 주문 부족 수량이 올바르지 않습니다.')],trace);
 const orderConfig=new Map((c.orderRules?.itemConfig||rules.orderItemConfig||[]).map(r=>[r.Code,r]));
 const demand=requirements(s);
 const nextLack=lack?.[row.next]??Math.max(0,(demand[row.next]||0)-(stock[row.next]||0));
 const bonus=overrides.bubbleOrderBonus;
 if(own(overrides,'bubbleOrderBonus')&&!integer(bonus))return unresolved('unknown-order-bonus',[unknown('bubbleOrderBonus','주문 보너스 서버 스위치가 미확인입니다.')],trace);
 const eligibleOrder=orderConfig.get(type)?.WeightMultiple===1&&row.next&&nextLack>0;
 if((bonus===1||bonus===2)&&eligibleOrder&&(bonus!==2||(stock[type]||0)<2)){
  chance=100;trace.push({id:'order-bonus',label:'다음 합성 단계의 주문 부족 보너스',ok:true,value:100});
 }else{
  const orderDecrease=overrides.bubbleOrderDecrease;
  if(own(overrides,'bubbleOrderDecrease')&&!number(orderDecrease))return unresolved('unknown-order-decrease',[unknown('bubbleOrderDecrease','주문 체인 확률 감소 입력이 미확인입니다.')],trace);
  if(orderDecrease>0&&orderDecrease<1){
   const chain=rules.items.filter(r=>r.chainId===row.chainId);
   const enough=chain.every(r=>orderConfig.get(r.type)?.WeightMultiple!==1||(stock[r.type]||0)>=(demand[r.type]||0));
   if(enough){chance*=orderDecrease;trace.push({id:'order-decrease',label:'충족된 고단계 주문 체인 확률 감소',ok:true,ratio:orderDecrease});}
  }
  const level=overrides.bubbleChainDecreaseLevel,ratio=overrides.bubbleChainDecreaseRatio;
  if((own(overrides,'bubbleChainDecreaseLevel')&&!integer(level))||(own(overrides,'bubbleChainDecreaseRatio')&&!number(ratio)))
   return unresolved('unknown-chain-decrease',[unknown('bubbleChainDecreaseLevel/bubbleChainDecreaseRatio','높은 단계 버블 수에 따른 감소 입력이 미확인입니다.')],trace);
  if(level>0&&ratio>0&&ratio<1){
   const chain=rules.items.filter(r=>r.chainId===row.chainId).sort((a,b)=>a.chainLevel-b.chainLevel);
   if(level<chain.length){
    const high=new Set(chain.slice(level).map(r=>r.type));
    const count=s.board.filter(cell=>cell&&high.has(s.bubbles?.[cell.uid]?.innerType)).length;
    const factor=ratio**count;
    if(count&&factor>0){chance*=factor;trace.push({id:'chain-decrease',label:'동일 체인의 높은 단계 버블 확률 감소',ok:true,count,ratio:factor});}
   }
  }
  const decrease=bubbleNoPurchaseRatio(overrides.bubbleDecrease);
  if(decrease.status==='unknown')return unresolved('unknown-purchase-decrease',decrease.unknowns,trace);
  chance*=decrease.ratio;
  trace.push({id:'purchase-decrease',label:'유료 버블 미구매 로그인 일수 보정',ok:true,ratio:decrease.ratio});
  chance=Math.max(chance,1);
 }
 // MainBoard _DoMergeItem resets m_lastBreakBubbleType before this function.
 // Passing a previous purchase cannot introduce an unreachable 100% bonus.
 if(overrides.bubbleBuyBonus)trace.push({id:'buy-bonus-reset',label:'일반 합성 진입 시 직전 버블 구매 타입 초기화',ok:false});
 return {status:'known',reason:'eligible',chancePercent:chance,trace,unknowns:[],mode:Object.keys(overrides).length?'explicit-input':'apk-default',targetType:targetType??null};
}

/** random must return a finite [0,1) value, matching MathUtil.Random(100).
 * No speculative RNG is used when the caller did not supply one. */
export function planMergeBubble(s,c,options={}){
 const result=bubbleChanceFor(s,c,options);
 if(result.status!=='known')return result;
 const type=String(options.resultType),overrides=options.overrides||{},quote=bubbleQuote(s,c,type,overrides);
 if(quote.status!=='known')return {...quote,chancePercent:result.chancePercent,trace:result.trace};
 if(!number(s.wallet?.time))return unresolved('unknown-time',[unknown('time','현재 연구 시각이 없습니다.')],result.trace);
 let value;try{value=typeof options.random==='function'?options.random():options.random;}catch{return unresolved('invalid-random',[unknown('random','난수 함수가 정상 값을 반환하지 않았습니다.')],result.trace);}
 if(!Number.isFinite(value)||value<0||value>=1)return unresolved('missing-random',[unknown('random','0 이상 1 미만의 난수 입력이 필요합니다.')],result.trace);
 const roll=Math.floor(value*100)+1;
 if(result.chancePercent<roll)return no('roll-failed',result.trace,{chancePercent:result.chancePercent,roll});
 const inputs={};
 for(const key of ['durationSeconds','tutorialCost'])if(own(overrides,key))inputs[key]=overrides[key];
 // Persist only effective, primitive price inputs. Activity metadata that
 // cannot affect this item's price need not make an otherwise valid save fail.
 const row=rowFor(c,type);
 if(!own(overrides,'tutorialCost')&&number(row.saleGemCost)&&row.saleGemCost<row.baseGemCost&&own(overrides,'bubbleSale')){
  const sale=overrides.bubbleSale;
  if(sale===false)inputs.bubbleSale=false;
  else if(sale.config===null||sale.resourceReady===false)inputs.bubbleSale={config:null,resourceReady:false};
  else{
   const cfg={};for(const key of ['sLv','sTime','eTime','rTime'])if(own(sale.config,key))cfg[key]=sale.config[key];
   inputs.bubbleSale={config:cfg,resourceReady:sale.resourceReady};
  }
 }
 const source={schema:1,type,createdAt:s.wallet.time,level:s.wallet.level,mode:Object.keys(inputs).length?'explicit-input':'apk-default',inputs};
 const spawn={type:codeFor(type,rulesFor(c).numericCodeOffset),innerType:type,kind:'natural',price:quote.price,basePrice:quote.basePrice,durationSeconds:quote.durationSeconds,
  expiresAt:s.wallet.time+quote.durationSeconds,source};
 return {status:'spawn',reason:'roll-passed',chancePercent:result.chancePercent,roll,spawn,trace:result.trace,unknowns:[],mode:result.mode,quote};
}

/** Validate persisted metadata without trusting stored prices or arbitrary
 * durations. Original three-field staged bubbles remain the caller's legacy
 * path. Expired natural instances may still be loaded for expiry processing. */
export function validBubbleInstance(b,c,time){
 if(!record(b)||b.kind!=='natural'||typeof b.innerType!=='string'||!number(time)||!record(b.source))return false;
 const src=b.source;
 if(src.schema!==1||src.type!==b.innerType||!number(src.createdAt)||src.createdAt>time||!integer(src.level)||src.level<rulesFor(c)?.unlockLevel||!record(src.inputs)||!['apk-default','explicit-input'].includes(src.mode))return false;
 if(!(rowFor(c,b.innerType)?.chancePercent>0))return false;
 if(Object.keys(src.inputs).some(k=>!['durationSeconds','tutorialCost','bubbleSale'].includes(k)))return false;
 if(src.mode!==(Object.keys(src.inputs).length?'explicit-input':'apk-default'))return false;
 if(own(src.inputs,'durationSeconds')&&!number(src.inputs.durationSeconds))return false;
 if(own(src.inputs,'tutorialCost')&&!integer(src.inputs.tutorialCost))return false;
 const sale=src.inputs.bubbleSale;
 if(own(src.inputs,'bubbleSale')&&sale!==false){
  if(!record(sale)||Object.keys(sale).some(k=>!['config','resourceReady'].includes(k)))return false;
  if(sale.config!==null){
   if(!record(sale.config)||Object.keys(sale.config).some(k=>!['id','sLv','sTime','eTime','rTime'].includes(k)))return false;
   if(bubbleSaleStatus({wallet:{time:src.createdAt,level:src.level}},sale).status!=='known')return false;
  }
 }
 // Recompute the creation quote from explicit activity input, not saved cost.
 const quote=bubbleQuote({wallet:{time:src.createdAt,level:src.level}},c,b.innerType,src.inputs);
 if(quote.status!=='known'||!number(b.price)||b.price!==quote.price||b.expiresAt!==src.createdAt+quote.durationSeconds)return false;
 if(own(b,'basePrice')&&b.basePrice!==quote.basePrice)return false;
 if(own(b,'durationSeconds')&&b.durationSeconds!==quote.durationSeconds)return false;
 if(own(b,'type')&&b.type!==codeFor(b.innerType,rulesFor(c).numericCodeOffset))return false;
 return true;
}
