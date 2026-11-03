const list=value=>Array.isArray(value)?value:[];
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const control=(kind,value,label,selected,disabled=false)=>`<button type="button" data-collection-viz="${kind}" data-value="${value}" data-viz-label="${e(label)}"${selected!==''?` aria-pressed="${selected===value}"`:''}${disabled?' disabled':''}>${e(label)}</button>`;

export const FLOW_PATHS={
 new:{title:'팩에서 신규 카드를 얻으면',summary:'처음 얻은 카드는 세트와 앨범의 고유 진행도를 올립니다. 마지막 빈칸을 채우면 완성 보상을 논리 지급한 뒤 결과를 보여줍니다.',steps:['팩 개봉','공통 카드 획득','신규 카드','세트·앨범 진척'],sourceRefs:['consume','acquire','pack-reveal']},
 duplicate:{title:'팩에서 중복 카드를 얻으면',summary:'중복은 고유 진행도를 늘리지 않습니다. 잉여 카드는 별 교환에 사용하고, Rainbow 설정이 있으면 추가 카드 보정 점수로도 이어집니다.',steps:['팩 개봉','공통 카드 획득','중복 카드','별 교환·조건부 Rainbow'],sourceRefs:['acquire','recycle','rainbow-score']},
 joker:{title:'조커로 카드를 얻으면',summary:'종류와 대상 제한을 확인하고 조커를 소비한 뒤 공통 카드 획득 처리를 호출합니다. 신규·중복과 완성 보상은 같은 보유 상태 판정으로 연결됩니다.',steps:['조커 보유·선택','대상 제한 확인','공통 카드 획득','보유 상태에 따른 판정'],sourceRefs:['joker','joker-entry','acquire']}
};

export const LOOP_NODES=[
 {id:'energy',label:'에너지 소비',detail:'퍼즐에서 아이템을 만들기 위한 플레이 자원을 사용합니다. 실제 사용량과 회복·구매 정책은 별도 설정과 조건을 따릅니다.',sourceRefs:['order-pack'],x:15,y:23},
 {id:'orders',label:'머지·주문 납품',detail:'아이템을 합성하고 주문을 완수합니다. 레벨·주문 점수 구간의 소진형 보상 풀과 주문별 캐시가 팩 공급에 관여합니다.',sourceRefs:['order-pack'],x:50,y:23},
 {id:'packs',label:'카드팩 획득',detail:'주문·이벤트 등의 보상으로 팩을 모읍니다. 팩 공급량과 팩 안의 신규 카드 획득 속도는 서로 다른 설정입니다.',sourceRefs:['order-pack','server-config','pity'],x:85,y:23},
 {id:'collection',label:'수집·완성',detail:'신규는 세트·앨범 진척, 중복은 별 교환·조건부 보정으로 이어집니다. 모든 팩을 단순한 균등 독립 추첨으로 해석하지 않습니다.',sourceRefs:['acquire','recycle','new-card-cap'],x:85,y:77},
 {id:'reward',label:'완성 보상',detail:'세트·전체 앨범·특수 카드·Royal의 조건에 맞는 보상을 처리합니다. 실제 에너지·재화 등 보상 구성과 수량은 서버표가 필요합니다.',sourceRefs:['acquire'],x:50,y:77},
 {id:'replay',label:'다시 플레이',detail:'획득 보상을 퍼즐·이벤트에 사용하거나 다음 수집 회차를 진행합니다. 이 순환은 구조 해석이며 현재 계정의 완성률·소요 시간을 뜻하지 않습니다.',sourceRefs:['upgrade','round-carry'],x:15,y:77}
];

