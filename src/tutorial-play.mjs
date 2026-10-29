import {createTutorialExtension,tutorialExtensionEvent,extensionView,validTutorialExtension} from './tutorial-extension.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const result=(ok,message,extra={})=>({ok,message,...extra});
export function createTutorialPlay(c){return {schema:1,revision:c.revision,enabled:false,selected:c.guides[0].id,context:{mode:'research'},engine:createTutorialExtension(c),message:'연구 조건을 명시하면 웹 플레이 이벤트와 안내를 연결합니다.',unknown:[]};}
export function validTutorialPlay(s,c){try{return object(s)&&s.schema===1&&s.revision===c.revision&&typeof s.enabled==='boolean'&&c.guides.some(g=>g.id===s.selected)&&object(s.context)&&s.context.mode==='research'&&JSON.stringify(s.context).length<=32768&&validTutorialExtension(s.engine,c)&&(!s.engine.active||s.engine.active.id===s.selected)&&typeof s.message==='string'&&s.message.length<=1000&&Array.isArray(s.unknown)&&s.unknown.every(x=>typeof x==='string'&&x.length<=300);}catch{return false;}}
export function configureTutorialPlay(s,id,context,c){
 if(!validTutorialPlay(s,c))return result(false,'기존 연결 안내 저장을 보존했습니다. 백업 후 초기화하세요.');
 if(!c.guides.some(g=>g.id===id)||!object(context)||context.mode!=='research'||JSON.stringify(context).length>32768)return result(false,'안내 ID와 mode=research 조건 객체를 확인하세요.');
 if(s.engine.active&&s.engine.active.id!==id)return result(false,'현재 연결한 안내를 초기화한 뒤 다른 안내로 전환하세요.');
 s.selected=id;s.context=structuredClone(context);s.enabled=true;s.unknown=[];s.message='연구 조건을 명시했습니다. 아래 설명의 실제 웹 조작으로 안내를 진행하세요.';return result(true,s.message);
}
export function tutorialPlayEvent(s,event,c,{context={}}={}){
 if(!validTutorialPlay(s,c)||!s.enabled)return result(false,'연결 안내가 꺼져 있거나 호환되지 않습니다.');
 const out=tutorialExtensionEvent(s.engine,{...event,guideId:s.selected,now:event.now??s.engine.time},{...s.context,...context,mode:'research'},c);
 s.message=out.message;s.unknown=out.unknown||[];return out;
}
export function resetTutorialPlay(s,c){return tutorialPlayEvent(s,{type:'reset'},c);}
export function renderTutorialPlay(s,c){
 if(!c)return '';
 if(s!==undefined&&!validTutorialPlay(s,c))return '<section class="tutorial-play"><h2>연결 안내 저장을 보존했습니다</h2><p>상태 JSON을 내려받거나 백업 후 연결 안내만 초기화하세요.</p><button class="button" data-play="export">상태 JSON</button><button class="button" data-play="guide:reset-invalid">백업 후 연결 안내 초기화</button></section>';
 const b=s||createTutorialPlay(c),g=c.guides.find(g=>g.id===b.selected),v=extensionView(b.engine,b.context,c),a=v.active;
 const instructions={tutorial_battlepass:'패스·앨범·이벤트 모드에서 패스 탭을 여세요. 설명 다음 버튼으로 수령권 강조를 확인합니다.',tutorial_event_energyboost_simple:'퍼즐로 이동한 뒤 생성 부스트 실험의 배율 버튼을 두 번 바꾸세요. 현재 창·일반 안내가 종료돼야 시작합니다.',tutorial_story_recap:'메인 맵의 과제 목록을 여세요. 설명을 진행하고 강조 뒤 과제 목록을 닫으면 완료합니다.',tutorial_generator_factory_Acquire:'퍼즐에서 아래 공장 폴링 예제를 시작하고 공장 조각 탭 예제→보관함 안내를 진행하세요. 공장 생산 자체는 미구현입니다.',tutorial_change_decoration:'맵의 Skin 연구에서 동일 슬롯의 소유를 두 개 이상 명시하세요. 보상 이벤트 뒤 설명과 팝업 완료 콜백을 비교합니다.'};
 const next=g.eventCatalog.findIndex(x=>x.event.type==='mask-click'),popup=g.eventCatalog.findIndex(x=>x.event.type==='decoration-popup-completed');
 const button=(a,label,disabled=false,value)=>`<button class="button" data-play="guide:${a}"${value!==undefined?' data-value="'+e(value)+'"':''}${disabled?' disabled':''}>${label}</button>`;
 return `<section class="tutorial-play" aria-labelledby="tutorial-play-title"><h2 id="tutorial-play-title">플레이에 연결한 추가 안내</h2><p>명시한 연구 컨텍스트와 웹 조작의 대응 실험입니다. 원작 계정 자동 발동·전체 강제 입력 마스크와 동일하다고 검증하지 않았습니다. 일반 튜토리얼과 메인 지갑은 유지합니다.</p><label>연결할 안내<select data-guide-select>${c.guides.map(r=>`<option value="${e(r.id)}"${r.id===b.selected?' selected':''}>${e(r.name)}</option>`).join('')}</select></label><div class="tutorial-presets">${button('configure','선택 안내의 연구 예제 연결')}${button('disable','안내 연결 중지',!b.enabled)}${button('reset','선택 안내 초기화',!b.enabled)}</div><p>${e(instructions[b.selected])}</p><div class="tutorial-play-status" role="status" data-guide-status><strong>${b.enabled?'연구 연결 켜짐':'연구 연결 꺼짐'} · ${e(a?.label||'진행 중 안내 없음')}</strong><p>${e(b.message)}</p>${b.unknown.length?'<p>미확인 입력: '+b.unknown.map(e).join(' · ')+'</p>':''}<small>연구 시각 ${e(b.engine.time)}초 · 등록 ${v.registered.includes(b.selected)?'완료':'전'} · 안내 흐름 ${v.completed.includes(b.selected)?'완료':'전'}</small></div>${a?.textKey?'<p>설명문 키: <code>'+e(a.textKey)+'</code></p>':''}<div class="tutorial-presets">${button('clock','다음 선언 지연까지 진행',!b.enabled||v.nextDueAt===null)}${next>=0?button('event','안내 설명 · 마스크 콜백',!b.enabled||!a,String(next)):''}${popup>=0?button('event','장식 팝업 완료 콜백',!b.enabled||a?.phase!=='popup-open',String(popup)):''}${b.selected==='tutorial_generator_factory_Acquire'?button('factory-poll','연구 공장 폴링',!b.enabled)+button('factory-tap','연구 공장 조각 탭',!b.enabled||a?.phase!=='tap-item'):''}</div><details><summary>서버·해금 조건 직접 명시</summary><label>연구 컨텍스트 JSON<textarea data-guide-context maxlength="32768" spellcheck="false">${e(JSON.stringify(b.context,null,2))}</textarea></label>${button('configure-custom','현재 JSON으로 연결')}<p>예제 버튼은 조건을 연구값으로 명시합니다. 실제 계정 소유·활동 배정으로 사용하지 않습니다. 일부 화면·모드 필드는 현재 웹 상태로 갱신합니다.</p></details><a href="#tutorial-analysis">추가 안내 전체 단계·출처</a></section>`;
}
