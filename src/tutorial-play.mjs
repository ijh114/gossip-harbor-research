import {createTutorialExtension,tutorialExtensionEvent,extensionView,validTutorialExtension} from './tutorial-extension.mjs';
import {createMoreTutorials,moreTutorialEvent,moreTutorialView,validMoreTutorials} from './tutorial-more.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const result=(ok,message,extra={})=>({ok,message,...extra});
export function playTutorialCatalog(data){const base=data?.tutorialConfig,more=data?.tutorialMoreConfig;if(!base)return null;return more?{...base,base,more,guides:[...base.guides,...more.guides]}:base;}
function bankFor(c,id){return c.more?.guides.some(g=>g.id===id)?'more':'base';}
function bank(c,id){const key=bankFor(c,id);return key==='more'?{key,config:c.more,create:createMoreTutorials,event:moreTutorialEvent,view:moreTutorialView,valid:validMoreTutorials}:{key,config:c.base||c,create:createTutorialExtension,event:tutorialExtensionEvent,view:extensionView,valid:validTutorialExtension};}
function view(s,c){const b=bank(c,s.selected);return b.view(s.engine,s.context,b.config);}
export function createTutorialPlay(c){return {schema:1,revision:c.revision,enabled:false,selected:c.guides[0].id,context:{mode:'research'},engine:createTutorialExtension(c),message:'연구 조건을 명시하면 웹 플레이 이벤트와 안내를 연결합니다.',unknown:[]};}
export function validTutorialPlay(s,c){try{if(!object(s)||s.schema!==1||s.revision!==c.revision||typeof s.enabled!=='boolean'||!c.guides.some(g=>g.id===s.selected)||!object(s.context)||s.context.mode!=='research'||JSON.stringify(s.context).length>32768)return false;const b=bank(c,s.selected);if(!b.valid(s.engine,b.config)||s.engine.active&&s.engine.active.id!==s.selected)return false;if(s.savedBanks!==undefined){if(!object(s.savedBanks))return false;for(const [key,engine]of Object.entries(s.savedBanks)){if(!['base','more'].includes(key)||key===b.key||key==='more'&&!c.more)return false;const other=key==='more'?{config:c.more,valid:validMoreTutorials}:{config:c.base||c,valid:validTutorialExtension};if(!other.valid(engine,other.config)||engine.active)return false;}}return typeof s.message==='string'&&s.message.length<=1000&&Array.isArray(s.unknown)&&s.unknown.every(x=>typeof x==='string'&&x.length<=300);}catch{return false;}}
export function configureTutorialPlay(s,id,context,c){
 if(!validTutorialPlay(s,c))return result(false,'기존 연결 안내 저장을 보존했습니다. 백업 후 초기화하세요.');
 if(!c.guides.some(g=>g.id===id)||!object(context)||context.mode!=='research'||JSON.stringify(context).length>32768)return result(false,'안내 ID와 mode=research 조건 객체를 확인하세요.');
 if(s.engine.active&&s.engine.active.id!==id)return result(false,'현재 연결한 안내를 초기화한 뒤 다른 안내로 전환하세요.');
 const oldBank=bank(c,s.selected),nextBank=bank(c,id);
 if(oldBank.key!==nextBank.key){s.savedBanks??={};s.savedBanks[oldBank.key]=structuredClone(s.engine);s.engine=s.savedBanks[nextBank.key]?structuredClone(s.savedBanks[nextBank.key]):nextBank.create(nextBank.config);delete s.savedBanks[nextBank.key];}
 s.selected=id;s.context=structuredClone(context);s.enabled=true;s.unknown=[];s.message='연구 조건을 명시했습니다. 아래 설명의 실제 웹 조작으로 안내를 진행하세요.';return result(true,s.message);
}
export function tutorialPlayEvent(s,event,c,{context={}}={}){
 if(!validTutorialPlay(s,c)||!s.enabled)return result(false,'연결 안내가 꺼져 있거나 호환되지 않습니다.');
 const b=bank(c,s.selected),out=b.event(s.engine,{...event,guideId:s.selected,now:event.now??s.engine.time},{...s.context,...context,mode:'research'},b.config);
 s.message=out.message;s.unknown=out.unknown||[];return out;
}
export function resetTutorialPlay(s,c){return tutorialPlayEvent(s,{type:'reset'},c);}
export function tutorialPlayView(s,c){return validTutorialPlay(s,c)?view(s,c):{valid:false,active:null};}
export function restoreTutorialPlay(s,c){if(!validTutorialPlay(s,c)||!s.enabled)return result(false,'복원할 연결 안내가 없습니다.');return s.selected==='tutorial_energyBoosteight_start'&&s.engine.active?tutorialPlayEvent(s,{type:'executer-started'},c):result(true,'기존 연결 안내 초안을 복원했습니다.');}
export function tutorialPlayPermission(s,action,c){
 if(!validTutorialPlay(s,c)||!s.enabled)return {allowed:true};const a=s.engine.active;if(!a||!a.strong&&a.dueAt===null)return {allowed:true};
 const free=['export','save','focus','reset','scenario','new-game','game-title','game-continue','game-new-prompt','game-new-cancel','game-sound','game-task-list-close','game-factory-close','game-skins-close','game-decor-close','close-energy','close-offer','close-shop','close-info','close-inventory','cancel-tool'];
 if(action.startsWith('guide:')||free.includes(action))return {allowed:true};
 const hud=a.target?.hud,phase=a.phase;
 if(hud==='EnergyBoost'&&action==='set-boost')return {allowed:true};
 if(s.selected==='tutorial_generator_factory_Acquire'&&phase==='tap-item'&&['game-factory-open','factory:store'].includes(action))return {allowed:true};
 if(hud==='Inventory'&&['inventory','game-factory-open'].includes(action))return {allowed:true};
 if(hud==='Task'&&['home','game-task-list'].includes(action))return {allowed:true};
 if(s.selected==='tutorial_battlepass'&&phase==='ticket-highlight'&&action==='activity:premium')return {allowed:true};
 return {allowed:false,message:'연결 안내의 현재 단계에서는 대상 조작만 허용합니다. 안내를 진행하거나 연결 중지를 선택하세요.',phase,kind:'web-action-policy-not-native-mask-geometry'};
}
export function renderTutorialPlay(s,c){
 if(!c)return '';
 if(s!==undefined&&!validTutorialPlay(s,c))return '<section class="tutorial-play"><h2>연결 안내 저장을 보존했습니다</h2><p>상태 JSON을 내려받거나 백업 후 연결 안내만 초기화하세요.</p><button class="button" data-play="export">상태 JSON</button><button class="button" data-play="guide:reset-invalid">백업 후 연결 안내 초기화</button></section>';
 const b=s||createTutorialPlay(c),g=c.guides.find(g=>g.id===b.selected),v=view(b,c),a=v.active;
 const instructions={tutorial_battlepass:'패스·앨범·이벤트 모드에서 패스 탭을 여세요. 설명 다음 버튼으로 수령권 강조를 확인합니다.',tutorial_event_energyboost_simple:'퍼즐로 이동한 뒤 생성 부스트 실험의 배율 버튼을 두 번 바꾸세요. 현재 창·일반 안내가 종료돼야 시작합니다.',tutorial_story_recap:'메인 맵의 과제 목록을 여세요. 설명을 진행하고 강조 뒤 과제 목록을 닫으면 완료합니다.',tutorial_generator_factory_Acquire:'공장의 연구 활성·해금을 명시한 뒤 퍼즐로 돌아오세요. 실제 대상 조각을 공장에 보관하면 보관함 안내로 이어집니다. 미설정 상태의 폴링·탭 버튼은 별도 연구 예제입니다.',tutorial_change_decoration:'맵의 Skin 연구에서 동일 슬롯의 소유를 두 개 이상 명시하세요. 보상 이벤트 뒤 설명과 팝업 완료 콜백을 비교합니다.',tutorial_energyBoosteight_start:'아래 연구 시작창 닫힘을 명시한 뒤, 퍼즐의 실제 배율 변경으로 안내를 마칩니다. 재접속은 원작 OnStart 종료 분기를 따릅니다.',tutorial_battlepass_bonus_task:'패스 추가 과제 셀 생성·생존·활동 상태는 명시 연구 스냅샷입니다. 실제 패스 서버 셀로 관측했다고 표시하지 않습니다.',tutorial_weekly_quest_bonus_star:'주간 별 수집과 주간 과제 창은 연구 입력입니다. 실제 활동 배정이나 서버 보상과 연결하지 않습니다.',tutorial_event_task_extra_reward_entry:'추가 보상 모델 시작을 명시하고 맵의 과제 목록을 실제로 열어 입구·상자 안내를 진행하세요.',tutorial_generator_boost_active:'생성기 부스트 창·활성 가능 여부를 명시한 뒤 연구 애니메이션 종료 사건을 보내세요. 실제 연출 측정이 아닙니다.'};
 const next=g.eventCatalog.findIndex(x=>x.event.type==='mask-click'),popup=g.eventCatalog.findIndex(x=>x.event.type==='decoration-popup-completed');
 const button=(a,label,disabled=false,value)=>`<button class="button" data-play="guide:${a}"${value!==undefined?' data-value="'+e(value)+'"':''}${disabled?' disabled':''}>${label}</button>`;
 return `<section class="tutorial-play" aria-labelledby="tutorial-play-title"><h2 id="tutorial-play-title">플레이에 연결한 추가 안내</h2><p>명시한 연구 컨텍스트와 웹 조작의 대응 실험입니다. 원작 계정 자동 발동·전체 강제 입력 마스크와 동일하다고 검증하지 않았습니다. 일반 튜토리얼과 메인 지갑은 유지합니다.</p><label>연결할 안내<select data-guide-select>${c.guides.map(r=>`<option value="${e(r.id)}"${r.id===b.selected?' selected':''}>${e(r.name)}</option>`).join('')}</select></label><div class="tutorial-presets">${button('configure','선택 안내의 연구 예제 연결')}${button('disable','안내 연결 중지',!b.enabled)}${button('reset','선택 안내 초기화',!b.enabled)}</div><p>${e(instructions[b.selected])}</p><div class="tutorial-play-status" role="status" data-guide-status><strong>${b.enabled?'연구 연결 켜짐':'연구 연결 꺼짐'} · ${e(a?.label||'진행 중 안내 없음')}</strong><p>${e(b.message)}</p>${b.unknown.length?'<p>미확인 입력: '+b.unknown.map(e).join(' · ')+'</p>':''}<small>연구 시각 ${e(b.engine.time)}초 · 등록 ${v.registered.includes(b.selected)?'완료':'전'} · 안내 흐름 ${v.completed.includes(b.selected)?'완료':'전'}</small></div>${a?.textKey?'<p>설명문 키: <code>'+e(a.textKey)+'</code></p>':''}<div class="tutorial-presets">${button('clock','다음 선언 지연까지 진행',!b.enabled||v.nextDueAt===null)}${next>=0?button('event','안내 설명 · 마스크 콜백',!b.enabled||!a,String(next)):''}${popup>=0?button('event','장식 팝업 완료 콜백',!b.enabled||a?.phase!=='popup-open',String(popup)):''}${b.selected==='tutorial_generator_factory_Acquire'?button('factory-poll','연구 공장 폴링',!b.enabled)+button('factory-tap','연구 공장 조각 탭',!b.enabled||a?.phase!=='tap-item'):''}</div>${c.more?.guides.some(x=>x.id===b.selected)?'<details><summary>명시 연구 상황의 사건 보내기</summary><p>아래는 현재 웹에 없는 활동·창의 연구 사건입니다. 실제 플레이 입력과 구분합니다.</p><div class="tutorial-presets">'+g.eventCatalog.filter(x=>!['clock','mask-click'].includes(x.event.type)).map(x=>button('event',e(x.label),!b.enabled,String(g.eventCatalog.indexOf(x)))).join('')+'</div></details>':''}<details><summary>서버·해금 조건 직접 명시</summary><label>연구 컨텍스트 JSON<textarea data-guide-context maxlength="32768" spellcheck="false">${e(JSON.stringify(b.context,null,2))}</textarea></label>${button('configure-custom','현재 JSON으로 연결')}<p>예제 버튼은 조건을 연구값으로 명시합니다. 실제 계정 소유·활동 배정으로 사용하지 않습니다. 일부 화면·모드 필드는 현재 웹 상태로 갱신합니다.</p></details><a href="#tutorial-analysis">추가 안내 전체 단계·출처</a></section>`;
}