export const BM_CASES={
 missing:{label:'4·5성 카드가 부족할 때',title:'완성에 가까운 세트와 맞춤 상품',stages:['미완성 일반 세트','누락 4·5성 후보·노출 조건','맞춤 카드 상품'],product:'custom-card-offer',note:'후보 중 한 장으로 세트가 완성되는 카드를 우선하는 지급 경로가 있습니다. 전 카드 자유선택 상품은 아닙니다.',sourceRefs:['custom-card-selection','custom-card-popup','custom-card-purchase']},
 duplicates:{label:'중복 별·교환 대기',title:'중복의 사용처와 시간 단축 소비',stages:['잉여 카드·보관 별','필요 별·슬롯 쿨다운 검사','기다리기 또는 젬 스킵'],product:'exchange-skip',note:'대기 단축 비용은 ceil(설정 가격 × 남은 시간 / 전체 쿨다운)입니다. 실제 가격·대기·보상표는 미확보입니다.',sourceRefs:['recycle-condition','recycle','gem-skip','gem-skip-consume']},
 progress:{label:'과제를 완료했을 때',title:'진행은 결제 전부터, 수령 자격은 별도',stages:['미결제 상태도 과제 진행','완료 상태·구매 여부 검사','결제 전/후 보상 자격'],product:'card-progress-pack',note:'종료 회수는 결제자가 완료했으나 받지 않은 과제에 한합니다. 미완료 과제 전체를 지급하는 규칙이 아닙니다.',sourceRefs:['card-progress-config','card-progress-paid','card-progress-recovery']},
 complete:{label:'앨범을 완성했을 때',title:'보상 이후의 재수집 목표',stages:['전체 앨범 완성','남은 별 안내·설정 확인','업그레이드·다음 회차'],product:'completion-upgrade',note:'일반 카드·그 중복은 초기화 대상입니다. 별도 보관 별·팩·조커·Rainbow·활성 Royal은 보존하는 분기가 있어 새 시즌 종료와 구분해야 합니다.',sourceRefs:['upgrade-condition','upgrade-confirm','round-carry']}
};

export function normalizeCollectionVisualState(state={},phaseCount=6){
 return {
  phase:Math.max(0,Math.min(phaseCount-1,Number.isInteger(Number(state.phase))?Number(state.phase):0)),
  flowPath:Object.hasOwn(FLOW_PATHS,state.flowPath)?state.flowPath:'new',
  loopNode:LOOP_NODES.some(n=>n.id===state.loopNode)?state.loopNode:'energy',
  bmCase:Object.hasOwn(BM_CASES,state.bmCase)?state.bmCase:'missing',
  payment:state.payment==='after'?'after':'before',
  resourcePart:['faces','covers','backgrounds','names','shared'].includes(state.resourcePart)?state.resourcePart:'faces'
 };
}

export function renderOperationExplorer(data,state,sourceLinks){
 const analysis=data.collectionStudy.operationalAnalysis,phases=analysis.phases,s=normalizeCollectionVisualState(state,phases.length),phase=phases[s.phase];
 return `<div class="collection-operation-explorer">
 <div class="collection-lifecycle" role="group" aria-label="운영 단계 선택">${phases.map((p,i)=>control('phase',String(i),`${i+1}. ${p.title}`,String(s.phase))).join('')}</div>
 <div class="collection-viz-output${state.vizMotion==='phase'?' is-updated':''}" aria-live="polite" aria-atomic="true"><h3>${e(phase.title)}</h3><p class="collection-viz-position">${s.phase+1} / ${phases.length} 단계</p><div class="collection-perspectives"><div><h4>플레이어가 하는 일</h4><p>${e(phase.player)}</p></div><div><h4>운영에서 조절하는 것</h4><p>${e(phase.control)}</p></div></div></div>
 <div class="collection-viz-navigation">${control('phase',String(Math.max(0,s.phase-1)),'이전 단계','',s.phase===0)}${control('phase',String(Math.min(phases.length-1,s.phase+1)),'다음 단계','',s.phase===phases.length-1)}<span>단계를 직접 눌러 비교할 수 있습니다.</span></div>
 ${sourceLinks(analysis.sourceRefs)}</div>`;
}

