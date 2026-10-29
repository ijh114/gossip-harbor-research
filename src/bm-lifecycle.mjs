// Thin replay harness for existing pure web models; never a second offer state machine.
import {createPlay,advancePlay,playAction} from './play-model.mjs';
import {dispatchCommerce,reconcileCommerce,energyGiftStatus} from './commerce-model.mjs';
import {evaluateEnergyGift} from './bm-rules.mjs';

const DAY=86400,MAX_TIME=1e9,MAX_STEP=7*DAY;
const ENERGY_FIELDS=['groupDuration','groupCD','giftDuration','triggerEnergyPrice','dailyTriggerUpper','poptype'];
const COMMERCE_ACTIONS=new Set(['commerce-input','commerce-trigger','commerce-detail']);
const PLAY_ACTIONS=new Set(['start','main','home','open-energy','close-energy','buy-energy','close-offer','close-shop','shop','aid-energy']);
const walletFields=new Set(['time','energy','gems','coins','level','price','freeUsed','freeTotal','recoveryRemainder','energyBuys']);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const integer=value=>Number.isSafeInteger(value)&&value>=0&&value<=MAX_TIME;
const day=time=>Math.floor(time/DAY);
const clone=value=>structuredClone(value);
const flatten=(value,prefix='')=>Object.entries(value).flatMap(([key,item])=>record(item)?flatten(item,prefix+key+'.'):[[prefix+key,item]]);

function missingInputs(state,sourceInputs){
 const gift=state.commerce.inputs.energyGift,unknown=[];
 if(gift.enabled)for(const field of ENERGY_FIELDS)if(gift[field]===null||gift[field]===undefined)unknown.push('energyGift.'+field);
 if(typeof sourceInputs?.lateInited!=='boolean')unknown.push('sourceInputs.lateInited');
 return unknown;
}

function staticCreationPredicate(state,sourceInputs){
 const unknown=missingInputs(state,sourceInputs);if(unknown.length)return {status:'input-unknown',unknown,result:null};
 const gift=state.commerce.inputs.energyGift,g=state.commerce.energy,t=state.wallet.time;
 // The source manager expires only when itemEnd < now. This comparison never
 // changes the current web state, including the known equality disagreement.
 const existing=g.left>0&&t<=g.itemEnd;
 const raw=gift.enabled?Object.fromEntries(ENERGY_FIELDS.map(field=>[field,gift[field]])):null;
 const result=evaluateEnergyGift(raw,{lateInited:sourceInputs.lateInited,serverTime:t,refreshTime:g.triggerDay*DAY,
  triggerCount:g.triggerCount,coolingDown:g.state==='CoolingDown',freeAvailable:state.wallet.freeUsed<state.wallet.freeTotal,
  gemPrice:state.wallet.price,existingValidBundle:existing,energy:state.wallet.energy,
  generationCost:state.commerce.lastGenerationCost,chainEnergyOpen:state.commerce.inputs.chainEnergy});
 return {status:'static-predicate-on-web-state',unknown:[],result,
  boundary:'현재 웹 투영 상태에 대한 정적 생성 조건 비교다. 다른 원작 상태 머신을 재생하거나 실제 적격성을 관측한 것이 아니다.'};
}

export function snapshotBMLifecycle(state,playConfig,{sourceInputs={}}={}){
 const g=state.commerce.energy,eligibility=energyGiftStatus(state,playConfig),last=state.commerce.lastRoute;
 return {now:state.wallet.time,groupState:g.state,groupEnd:g.groupEnd,cooldownEnd:g.cooldownEnd,itemEnd:g.itemEnd,
  triggerCount:g.triggerCount,triggerDay:g.triggerDay,left:g.left,configured:eligibility.configured,
  existing:eligibility.existing,canGenerate:eligibility.canGenerate,generationCost:eligibility.generationCost,
  canAttemptFromLack:eligibility.canAttemptFromLack,poptype:eligibility.poptype,
  route:last?.chosen??null,routeUnknown:last?.unknown??null,routeTrace:clone(last?.trace??[]),routeMeaning:'last-evaluated-web-route',
  modal:state.modal??null,offerChosen:state.offer?.chosen??null,moreNextAt:state.commerce.moreNextAt,
  wallet:Object.fromEntries([...walletFields].map(field=>[field,state.wallet[field]??0])),
  sourcePredicate:staticCreationPredicate(state,sourceInputs)};
}

