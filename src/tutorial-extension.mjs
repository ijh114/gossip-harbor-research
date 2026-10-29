// Isolated executer projections. Inputs are explicit research snapshots, never
// observations of live server state. No dependency on the main game/save model.
const ids={energy:'tutorial_event_energyboost_simple',pass:'tutorial_battlepass',factory:'tutorial_generator_factory_Acquire',recap:'tutorial_story_recap',decor:'tutorial_change_decoration'};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const time=v=>Number.isFinite(v)&&v>=0&&v<=1e9;
const text=v=>typeof v==='string'&&v.length>0&&v.length<=160;
const list=v=>Array.isArray(v)&&v.length<=1000;
const strings=v=>list(v)&&v.every(text);
const bool=v=>typeof v==='boolean';
const tickets=['PassActivityTicketWindow','PassActivityTicketWindowSVip'];
const tasks=['TaskWindow','NoTaskWindow'];
const definition=(c,id)=>c.guides.find(g=>g.id===id);
const phaseDef=(c,id,phase)=>definition(c,id)?.steps.find(s=>s.phase===phase);
const response=(ok,status,message,extra={})=>({ok,status,message,unknown:[],changed:false,...extra});
const unknown=fields=>response(false,'unknown','누락되거나 미확인인 컨텍스트를 먼저 명시하세요.',{unknown:[...new Set(fields)]});
const blocked=message=>response(false,'blocked',message);
const ignored=message=>response(true,'ignored',message);
function check(c,rows){
 const missing=[],denied=[];for(const [key,valid,allow,label]of rows){const value=c[key];if(value===undefined||value===null||!valid(value))missing.push(key);else if(allow&&!allow(value))denied.push(label||key);}
 return denied.length?blocked('시작 조건 불충족: '+denied.join(' · ')):missing.length?unknown(missing):null;
}
function log(s,id,kind,detail=''){s.history.push({time:s.time,guideId:id,kind,phase:s.active?.phase||null,detail});s.history=s.history.slice(-50);}
function register(s){const a=s.active;if(!s.registeredFinished.includes(a.id))s.registeredFinished.push(a.id);a.registered=true;log(s,a.id,'registered','SetTutorialFinished: 등록 완료와 화면 안내 완료를 구분합니다.');}
function phase(s,c,next,{strong=true,registerNow=false}={}){
 const a=s.active,p=phaseDef(c,a.id,next);a.phase=next;a.sourceStep=p.sourceStep;a.strong=strong;a.dueAt=p.delaySeconds===undefined?null:s.time+p.delaySeconds;
 if(registerNow)register(s);log(s,a.id,'phase',p.label);
}
function begin(s,c,id,next,snapshot=null,{strong=false,registerNow=false}={}){
 s.active={id,phase:next,sourceStep:null,startedAt:s.time,dueAt:null,strong:false,registered:false,snapshot,target:null};
 phase(s,c,next,{strong,registerNow});return response(true,'started','명시된 연구 컨텍스트에서 안내를 시작했습니다.');
}
function finish(s,id,reason){if(!s.registeredFinished.includes(id))s.registeredFinished.push(id);if(!s.completed.includes(id))s.completed.push(id);log(s,id,'completed',reason);s.active=null;return response(true,'completed',reason);}
function cancel(s,reason){const id=s.active.id;log(s,id,'cancelled',reason);s.active=null;return response(true,'cancelled',reason);}
function stageReady(ctx){return check(ctx,[['gameMode',text,x=>x==='Main','메인 보드 모드'],['allWindowsClosed',bool,x=>x,'모든 창 닫힘'],['otherStrong',bool,x=>!x,'다른 강제 안내 없음']]);}
function openViews(ctx){return check(ctx,[['openViews',strings]]);}
function passDefinition(ctx,c){
 const missing=[];if(!text(ctx.passActivityId))missing.push('passActivityId');
 if(!object(ctx.passDefinition))missing.push('passDefinition');else for(const key of ['mainWindow','newTaskWindow','finishTaskWindow','buyTicketWindow'])if(!text(ctx.passDefinition[key]))missing.push('passDefinition.'+key);
 if(missing.length)return unknown(missing);
 if(c.passDefinitions&&!c.passDefinitions.some(d=>['mainWindow','newTaskWindow','finishTaskWindow','buyTicketWindow'].every(k=>d[k]===ctx.passDefinition[k])))return blocked('현재 투영한 동봉 패스 창 정의와 일치하지 않습니다.');
 return null;
}
function decoration(ctx){
 const guard=check(ctx,[['otherStrong',bool,x=>!x,'다른 강제 안내 없음'],['decorationRewards',list]]);if(guard)return {error:guard};
 for(let i=0;i<ctx.decorationRewards.length;i++){
  const r=ctx.decorationRewards[i];if(!object(r)||!text(r.category))return {error:unknown(['decorationRewards['+i+'].category'])};
  if(r.category!=='Skin')continue;
  const missing=[];if(!text(r.skinId))missing.push('decorationRewards['+i+'].skinId');if(!text(r.slot))missing.push('decorationRewards['+i+'].slot');if(!strings(r.unlockedSkins))missing.push('decorationRewards['+i+'].unlockedSkins');
  if(missing.length)return {error:unknown(missing)};
  if(r.unlockedSkins.length>=2)return {target:{skinId:r.skinId,slot:r.slot,unlockedCount:r.unlockedSkins.length}};
 }
 return {error:blocked('Skin 보상과 해당 슬롯의 해금 스킨2개 이상 조건이 필요합니다.')};
}
function factory(ctx){
 const guard=stageReady(ctx)||check(ctx,[['mainBoardViewAvailable',bool,x=>x,'메인 보드 View 존재'],['generatorFactoryOpen',bool,x=>x,'생성기 공장 열림'],['registeredTutorials',strings,x=>x.includes('tutorial_generator_factory'),'앞선 공장 안내 Finished 등록'],['factoryCandidates',list]]);
 if(guard)return {error:guard};
 const candidates=[];
 for(let i=0;i<ctx.factoryCandidates.length;i++){
  const r=ctx.factoryCandidates[i];if(!object(r)||!bool(r.hasFactoryComponent))return {error:unknown(['factoryCandidates['+i+'].hasFactoryComponent'])};
  if(!r.hasFactoryComponent)continue;
  if(!text(String(r.uid??''))||!object(r.position)||!Number.isInteger(r.position.x)||r.position.x<1||r.position.x>7||!Number.isInteger(r.position.y)||r.position.y<1||r.position.y>9)return {error:unknown(['factoryCandidates['+i+'].uid/position'])};
  candidates.push({uid:String(r.uid),position:{...r.position}});
 }
 if(!candidates.length)return {error:blocked('ItemGeneratorFactory 컴포넌트를 가진 보드 후보가 없습니다.')};
 if(new Set(candidates.map(x=>x.uid)).size!==candidates.length)return {error:blocked('후보 UID가 중복되어 선택을 확정할 수 없습니다.')};
 return {candidates};
}
export function createTutorialExtension(c){return {schema:1,revision:c.revision,time:0,registeredFinished:[],completed:[],active:null,history:[]};}
function start(s,event,ctx,c,id){
 if(s.registeredFinished.includes(id))return blocked('이미 Finished로 등록된 안내입니다. 연구 초기화 후 다시 비교하세요.');
 if(id===ids.energy){
  if(event.type!=='game-mode-change-finished')return ignored('GameModeChangeFinished를 기다립니다.');
  const guard=check(ctx,[['energyBoostLevel',Number.isInteger,x=>x===1,'EnergyBoostLevel=1']])||stageReady(ctx);if(guard)return guard;
  return begin(s,c,id,'entry-delay');
 }
 if(id===ids.pass){
  if(event.type!=='view-opened')return ignored('패스 관련 OpenView를 기다립니다.');
  if(!text(event.name))return unknown(['event.name']);
  if(tickets.includes(event.name))return finish(s,id,'수령권 창 OpenView는 메인 안내를 시작하지 않은 경우에도 원작 Finish 경로를 호출합니다.');
  const guard=passDefinition(ctx,c);if(guard)return guard;
  if(event.name!==ctx.passDefinition.mainWindow)return ignored('동봉 패스 메인 창과 다른 창입니다.');
  return begin(s,c,id,'tip-delay',{...ctx.passDefinition,activityId:ctx.passActivityId},{strong:true,registerNow:true});
 }
 if(id===ids.recap){
  if(event.type!=='view-opened'||!tasks.includes(event.name))return ignored('TaskWindow/NoTaskWindow OpenView를 기다립니다.');
  const guard=check(ctx,[['storyRecapOpen',bool,x=>x,'스토리 회상 열림'],['otherStrong',bool,x=>!x,'다른 강제 안내 없음'],['storyUnlockedBooks',x=>list(x)&&x.every(v=>Number.isInteger(v)&&v>=1),x=>x.length>0,'해금된 회상 책 있음']]);if(guard)return guard;
  return begin(s,c,id,'recap-delay',{triggerWindow:event.name});
 }
 if(id===ids.decor){
  if(event.type!=='decoration-reward')return ignored('MainDecorNewChangeDecorationTutorial 보상 이벤트를 기다립니다.');
  const match=decoration(ctx);if(match.error)return match.error;return begin(s,c,id,'dialogue-delay',match.target,{strong:true,registerNow:true});
 }
 if(id===ids.factory){
  if(event.type!=='factory-poll')return ignored('공장 안내의1초 스케줄러 검사를 기다립니다.');
  const match=factory(ctx);if(match.error)return match.error;return begin(s,c,id,'factory-delay',{candidates:match.candidates});
 }
 return blocked('지원하지 않는 안내 ID입니다.');
}
function due(s,ctx,c){
 const a=s.active;if(a.dueAt===null)return ignored('진행 중인 정적 지연이 없습니다.');if(s.time<a.dueAt)return response(true,'waiting','원작 코드의 정적 지연 경계 전입니다.');
 if(a.id===ids.energy&&a.phase==='entry-delay'){
  const guard=stageReady(ctx);if(guard){if(guard.status==='unknown')return guard;return cancel(s,'0.5초 뒤 활성 조건이 바뀌어 안내를 시작하지 않았습니다.');}
  if(!bool(ctx.energyBoostHudAvailable))return unknown(['energyBoostHudAvailable']);
  phase(s,c,'click-1',{registerNow:true});if(!ctx.energyBoostHudAvailable)return finish(s,a.id,'첫 단계에서 부스트 HUD가 없으면 Finished 등록 후 즉시 Finish합니다.');
  a.target={hud:'EnergyBoost'};return response(true,'advanced','첫 부스트 전환을 안내합니다.');
 }
 if(a.id===ids.pass&&a.phase==='tip-delay'){
  const guard=openViews(ctx);if(guard)return guard;
  if(ctx.openViews.includes(a.snapshot.finishTaskWindow)||ctx.openViews.includes(a.snapshot.newTaskWindow))return finish(s,a.id,'1초 지연 뒤 과제 완료/새 과제 창이 열려 있어 안내를 종료했습니다.');
  phase(s,c,'main-tip');return response(true,'advanced','패스 메인 설명 마스크를 표시합니다.');
 }
 if(a.id===ids.recap&&a.phase==='recap-delay'){
  const guard=check(ctx,[['storyRecapOpen',bool,x=>x,'회상 열림'],['otherStrong',bool,x=>!x,'다른 강제 안내 없음']])||openViews(ctx);
  if(guard){if(guard.status==='unknown')return guard;return cancel(s,'1초 뒤 회상/다른 강제 안내 조건이 바뀌어 시작하지 않았습니다.');}
  if(!ctx.openViews.some(x=>tasks.includes(x)))return cancel(s,'1초 뒤 과제 창이 없어 시작하지 않았습니다.');
  phase(s,c,'dialogue',{registerNow:true});return response(true,'advanced','회상 설명을 표시하고 Finished를 먼저 등록했습니다.');
 }
 if(a.id===ids.decor&&a.phase==='dialogue-delay'){phase(s,c,'dialogue');return response(true,'advanced','장식 변경 설명을 표시합니다.');}
 if(a.id===ids.decor&&a.phase==='popup-delay'){phase(s,c,'popup-open');a.target={popup:'TutorialChangeDecorationContent',parameter:7};return response(true,'advanced','장식 안내 팝업 완료 콜백을 기다립니다.');}
 if(a.id===ids.factory&&a.phase==='factory-delay'){
  if(!Number.isFinite(ctx.factoryRandomRoll)||ctx.factoryRandomRoll<0||ctx.factoryRandomRoll>=1)return unknown(['factoryRandomRoll']);
  const candidate=a.snapshot.candidates[Math.floor(ctx.factoryRandomRoll*a.snapshot.candidates.length)];a.target={...candidate,dialogHeight:candidate.position.y>5?30:75,uniformRoll:ctx.factoryRandomRoll};
  phase(s,c,'tap-item',{registerNow:true});return response(true,'advanced','캡처한 후보 목록에서 명시 난수로 선택하고 공장 조각을 강조합니다.');
 }
 return ignored('해당 단계에 지연 콜백이 없습니다.');
}
function advance(s,event,ctx,c){
 const a=s.active,id=a.id;
 if(event.type==='clock')return due(s,ctx,c);
 if(id===ids.energy){
  if(event.type==='energy-mode-changed'||event.type==='mask-click'&&a.phase==='click-1'){
   if(a.phase==='click-1'){
    if(!bool(ctx.energyBoostHudAvailable))return unknown(['energyBoostHudAvailable']);if(!ctx.energyBoostHudAvailable)return blocked('두 번째 단계의 HUD 부재에는 원작 안전 종료 분기가 없습니다.');
    phase(s,c,'click-2');return response(true,'advanced','두 번째 부스트 버튼을 강조합니다.');
   }
   if(a.phase==='click-2'&&event.type==='energy-mode-changed')return finish(s,id,'두 번째 EnergyBoostModeChanged로 화면 안내를 완료했습니다.');
  }
  return ignored('현재 단계가 기다리는 부스트 이벤트가 아닙니다.');
 }
 if(id===ids.pass){
  if(event.type==='view-opened'){
   if(!text(event.name))return unknown(['event.name']);
   if([...tickets,a.snapshot.newTaskWindow,a.snapshot.buyTicketWindow].includes(event.name))return finish(s,id,'수령권/새 과제/구매 창 OpenView로 안내를 종료했습니다.');
  }
  if(event.type==='pass-state-changed'){
   if(!text(event.activityId))return unknown(['event.activityId']);if(!['Preparing','Started','Ended','Released'].includes(event.state))return unknown(['event.state']);
   if(event.activityId!==a.snapshot.activityId||['Ended','Released'].includes(event.state))return finish(s,id,'활동 ID 변경 또는 Ended/Released로 안내를 종료했습니다.');
  }
  if(event.type==='mask-click'&&a.phase==='main-tip'){
   const guard=openViews(ctx);if(guard)return guard;if(!ctx.openViews.includes(a.snapshot.mainWindow))return blocked('수령권 강조 단계의 메인 창 부재에는 원작 안전 종료 분기가 없습니다.');
   phase(s,c,'ticket-highlight');a.target={area:'ticket'};return response(true,'advanced','수령권 영역을 강조합니다. 실제 결제는 수행하지 않습니다.');
  }
  if(event.type==='mask-click'&&a.phase==='ticket-highlight')return finish(s,id,'수령권 영역의 마스크 콜백으로 안내를 완료했습니다.');
  return ignored('현재 패스 단계가 기다리는 이벤트가 아닙니다.');
 }
 if(id===ids.recap){
  if(event.type==='mask-click'&&a.phase==='dialogue'){
   const guard=openViews(ctx);if(guard)return guard;if(!ctx.openViews.some(x=>tasks.includes(x)))return finish(s,id,'회상 입구 강조 전에 과제 창이 없으면 즉시 Finish합니다.');
   phase(s,c,'recap-highlight');a.target={area:'story-recap'};return response(true,'advanced','과제 창의 회상 입구를 강조합니다.');
  }
  if(event.type==='view-closed'&&tasks.includes(event.name)&&a.phase==='recap-highlight')return finish(s,id,'회상 입구 강조 후 과제 창 CloseView로 안내를 완료했습니다.');
  return ignored('설명 단계의 창 닫힘만으로는 원작 안내가 완료되지 않습니다.');
 }
 if(id===ids.decor){
  if(event.type==='mask-click'&&a.phase==='dialogue'){phase(s,c,'popup-delay');return response(true,'advanced','0.8초 뒤 장식 안내 팝업을 엽니다.');}
  if(event.type==='decoration-popup-completed'&&a.phase==='popup-open')return finish(s,id,'TutorialChangeDecorationContent 완료 콜백으로 안내를 마쳤습니다.');
  return ignored('장식 안내 팝업의 실제 완료 콜백을 기다립니다.');
 }
 if(id===ids.factory){
  if(event.type==='factory-state-changed'){
   if(!bool(event.isOpen))return unknown(['event.isOpen']);
   if(!event.isOpen&&a.phase!=='factory-delay')return finish(s,id,'시각 단계 시작 후 공장 닫힘으로 안내를 종료했습니다.');
   return ignored('지연 전에는 ongoing 문자열이 비어 있어 공장 닫힘이 안내를 종료하지 않습니다.');
  }
  if(event.type==='factory-item-tapped'&&a.phase==='tap-item'){phase(s,c,'inventory-highlight');a.target={hud:'Inventory'};return response(true,'advanced','보관함을 강조합니다. 원작 콜백은 msg의 UID를 재검사하지 않습니다.');}
  if(event.type==='mask-click'&&a.phase==='inventory-highlight')return finish(s,id,'보관함 강조 마스크 콜백으로 안내를 완료했습니다.');
  return ignored('현재 공장 안내 단계가 기다리는 이벤트가 아닙니다.');
 }
 return ignored('현재 안내의 대상 이벤트가 아닙니다.');
}
export function tutorialExtensionEvent(s,event,context,c){
 if(!validTutorialExtension(s,c))return blocked('확장 안내 저장이 호환되지 않습니다. 원본을 보존한 뒤 별도 연구 상태를 초기화하세요.');
 if(!object(event)||!text(event.type))return blocked('유효한 이벤트 종류가 필요합니다.');
 if(!object(context)||context.mode!=='research')return unknown(['mode=research']);
 const now=event.now===undefined?s.time:event.now;if(!time(now)||now<s.time)return blocked('연구 시각은 현재 시각 이상의 유한한 초 값이어야 합니다.');
 const id=event.guideId||s.active?.id;if(!definition(c,id))return blocked('지원하는 안내 ID를 선택하세요.');
 if(s.active&&s.active.id!==id)return blocked('이 독립 도구는 한 안내씩 비교합니다. 실행 중 안내를 먼저 마치거나 초기화하세요.');
 const copy=structuredClone(s);copy.time=now;let out;
 try{
  if(event.type==='reset'){
   copy.registeredFinished=copy.registeredFinished.filter(x=>x!==id);copy.completed=copy.completed.filter(x=>x!==id);if(copy.active?.id===id)copy.active=null;log(copy,id,'reset','명시적 연구 초기화');out=response(true,'reset','선택한 안내의 독립 연구 상태만 초기화했습니다.');
  }else out=copy.active?advance(copy,event,context,c):start(copy,event,context,c,id);
 }catch{return blocked('컨텍스트를 처리하지 못했습니다. 기존 상태를 유지합니다.');}
 if(!out.ok)return out;if(!validTutorialExtension(copy,c))return blocked('변경 후 상태 검사를 통과하지 못해 적용하지 않았습니다.');
 const changed=JSON.stringify(copy)!==JSON.stringify(s);if(changed)Object.assign(s,copy);return {...out,changed};
}
export function extensionView(s,context,c){
 if(!validTutorialExtension(s,c))return {valid:false,active:null,registered:[],completed:[],unknown:['incompatible-save']};
 const a=s.active,g=a&&definition(c,a.id),p=a&&phaseDef(c,a.id,a.phase);
 return {valid:true,active:a?{...structuredClone(a),name:g.name,label:p.label,textKey:p.textKey||null,inputLocked:a.dueAt!==null}:null,
  nextDueAt:a?.dueAt??null,registered:[...s.registeredFinished],completed:[...s.completed],waiting:a?.dueAt!==null&&a!==null,
  unknown:context?.mode==='research'?[]:['mode=research'],boundary:c.coordinationBoundary};
}
export function validTutorialExtension(s,c){
 try{
  const known=new Set(c.guides.map(x=>x.id));
  if(!object(s)||s.schema!==1||s.revision!==c.revision||!time(s.time)||!strings(s.registeredFinished)||!strings(s.completed)||new Set(s.registeredFinished).size!==s.registeredFinished.length||new Set(s.completed).size!==s.completed.length||s.registeredFinished.some(x=>!known.has(x))||s.completed.some(x=>!s.registeredFinished.includes(x))||!Array.isArray(s.history)||s.history.length>50)return false;
  let previousTime=0;for(const h of s.history){if(!object(h)||!time(h.time)||h.time<previousTime||h.time>s.time||!known.has(h.guideId)||!['registered','phase','completed','cancelled','reset'].includes(h.kind)||!(h.phase===null||phaseDef(c,h.guideId,h.phase))||typeof h.detail!=='string'||h.detail.length>500)return false;previousTime=h.time;}
  if(s.active!==null){const a=s.active,p=phaseDef(c,a.id,a.phase);if(!object(a)||!p||s.completed.includes(a.id)||a.sourceStep!==p.sourceStep||!time(a.startedAt)||a.startedAt>s.time||!bool(a.strong)||!bool(a.registered)||a.registered!==s.registeredFinished.includes(a.id)||!(a.dueAt===null||time(a.dueAt)&&a.dueAt>=a.startedAt)||!(a.snapshot===null||object(a.snapshot))||!(a.target===null||object(a.target)))return false;
   if((p.delaySeconds===undefined)!==(a.dueAt===null))return false;
   const delayedRegistration=[ids.energy+':entry-delay',ids.factory+':factory-delay',ids.recap+':recap-delay'].includes(a.id+':'+a.phase);if(a.registered===delayedRegistration||a.strong===delayedRegistration)return false;
   if(a.id===ids.pass&&!['activityId','mainWindow','newTaskWindow','finishTaskWindow','buyTicketWindow'].every(k=>text(a.snapshot?.[k])))return false;
   if(a.id===ids.factory&&a.phase==='factory-delay'&&(!list(a.snapshot?.candidates)||!a.snapshot.candidates.length))return false;
  }
  return true;
 }catch{return false;}
}
