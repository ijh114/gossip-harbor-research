// Finite presentation clock for the source InventoryFactoryItem/DetailCell
// callbacks. This module never grants rewards or mutates the domain save.
const number=n=>Number.isFinite(n)&&n>=0&&n<=1e12;
const copy=v=>structuredClone(v);
const clamp=v=>Math.max(0,Math.min(1,v));
const group=(c,type)=>c.groups.find(g=>g.targetType===type);
export const createFactoryMotion=()=>({schema:1,clock:0,lastSequence:0,locked:false,motions:[]});
export function validFactoryMotion(s,c){try{return s?.schema===1&&number(s.clock)&&Number.isSafeInteger(s.lastSequence)&&s.lastSequence>=0&&typeof s.locked==='boolean'&&Array.isArray(s.motions)&&s.motions.length<=128&&new Set(s.motions.map(m=>m.sequence)).size===s.motions.length&&s.motions.every(m=>{const g=group(c,m.targetType),f=g?.fragments.find(f=>f.type===m.itemType);return f&&Number.isSafeInteger(m.sequence)&&m.sequence>0&&m.sequence<=s.lastSequence&&number(m.startedAt)&&m.startedAt<=s.clock&&Number.isSafeInteger(m.fromScore)&&m.fromScore>=0&&m.toScore===m.fromScore+f.points&&m.maxScore===g.targetScore&&m.threshold===(m.toScore>=g.targetScore)&&Number.isSafeInteger(m.cursor)&&m.cursor>=0&&m.cursor<=5;});}catch{return false;}}
function schedule(m,c){const r=c.motionRules;if(!r)throw Error('Source factory motion declarations are required.');const flight=r.flightSeconds,end=flight+r.sliderSeconds+r.rewardPauseSeconds;return [
 {at:m.startedAt+flight,type:'slider-update',requestReward:m.threshold,targetType:m.targetType,sequence:m.sequence,lock:m.threshold?true:null},
 {at:m.startedAt+r.initialThresholdLockSeconds,type:'click-lock-ended',sequence:m.sequence,lock:m.threshold?false:null},
 {at:m.startedAt+end,type:'reward-view',targetType:m.targetType,sequence:m.sequence,enabled:m.threshold,lock:m.threshold?false:null},
 {at:m.startedAt+end+r.remainderSliderSeconds,type:'remainder-slider-ended',sequence:m.sequence},
 {at:m.startedAt+flight+r.flightRemoveDelaySeconds,type:'flight-removed',sequence:m.sequence}
];}
export function advanceFactoryMotion(s,now,c){
 if(!validFactoryMotion(s,c)||!number(now)||now<s.clock)return {ok:false,message:'공장 표시 시계·순서를 확인하세요.',state:s,events:[]};
 const next=copy(s),due=[];for(const m of next.motions){const steps=schedule(m,c);for(let i=m.cursor;i<steps.length&&steps[i].at<=now;i++){due.push({...steps[i],index:i,motion:m});}}
 due.sort((a,b)=>a.at-b.at||a.sequence-b.sequence||a.index-b.index);const events=[];
 for(const event of due){event.motion.cursor=event.index+1;if(event.lock!==null&&typeof event.lock==='boolean')next.locked=event.lock;const {motion,index,enabled,...publicEvent}=event;if(enabled!==false)events.push(publicEvent);}
 next.clock=now;next.motions=next.motions.filter(m=>m.cursor<5);return {ok:true,state:next,events};
}
/** Call after a successful add-score transaction, using its committed sequence.
 * Process returned events too: the start first advances older flight callbacks. */
export function startFactoryMotion(s,{now,sequence,targetType,itemType,fromScore,toScore},c){
 const stepped=advanceFactoryMotion(s,now,c);if(!stepped.ok)return stepped;const next=stepped.state,g=group(c,targetType),f=g?.fragments.find(f=>f.type===itemType);
 if(next.locked)return {ok:false,message:'공장 원작 선언의 입력 잠금 구간입니다.',state:next,events:stepped.events};
 if(!f||!Number.isSafeInteger(sequence)||sequence<=next.lastSequence||!Number.isSafeInteger(fromScore)||fromScore<0||toScore!==fromScore+f.points||next.motions.length>=128)return {ok:false,message:'공장 합산 결과·표시 작업 순서를 확인하세요.',state:next,events:stepped.events};
 const threshold=toScore>=g.targetScore;next.motions.push({sequence,targetType,itemType,fromScore,toScore,maxScore:g.targetScore,threshold,startedAt:now,cursor:0});next.lastSequence=sequence;if(threshold)next.locked=true;
 return {ok:true,state:next,events:[...stepped.events,{type:'flight-start',at:now,sequence,targetType,itemType,lock:threshold?true:null}]};
}
export function factoryMotionView(s,now,c){
 if(!validFactoryMotion(s,c)||!number(now))return {valid:false,inputLocked:false,flights:[],groups:[]};
 const latest=new Map();for(const m of s.motions)latest.set(m.targetType,m);const r=c.motionRules;
 return {valid:true,inputLocked:s.locked,flights:s.motions.map(m=>({...m,progress:clamp((now-m.startedAt)/r.flightSeconds),arrived:now-m.startedAt>=r.flightSeconds})),groups:[...latest.values()].map(m=>{
  const age=Math.max(0,now-m.startedAt),arrival=r.flightSeconds,end=arrival+r.sliderSeconds+r.rewardPauseSeconds;let value=m.fromScore/m.maxScore,phase='flight',displayScore=m.toScore;
  if(age>=arrival){const t=clamp((age-arrival)/r.sliderSeconds);value=m.threshold?value+(1-value)*t:value+(m.toScore/m.maxScore-value)*t;phase=m.threshold?'threshold-slider':'score-slider';}
  if(m.threshold&&age>=end){displayScore=m.toScore-m.maxScore;value=displayScore/m.maxScore*clamp((age-end)/r.remainderSliderSeconds);phase='remainder-slider';}
  return {targetType:m.targetType,value:clamp(value),displayScore,maxScore:m.maxScore,phase};
 })};
}
/** On actual view disable, UpdateSlider can settle one pending threshold.
 * Commit these reward attempts in the domain; if a queue limit rejects them,
 * points remain saved and LateInit can retry. Cancel never rolls back points. */
export function cancelFactoryMotion(s,now,c){
 const stepped=advanceFactoryMotion(s,now,c);if(!stepped.ok)return {...stepped,pendingRewards:[]};
 const pendingRewards=[...new Set(stepped.state.motions.filter(m=>m.threshold&&m.cursor===0).map(m=>m.targetType))];
 return {ok:true,state:{...stepped.state,locked:false,motions:[]},events:stepped.events,pendingRewards};
}