export function renderContentFlow(data,state,sourceLinks){
 const s=normalizeCollectionVisualState(state),path=FLOW_PATHS[s.flowPath],isJoker=s.flowPath==='joker';
 return `<section class="collection-section" id="collection-content-flow" aria-labelledby="collection-content-flow-title"><h2 id="collection-content-flow-title" tabindex="-1">콘텐츠 플로우 · 신규와 중복의 갈림길</h2><p>획득 경로를 선택하면 강조된 분기와 설명이 바뀝니다. 카드 추첨이나 보상 지급을 실행하는 화면은 아닙니다.</p>
 <div class="collection-viz-choices" role="group" aria-label="카드 획득 경로 선택">${control('flowPath','new','팩 → 신규',s.flowPath)}${control('flowPath','duplicate','팩 → 중복',s.flowPath)}${control('flowPath','joker','조커 → 획득',s.flowPath)}</div>
 <div class="collection-branch-diagram" role="group" aria-label="팩과 조커는 공통 획득 처리 후 신규 또는 중복으로 판정">
 <div class="collection-branch-row"><div class="collection-diagram-node${!isJoker?' is-active':''}"><strong>팩 개봉</strong><span>성급·가중치·보정·후보 풀</span></div><div class="collection-diagram-node${isJoker?' is-active':''}"><strong>조커 사용</strong><span>종류·보유·대상 제한</span></div></div>
 <svg class="collection-fork" viewBox="0 0 800 50" aria-hidden="true" preserveAspectRatio="none"><path d="M200 0 V20 H600 V0 M400 20 V48"/></svg>
 <div class="collection-diagram-node collection-common-node is-active"><strong>공통 카드 획득 처리</strong><span>카드 보유 상태와 완성 조건 판정</span></div>
 <svg class="collection-fork" viewBox="0 0 800 50" aria-hidden="true" preserveAspectRatio="none"><path d="M400 0 V20 M200 48 V20 H600 V48"/></svg>
 <div class="collection-branch-row"><div class="collection-diagram-node${s.flowPath==='new'||isJoker?' is-active':''}"><strong>신규 카드</strong><span>세트·앨범 진척과 완성 보상</span></div><div class="collection-diagram-node${s.flowPath==='duplicate'||isJoker?' is-active':''}"><strong>중복 카드</strong><span>별 교환·조건부 Rainbow</span></div></div>
 </div><div class="collection-viz-output${state.vizMotion==='flowPath'?' is-updated':''}" aria-live="polite"><h3>${e(path.title)}</h3><p>${e(path.summary)}</p><ol class="collection-path-summary">${path.steps.map(step=>`<li>${e(step)}</li>`).join('')}</ol>${sourceLinks(path.sourceRefs)}</div></section>`;
}

export function renderLoopExplorer(data,state,sourceLinks){
 const s=normalizeCollectionVisualState(state),index=LOOP_NODES.findIndex(n=>n.id===s.loopNode),selected=LOOP_NODES[index];
 const paths=['M150 92 H370','M500 92 H720','M850 92 V250','M850 308 H630','M500 308 H280','M150 308 V150'];
 return `<div class="collection-loop-explorer"><div class="collection-loop-diagram" role="group" aria-label="에너지부터 다시 플레이까지 순환 구조. 각 단계 버튼으로 설명 확인">
 <svg viewBox="0 0 1000 400" aria-hidden="true" preserveAspectRatio="none"><defs><marker id="collection-loop-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z"/></marker></defs>${paths.map((path,i)=>`<path class="collection-loop-edge${i===index?' is-active':''}" d="${path}" marker-end="url(#collection-loop-arrow)"/>`).join('')}</svg>
 ${LOOP_NODES.map((node,i)=>`<button type="button" data-collection-viz="loopNode" data-value="${node.id}" aria-pressed="${s.loopNode===node.id}" style="--node-x:${node.x}%;--node-y:${node.y}%"><span>${i+1}</span><strong>${e(node.label)}</strong></button>`).join('')}</div>
 <div class="collection-viz-output${state.vizMotion==='loopNode'?' is-updated':''}" aria-live="polite"><h3>${index+1}. ${e(selected.label)}</h3><p>${e(selected.detail)}</p>${sourceLinks(selected.sourceRefs)}${control('loopNode',LOOP_NODES[(index+1)%LOOP_NODES.length].id,'다음 연결 보기','')}</div></div>`;
}

export function collectionResourceParts(study){
 const count=id=>list(study.resourceAssets).filter(a=>a.scope==='album'&&a.groupId===id).length;
 const core=[{id:'faces',title:'카드 앞면',quantity:count('card-faces'),note:'두 테마의 카드 원화입니다. 시즌별 세트 수와 세트당 카드 수가 제작량을 결정합니다.'},{id:'covers',title:'세트 표지',quantity:count('set-covers'),note:'세트 목록에서 수집 주제와 가까운 목표를 보여주는 표지입니다.'},{id:'backgrounds',title:'세트 배경',quantity:count('set-backgrounds'),note:'세트 수와 배경 수가 다릅니다. 세트마다 독립 배경 한 장으로 계산하지 않습니다.'},{id:'names',title:'이름판·배경',quantity:count('card-nameplates'),note:'카드 그림과 분리해 제목·이름을 표시하는 부품입니다.'}];
 const total=list(study.resourceAssets).filter(a=>a.scope==='album'&&a.kind==='image').length;
 return [...core,{id:'shared',title:'공용·기능 이미지',quantity:total-core.reduce((sum,p)=>sum+p.quantity,0),note:'팩·조커·HUD·특수 프레임·테마 UI입니다. 원화·효과·프리팹·음향은 서로 다른 단위로 관리합니다.'}];
}

