import {createTutorialCatalog,validTutorialCatalog,tutorialCatalogEvent,tutorialCatalogView} from './tutorial-catalog.mjs';
export const TUTORIAL_CATALOG_STORAGE_KEY='harbor-tutorial-catalog-v1';
const LIMIT_CONTEXT=32768,LIMIT_PAYLOAD=16384,LIMIT_REGISTRY=2*1024*1024;
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const text=(v,max)=>typeof v==='string'&&v.length<=max;
const json=v=>JSON.stringify(v,null,2);
const safeKey=k=>!['__proto__','prototype','constructor'].includes(k);
function safeJSON(v,depth=0){if(depth>60)return false;if(v===null||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);if(typeof v==='string')return v.length<=LIMIT_REGISTRY;if(Array.isArray(v))return v.length<=30000&&Object.keys(v).length===v.length&&v.every(x=>safeJSON(x,depth+1));return object(v)&&Object.keys(v).length<=30000&&Object.entries(v).every(([k,x])=>safeKey(k)&&safeJSON(x,depth+1));}
const allowedKeys=(x,keys)=>object(x)&&Object.keys(x).every(k=>keys.includes(k));
const statusNames={idle:'시작 전',started:'원작 리스너 시작',unknown:'필요한 맥락 미확인',unimplemented:'전용 구현 필요',completed:'이 연구 안내 흐름 종료',restored:'미완료 저장 복원','registered-not-restored':'등록 완료 · 시각 종료를 추가하지 않음','torn-down':'리스너 정리 · 완료 등록 없음','event-dispatched':'등록 사건 처리','mask-callback':'원작 마스크 콜백 처리',waiting:'예약 시각 대기','scheduled-callback':'예약 콜백 처리',reset:'연구 초기화',ignored:'대상 사건 없음',ineligible:'시작 조건 불충족','invalid-input':'입력 형식 오류','invalid-state':'저장 호환 오류'};
const expr=x=>x===false?'false':x===true?'true':x===null?'없음':x?.v!==undefined?String(x.v):x?.get?.ref&&x?.key?x.get.ref+'.'+x.key:x?.ref||'원작 조건식';
const button=(action,label,{value,disabled=false}={})=>`<button class="button" data-catalog-action="${e(action)}"${value!==undefined?' data-value="'+e(value)+'"':''}${disabled?' disabled':''}>${e(label)}</button>`;

