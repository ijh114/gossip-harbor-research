// Derived static predicates. Inputs are analyst scenarios, never live server values.
const DAY=86400;
function number(value,name,min=0){if(!Number.isFinite(value)||value<min)throw new RangeError(`${name}: ${min} 이상의 숫자가 필요합니다.`);return value;}
export function normalizeEnergyGift(raw){
 if(!raw)return null;
 for(const name of ['groupDuration','groupCD','giftDuration','triggerEnergyPrice','dailyTriggerUpper','poptype'])number(raw[name],name);
 if(!Number.isInteger(raw.dailyTriggerUpper))throw new RangeError('dailyTriggerUpper: 정수가 필요합니다.');
 return {groupSeconds:raw.groupDuration*60,cooldownSeconds:raw.groupCD*60,giftSeconds:raw.giftDuration*60,triggerPrice:raw.triggerEnergyPrice,triggerLimit:raw.dailyTriggerUpper,popType:raw.poptype};
}
export function evaluateEnergyGift(raw,state={}){
 const config=normalizeEnergyGift(raw),s={lateInited:true,serverTime:86400,refreshTime:86400,triggerCount:0,coolingDown:false,freeAvailable:false,gemPrice:20,existingValidBundle:false,energy:0,generationCost:1,chainEnergyOpen:false,...state};
 for(const key of ['serverTime','refreshTime','triggerCount','gemPrice','energy'])number(s[key],key);number(s.generationCost,'generationCost',1);
 // _Try2UpdateTriggerCount uses server-day quotient, separate from group cooldown.
 const refreshed=Math.floor(s.serverTime/DAY)!==Math.floor(s.refreshTime/DAY),count=refreshed?0:s.triggerCount;
 const checks=[
  ['lateInit','LateInit 완료',s.lateInited],
  ['config','EnergyGift 구성 존재',!!config],
  ['daily','일별 신규 생성 횟수',!!config&&count<config.triggerLimit],
  ['cooldown','그룹 쿨다운 아님',!s.coolingDown],
  ['free','무료 충전 차례 아님',!s.freeAvailable],
  ['price','일반 젬 충전 가격 임계값',!!config&&s.gemPrice>=config.triggerPrice],
  ['existing','그룹 내 유효 번들 없음',!s.existingValidBundle],
  ['energy','현재 생성 비용보다 에너지 부족',s.energy<s.generationCost],
  ['chain','ChainEnergy 충전 체인 비활성',!s.chainEnergyOpen]
 ];
 let stopped=false;const gates=checks.map(([id,label,pass])=>{const evaluated=!stopped;if(evaluated&&!pass)stopped=true;return {id,label,evaluated,pass:evaluated?!!pass:null};});
 return {canCreate:!stopped,config,gates,refreshed,effectiveTriggerCount:count,firstFailure:gates.find(x=>x.evaluated&&!x.pass)?.id||null,scope:'신규 EnergyBundle 생성 판정만. 기존 번들 노출·상위 IAP/튜토리얼/UI 게이트는 별도.'};
}
export function energyCostExcludeFree(normalPrice,chainPrices=[],currentIndex=0){
 number(normalPrice,'normalPrice');if(!Number.isInteger(currentIndex)||currentIndex<0)throw new RangeError('currentIndex');
 const next=chainPrices.slice(currentIndex).find(price=>Number.isFinite(price)&&price>0);
 return Math.max(normalPrice,next??0);
}