export function renderResourceChart(data,state){
 const parts=collectionResourceParts(data.collectionStudy),s=normalizeCollectionVisualState(state),selected=parts.find(p=>p.id===s.resourcePart),total=parts.reduce((sum,p)=>sum+p.quantity,0);
 return `<div class="collection-resource-chart"><p>확보한 앨범 이미지 <strong>${total}개 등록 키</strong>의 구성입니다. 항목을 눌러 제작 단위를 확인하세요.</p><div class="collection-stacked-bar" role="img" aria-label="${e(parts.map(p=>p.title+' '+p.quantity+'개').join(', '))}">${parts.map((p,i)=>`<span class="collection-part-${i}${p.id===selected.id?' is-active':''}" style="flex-grow:${p.quantity}" title="${e(p.title)} ${p.quantity}개"></span>`).join('')}</div><div class="collection-chart-legend" role="group" aria-label="이미지 구성 항목 선택">${parts.map((p,i)=>`<button type="button" data-collection-viz="resourcePart" data-value="${p.id}" aria-pressed="${p.id===selected.id}"><i class="collection-part-${i}" aria-hidden="true"></i><span>${e(p.title)}</span><strong>${p.quantity}</strong></button>`).join('')}</div><div class="collection-viz-output${state.vizMotion==='resourcePart'?' is-updated':''}" aria-live="polite"><h3>${e(selected.title)} · ${selected.quantity}개</h3><p>${e(selected.note)}</p></div></div>`;
}

export function renderBMExplorer(data,state,sourceLinks){
 const s=normalizeCollectionVisualState(state),selected=BM_CASES[s.bmCase],product=list(data.collectionStudy.systems[0].monetization).find(m=>m.id===selected.product);
 return `<div class="collection-bm-explorer"><p>플레이어의 상황을 골라 상품·교환·반복 참여가 연결되는 조건을 비교합니다. 정적 규칙과 운영 해석을 설명하는 구조도입니다.</p><div class="collection-viz-choices" role="group" aria-label="BM 연결 상황 선택">${Object.entries(BM_CASES).map(([id,row])=>control('bmCase',id,row.label,s.bmCase)).join('')}</div>
 <div class="collection-viz-output${['bmCase','payment'].includes(state.vizMotion)?' is-updated':''}" aria-live="polite"><h3>${e(selected.title)}</h3><ol class="collection-bm-path">${selected.stages.map((stage,i)=>`<li><span>${['플레이어 상태','조건·중재','연결되는 행동'][i]}</span><strong>${e(stage)}</strong></li>`).join('')}</ol>
 ${s.bmCase==='progress'?`<div class="collection-payment-compare" role="group" aria-label="카드 진행 팩 결제 전후 비교">${control('payment','before','결제 전 보기',s.payment)}${control('payment','after','결제 후 보기',s.payment)}<p>${s.payment==='before'?'과제 진척과 완료 상태는 쌓이지만 유료 완료 보상의 수령 자격은 열리지 않습니다.':'완료 과제의 보상을 수령할 수 있습니다. 아직 완료하지 않은 과제를 자동 완성하지는 않습니다.'}</p></div>`:''}
 <p>${e(selected.note)}</p>${product?`<dl class="collection-bm-explanation"><div><dt>진입·평가 조건</dt><dd>${e(product.trigger)}</dd></div><div><dt>미확보 운영값</dt><dd>${e(product.operationalValues)}</dd></div></dl>`:''}${sourceLinks(selected.sourceRefs)}</div><p class="collection-method-note">조건을 만족해도 전역 팝업 우선순위·허용 상태를 통과해야 합니다. 실제 결제·보상 지급·현재 계정의 활성 상품을 실행하거나 검증하는 도구는 아닙니다.</p></div>`;
}
