import {createTutorialExtension,tutorialExtensionEvent,extensionView,validTutorialExtension} from './tutorial-extension.mjs';
export const TUTORIAL_RESEARCH_KEY='harbor-tutorial-research-v1';
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=value=>JSON.stringify(value,null,2);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function createTutorialWorkbench({getData,render,download,storage=window.localStorage,storageKey=TUTORIAL_RESEARCH_KEY,configKey='tutorialConfig',model=null,title='추가 튜토리얼 · 조건과 단계 실험'}){
 const createModel=model?.create||createTutorialExtension,runModel=model?.event||tutorialExtensionEvent,viewModel=model?.view||extensionView,validModel=model?.valid||validTutorialExtension;
 let loaded=false,state,selected,contexts={},broken=null,message='',unknown=[],storageError='';
 const config=()=>getData()?.[configKey];
 function load(){
  const c=config();if(!c||loaded)return;loaded=true;selected=c.guides[0].id;state=createModel(c);
  try{const raw=storage.getItem(storageKey);if(raw!==null){const x=JSON.parse(raw);if(!object(x)||x.schema!==1||!validModel(x.state,c)||!c.guides.some(g=>g.id===x.selected)||!object(x.contexts)||Object.entries(x.contexts).some(([key,value])=>!c.guides.some(g=>g.id===key)||typeof value!=='string'||value.length>32768))throw Error('incompatible');state=x.state;selected=x.selected;contexts=x.contexts;}}
  catch{broken=true;message='독립 안내 연구 저장을 읽지 못했습니다. 원본을 보관한 뒤 연구 상태만 초기화하세요.';}
 }
 const guide=()=>config().guides.find(g=>g.id===selected);
 const contextText=()=>contexts[selected]||json({mode:'research'});
 function context(){try{const x=JSON.parse(contextText());if(!object(x))throw Error();return x;}catch{return null;}}
 function persist(){if(broken)return;try{storage.setItem(storageKey,json({schema:1,state,selected,contexts}));storageError='';}catch{storageError='브라우저 저장 공간에 기록하지 못했습니다. JSON으로 내려받아 보관하세요.';}}
 function capture(){const input=document.querySelector('[data-tutorial-context]');if(input)contexts[selected]=input.value.slice(0,32768);}
 function handle(action,value){
  load();if(!config())return;capture();
  if(action==='export'){let raw;try{raw=storage.getItem(storageKey);}catch{}download('tutorial-research-backup.json',broken?raw??'':{schema:1,state,selected,contexts});return;}
  if(action==='reset-all'){
   try{const raw=storage.getItem(storageKey);if(raw!==null)storage.setItem(storageKey+'-previous',raw);state=createModel(config());contexts={};broken=null;unknown=[];message='기존 연구 저장을 별도 백업하고 이 안내 연구만 초기화했습니다.';persist();}catch{message='원본을 백업하지 못해 초기화를 중단했습니다. 먼저 JSON으로 보관하세요.';}render();return;
  }
  if(broken)return;
  if(action==='select'&&config().guides.some(g=>g.id===value)){selected=value;unknown=[];message='';}
  else if(action==='preset'||action==='unknown'){contexts[selected]=json(action==='preset'?guide().researchExample:{mode:'research'});unknown=[];message=action==='preset'?'연구 예제 조건을 명시했습니다. 실제 계정·서버에서 관측한 값이 아닙니다.':'미확인 조건으로 되돌렸습니다. 필요한 입력은 임의로 채우지 않습니다.';}
  else if(action==='event'||action==='reset-guide'){
   const ctx=context();if(!ctx){message='조건 JSON 형식을 확인하세요. 객체 { } 형태로 입력해야 합니다.';unknown=['context JSON'];render();return;}
   const ev=action==='reset-guide'?{type:'reset'}:guide().eventCatalog[Number(value)]?.event;if(!ev)return;
   const now=ev.type==='clock'?(state.active?.dueAt??state.time+1):state.time;
   const result=runModel(state,{...ev,guideId:selected,now},ctx,config());message=result.message;unknown=result.unknown||[];
  }
  persist();render();document.querySelector(action==='select'?`[data-tutorial-action="select"][data-value="${selected}"]`:'[data-tutorial-status]')?.focus({preventScroll:true});
 }
 function renderPage(){
  load();const c=config();if(!c)return '<p>추가 안내 자료를 불러오고 있습니다.</p>';
  const g=guide(),v=viewModel(state,context(),c),a=v.active,active=a?.id===selected;
  return `<div class="tutorial-analysis"><header class="studio-intro"><h1>${e(title)}</h1><p>기존 시작·일반 안내와 별도로 활동 안내 5종의 정적 조건을 확인합니다. 연구 예제와 실제 관측을 구분하며 메인 플레이의 재화·진행·안내 저장에 영향을 주지 않습니다.</p></header><nav class="tutorial-guides" aria-label="분석할 추가 안내">${c.guides.map(row=>`<button class="button" data-tutorial-action="select" data-value="${e(row.id)}" aria-pressed="${row.id===selected}">${e(row.name)}</button>`).join('')}</nav><p class="tutorial-feedback" data-tutorial-status role="status" tabindex="-1">${e(message||'미확인 조건에서 시작합니다. 조건을 직접 명시한 뒤 아래 이벤트를 하나씩 보내세요.')}${unknown.length?`<br>확인할 입력: ${unknown.map(e).join(' · ')}`:''}${storageError?'<br>'+e(storageError):''}</p>${broken?`<p role="alert">손상되거나 호환되지 않는 원본 저장을 유지하고 있습니다.</p>${button('export','원본 JSON 보관')}${button('reset-all','백업 후 안내 연구 초기화')}`:`<div class="tutorial-workbench"><section><h2>${e(g.name)}</h2><p><code>${e(g.id)}</code></p><ol class="tutorial-steps">${g.steps.map(p=>`<li${active&&a.phase===p.phase?' aria-current="step"':''}><strong>${e(p.label)}</strong><small>원작 단계 ${e(p.sourceStep)}${p.delaySeconds!==undefined?' · 선언 대기 '+e(p.delaySeconds)+'초':''}</small></li>`).join('')}</ol><h3>현재 연구 상태</h3><dl class="tutorial-state"><dt>안내 화면</dt><dd>${e(a?a.name+' / '+a.label:'진행 중 안내 없음')}</dd><dt>연구 시각</dt><dd>${e(state.time)}초${v.nextDueAt!==null?' · 다음 경계 '+e(v.nextDueAt)+'초':''}</dd><dt>등록상 완료</dt><dd>${v.registered.includes(selected)?'등록됨':'미등록'}</dd><dt>안내 흐름 완료</dt><dd>${v.completed.includes(selected)?'완료':'미완료'}</dd></dl><p>등록상 완료는 <code>SetTutorialFinished</code> 호출 상태입니다. 지연 뒤 표시·콜백 종료와 시점이 다를 수 있습니다.</p><h3>명시 이벤트 보내기</h3><div class="tutorial-events">${g.eventCatalog.map((ev,i)=>button('event',ev.label,String(i))).join('')}</div><p>시간은 버튼으로 진행합니다. 창·활동·보상 이벤트는 아래 연구 조건에 대응하는 고정 예제 payload이며 실제 게임 입력을 수집하지 않습니다. 한 번에 하나의 안내만 실행합니다.</p>${button('reset-guide','선택 안내 다시 실험')}</section><section><h2>조건 입력</h2><div class="tutorial-presets">${button('preset','연구 예제 조건 채우기')}${button('unknown','미확인 조건으로')}</div><ul class="tutorial-fields">${g.fields.map(f=>`<li><strong>${e(f.label)}</strong><code>${e(f.path)}</code></li>`).join('')}</ul><label for="tutorial-context">연구 컨텍스트 JSON</label><textarea id="tutorial-context" data-tutorial-context spellcheck="false" maxlength="32768">${e(contextText())}</textarea><p>조건을 수정하면 다음 이벤트부터 적용합니다. 이벤트의 상세 payload는 아래 출처에서 확인하세요.</p><h3>최근 상태 전이</h3><ol class="tutorial-history">${state.history.slice(-10).reverse().map(h=>`<li><time>${e(h.time)}초</time> ${e(h.guideId)}<br><strong>${e(h.kind)} · ${e(h.phase||'종료')}</strong><small>${e(h.detail)}</small></li>`).join('')||'<li>아직 적용한 상태 전이가 없습니다.</li>'}</ol></section></div><div class="tutorial-presets">${button('export','연구 JSON 보관')}${button('reset-all','백업 후 안내 연구 전체 초기화')}</div>`}<details class="tutorial-sources"><summary>정적 근거 · 이벤트 · 재현 범위</summary><p>${e(c.registrationBoundary)}</p><p>${e(c.coordinationBoundary)}</p><p>${e(c.eventPayloadBoundary)}</p><pre>${e(json(g.eventCatalog))}</pre>${c.sources.map(s=>`<p><code>${e(s.path)}</code><br>행 ${e((s.ranges||[]).join(', '))}<br><small>SHA-256 ${e(s.sha256)}</small></p>`).join('')}<p>기존 미지원 목록에서 5종을 독립 연구로 추가한 범위입니다. 서버 조건을 자동 추정하지 않으며 나머지 활동 안내 전체의 완료가 아닙니다.</p></details></div>`;
 }
 function button(action,label,value=''){return `<button class="button" data-tutorial-action="${action}" data-value="${e(value)}">${e(label)}</button>`;}
 return {renderPage,handle};
}
