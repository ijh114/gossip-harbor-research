// Portable rules: these functions never call a game server or a payment provider.
// Energy constants come from the shipped 4.10.5 Lua defaults. Board/order rules
// deliberately form a small experimental model, not a reconstruction of the board.
export const DEFAULT_RULES = Object.freeze({
  maxEnergy:100, recoverySeconds:120, refillEnergy:100, firstGemCost:10,
  maxGemCost:160, freeRefills:1, configuredNewUserFree:false,
  generationCost:1, boardSize:30, orderLevel:4, orderCoins:40,
});
export function createState(options={}) {
  return {energy:100,gems:200,coins:0,level:3,time:0,recoveryRemainder:0,
    energyBuys:0,freeUsed:0,freeTotal:1,price:10,board:Array(30).fill(null),
    selected:null,log:[],generated:0,orders:0,seed:42,...options};
}
function event(state,ok,message) {
  state.log.unshift({time:state.time,message,ok}); state.log=state.log.slice(0,50);
  return {ok,message};
}
function validNumber(value,name,min=0) {
  if(!Number.isFinite(value)||value<min) throw new RangeError(`Invalid ${name}`);
}
export function energyCost(state) {return state.freeUsed<state.freeTotal?0:state.price;}
export function advanceTime(state,seconds,rules=DEFAULT_RULES) {
  validNumber(seconds,'time'); validNumber(rules.recoverySeconds,'recoverySeconds',1);
  const oldDay=Math.floor(state.time/86400); state.time+=seconds;
  if(Math.floor(state.time/86400)>oldDay) state.price=rules.firstGemCost;
  let gained=0;
  if(state.energy<rules.maxEnergy) {
    const available=state.recoveryRemainder+seconds;
    gained=Math.min(rules.maxEnergy-state.energy,Math.floor(available/rules.recoverySeconds));
    state.energy+=gained;
    state.recoveryRemainder=state.energy>=rules.maxEnergy?0:available%rules.recoverySeconds;
  } else state.recoveryRemainder=0;
  return event(state,true,`${Math.round(seconds/60)}분 경과 · 자연 회복 +${gained}${Math.floor(state.time/86400)>oldDay?' · 일일 젬 비용 리셋':''}`);
}
export function buyEnergy(state,rules=DEFAULT_RULES) {
  const free=state.freeUsed<state.freeTotal; const cost=free?0:state.price;
  if(state.gems<cost) return event(state,false,`젬 부족 · 필요 ${cost}, 보유 ${state.gems}`);
  state.gems-=cost; state.energy+=rules.refillEnergy; state.energyBuys++;
  if(free) {
    state.freeUsed++;
    if(!rules.configuredNewUserFree && state.freeUsed>=state.freeTotal) state.price=rules.firstGemCost*2;
  } else state.price=Math.min(rules.maxGemCost,state.price*2);
  return event(state,true,`${free?'무료 충전':`${cost}젬 소비`} · 에너지 +${rules.refillEnergy}`);
}
function random(state) {let x=state.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;state.seed=x>>>0;return state.seed/4294967296;}
export function generateItem(state,rules=DEFAULT_RULES) {
  if(state.energy<rules.generationCost) return event(state,false,'에너지 부족 · 오퍼 트리거 실험에서 분기를 확인하세요.');
  const slot=state.board.findIndex(x=>x===null);
  if(slot<0) return event(state,false,'보드가 가득 찼습니다. 같은 아이템을 합치거나 주문을 제출하세요.');
  state.energy-=rules.generationCost;
  state.board[slot]={family:random(state)<0.5?'bread':'tea',level:1};state.generated++;
  return event(state,true,`아이템 생성 · 에너지 −${rules.generationCost}`);
}
export function mergeItems(state,from,to) {
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=state.board.length||to>=state.board.length||from===to) return event(state,false,'서로 다른 두 칸을 선택하세요.');
  const a=state.board[from],b=state.board[to];
  if(!a) return event(state,false,'첫 번째 칸이 비어 있습니다.');
  if(!b) {state.board[to]=a;state.board[from]=null;return event(state,true,'아이템 이동');}
  if(a.family!==b.family||a.level!==b.level) return event(state,false,'같은 종류·같은 레벨끼리 합칠 수 있습니다.');
  if(a.level>=10) return event(state,false,'실험 모델의 최대 레벨입니다.');
  state.board[to]={family:a.family,level:a.level+1};state.board[from]=null;
  return event(state,true,`합성 완료 · 레벨 ${a.level+1}`);
}
export function deliverOrder(state,rules=DEFAULT_RULES) {
  const i=state.board.findIndex(x=>x&&x.level>=rules.orderLevel);
  if(i<0) return event(state,false,`실험 주문: 레벨 ${rules.orderLevel} 이상 아이템 1개가 필요합니다.`);
  state.board[i]=null;state.coins+=rules.orderCoins;state.orders++;
  return event(state,true,`실험 주문 제출 · 코인 +${rules.orderCoins}`);
}
export function traceOffers(inputs={}) {
  // Server candidates here are analyst-supplied eligibility, not discovered live config.
  const x={level:3,energy:0,price:20,freeAvailable:false,triggerPrice:20,invite:false,noPay:false,
    bundle:true,plenty:false,chain:false,weekly:false,chainPrice:2.99,weeklyPrice:4.99,
    closedWithoutPurchase:true,popType:1,...inputs};
  const bundleEligible=x.bundle&&!x.freeAvailable&&x.energy<1&&x.price>=x.triggerPrice;
  const earlyBundle=bundleEligible&&Number(x.popType)!==1;
  const steps=[];
  const step=(id,label,ok,reason)=>{steps.push({id,label,ok,reason});return ok;};
  if(earlyBundle) {step('energy-bundle','에너지 번들 선노출',true,'Main·IAP·튜토리얼 게이트 통과를 가정. popType ≠ 1 → 일반 충전창 이전 분기');return {chosen:'에너지 번들 (충전창 이전)',steps,earlyBundle:true};}
  if(!x.closedWithoutPurchase) {step('close','충전창 닫기',false,'구매 없이 닫은 경우에만 후속 체인을 평가');return {chosen:null,steps,earlyBundle:false};}
  if(step('invite','친구 초대',x.invite,'서버·초대 상태 적격 여부를 입력값으로 가정')) return {chosen:'친구 초대',steps,earlyBundle:false};
  if(step('no-pay','EnergyGemOffer',x.noPay,'NoPayEnergy 서버 구성·잔여시간·쿨다운 적격 여부 가정')) return {chosen:'EnergyGemOffer',steps,earlyBundle:false};
  if(step('energy-bundle','에너지 번들',bundleEligible,!x.bundle?'서버 후보 비활성':x.freeAvailable?'무료 충전이 남아 있음':x.energy>=1?'생성 비용 이상의 에너지 보유':x.price<x.triggerPrice?'충전 젬 비용이 triggerPrice 미만':'에너지 부족·가격 임계치 통과, 나머지 서버 게이트 적격 가정')) return {chosen:'에너지 번들',steps,earlyBundle:false};
  if(step('plenty','Plenty 오퍼',x.plenty,'서버 후보·로컬 적격 여부 가정')) return {chosen:'Plenty 오퍼',steps,earlyBundle:false};
  let chosen=null;
  if(x.chain&&x.weekly) chosen=x.chainPrice<=x.weeklyPrice?'체인 패키지':'신규 주간 패키지';
  else if(x.chain) chosen='체인 패키지'; else if(x.weekly) chosen='신규 주간 패키지';
  step('chain-weekly','체인 / 신규 주간 패키지',!!chosen,chosen?`가격 비교 기준 GetFixedMoney · 체인 ${x.chainPrice} / 주간 ${x.weeklyPrice}`:'두 후보 모두 비활성');
  return {chosen,steps,earlyBundle:false};
}
export function activityState(inputs={}) {
  const x={level:3,startLevel:5,now:0,start:3600,end:86400,settle:90000,downloaded:true,...inputs};
  if(!(x.start<x.end&&x.end<=x.settle)) return {state:'invalid',label:'시간 설정 오류',reason:'시작 < 종료 ≤ 보상 종료로 설정하세요.'};
  if(x.level<x.startLevel) return {state:'locked',label:'레벨 잠금',reason:`sLv ${x.startLevel} 미충족`};
  if(!x.downloaded) return {state:'resources',label:'리소스 대기',reason:'기본 GetState()는 리소스 미준비 시 Released를 반환'};
  if(x.now<x.start) return {state:'upcoming',label:'시작 전',reason:'서버 시각 < sTime'};
  if(x.now>=x.settle) return {state:'closed',label:'종료',reason:'서버 시각 ≥ rTime'};
  if(x.now>=x.end) return {state:'settlement',label:'종료 후 보상 구간',reason:'eTime ≤ 서버 시각 < rTime (축약 상태 표현)'};
  return {state:'active',label:'진행 중',reason:'sTime ≤ 서버 시각 < eTime · 게이트 통과'};
}
