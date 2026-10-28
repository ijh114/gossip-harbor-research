// Pure rendering for the bounded APK-data play experiment. State changes live elsewhere.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const rows = value => Array.isArray(value) ? value : [];
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const format = value => number(value).toLocaleString('ko-KR');
const clock = value => {const total=Math.max(0,Math.floor(number(value)));return `${String(Math.floor(total/3600)).padStart(2,'0')}:${String(Math.floor(total%3600/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;};
const action = (name,label,{value,primary=false,disabled=false,pressed,extra=''}={}) => `<button type="button" class="button${primary?' primary':''}" data-play="${name}"${value!==undefined?` data-value="${escape(value)}"`:''}${disabled?' disabled':''}${pressed!==undefined?` aria-pressed="${Boolean(pressed)}"`:''}${extra}>${escape(label)}</button>`;

function lookup(config,type){return rows(config.items).find(item=>String(item.type)===String(type));}
function itemName(config,type){const item=lookup(config,type);return item?.name || (type ? `Type ${type}` : '아이템');}
function assetFor(config,data,type){
 const item=lookup(config,type),entries=rows(data?.media?.entries);
 const keys=[`item:ItemModelConfig:${type}`,item?.imageKey,item?.imageKey?`asset:${item.imageKey}`:null].filter(Boolean);
 const media=keys.map(key=>entries.find(entry=>entry.key===key)).find(entry=>entry&&entry.kind==='image'&&/^\.\/assets\/media\/[\w./-]+\.(?:png|jpe?g|webp)$/i.test(entry.src)&&!entry.src.includes('..'));
 return media?.src || '';
}
function itemImage(config,data,type,{large=false}={}){
 const src=assetFor(config,data,type);
 return src?`<img class="source-item-image${large?' large':''}" src="${escape(src)}" alt="" width="96" height="96" decoding="async">`:`<span class="source-item-fallback" aria-hidden="true">${escape(type || '?')}</span>`;
}
function wallet(s,config){
 const w=s.wallet||{},level=rows(config.levels).find(row=>number(row.level)===number(w.level)),cost=number(level?.exp);
 return `<dl class="source-play-wallet"><div><dt>에너지</dt><dd>${format(w.energy)}<small>자연 회복 상한 100</small></dd></div><div><dt>젬</dt><dd>${format(w.gems)}<small>실험 재화</small></dd></div><div><dt>골드</dt><dd>${format(w.coins)}<small>주문 → 맵 진행</small></dd></div><div><dt>플레이어 레벨</dt><dd>${format(w.level)}<small>EXP ${format(s.xp)}${cost?` / ${format(cost)}`:''}</small></dd></div></dl>`;
}
function order(s,config,data){
 const current=rows(config.orders)[number(s.orderIndex)];
 if(!current)return `<section class="source-play-order"><div><h2>선정 주문을 모두 마쳤습니다</h2><p>확인하지 않은 주문을 자동으로 만들어 반복하지 않습니다. 남은 보드와 맵 진행은 계속 비교할 수 있습니다.</p></div><a class="text-link" href="#difficulty">주문 분석 보기</a></section>`;
 const board=rows(s.board),requirements=rows(current.requirements),levelReady=number(s.wallet?.level)>=number(current.level);
 const satisfied=requirements.length>0&&requirements.every(req=>board.filter(item=>item&&!item.cover&&String(item.type)===String(req.type)).length>=number(req.count));
 return `<section class="source-play-order" aria-labelledby="source-order-title"><div class="source-order-heading"><h2 id="source-order-title">현재 주문</h2><span>${escape(current.id)} · ${number(s.orderIndex)+1} / ${rows(config.orders).length}</span></div><ul class="source-order-items">${requirements.map(req=>{const have=board.filter(item=>item&&!item.cover&&String(item.type)===String(req.type)).length;return `<li>${itemImage(config,data,req.type)}<div><strong>${escape(itemName(config,req.type))}</strong><span>보유 ${format(have)} / 필요 ${format(req.count)}</span></div></li>`;}).join('')}</ul><div class="source-order-submit"><span>골드 <strong>+${format(current.coins)}</strong>${!levelReady?` · 레벨 ${format(current.level)} 필요`:''}</span>${action('deliver','주문 제출',{primary:true,disabled:!satisfied||!levelReady})}</div></section>`;
}
function board(s,config,data){
 return `<div class="source-play-board" role="group" aria-label="7열 9행 APK 규칙 실험 보드">${Array.from({length:63},(_,index)=>{
  const item=rows(s.board)[index],definition=item?lookup(config,item.type):null,selected=s.selected===index,cover=item?.cover,changed=s.lastAction?.ok&&s.lastAction?.cells?.includes(index);
  const coverName=cover==='box'?'상자':cover==='web'?'거미줄':'';
  const label=`${Math.floor(index/7)+1}행 ${index%7+1}열, ${item?itemName(config,item.type)+(coverName?', '+coverName+' 덮개':''):'빈칸'}${selected?', 선택됨':''}`;
  return `<button type="button" class="source-play-cell${item?' occupied':''}${selected?' selected':''}${changed?' source-cell-changed':''}${cover?' covered cover-'+escape(cover):''}${definition?.generator?' generator':''}" data-play="cell" data-value="${index}" aria-label="${escape(label)}" aria-pressed="${selected}">${item?itemImage(config,data,item.type):'<span class="source-empty-dot" aria-hidden="true"></span>'}${coverName?`<span class="source-cover-label" aria-hidden="true">${coverName}</span>`:definition?.generator?'<span class="source-generator-label" aria-hidden="true">생성</span>':''}</button>`;
 }).join('')}</div>`;
}
function selected(s,config,data){
 const item=rows(s.board)[s.selected],definition=item?lookup(config,item.type):null,gen=definition?.generator;
 const generatorState=item?s.generatorState?.[item.uid]:null,remaining=Math.max(0,number(generatorState?.readyAt)-number(s.wallet?.time));
 const cooling=Boolean(gen&&number(generatorState?.charges)<=0&&remaining>0);
 if(!item)return `<section class="source-play-inspector"><h2>아이템을 선택하세요</h2><p>생성기를 선택하면 생성할 수 있습니다. 같은 아이템 두 칸을 차례로 누르면 합성하고, 빈칸을 누르면 이동합니다.</p>${action('generate','선택한 생성기로 생성',{primary:true,disabled:true})}</section>`;
 return `<section class="source-play-inspector"><div class="source-selected-heading">${itemImage(config,data,item.type,{large:true})}<div><h2>${escape(itemName(config,item.type))}</h2><p>Type ${escape(item.type)}</p></div></div><dl class="source-selected-details"><div><dt>현재 상태</dt><dd>${item.cover==='box'?'상자 안':item.cover==='web'?'거미줄 안':'조작 가능'}</dd></div><div><dt>다음 합성</dt><dd>${definition?.next?escape(itemName(config,definition.next)):'다음 타입 선언 없음'}</dd></div>${gen?`<div><dt>에너지 비용</dt><dd>${format(gen.cost)} / 생성</dd></div><div><dt>현재 충전</dt><dd>${generatorState?.charges==null?'미확인':format(generatorState.charges)}${number(gen.storage)?` / ${format(gen.batch)}`:''}</dd></div><div><dt>재충전 대기</dt><dd>${remaining?format(Math.ceil(remaining))+'초':'생성 가능'}</dd></div>`:''}</dl>${!gen&&definition?.sellingPrice?action('sell',`판매 · +${format(definition.sellingPrice)}골드`):''}${gen?action('generate',cooling?'충전을 기다리는 중':'선택한 생성기로 생성',{primary:true,disabled:Boolean(item.cover)||cooling}):'<p class="source-play-hint">같은 타입을 선택해 합성하거나 빈칸으로 옮기세요.</p>'}</section>`;
}
function queue(s,config,data){
 const queued=rows(s.queue);
 return `<section class="source-play-queue"><div><h2>보상 대기열</h2><span>${queued.length}건 대기</span></div>${queued.length?`<ul>${queued.slice(0,4).map(reward=>{const type=typeof reward==='object'?reward.type:reward;return `<li>${itemImage(config,data,type)}<span>${escape(itemName(config,type))}${typeof reward==='object'&&number(reward.count)>1?' ×'+format(reward.count):''}</span></li>`;}).join('')}</ul>`:'<p>맵·레벨 보상이 생기면 여기에서 확인합니다.</p>'}${action('queue','지원하는 보상1개 배치',{disabled:queued.length===0})}</section>`;
}
function home(s,config){
 const quests=rows(config.quests),done=Math.min(quests.length,Math.max(0,number(s.questsDone))),current=quests[done],pending=s.pendingQuest!==undefined&&s.pendingQuest!==null;
 return `<div class="source-play-home"><div class="source-home-title"><div><h2>주문 골드로 맵 진행하기</h2><p>선정한 내장 퀘스트의 순서·기본 비용·EXP를 적용합니다. 화면은 진행 상태를 보여주는 웹 모식도입니다.</p></div>${action('main','퍼즐로 돌아가기')}</div><div class="source-map-progress"><span>완료 ${done} / ${quests.length}</span><progress max="${quests.length||1}" value="${done}" aria-label="선정 퀘스트 완료 수"></progress></div><ol class="source-map-track">${quests.map((quest,index)=>`<li class="${index<done?'done':index===done?'current':'locked'}"${index===done?' aria-current="step"':''}><span>${index<done?'완료':index===done?'현재':'대기'}</span><strong>${escape(quest.name || quest.id)}</strong><small>골드 ${format(quest.cost)} · EXP +${format(quest.exp)}</small></li>`).join('')}</ol><section class="source-current-quest">${current?`<div><h3>${escape(current.name||current.id)}</h3><p>기본 비용 <strong>${format(current.cost)}골드</strong> · EXP +${format(current.exp)}</p>${rows(current.rewards).length?`<p class="source-play-hint">추가 보상 ${current.rewards.map(reward=>`Type ${escape(reward.type)} ×${format(reward.count)}`).join(' · ')}</p>`:''}<p class="source-play-hint">서버 비용 보정은 배율1로 둔 실험입니다. 장면 완료 시 골드를 차감하고 보상·다음 과제를 확정합니다.</p></div>${pending?action('quest-finish','장면 완료 · 비용과 보상 확정',{primary:true}):action('quest-start','이 과제 시작',{primary:true,disabled:number(s.wallet?.coins)<number(current.cost)})}`:'<div><h3>선정 퀘스트를 모두 마쳤습니다</h3><p>다음 과제·지역·스토리는 이번 실험 범위에 포함하지 않았습니다.</p></div>'}</section></div>`;
}
const CHAIN=[{cost:20,label:'에너지 100'},{cost:0,label:'초록 카드팩'},{cost:0,label:'에너지 15'},{cost:40,label:'에너지 100'},{cost:0,label:'파란 카드팩'},{cost:0,label:'에너지 20'},{cost:80,label:'에너지 100 · 미구매'}];
function modal(s,config,data){
 if(!s.modal)return '';
 const w=s.wallet||{};
 let title='',body='',close='';
 if(s.modal==='energy'){
  const free=number(w.freeUsed)<number(w.freeTotal),cost=free?0:number(w.price);
  title='에너지 충전';close='close-energy';
  body=`<p>현재 에너지 <strong>${format(w.energy)}</strong>에서 100을 충전합니다.</p><div class="source-energy-exchange"><span>에너지 <strong>+100</strong></span><span>${free?'무료':format(cost)+'젬'}</span></div><p class="source-play-hint">충전·가격 변화는 선택한 규칙에 따른 웹 실험입니다. 실제 결제는 발생하지 않습니다.</p>${action('buy-energy',free?'무료 에너지 받기':`${format(cost)}젬으로 충전`,{primary:true,disabled:number(w.gems)<cost})}<p class="source-dialog-note">구매 없이 닫으면 현재 플레이 상태로 후속 오퍼 조건을 평가합니다. 서버 후보와 임계치는 실험 입력입니다.</p>`;
 }else if(s.modal==='offer'){
  title='플레이 상황에 따른 제안';close='close-offer';
  body=`<p class="source-offer-choice">${escape(s.offer?.chosen||'선택된 제안 없음')}</p><p class="source-play-hint">APK 조건식에 실험 상태·가정 후보를 넣은 결과입니다. 해당 계정에 실제로 이 상품이 노출됐다는 뜻은 아닙니다.</p><ol class="source-offer-trace">${rows(s.offer?.steps).map(step=>`<li><span>${step.ok?'충족':'미충족'}</span><div><strong>${escape(step.label||step.id)}</strong><p>${escape(step.reason)}</p></div></li>`).join('')}</ol><a class="text-link" href="#bm-validation">상세 BM 조건 실험 보기</a>`;
 }else if(s.modal==='shop'){
  title='상점과 관측 체인';close='close-shop';
  const unlocked=number(w.level)>=3,current=Math.max(0,Math.min(6,number(s.chainStep))),active=s.chainActive!==false;
  body=`<p>상점 해금은 내장 기본값 <strong>레벨3</strong>을 사용합니다. 현재 레벨은 ${format(w.level)}입니다.</p>${!unlocked?'<p class="source-dialog-note">상점 기본 해금 레벨에 도달하지 않았습니다. 원작 서버가 같은 값을 사용한다는 의미는 아닙니다.</p>':`<div class="source-shop-scope"><strong>실제 IAP 구매는 연결하지 않습니다</strong><p>상품 원화 가격과 서버 배정은 상품 카탈로그·관측 자료에서 확인합니다.</p><a class="text-link" href="#catalog">내장 상품 선언 보기</a></div><section class="source-chain-lab"><h3>과거 에너지 체인 구간</h3><p>GH-V0030에서 확인한 순서만 재생합니다. 캡처 버전은 미확인이며 원작의 현행 가격표가 아닙니다.</p><ol>${CHAIN.map((step,index)=>`<li class="${index<current?'claimed':index===current?'current':'locked'}"><span>${index<current?'수령':index===6?'미구매':index===current?'현재':'대기'}</span><strong>${escape(step.label)}</strong><small>${step.cost?format(step.cost)+'젬':'무료'}</small></li>`).join('')}</ol><p class="source-play-hint">카드팩은 내용 미확인 보상으로 기록합니다. 80젬 단계 이후의 구매·가격·반복은 구현하지 않았습니다.</p><div class="source-dialog-actions">${action('chain-start','관측 체인 시나리오 준비')}${action('chain-claim',current>=6?'80젬 단계 · 관측 경계':CHAIN[current].cost?`${CHAIN[current].cost}젬 단계 진행`:'무료 단계 받기',{primary:true,disabled:!active||current>=6||(CHAIN[current].cost>number(w.gems))})}</div><p class="source-play-hint">기록된 체인 보상 ${rows(s.chainRewards).length}건</p><a class="text-link" href="#captures">원본 관측 구간과 비교하기</a></section>`}`;
 }else{return '';}
 return `<dialog id="play-dialog" class="source-play-dialog" aria-labelledby="source-play-dialog-title"><div class="source-dialog-heading"><h2 id="source-play-dialog-title">${escape(title)}</h2>${action(close,'닫기')}</div><div class="source-dialog-content">${body}</div></dialog>`;
}
function boundaries(config){
 return `<details class="source-play-boundaries"><summary>적용한 근거와 실험 범위</summary><ul>${rows(config.boundary).map(text=>`<li>${escape(text)}</li>`).join('')}</ul><p>이벤트·패스·앨범의 전체 서버 설정과 현재 상품 배정은 포함하지 않습니다. 실험 결과는 원작 실플레이 검증과 별도로 읽습니다.</p>${rows(config.sources).length?`<details><summary>설정 출처 ${rows(config.sources).length}건</summary><ul>${rows(config.sources).map(source=>`<li><code>${escape(typeof source==='string'?source:source.path||source.id||'설정 출처')}</code>${typeof source==='object'&&source.line_start!=null?` · L${escape(source.line_start)}${source.line_end!=null?'–L'+escape(source.line_end):''}`:''}</li>`).join('')}</ul></details>`:''}</details>`;
}

export function renderSourcePlay(s={},config={},data={}){
 const stage=s.stage||'title',time=number(s.wallet?.time);
 const top=`<header class="studio-intro source-play-intro"><h1>APK 규칙으로 플레이하기</h1><p>생성·합성·주문에서 골드와 맵 진행, 에너지 충전과 제안까지 연결해 비교합니다. 내장 설정과 가정·과거 관측 시나리오의 범위를 함께 표시합니다.</p></header>`;
 const toolbar=`<div class="source-play-toolbar"><span>실험 시간 <strong>${clock(time)}</strong> · 설정 ${escape(config.revision?.slice(0,8)||'준비 중')}</span><div>${action('focus',s.focused?'집중 모드 종료':'보드 집중 모드')}${action('save','저장')}${action('export','상태 JSON')}${action('reset','새 실험')}<label class="button source-import-label">상태 가져오기<input id="play-import" type="file" accept="application/json,.json" aria-label="연구 상태 JSON 가져오기"></label></div></div>`;
 const feedback=`<div class="source-play-feedback" role="status" aria-live="polite"><p>${escape(s.message||'원하는 행동을 선택하세요.')}</p>${s.storageMessage?`<small>${escape(s.storageMessage)}</small>`:''}</div>`;
 if(stage==='title')return `<div class="source-play">${top}<section class="source-play-start"><h2>원하는 배치에서 시작하세요</h2><p>연구용 열린 배치는 생성·합성·주문을 빠르게 비교하기 위한 구성입니다. 원본 초기 배치는 내장 보드의 상자·거미줄 상태를 확인하는 별도 시나리오입니다.</p><div class="source-scenario-switch" role="group" aria-label="시작 보드 선택">${action('scenario','연구용 열린 배치',{value:'open',pressed:s.scenario!=='initial'})}${action('scenario','원본 초기 배치',{value:'initial',pressed:s.scenario==='initial'})}</div><p class="source-play-hint">현재 선택: ${s.scenario==='initial'?'APK 초기 배치':'연구용 열린 배치'} · 원작 튜토리얼 입력 순서와 연출을 재현한 결과는 아닙니다.</p>${action('start','플레이 시작',{primary:true})}</section>${toolbar}${feedback}${boundaries(config)}</div>`;
 const play=`${order(s,config,data)}<div class="source-play-layout"><section class="source-board-panel" aria-label="합성 보드"><div class="source-board-heading"><span>7 × 9 보드</span><span>${rows(s.board).filter(Boolean).length} / 63칸</span></div>${board(s,config,data)}<p class="source-play-hint">아이템 선택 → 같은 아이템으로 합성 · 빈칸으로 이동. 생성기는 두 번 누르거나 선택 후 생성 버튼을 누릅니다.</p></section><aside class="source-play-side" aria-label="선택 아이템과 플레이 조작">${selected(s,config,data)}${queue(s,config,data)}<div class="source-play-actions">${action('open-energy','에너지 충전')}${action('shop','상점·관측 체인',{disabled:number(s.wallet?.level)<3})}${action('home','맵 진행')}</div><p class="source-play-hint">상점 기본 해금: 레벨3</p></aside></div>`;
 return `<div class="source-play">${top}${wallet(s,config)}${toolbar}${stage==='home'?home(s,config):play}${feedback}<div class="source-play-time"><strong>시간 경과 실험</strong>${action('time','2분 경과',{value:120})}${action('time','1시간 경과',{value:3600})}<span>자연 회복·생성기 충전을 비교합니다. 실제 경과는 조작·재접속 시 반영합니다.</span></div><details class="source-play-assistance"><summary>실험 도우미 · 원작 보상과 별도</summary><p>막힌 구간의 조건을 비교하기 위한 재화 보충입니다. 원작의 지급·구매·광고 보상이 아닙니다.</p><div>${action('aid-energy','에너지0 · 부족 상태')}${action('aid-coins','골드 보충')}${action('aid-gems','젬 보충')}${action('aid-xp','EXP15 · 레벨 게이트 실험')}</div></details><details class="source-bm-inputs"><summary>BM 후보 설정 · 서버값 가정</summary><p>현재 플레이 재화와 아래 가정 후보를 조합합니다. 다음 충전/닫기 동작부터 적용합니다.</p><div>${[['bundle','에너지 번들'],['noPay','EnergyGemOffer'],['invite','친구 초대'],['plenty','Plenty'],['chain','체인 패키지'],['weekly','신규 주간 패키지']].map(([key,label])=>`<label><input type="checkbox" data-play-bm="${key}"${s.bm?.[key]?' checked':''}> ${label}</label>`).join('')}<label>번들 임계 젬 가격<input type="number" min="0" max="1000000" data-play-bm="triggerPrice" value="${number(s.bm?.triggerPrice)}"></label><label>번들 분기<select data-play-bm="popType"><option value="1"${s.bm?.popType===1?' selected':''}>충전창을 닫은 후</option><option value="2"${s.bm?.popType===2?' selected':''}>일반 충전창 이전</option></select></label></div></details>${boundaries(config)}<details class="source-play-log"><summary>최근 행동 기록 ${rows(s.log).length}건</summary><ol>${rows(s.log).slice(0,10).map(entry=>`<li><time>${clock(entry.time)}</time><span>${escape(entry.message)}</span><small>${entry.ok===false?'실패':'처리'}</small></li>`).join('')}</ol></details>${modal(s,config,data)}</div>`;
}
