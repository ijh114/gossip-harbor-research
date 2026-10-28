import {DOMAIN_DEFS,domainStats,selectDomainFacts,baseMergeUnits} from './domain-model.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={code:'코드 확인',config:'내장 설정',text:'설명문',inference:'분석 추론'};
const list=v=>Array.isArray(v)?v:v?[v]:[];
const badge=(kind,text)=>`<span class="badge ${escape(kind)}">${escape(text||labels[kind]||kind)}</span>`;
const sourceButton=id=>`<button class="source-button" data-evidence="${escape(id)}">근거 보기 ↗</button>`;
function sourceLinks(ids,facts){return list(ids).filter(id=>facts.some(f=>f.id===id)).map(id=>`<button class="source-chip mono" data-evidence="${escape(id)}">${escape(id)} ↗</button>`).join('');}
function renderTable(visual){
 return `<div class="table-wrap"><table class="domain-table"><caption class="sr-only">${escape(visual.title)}</caption><thead><tr>${visual.columns.map(c=>`<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${visual.rows.map(row=>`<tr>${row.map(cell=>`<td>${escape(typeof cell==='object'?JSON.stringify(cell):cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderFlow(visual){
 return `<ol class="domain-flow">${visual.steps.map((step,i)=>`<li><span class="flow-index mono">${String(i+1).padStart(2,'0')}</span><strong>${escape(typeof step==='string'?step:step.title)}</strong>${step.detail?`<p>${escape(step.detail)}</p>`:''}</li>`).join('')}</ol>`;
}
function renderTiming(visual){
 const max=Math.max(...visual.lanes.map(l=>Number(l.end)||0),1);
 return `<div class="timing-chart" role="img" aria-label="${escape(visual.title)} 코드 시간표">${visual.lanes.map(l=>`<div class="timing-row"><span>${escape(l.label)}</span><div class="timing-track"><span class="timing-bar" style="margin-left:${Math.max(0,Math.min(100,100*l.start/max))}%;width:${Math.max(1,Math.min(100,100*(l.end-l.start)/max))}%"></span></div><span class="mono">${escape(l.start)}–${escape(l.end)}s</span></div>`).join('')}</div>`;
}
function renderBars(visual){
 const max=Math.max(...visual.rows.map(r=>Number(r[1])||0),1);
 return `<div class="domain-bars">${visual.rows.map(r=>`<div class="domain-bar-row"><span>${escape(r[0])}</span><span class="domain-bar-track"><i style="width:${Math.max(1,100*r[1]/max)}%"></i></span><strong class="mono">${escape(r[1])}</strong></div>`).join('')}</div>`;
}
function renderBoard(visual){
 return `<div class="initial-board-layout"><div class="initial-board" style="--board-cols:${visual.width}" role="group" aria-label="${visual.width}열 ${visual.height}행 내장 초기 보드">${visual.cells.map((cell,i)=>`<button class="initial-cell ${cell.locked?'sealed':'open'}" data-initial-cell="${i}" aria-label="${i+1}번 초기 칸, ${escape(cell.raw)}, ${cell.locked?'봉인':'기본 아이템'}"><span class="mono">${i+1}</span><strong>${cell.locked?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="9" width="16" height="12" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3m-4 5v3"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>'}</strong><small>${escape(cell.raw)}</small></button>`).join('')}</div><aside><h3>${visual.width} × ${visual.height} · ${visual.cells.length}칸</h3><p>${escape(visual.note)}</p><div id="initial-cell-detail" class="initial-cell-detail" role="status">보드 칸을 선택하면 저장된 원문과 해석을 볼 수 있습니다.</div><p class="control-hint">기존 시뮬레이터의 6×5 보드는 독립 설계 실험입니다. 이 그림은 내장 초기 표를 읽은 정적 구조도입니다.</p></aside></div>`;
}
export function renderStoryDay(day,data){
 const model=data.domainAnalysis.models.mapProgression;
 const row=model.days.find(d=>d.day===Number(day));if(!row)return '';
 return `<div class="story-day-metrics"><div><span>스토리 day</span><strong>${row.day}</strong></div><div><span>영역 ID</span><strong>${escape(row.area)}</strong></div><div><span>과제 수</span><strong>${row.task_count}</strong></div><div><span>기본 골드 합</span><strong>${row.base_gold_cost.toLocaleString('ko-KR')}</strong></div></div><p class="table-note">스토리 순번이며 실제 플레이 일수가 아닙니다. 해당 day의 내장 기본 비용 합계로, 서버 보정 후 유저가 지불하는 실제 비용·수익·소요 시간을 뜻하지 않습니다.</p>`;
}
function renderDayBrowser(visual,data){
 const model=data.domainAnalysis.models.mapProgression;
 return `<div class="story-day-controls"><label for="story-day">스토리 순번 선택 <select id="story-day" data-story-day>${model.days.map(d=>`<option value="${d.day}">day ${d.day} · area ${d.area}</option>`).join('')}</select></label><div id="story-day-output" aria-live="polite">${renderStoryDay(1,data)}</div></div>`;
}
function renderAreaGrid(visual){
 return `<div class="area-grid" role="list" aria-label="기본 퀘스트표의 영역별 구조">${visual.areas.map(area=>`<div role="listitem"><span class="mono">AREA ${area.area_id}</span><strong>${area.task_count}<small>개 과제</small></strong><p>day ${area.day_min}–${area.day_max}</p><span>${area.base_gold_cost.toLocaleString('ko-KR')} 기본 골드</span></div>`).join('')}</div>`;
}
function renderVisual(visual,facts){
 const renderers={table:renderTable,flow:renderFlow,timing:renderTiming,bars:renderBars,board:renderBoard,'area-grid':renderAreaGrid};
 const content=renderers[visual.type]?.(visual)||'';
 return `<section class="domain-visual panel"><div class="panel-head"><div><h2>${escape(visual.title)}</h2></div>${badge(visual.kind||'code')}</div><div class="panel-body">${visual.description?`<p class="visual-description">${escape(visual.description)}</p>`:''}${content}${visual.note&&visual.type!=='board'?`<p class="table-note">${escape(visual.note)}</p>`:''}<div class="visual-sources">${sourceLinks(visual.sourceIds,facts)}</div></div></section>`;
}
export function renderMergeOutput(level){
 const n=baseMergeUnits(level);
 return `<strong>${n.toLocaleString('ko-KR')}<small>개</small></strong><p>레벨 ${level} 1개를 만들기 위한 레벨1 아이템의 최소 수</p><code>2^(${level} − 1) = ${n}</code>`;
}
function mergeExperiment(){
 return `<section class="domain-experiment panel"><div class="panel-head"><div><h2>합성 깊이가 만드는 작업량</h2></div>${badge('inference','산술 모델')}</div><div class="panel-body merge-math"><div><label for="merge-depth">목표 아이템 레벨</label><input id="merge-depth" type="range" min="1" max="13" value="8" step="1" data-merge-level><div class="range-labels mono"><span>Lv1</span><span>Lv7</span><span>Lv13</span></div><p>동일 아이템 2개가 다음 레벨 1개가 되고, 레벨1만 공급된다는 가정입니다. 생성기의 상위 레벨 드롭·보상·상점·부스터를 포함하지 않습니다.</p></div><div id="merge-output" class="merge-math-output" aria-live="polite">${renderMergeOutput(8)}</div></div></section>`;
}
function factArticle(fact){
 return `<article class="domain-finding" id="finding-${escape(fact.id)}"><div class="domain-finding-header"><span class="mono finding-id">${escape(fact.id)}</span>${badge(fact.kind)}${sourceButton(fact.id)}<button class="source-button" data-share-finding="${escape(fact.id)}" aria-label="${escape(fact.title)} 공유 링크 복사">링크 복사</button></div><h3>${escape(fact.title)}</h3><p class="finding-summary">${escape(fact.summary)}</p>${list(fact.details).length?`<details class="finding-detail"><summary>분석 상세 ${fact.details.length}개 항목</summary><ul class="details-list">${fact.details.map(d=>`<li>${escape(typeof d==='string'?d:JSON.stringify(d))}</li>`).join('')}</ul></details>`:''}${list(fact.unknowns).length?`<details class="finding-unknowns"><summary>확인 경계 · 미확인 ${fact.unknowns.length}건</summary><ul>${fact.unknowns.map(u=>`<li>${escape(u)}</li>`).join('')}</ul></details>`:''}<div class="row-meta">${new Set(list(fact.sources).map(s=>s.path)).size}개 파일 · ${list(fact.sources).length}개 원문 위치</div></article>`;
}
export function renderDomainPage(id,data,filters={}){
 const def=DOMAIN_DEFS.find(d=>d.id===id);if(!def)return '';
 const page=data.domainAnalysis?.pages?.[id]||{};
 const stats=domainStats(data.facts,id), facts=selectDomainFacts(data.facts,id,{query:filters.query,kind:filters.kind});
 const all=selectDomainFacts(data.facts,id);
 return `<div class="page-intro"><div><h1>${escape(def.title)}</h1><p class="domain-subtitle">${escape(def.subtitle)}</p><p>${escape(def.intro)}</p></div><button class="button" data-download-domain="${id}">이 페이지 JSON ↓</button></div>
 <div class="domain-breadcrumbs"><a href="#overview">연구 개요</a><span>/</span><span>${escape(def.title)}</span><span class="mono domain-count">${stats.total} FINDINGS / ${stats.sources} FILES</span></div>
 <div class="domain-summary-grid">${def.questions.map((q,i)=>`<div><h3>${escape(q)}</h3><p>${escape((page.answers||[])[i]||'아래 정적 근거와 남은 질문을 함께 확인하세요.')}</p></div>`).join('')}</div>
 <div class="domain-boundary"><strong>근거 범위</strong><span>제공 패키지 4.10.5 · ${stats.code}개 코드 / ${stats.config}개 설정 / ${stats.text}개 설명문 / ${stats.inference}개 추론. 실제 플레이·프레임 캡처·현행 서버 배정은 미관측.</span></div>
 ${page.sections?.length?`<nav class="chapter-jumps" aria-label="이 페이지 분석 항목">${page.sections.map(s=>`<a href="#${id}?section=${encodeURIComponent(s.id)}" data-domain-jump="${escape(s.id)}">${escape(s.title)} <span>↓</span></a>`).join('')}</nav>`:''}
 ${id==='difficulty'?mergeExperiment():''}
 <div class="domain-visuals">${list(page.visuals).map(v=>v.type==='day-browser'?`<section class="domain-visual panel"><div class="panel-head"><h2>${escape(v.title)}</h2>${badge('config')}</div><div class="panel-body">${renderDayBrowser(v,data)}<div class="visual-sources">${sourceLinks(v.sourceIds,data.facts)}</div></div></section>`:renderVisual(v,data.facts)).join('')}</div>

 <section class="domain-ledger"><div class="section-heading"><h2>규칙과 근거</h2><span>${facts.length} / ${all.length} FINDINGS</span></div><div class="domain-filter" role="group" aria-label="분석 근거 유형">${[['all','전체'],...Object.entries(labels)].map(([kind,label])=>`<button class="button small ${filters.kind===kind||(!filters.kind&&kind==='all')?'primary':''}" data-domain-kind="${kind}" aria-pressed="${filters.kind===kind||(!filters.kind&&kind==='all')}">${label}</button>`).join('')}</div>
 ${page.sections?.length?page.sections.map(section=>{const rows=facts.filter(f=>section.factIds.includes(f.id));return rows.length?`<section class="domain-section" id="section-${escape(section.id)}"><div class="domain-section-title"><span class="mono">${escape(section.id.toUpperCase())}</span><h2>${escape(section.title)}</h2></div>${section.intro?`<p class="section-description">${escape(section.intro)}</p>`:''}<div class="domain-findings">${rows.map(factArticle).join('')}</div></section>`:'';}).join(''):`<div class="domain-findings">${facts.map(factArticle).join('')}</div>`}
 ${facts.length?'':`<div class="empty-state"><h3>조건에 맞는 분석 항목이 없습니다</h3><p>검색어 또는 근거 유형을 바꿔보세요.</p><button class="button" data-action="clear-filters">검색 초기화</button></div>`}</section>
 ${page.next?.length?`<section class="domain-next"><div class="section-heading"><h2>다음 관측에서 확인할 것</h2><span>STATIC → RUNTIME</span></div>${page.next.map((item,i)=>`<article><span class="mono">${String(i+1).padStart(2,'0')}</span><div><h3>${escape(typeof item==='string'?item:item.title)}</h3>${item.detail?`<p>${escape(item.detail)}</p>`:''}</div></article>`).join('')}</section>`:''}
 <div class="section-heading"><h2>다른 시스템과 연결하기</h2><span>RELATED CHAPTERS</span></div><div class="related-chapters">${def.related.map(key=>{const d=DOMAIN_DEFS.find(x=>x.id===key);return `<a href="#${key}"><strong>${d.title}<span>↗</span></strong><p>${d.subtitle}</p></a>`;}).join('')}</div>`;
}
export function renderDomainIndex(data){
 return `<section class="domain-index"><div class="section-heading"><h2>시스템별 분석 페이지</h2><span>10 CHAPTERS</span></div><div class="domain-index-grid">${DOMAIN_DEFS.map(d=>{const stats=domainStats(data.facts,d.id);return `<a class="domain-index-card" href="#${d.id}"><div><span class="mono">${d.number} / ${d.short}</span><span>↗</span></div><h3>${d.title}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></h3><p>${d.subtitle}</p><small>${stats.total}개 분석 · ${stats.sources}개 출처 파일</small></a>`;}).join('')}</div></section>`;
}
export function describeInitialCell(index,data){
 const board=data.domainAnalysis?.pages?.mechanics?.visuals?.find(v=>v.type==='board');
 const cell=board?.cells?.[index];if(!cell)return '';
 return `<strong>${index+1}번 칸 · (${escape(cell.x??index%board.width)}, ${escape(cell.y??Math.floor(index/board.width))})</strong><code>${escape(cell.raw)} · ${escape(cell.symbol||cell.itemType||'')}</code><p>${escape(cell.description||(cell.locked?'봉인/래핑 상태로 저장된 초기 항목':'일반 아이템 초기 항목'))}</p><small>이동 가능: ${cell.canMoveAtSeed?'예':'아니요'} · 합성 가능: ${cell.canMergeAtSeed?'예':'아니요'}<br>초기 DB 생성용 표입니다. 튜토리얼 후 현재 플레이 보드가 아닙니다.</small>`;
}