export function createTutorialCatalogWorkbench({getData,render,download,storage}){
 let store=storage,loaded=false,loadedRevision=null,registry=null,broken=false,brokenRaw=null,message='',storageError='';
 if(store===undefined){try{store=window.localStorage;}catch{store=null;storageError='브라우저 저장소에 접근할 수 없어 기존 저장을 확인하지 못했습니다. 이번 메모리 연구는 JSON으로 보관하세요.';}}
 const config=()=>getData()?.tutorialCatalogConfig;
 const definition=id=>config()?.guides.find(g=>g.id===id);
 const freshEntry=id=>({state:createTutorialCatalog(config(),id),contextJSON:json({mode:'research'}),payloadJSON:'{}',eventName:'',lastResult:null});
 function validEntry(x,id,c){return allowedKeys(x,['state','contextJSON','payloadJSON','eventName','lastResult'])&&validTutorialCatalog(x.state,c)&&x.state.guideId===id&&text(x.contextJSON,LIMIT_CONTEXT)&&text(x.payloadJSON,LIMIT_PAYLOAD)&&text(x.eventName,500)&&(x.lastResult===null||object(x.lastResult)&&safeJSON(x.lastResult)&&JSON.stringify(x.lastResult).length<=131072);}
 function validRegistry(x,c){return allowedKeys(x,['schema','revision','selected','entries'])&&x.schema===1&&x.revision===c.revision&&Boolean(c.guides.find(g=>g.id===x.selected))&&object(x.entries)&&Object.keys(x.entries).length<=87&&Object.entries(x.entries).every(([id,entry])=>safeKey(id)&&c.guides.some(g=>g.id===id)&&validEntry(entry,id,c))&&JSON.stringify(x).length<=LIMIT_REGISTRY;}
 function initial(){const selected=config().guides[0].id;return {schema:1,revision:config().revision,selected,entries:{[selected]:freshEntry(selected)}};}
 function load(){
  const c=config();if(!c)return;
  if(loaded){if(loadedRevision!==c.revision){broken=true;message='카탈로그 revision이 바뀌었습니다. 기존 연구를 보관한 뒤 백업 후 초기화하세요.';}return;}
  loaded=true;loadedRevision=c.revision;registry=initial();
  if(store===null)return;
  try{const raw=store.getItem(TUTORIAL_CATALOG_STORAGE_KEY);if(raw===null)return;brokenRaw=raw;if(raw.length>LIMIT_REGISTRY)throw Error('size');const x=JSON.parse(raw);if(!validRegistry(x,c))throw Error('schema');registry=x;brokenRaw=null;}
  catch{broken=true;message='손상되거나 호환되지 않는 독립 연구 저장을 그대로 보존했습니다. 원본 보관·백업 후 초기화만 가능합니다.';}
 }
 function entry(){return registry.entries[registry.selected]??=(freshEntry(registry.selected));}
 function persist(){
  if(broken)return;
  try{const raw=json(registry);if(raw.length>LIMIT_REGISTRY)throw Error('size');store.setItem(TUTORIAL_CATALOG_STORAGE_KEY,raw);storageError='';}
  catch{storageError='브라우저에 연구를 저장하지 못했습니다. 현재 메모리의 연구 JSON을 내려받아 보관하세요.';}
 }
 function capture(){
  const ctx=document.querySelector('[data-catalog-context]'),payload=document.querySelector('[data-catalog-payload]'),event=document.querySelector('[data-catalog-event]');
  if(ctx&&ctx.value.length>LIMIT_CONTEXT||payload&&payload.value.length>LIMIT_PAYLOAD){message='조건은32KiB, payload는16KiB 이내로 입력하세요. 초과한 입력은 잘라 저장하지 않았습니다.';return false;}
  const row=entry();if(ctx)row.contextJSON=ctx.value;if(payload)row.payloadJSON=payload.value;if(event)row.eventName=event.value;return true;
 }
 function feedback(){const node=document.querySelector('[data-catalog-status]');if(node){node.textContent=message+(storageError?' · '+storageError:'');node.focus({preventScroll:true});}const select=document.querySelector('[data-catalog-select]');if(select)select.value=registry.selected;}
 function parsed(raw,{context=false}={}){try{const value=JSON.parse(raw);if(!safeJSON(value)||context&&(!object(value)||value.mode!=='research'))return null;return {value};}catch{return null;}}
 function rememberResult(out){const row=entry();row.lastResult=structuredClone(out);message=out.message||statusNames[out.status]||out.status;}
 function backedUpReset(all){
  try{
   let prior;if(broken){prior=brokenRaw;if(prior===null)prior=store.getItem(TUTORIAL_CATALOG_STORAGE_KEY);if(prior===null)throw Error('unreadable original');}
   else prior=json(registry);
   store.setItem(TUTORIAL_CATALOG_STORAGE_KEY+'-previous',prior);
   if(all||broken)registry=initial();else registry.entries[registry.selected]=freshEntry(registry.selected);
   broken=false;brokenRaw=null;loadedRevision=config().revision;message='기존 독립 연구를 별도 백업한 뒤 '+(all?'전체':'선택 안내')+' 연구만 초기화했습니다.';persist();
  }catch{message='원본을 백업하지 못해 초기화를 중단했습니다. 먼저 원본 JSON을 보관하세요.';}
 }
 function handle(action,value){
  load();if(!config()||!registry)return;
  if(action==='export'){
   if(broken){let raw=brokenRaw;try{if(raw===null)raw=store.getItem(TUTORIAL_CATALOG_STORAGE_KEY);}catch{}if(raw===null){message='저장 원본을 읽을 수 없어 내보내지 못했습니다.';render();return;}download('tutorial-catalog-original.json',raw);return;}
   if(!capture()){feedback();return;}persist();download('tutorial-catalog-research.json',{kind:'isolated-source-projection-not-original-runtime',schema:1,revision:config().revision,registry:structuredClone(registry),selectedView:tutorialCatalogView(entry().state,{},config()),originalRuntimeObserved:false});return;
  }
  if(action==='reset-all'||action==='reset-guide'){if(broken&&action!=='reset-all')return;backedUpReset(action==='reset-all');render();document.querySelector('[data-catalog-status]')?.focus({preventScroll:true});return;}
  if(broken)return;
  if(!capture()){feedback();return;}
  if(action==='select'){
   if(!definition(value)){message='분석할 안내 ID를 확인하세요.';}else{registry.selected=value;entry();message='선택한 안내의 조건·진행·payload를 복원했습니다. 미입력 조건을 자동 채우지 않습니다.';}
  }else if(action==='save-draft'||action==='event-select'){if(action==='event-select'&&typeof value==='string')entry().eventName=value;message='입력 초안을 저장했습니다. 게임 사건이나 보상은 실행하지 않았습니다.';}
  else{
   const row=entry(),ctx=parsed(row.contextJSON,{context:true});
   if(!ctx){message='조건 JSON을 확인하세요. mode가 research인 유효한 객체여야 하며 함수·특수 객체·잘못된 속성은 사용할 수 없습니다.';persist();render();document.querySelector('[data-catalog-status]')?.focus({preventScroll:true});return;}
   const v=tutorialCatalogView(row.state,ctx.value,config());let event;
   if(['start','run','executer-started'].includes(action))event={type:'executer-started'};
   else if(action==='source-event'){
    const payload=parsed(row.payloadJSON);if(!payload){message='사건 payload JSON 형식을 확인하세요. 입력과 기존 진행은 보존했습니다.';persist();render();document.querySelector('[data-catalog-status]')?.focus({preventScroll:true});return;}
    const sourceEvent=v.eventOptions.find(x=>x.sourceEvent===row.eventName)?.sourceEvent||(!row.eventName?v.eventOptions[0]?.sourceEvent:null);
    if(!sourceEvent){message='현재 원작 리스너에 등록된 사건을 먼저 선택하세요.';}else event={type:'source-event',sourceEvent,payload:payload.value};
   }else if(action==='mask-click'){
    const callback=v.allowedActions.find(x=>x.type==='mask-click');if(!callback){message='현재 원작 마스크에는 진행 콜백이 없습니다. 임의의 다음 단계로 넘기지 않았습니다.';}else event={type:'mask-click',callbackId:callback.callbackId};
   }else if(action==='clock'){
    if(v.nextDueAt===null){message='예약된 원작 콜백이 없습니다.';}else event={type:'clock',now:Math.max(row.state.time,v.nextDueAt)};
   }else if(action==='resume'||action==='teardown')event={type:action};
   else message='지원하지 않는 연구 조작입니다.';
   if(event){try{const draft=structuredClone(row.state),out=tutorialCatalogEvent(draft,event,ctx.value,config());if(validTutorialCatalog(draft,config())){row.state=draft;rememberResult(out);}else message='사건 처리 결과가 저장 형식에 맞지 않아 기존 연구를 유지했습니다.';}catch{message='사건 처리 중 오류가 발생했습니다. 기존 연구를 JSON으로 보관한 뒤 입력과 지원 범위를 확인하세요.';}}
  }
  persist();render();document.querySelector(action==='select'?'[data-catalog-select]':'[data-catalog-status]')?.focus({preventScroll:true});
 }
 function renderPage(){
  load();const c=config();if(!c)return '<p>나머지 안내의 소스 대조 자료를 불러오고 있습니다.</p>';
  const g=definition(registry.selected),row=broken?null:entry(),ctx=row?parsed(row.contextJSON,{context:true}):null,v=row?tutorialCatalogView(row.state,ctx?.value||{},c):null;
  const groups=new Map();for(const guide of c.guides){const label=guide.system||'활동·기능 안내';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(guide);}
  const selection=`<label for="catalog-guide">분석할 안내 · ${c.guides.length}종<select id="catalog-guide" data-catalog-select${broken?' disabled':''}>${[...groups].map(([system,guides])=>`<optgroup label="${e(system)}">${guides.map(guide=>`<option value="${e(guide.id)}"${guide.id===registry.selected?' selected':''}>${e(system)} · ${e(guide.id)}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
  const status=`<p class="tutorial-feedback" role="status" tabindex="-1" data-catalog-status>${e(message||'조건은 mode: research만 설정한 미확인 상태입니다. 실제 필요한 맥락을 명시한 뒤 원작 사건을 실행하세요.')}${storageError?'<br>'+e(storageError):''}</p>`;
  const sourceIds=new Set([...(c.managerSources||[]),...(g.sourceRefs||[])]),sources=c.sources.filter(s=>sourceIds.has(s.id));
  const provenance=`<details class="tutorial-sources"><summary>선택 안내의 출처·선언과 지원 범위</summary><p>정적 제어 흐름 ${Object.keys(g.programs).length}개 함수·콜백 투영. 활동 모델·원작 화면/모션·입력 좌표의 완성 구현을 뜻하지 않습니다.</p><p>${e(g.requirements)}</p>${sources.map(s=>`<p><code>${e(s.path)}</code><br>행 ${e(s.lineStart)}–${e(s.lineEnd)}<br><small>SHA-256 ${e(s.sha256)}</small></p>`).join('')}${c.boundaries.map(x=>'<p>'+e(x)+'</p>').join('')}</details>`;
  if(broken)return `<div class="tutorial-analysis tutorial-catalog-workbench"><header class="studio-intro"><h1>나머지87종 안내 · 소스 기반 연구</h1><p>87개 선언의 투영은87개 안내 전체 구현·실행 완료가 아닙니다.</p></header>${selection}${status}<p role="alert">원본 독립 저장을 자동 교체하지 않습니다. 선택·사건 실행은 잠근 상태입니다.</p><div class="tutorial-presets">${button('export','손상 원본 JSON 보관')}${button('reset-all','원본 백업 후 독립 연구 초기화')}</div>${provenance}</div>`;
  const events=v.eventOptions,eventName=events.some(ev=>ev.sourceEvent===row.eventName)?row.eventName:events[0]?.sourceEvent||'';
  const eventInput=`<label for="catalog-event">현재 원작 구독 사건<select id="catalog-event" data-catalog-event${events.length?'':' disabled'}>${events.length?events.map(ev=>`<option value="${e(ev.sourceEvent)}"${ev.sourceEvent===eventName?' selected':''}>${e(ev.sourceEvent)} · ${e(ev.handler)}</option>`).join(''):'<option value="">등록된 리스너 없음</option>'}</select></label>`;
  return `<div class="tutorial-analysis tutorial-catalog-workbench"><header class="studio-intro"><h1>나머지87종 안내 · 소스 기반 연구</h1><p><strong>87개 선언을 읽고 투영한 상태이며, 87개 안내의 전체 구현·실행 완료가 아닙니다.</strong> 원작 활동·UI·외부 변경에 필요한 맥락이 없으면 미확인 또는 미지원으로 멈춥니다. 메인 플레이 저장·재화·진행과 분리된 연구입니다.</p></header>${selection}${status}<div class="tutorial-workbench"><section><h2>선택 안내 · ${e(g.system||'활동·기능')}</h2><p><code>${e(g.id)}</code></p><p>${e(g.requirements)}</p><h3>시작 조건</h3><ul>${g.configConditions.length?g.configConditions.map(x=>'<li><code>'+e(x.raw)+'</code></li>').join(''):'<li>config 조건 없음 · OnStart 내부 적격 검사는 별도입니다.</li>'}</ul><h3>원작 단계·지연 선언</h3><ol class="tutorial-steps">${g.steps.map(step=>`<li><strong>${e(step.phase)}</strong><small>진행 값 ${e(expr(step.sourceStep))} · 강제 ${e(expr(step.strong))}${step.delays.length?' · 지연 '+step.delays.map(expr).map(e).join(', ')+'초':''}${step.registeredOnPath?' · 등록 완료 호출 포함':''}<br>출처 ${e(step.sourceId)} · 행 ${step.lineStart}–${step.lineEnd}</small></li>`).join('')||'<li>별도 단계 선언 없이 리스너·조건 분기로 진행합니다.</li>'}</ol><p>목록은 소스의 단계 메서드 요약입니다. 순서대로 다음 버튼을 누르는 선형 안내로 바꾸지 않습니다.</p><h3>현재 독립 연구 상태</h3><dl class="tutorial-state"><dt>상태</dt><dd>${e(statusNames[v.status]||v.status)}</dd><dt>연구 시각</dt><dd>${e(v.time)}초${v.nextDueAt!==null?' · 다음 예약 '+e(v.nextDueAt)+'초':''}</dd><dt>원작 진행 값</dt><dd>${e(v.ongoingData||'없음')}</dd><dt>등록상 완료</dt><dd>${v.registered?'등록됨':'미등록'}</dd><dt>시각·안내 흐름 종료</dt><dd>${v.completed?'이 연구 흐름 종료':'미완료'}</dd><dt>강제 안내 / 입력 잠금</dt><dd>${v.strong?'강제':'일반'} / ${v.inputLocked?'잠김':'잠금 없음'}</dd></dl>${v.unknown.length?'<p class="notice">확인할 맥락: '+v.unknown.map(e).join(' · ')+'</p>':''}<div class="tutorial-events">${button('start','원작 OnStart 실행',{disabled:v.started||v.registered||v.completed})}${button('mask-click','현재 원작 마스크 콜백',{disabled:!v.allowedActions.some(a=>a.type==='mask-click')})}${button('clock','다음 예약 시각까지',{disabled:v.nextDueAt===null})}${button('resume','저장 재접속 규칙 적용')}${button('teardown','리스너 정리 · 완료 아님')}</div><h3>등록된 원작 사건 보내기</h3>${eventInput}<label for="catalog-payload">사건 payload JSON<textarea id="catalog-payload" data-catalog-payload maxlength="${LIMIT_PAYLOAD}" spellcheck="false">${e(row.payloadJSON)}</textarea></label>${button('source-event','선택 원작 사건 보내기',{disabled:events.length===0})}</section><section><h2>명시 연구 맥락</h2><label for="catalog-context">조건 JSON · mode는 research<textarea id="catalog-context" data-catalog-context maxlength="${LIMIT_CONTEXT}" spellcheck="false">${e(row.contextJSON)}</textarea></label><p>기본값은 mode만 있습니다. 서버·활동·창·해금·함수 반환·외부 효과 성공을 임의로 채우지 않습니다. 입력은 아래 동작 또는 안내 선택 때 저장합니다.</p>${button('save-draft','입력 초안만 저장')}<details${g.unimplemented.length?' open':''}><summary>지원 경계·전용 구현 필요 ${g.unimplemented.length}개</summary>${g.unimplemented.length?'<ul>'+g.unimplemented.map(x=>'<li><strong>'+e(x.callee||x.op)+'</strong><p>'+e(x.reason)+'</p><small>'+e(x.sourceId)+' · 행 '+e(x.lineStart)+'–'+e(x.lineEnd)+'</small></li>').join('')+'</ul>':'<p>정적 변환에서 별도 미지원 연산을 기록하지 않았습니다. 활동·원작 UI의 전체 구현이나 원작 실행 검증을 뜻하지 않습니다.</p>'}</details><details><summary>최근 사건 결과·관측한 외부 요청</summary><p>${e(row.lastResult?.message||'아직 실행 결과가 없습니다.')}</p><ul>${(row.lastResult?.unknown||[]).map(x=>'<li>'+e(x)+'</li>').join('')}</ul><ol>${v.effects.slice(-12).map(x=>`<li>${e(x.callee||x.kind)}<small> · ${e(x.sourceId)}:${e(x.lineStart)} · ${x.targetBinding?'명시 웹 대상 연결 있음':'원작 대상 좌표 미연결'}</small></li>`).join('')||'<li>외부 요청 기록 없음</li>'}</ol></details><h3>최근 상태 전이</h3><ol class="tutorial-history">${v.history.slice(-12).reverse().map(x=>`<li><time>${e(x.time)}초</time><strong>${e(x.kind)}</strong><small>${e(x.detail)}</small></li>`).join('')||'<li>아직 적용한 전이가 없습니다.</li>'}</ol></section></div><div class="tutorial-presets">${button('export','독립 연구 JSON 보관')}${button('reset-guide','백업 후 선택 안내 초기화')}${button('reset-all','백업 후87종 연구 전체 초기화')}</div>${provenance}</div>`;
 }
 return {renderPage,handle};
}
