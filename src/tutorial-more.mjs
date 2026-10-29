// Additional isolated executer projections. No live activity calls, wallet,
// original guide mutation, reward dispatch or native input are performed here.
const ID={energy:'tutorial_energyBoosteight_start',weekly:'tutorial_weekly_quest_bonus_star',bonus:'tutorial_battlepass_bonus_task',extra:'tutorial_event_task_extra_reward_entry',generator:'tutorial_generator_boost_active'};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=160;
const array=v=>Array.isArray(v)&&v.length<=1000;
const strings=v=>array(v)&&v.every(text);
const bool=v=>typeof v==='boolean';
const time=v=>Number.isFinite(v)&&v>=0&&v<=1e9;
const states=['Preparing','Started','Ended','Released'];
const guide=(c,id)=>c.guides.find(g=>g.id===id);
const step=(c,id,phase)=>guide(c,id)?.steps.find(p=>p.phase===phase);
const answer=(ok,status,message,extra={})=>({ok,status,message,unknown:[],changed:false,...extra});
const unknown=fields=>answer(false,'unknown','미확인 컨텍스트를 명시해야 이 경로를 판단할 수 있습니다.',{unknown:[...new Set(fields)]});
const blocked=message=>answer(false,'blocked',message);
const ignored=message=>answer(true,'ignored',message);
function log(s,id,kind,detail=''){s.history.push({time:s.time,guideId:id,kind,phase:s.active?.phase||null,detail});s.history=s.history.slice(-50);}
function phase(s,c,name){
 const a=s.active,p=step(c,a.id,name);a.phase=name;a.sourceStep=p.sourceStep;a.strong=p.strong;a.dueAt=p.delaySeconds===undefined?null:s.time+p.delaySeconds;
 if(p.registered&&!a.registered){s.registeredFinished.push(a.id);a.registered=true;log(s,a.id,'registered','첫 시각 단계의 SetTutorialFinished 등록');}
 log(s,a.id,'phase',p.label);
}
function begin(s,c,id,name,snapshot=null){s.active={id,phase:name,sourceStep:null,startedAt:s.time,dueAt:null,strong:false,registered:false,snapshot,target:null};phase(s,c,name);return answer(true,'started','명시적 연구 컨텍스트에서 안내 경로를 시작했습니다.');}
function finish(s,id,detail){if(!s.registeredFinished.includes(id))s.registeredFinished.push(id);if(!s.completed.includes(id))s.completed.push(id);log(s,id,'completed',detail);s.active=null;return answer(true,'completed',detail);}
function readWindows(ctx){return strings(ctx.openViews)?null:unknown(['openViews']);}
function runningSnapshot(ctx,event={}){
 const exists=event.modelExists===undefined?ctx.extraRewardModelExists:event.modelExists;
 if(!bool(exists))return {error:unknown(['extraRewardModelExists / event.modelExists'])};
 if(!exists)return {running:false};
 const running=event.running===undefined?ctx.extraRewardRunning:event.running;
 if(!bool(running))return {error:unknown(['extraRewardRunning / event.running'])};return {running};
}
function passSelection(ctx,c){
 if(!array(ctx.passActivities))return {error:unknown(['passActivities'])};
 if(ctx.passActivities.length!==c.passActivityTypes.length)return {error:unknown(['passActivities: 모든 동봉 패스 종류의 상태'])};
 const seen=new Set();for(const r of ctx.passActivities){if(!object(r)||!c.passActivityTypes.includes(r.activityType)||seen.has(r.activityType)||!states.includes(r.state))return {error:unknown(['passActivities: activityType/state'])};seen.add(r.activityType);}
 const started=ctx.passActivities.filter(x=>x.state==='Started');
 if(!started.length)return {error:blocked('소스는 Started 패스 모델 부재에 Assert합니다. 임의로 완료하지 않습니다.')};
 if(started.length===1)return {activityType:started[0].activityType};
 if(!text(ctx.selectedPassActivity))return {error:unknown(['selectedPassActivity: 다중 Started의 pairs 순서 미확인'])};
 if(!started.some(x=>x.activityType===ctx.selectedPassActivity))return {error:blocked('명시한 패스 선택이 Started 후보와 일치하지 않습니다.')};return {activityType:ctx.selectedPassActivity};
}
function start(s,event,ctx,c,id){
 if(s.registeredFinished.includes(id))return blocked('Finished로 등록된 안내입니다. 명시적으로 연구 초기화한 뒤 다시 비교하세요.');
 if(id===ID.energy){
  if(event.type==='executer-started'){
   if(typeof ctx.persistedOngoingData!=='string'||ctx.persistedOngoingData.length>160)return unknown(['persistedOngoingData']);
   return ctx.persistedOngoingData==='1'?finish(s,id,'OnStart에서 ongoing=1을 복원하면 표시 없이 FinishTutorial을 호출합니다.'):ignored('진행 문자열이1이 아니므로 CloseView를 기다립니다.');
  }
  if(event.type!=='view-closed'||event.name!=='EnergyBoostEightStartWindow')return ignored('EnergyBoostEightStartWindow CloseView를 기다립니다.');
  if(!bool(ctx.energyBoostHudAvailable))return unknown(['energyBoostHudAvailable']);
  if(!ctx.energyBoostHudAvailable)return blocked('명시적 null 종료 분기가 없는 HUD 표현 부재입니다. 완료를 추정하지 않습니다.');
  begin(s,c,id,'boost-highlight');s.active.target={hud:'EnergyBoost',ongoingSaved:'1'};return answer(true,'started','부스트 HUD를 강조했지만 Finished 등록은 아직 하지 않았습니다.');
 }
 if(id===ID.weekly){
  if(event.type!=='weekly-bonus-star-collected')return ignored('WeeklyActiveQuestBonusStarCollect를 기다립니다.');
  const guard=readWindows(ctx);if(guard)return guard;const matches=c.weeklyWindows.filter(x=>ctx.openViews.includes(x));
  if(!matches.length)return finish(s,id,'열린 주간 과제 창을 찾지 못해 시각 안내 없이 Finish합니다.');
  if(!bool(ctx.otherStrong))return unknown(['otherStrong']);
  if(ctx.otherStrong)return finish(s,id,'다른 강제 안내가 있으면 추가 별 안내를 표시하지 않고 Finish합니다.');
  if(matches.length>1&&!text(ctx.weeklySelectedWindow))return unknown(['weeklySelectedWindow: 다중 창의 pairs 순서 미확인']);
  const selected=matches.length===1?matches[0]:ctx.weeklySelectedWindow;if(!matches.includes(selected))return blocked('명시한 주간 과제 창이 열린 창과 일치하지 않습니다.');
  return begin(s,c,id,'star-delay',{window:selected});
 }
 if(id===ID.bonus){
  if(event.type!=='pass-bonus-cell-created')return ignored('PassActivityBonusTaskCellCreated를 기다립니다.');
  const selected=passSelection(ctx,c);if(selected.error)return selected.error;
  if(!text(ctx.bonusTaskCellId))return unknown(['bonusTaskCellId']);
  return begin(s,c,id,'cell-delay',{activityType:selected.activityType,cellId:ctx.bonusTaskCellId});
 }
 if(id===ID.extra){
  if(event.type!=='extra-reward-start')return ignored('TaskExtraRewardTutorialStart를 기다립니다.');
  const model=runningSnapshot(ctx);if(model.error)return model.error;if(!model.running)return ignored('추가 보상 모델이 없거나 실행 중이 아니므로 시작하지 않습니다.');
  begin(s,c,id,'task-button');s.active.target={hud:'Task'};return answer(true,'started','과제 HUD를 강조하고 Finished를 먼저 등록했습니다.');
 }
 if(id===ID.generator){
  if(event.type!=='generator-buff-animation-ended')return ignored('GeneratorBoostBuffActiveAniEnd를 기다립니다.');
  const guard=readWindows(ctx);if(guard)return guard;if(!ctx.openViews.includes(c.generatorWindow))return ignored('생성기 부스트 메인 창이 없어 시작하지 않습니다.');
  if(!bool(ctx.canActiveSpreadFirst))return unknown(['canActiveSpreadFirst']);if(!ctx.canActiveSpreadFirst)return ignored('첫 CanActiveSpread가false이므로 두 번째 호출을 하지 않습니다.');
  if(!bool(ctx.canActiveSpreadSecond))return unknown(['canActiveSpreadSecond']);if(!ctx.canActiveSpreadSecond)return ignored('두 번째 CanActiveSpread가false여서 시작하지 않습니다.');
  if(!bool(ctx.boostWindowAfterStartAvailable))return unknown(['boostWindowAfterStartAvailable']);
  begin(s,c,id,'active-area',{window:c.generatorWindow});if(!ctx.boostWindowAfterStartAvailable)return finish(s,id,'StartTutorial0에서 창 재조회가nil이면 등록 후 즉시 Finish합니다.');
  s.active.target={area:'generator-active'};return answer(true,'started','부스트 활성 영역을 강조합니다.');
 }
 return blocked('지원하지 않는 안내입니다.');
}
function delayed(s,ctx,c){
 const a=s.active;if(a.dueAt===null)return ignored('진행 중인 정적 지연 콜백이 없습니다.');if(s.time<a.dueAt)return answer(true,'waiting','원작 정적 지연 경계 전입니다.');
 if(a.id===ID.weekly&&a.phase==='star-delay'){
  const guard=readWindows(ctx);if(guard)return guard;if(!ctx.openViews.includes(a.snapshot.window))return blocked('0.6초 콜백은 창 nil을 검사하지 않습니다. 창 부재를 완료로 바꾸지 않았습니다.');
  phase(s,c,'star-area');a.target={area:'weekly-star'};return answer(true,'advanced','추가 별 영역 설명을 표시합니다. 다른 강제 안내를 재검사하지 않는 소스 경로입니다.');
 }
 if(a.id===ID.bonus&&a.phase==='cell-delay'){
  if(!bool(ctx.bonusTaskCellAlive))return unknown(['bonusTaskCellAlive']);
  if(!ctx.bonusTaskCellAlive){phase(s,c,'waiting-cell');return answer(true,'waiting','셀 gameObject가 사라져 설명을 시작하지 않았습니다. Finish도 호출하지 않습니다.');}
  if(!bool(ctx.otherStrong))return unknown(['otherStrong']);
  if(ctx.otherStrong){phase(s,c,'waiting-cell');return answer(true,'waiting','다른 강제 안내가 있어 설명을 시작하지 않았습니다. 다음 셀 생성 이벤트를 기다립니다.');}
  phase(s,c,'bonus-dialog');a.target={cellId:a.snapshot.cellId};return answer(true,'advanced','추가 과제 셀을 설명합니다. 소스처럼 아직 Finished를 등록하지 않았습니다.');
 }
 if(a.id===ID.extra&&a.phase==='chest-delay'){
  if(!bool(ctx.extraChestAvailable))return unknown(['extraChestAvailable']);
  if(!ctx.extraChestAvailable)return finish(s,a.id,'지연 뒤 GetExtraRewardChestTransform이nil이면 Finish합니다.');
  phase(s,c,'chest-highlight');a.target={area:'extra-chest',maskOffset:[0,82,0],maskSizeAdd:[20,20]};return answer(true,'advanced','추가 보상 상자를 강조합니다. 마스크 값은 정적 Unity 값입니다.');
 }
 return ignored('이 단계에는 지연 콜백이 없습니다.');
}
function advance(s,event,ctx,c){
 const a=s.active,id=a.id;if(event.type==='clock')return delayed(s,ctx,c);
 if(id===ID.energy){
  if(event.type==='executer-started')return finish(s,id,'저장된 ongoing=1 상태의 Executer를 재시작하면 즉시 Finish합니다.');
  if(event.type==='mask-click'||event.type==='energy-mode-changed'||event.type==='view-opened'&&event.name==='EnergyBoostSettingWindow')return finish(s,id,'부스트 변경·설정 창 열림·전체 마스크 콜백으로 화면 안내를 완료했습니다.');
  return ignored('8배 부스트 안내의 종료 이벤트가 아닙니다.');
 }
 if(id===ID.weekly){
  if(event.type==='weekly-state-changed')return finish(s,id,'activityDefinition을 선택한 뒤의 상태 변경은 상태값과 관계없이 Finish합니다.');
  if(event.type==='mask-click'&&a.phase==='star-area')return finish(s,id,'추가 별 영역 마스크 콜백으로 안내를 완료했습니다.');
  return ignored('별 영역 콜백 또는 활동 상태 변경을 기다립니다.');
 }
 if(id===ID.bonus){
  if(event.type==='pass-state-changed'){
   let state=event.selectedState;
   if(state===undefined){if(!array(ctx.passActivities))return unknown(['passActivities / event.selectedState']);state=ctx.passActivities.find(x=>x?.activityType===a.snapshot.activityType)?.state;}
   if(!states.includes(state))return unknown(['선택된 패스 모델 상태 / event.selectedState']);
   return ['Ended','Released'].includes(state)?finish(s,id,'선택된 패스 모델이Ended/Released여서 지연/설명을 종료했습니다.'):ignored('선택된 패스 모델이Ended/Released가 아닙니다.');
  }
  if(event.type==='pass-bonus-cell-created'&&a.phase==='waiting-cell')return start(s,event,ctx,c,id);
  if(event.type==='pass-bonus-cell-created')return blocked('중복 셀 생성의 Delay 경합은 이 독립 도구에서 재현하지 않습니다.');
  if(event.type==='mask-click'&&a.phase==='bonus-dialog')return finish(s,id,'추가 과제 설명 마스크를 완료한 시점에 Finished를 등록했습니다.');
  return ignored('추가 과제 셀의 지연/설명 단계가 기다리는 이벤트가 아닙니다.');
 }
 if(id===ID.extra){
  if(event.type==='extra-state-changed'){const model=runningSnapshot(ctx,event);if(model.error)return model.error;return model.running?ignored('추가 보상 활동이 계속 실행 중입니다.'):finish(s,id,'진행 문자열이 있는 상태에서 모델이 없거나 실행 종료되면 Finish합니다.');}
  if(event.type==='view-opened'&&event.name==='TaskWindow'&&a.phase==='task-button'){
   const guard=readWindows(ctx);if(guard)return guard;if(!ctx.openViews.includes('TaskWindow'))return finish(s,id,'TaskWindow OpenView 뒤 창을 찾지 못하면 Finish합니다.');
   phase(s,c,'chest-delay');a.snapshot={window:'TaskWindow'};a.target=null;return answer(true,'advanced','추가 보상 상자1초 지연을 시작했습니다.');
  }
  if(event.type==='mask-click'&&a.phase==='chest-highlight')return finish(s,id,'추가 보상 상자 마스크 콜백으로 안내를 완료했습니다.');
  return ignored('첫 WholeMask에는 콜백이 없습니다. 과제 창 OpenView 또는 상자 콜백이 필요합니다.');
 }
 if(id===ID.generator){
  if(event.type==='generator-state-changed'){
   if(!states.includes(event.state))return unknown(['event.state']);
   return ['Started','Released'].includes(event.state)?finish(s,id,'원문 조건 Started 또는 Released에 따라 안내를 종료했습니다.'):ignored('원문의 종료 조건에Ended/Preparing은 포함되지 않습니다.');
  }
  if(event.type==='mask-click'&&a.phase==='active-area'){
   const guard=readWindows(ctx);if(guard)return guard;if(!ctx.openViews.includes(c.generatorWindow))return finish(s,id,'닫기 영역을 강조하기 전에 창이nil이면 Finish합니다.');
   phase(s,c,'close-area');a.target={area:'generator-close'};return answer(true,'advanced','부스트 창의 닫기 영역을 강조합니다.');
  }
  if(event.type==='mask-click'&&a.phase==='close-area')return finish(s,id,'닫기 영역 마스크 콜백으로 안내를 완료했습니다.');
  return ignored('생성기 부스트 안내의 대상 이벤트가 아닙니다.');
 }
 return ignored('현재 안내의 대상 이벤트가 아닙니다.');
}
export function createMoreTutorials(c){return {schema:1,revision:c.revision,time:0,registeredFinished:[],completed:[],active:null,history:[]};}
export function moreTutorialEvent(s,event,ctx,c){
 if(!validMoreTutorials(s,c))return blocked('추가 안내 저장이 호환되지 않습니다. 원본 보존 후 별도 상태를 초기화하세요.');
 if(!object(event)||!text(event.type))return blocked('이벤트 종류가 필요합니다.');
 if(!object(ctx)||ctx.mode!=='research')return unknown(['mode=research']);
 const now=event.now===undefined?s.time:event.now;if(!time(now)||now<s.time)return blocked('연구 시각은 현재 시각 이상의 유한한 초 값이어야 합니다.');
 const id=event.guideId||s.active?.id;if(!guide(c,id))return blocked('지원하는 추가 안내 ID를 선택하세요.');
 if(s.active&&s.active.id!==id)return blocked('독립 도구는 한 안내씩 비교합니다. 현재 안내 완료/초기화가 먼저입니다.');
 const copy=structuredClone(s);copy.time=now;let out;
 try{
  if(event.type==='reset'){copy.registeredFinished=copy.registeredFinished.filter(x=>x!==id);copy.completed=copy.completed.filter(x=>x!==id);if(copy.active?.id===id)copy.active=null;log(copy,id,'reset','명시적인 연구 초기화');out=answer(true,'reset','선택한 추가 안내의 독립 상태만 초기화했습니다.');}
  else out=copy.active?advance(copy,event,ctx,c):start(copy,event,ctx,c,id);
 }catch{return blocked('컨텍스트 처리에 실패해 기존 상태를 보존합니다.');}
 if(!out.ok)return out;if(!validMoreTutorials(copy,c))return blocked('변경 후 상태 검사를 통과하지 못해 적용하지 않았습니다.');
 const changed=JSON.stringify(copy)!==JSON.stringify(s);if(changed)Object.assign(s,copy);return {...out,changed};
}
export function moreTutorialView(s,ctx,c){
 if(!validMoreTutorials(s,c))return {valid:false,active:null,registered:[],completed:[],unknown:['incompatible-save']};
 const a=s.active,p=a&&step(c,a.id,a.phase);return {valid:true,active:a?{...structuredClone(a),name:guide(c,a.id).name,label:p.label,textKey:p.textKey||null,inputLocked:a.dueAt!==null}:null,nextDueAt:a?.dueAt??null,registered:[...s.registeredFinished],completed:[...s.completed],waiting:Boolean(a&&a.dueAt!==null),unknown:ctx?.mode==='research'?[]:['mode=research'],boundary:c.coordinationBoundary};
}
export function validMoreTutorials(s,c){
 try{
  const known=new Set(c.guides.map(g=>g.id));if(!object(s)||s.schema!==1||s.revision!==c.revision||!time(s.time)||!strings(s.registeredFinished)||!strings(s.completed)||new Set(s.registeredFinished).size!==s.registeredFinished.length||new Set(s.completed).size!==s.completed.length||s.registeredFinished.some(id=>!known.has(id))||s.completed.some(id=>!s.registeredFinished.includes(id))||!Array.isArray(s.history)||s.history.length>50)return false;
  let previous=0;for(const h of s.history){if(!object(h)||!time(h.time)||h.time<previous||h.time>s.time||!known.has(h.guideId)||!['registered','phase','completed','reset'].includes(h.kind)||!(h.phase===null||step(c,h.guideId,h.phase))||typeof h.detail!=='string'||h.detail.length>500)return false;previous=h.time;}
  if(s.active!==null){const a=s.active,p=step(c,a.id,a.phase);if(!object(a)||!p||s.completed.includes(a.id)||!time(a.startedAt)||a.startedAt>s.time||a.sourceStep!==p.sourceStep||a.strong!==p.strong||a.registered!==p.registered||a.registered!==s.registeredFinished.includes(a.id)||!(a.dueAt===null||time(a.dueAt)&&a.dueAt>=a.startedAt)||((p.delaySeconds===undefined)!==(a.dueAt===null))||!(a.snapshot===null||object(a.snapshot))||!(a.target===null||object(a.target)))return false;
   if(a.id===ID.weekly&&!c.weeklyWindows.includes(a.snapshot?.window))return false;
   if(a.id===ID.bonus&&(!c.passActivityTypes.includes(a.snapshot?.activityType)||!text(a.snapshot?.cellId)))return false;
  }
  return true;
 }catch{return false;}
}