function comparisons(before,after,event,state){
 const rows=[],source=(id,status,actual,sourcePrediction,note)=>rows.push({id,status,actual,sourcePrediction,note,evidenceType:'source-static-comparison'});
 if(after.left>0){const expected=after.now<=after.itemEnd;source('item-expiry-equality',expected===after.existing?'aligned':'gap',after.existing,expected,
  'BundleManager.lua는 itemEnd < now에서 만료한다. 현재 웹은 now < itemEnd여야 기존 상품으로 본다. left가 있는 현재 행만 비교한다.');}
 if(day(before.now)!==day(after.now)&&before.triggerCount>0&&!(event.kind==='commerceAction'&&event.action==='commerce-trigger'&&event.value!=='close'))
  source('daily-reset-timing','gap',after.triggerCount,before.triggerCount,
   '이 사건의 시간 전진은 웹 reconcile에서 일별 횟수를 갱신했다. 소스의 _Try2UpdateTriggerCount는 LateInit 이후 생성 판정 호출 때 실행된다. 다음 소스 호출 전 DB 값만 비교한다.');
 if(event.kind==='commerceAction'&&event.action==='commerce-input'&&String(event.value?.field).startsWith('energyGift.')&&before.groupState!=='None'&&after.groupState==='None'){
  const known=event.sourceAssumption?.sameGroupID===true&&event.sourceAssumption?.md5Changed===true;
  source('config-identity-reset',known?'conditional-gap':'input-unknown',after.groupState,known?before.groupState:null,
   known?'같은 groupID와 변경 MD5를 명시한 연구 가정이다. 소스는 같은 groupID의 단순 설정 변경으로 _ClearState를 호출하지 않지만 웹은 전체 입력 signature 변경으로 비운다.':'웹 전체 signature는 바뀌었지만 원작 groupID/MD5가 없어 소스가 clear할지 확정할 수 없다.');
 }
 if(event.kind==='playAction'&&event.action==='close-offer'&&before.offerChosen==='EnergyBundle'&&before.modal==='offer')
  source('close-offer-routing','unimplemented',after.modal,after.poptype===1?'Plenty/Chain/NewWeekly 후속 체인 검사':'ShopModel.OpenEnergyWindow 호출',
   '웹 close-offer는 닫기만 한다. source BundleEnergyWindow 미구매 닫기는 poptype별 후속 호출을 갖는다. 실제 후속 후보의 성공은 입력 미확인이다.');
 const input=state.commerce.inputs,free=state.wallet.freeUsed<state.wallet.freeTotal;
 if(free&&input.more.threshold!==null&&!input.chainEnergy){
  const reached=after.routeTrace.some(row=>row.label==='후속 Plenty/Chain/주간 공통 gate');
  source('more-free-normal-price',reached&&after.wallet.price!==0?'gap':reached?'aligned':'not-reached',0,after.wallet.price,
   '웹의 후속 normalCost는 무료 잔여 시0이다. source GetEnergyCostExcludeFree는 GetEnergyData.costNum의 저장 충전가격부터 시작한다. 높은 우선순위가 이미 선택되면 이 gate에 도달하지 않는다.');
 }
 return rows;
}

function boundaries(catalog){
 return [...(catalog?.boundaries??[]),'run.ok는 연구 사건열 재생의 유효성이다. 실제 상품 노출·구매·지급 성공을 뜻하지 않는다.'];
}

function invalid(status,message,catalog){
 return {ok:false,status,message,mode:'research',unknown:[message],events:[],boundaries:boundaries(catalog),final:null,
  originalRuntimeObserved:false,receiptsVerified:0,rewardsIssuedByHarness:0};
}

function validateScenario(scenario){
 if(!record(scenario)||scenario.mode!=='research')throw new Error('mode: research를 명시해야 한다.');
 if(!record(scenario.initial)||!record(scenario.initial.wallet)||!record(scenario.input)||!Array.isArray(scenario.events)||scenario.events.length>200)
  throw new Error('initial.wallet/input/events 형식을 확인하세요. 사건은200개 이하여야 한다.');
 for(const [field,value]of Object.entries(scenario.initial.wallet))if(!walletFields.has(field)||!integer(value))throw new Error('유효하지 않은 초기 wallet 입력: '+field);
 if((scenario.initial.wallet.level??1)<1)throw new Error('초기 레벨은1 이상이어야 한다.');
 let previous=scenario.initial.wallet.time??0;const ids=new Set();
 for(const event of scenario.events){
  if(!record(event)||typeof event.id!=='string'||!event.id||ids.has(event.id)||!integer(event.at)||event.at<previous||event.at-previous>MAX_STEP)
   throw new Error('사건 ID는 고유하며 시각은0 이상 정수·비감소·한 단계7일 이하여야 한다.');
  if(!['advanceClock','commerceAction','playAction','probe'].includes(event.kind))throw new Error('지원하지 않는 사건 종류: '+event.kind);
  if(['commerceAction','playAction'].includes(event.kind)&&typeof event.action!=='string')throw new Error('동작 이름이 필요하다.');
  previous=event.at;ids.add(event.id);
 }
}

export function runBMLifecycle(scenario,catalog,{playConfig}={}){
 if(!playConfig?.commerceRules||!Array.isArray(playConfig.items))return invalid('missing-play-config','기존 playConfig/commerceRules가 필요하다. 별도 가정 설정으로 대체하지 않는다.',catalog);
 const selected=typeof scenario==='string'?catalog?.presets?.find(item=>item.id===scenario):scenario;
 try{validateScenario(selected);}catch(error){return invalid('invalid-scenario',error.message,catalog);}
 const spec=clone(selected),config=clone(playConfig),events=[];
 let state;
 try{
  state=createPlay(config);Object.assign(state.wallet,spec.initial.wallet);state.stage='play';reconcileCommerce(state,config);
  for(const [field,value]of flatten(spec.input)){
   const result=dispatchCommerce(state,config,'commerce-input',{field,value});
   if(!result.ok)return invalid('invalid-input',field+': '+result.message,catalog);
  }
 }catch(error){return invalid('invalid-input',error.message,catalog);}
 const initial=snapshotBMLifecycle(state,config,{sourceInputs:spec.sourceInputs});
 for(const action of spec.events){
  const before=snapshotBMLifecycle(state,config,{sourceInputs:spec.sourceInputs});
  let clockResult=null,result;
  const seconds=action.at-state.wallet.time;
  if(seconds>0){clockResult=advancePlay(state,seconds,config,{silent:true});if(!clockResult.ok)return invalid('clock-rejected',clockResult.message,catalog);}
  if(action.kind==='probe')result={ok:true,status:'probe',message:'읽기 전용 웹 상태 표본. 자동 tick/서버 호출 없음.'};
  else if(action.kind==='advanceClock')result={ok:true,status:'advanced',message:'기존 advancePlay로 연구 시간을 전진했다.'};
  else if(action.kind==='commerceAction'&&COMMERCE_ACTIONS.has(action.action))result={...dispatchCommerce(state,config,action.action,action.value),status:'existing-commerce-model'};
  else if(action.kind==='playAction'&&PLAY_ACTIONS.has(action.action))result={...playAction(state,action.action,action.value,config),status:'existing-play-model'};
  else result={ok:false,status:'unsupported',message:'이 harness 범위에서 지원하지 않는 동작이다. IAP/영수증/상품 보상 성공을 만들어내지 않는다.'};
  const after=snapshotBMLifecycle(state,config,{sourceInputs:spec.sourceInputs}),comparison=comparisons(before,after,action,state);
  if(result.status==='unsupported')comparison.push({id:'energy-iap-unsupported',status:'unimplemented',actual:'동작 자체는 무지급·미지원. 사건 전 시계 전진 효과는 별도다.',sourcePrediction:null,
   evidenceType:'source-static-comparison',note:'소스에는 구매 성공 콜백·보상 지급·CostLeftCount·재trigger가 있지만 현재 웹 EnergyGift IAP는 미연결이다. 반복 요청 무지급은 harness 경계이며 원작 exactly-once 검증이 아니다.'});
  events.push({id:action.id,now:after.now,at:action.at,kind:action.kind,action:action.action??action.kind,label:action.label??action.action??action.kind,
   value:clone(action.value??null),before,after,result:clone(result),clock:clockResult?{seconds,result:clockResult}:null,comparisons:comparison,
   evidenceType:'research-replay',originalRuntimeObserved:false});
 }
 const final=snapshotBMLifecycle(state,config,{sourceInputs:spec.sourceInputs});
 const unknown=[...new Set([...(catalog?.unknowns??[]),...missingInputs(state,spec.sourceInputs),...(final.routeUnknown?[final.routeUnknown]:[])])];
 return {ok:true,status:events.some(event=>event.result.status==='unsupported')?'replayed-with-unimplemented-paths':'replayed-research',mode:'research',
  id:spec.id,label:spec.label,unknown,events,initial,final,boundaries:boundaries(catalog),
  originalRuntimeObserved:false,receiptsVerified:0,rewardsIssuedByHarness:0,
  implementation:'createPlay / dispatchCommerce / playAction / advancePlay의 기존 구현 호출. evaluateEnergyGift는 현재 웹 상태의 정적 조건 비교에만 사용한다.'};
}
