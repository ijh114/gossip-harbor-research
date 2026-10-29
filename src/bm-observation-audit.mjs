// Read-only evidence projection. No original-game runtime, server, payment or ad calls.
import {validMedia} from './visual-model.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const labels={'observed-scoped':'구간 한정 관측',partial:'부분 관측', 'static-only':'정적 경로만',unconfirmed:'독립 근거 없음'};
const counts=rows=>Object.fromEntries(Object.keys(labels).map(status=>[status,rows.filter(row=>row.status===status).length]));
const timestamp=seconds=>seconds==null?'정지 표본':`${Math.floor(seconds/60)}:${(seconds%60).toFixed(2).padStart(5,'0')}`;
const range=value=>value?`${timestamp(value.startSeconds)}–${timestamp(value.endSeconds)}`:'정지 표본';
const payload=data=>data?.bmObservationAudit??data;
const normalize=filters=>({question:filters?.question??filters?.questionId??'all',type:filters?.type??filters?.typeId??'all',status:filters?.status??'all',query:String(filters?.query??'')});
const indexOf=(items,key='id')=>new Map((items??[]).map(item=>[item[key],item]));

export function selectBMObservationRows(data,filters={}){
 const audit=payload(data);if(!audit?.rows)return [];
 const selected=normalize(filters),query=selected.query.trim().toLocaleLowerCase(),observations=indexOf(audit.observations),types=indexOf(audit.types),questions=indexOf(audit.questions),points=indexOf(audit.contextPoints);
 return audit.rows.filter(row=>{
  if(selected.question!=='all'&&row.questionId!==selected.question)return false;
  if(selected.type!=='all'&&row.typeId!==selected.type)return false;
  if(selected.status!=='all'&&row.status!==selected.status)return false;
  if(!query)return true;
  const evidence=(row.observationIds??[]).map(id=>observations.get(id)).filter(Boolean);
  const context=(row.contextPointIds??[]).map(id=>points.get(id)).filter(Boolean);
  return [row.answer,row.typeId,types.get(row.typeId)?.title,questions.get(row.questionId)?.label,
   ...evidence.flatMap(item=>[item.id,item.sourceId,item.claim,...(item.unknowns??[])]),
   ...context.map(point=>point.sourceId)].join(' ').toLocaleLowerCase().includes(query);
 });
}

export function summarizeBMObservationAudit(data,filters={}){
 const audit=payload(data),rows=selectBMObservationRows(audit,filters),ids=new Set(rows.flatMap(row=>row.observationIds??[]));
 return {visibleCells:rows.length,totalCells:audit?.rows?.length??0,uniqueObservations:ids.size,
  ...counts(rows),newRuntimeObservations:audit?.summary?.newOriginalRuntimeObservations??0};
}

// Scoped styles use the incumbent forest-green/Pretendard tokens. No new fonts or motion.
export const BM_OBSERVATION_AUDIT_STYLES=`
.bm-observation-audit{color:var(--ink,#202e2b);font-family:var(--font,Pretendard,sans-serif);min-width:0}
.bm-observation-audit p,.bm-observation-audit li{line-height:1.85}.bm-observation-audit header>p,.bm-observation-audit .bm-audit-prose{max-width:68ch}
.bm-observation-audit .bm-audit-filters{display:flex;flex-wrap:wrap;gap:16px;margin:24px 0}.bm-observation-audit label{display:grid;gap:8px;font-size:.875rem;flex:1 1 180px;min-width:0}
.bm-observation-audit select,.bm-observation-audit input{min-height:44px;width:100%;max-width:100%;padding:8px 12px;border:1px solid var(--line,#d7ded8);border-radius:8px;background:var(--surface,#fff);color:var(--ink,#202e2b);font:inherit;caret-color:var(--teal,#18564c)}
.bm-observation-audit select:focus-visible,.bm-observation-audit input:focus-visible,.bm-observation-audit summary:focus-visible{outline:3px solid var(--focus,#a74726);outline-offset:3px}
.bm-observation-audit .bm-audit-summary{padding-block:16px;border-block:1px solid var(--line,#d7ded8);margin-bottom:24px}.bm-observation-audit .bm-audit-summary p{margin:0 0 8px}
.bm-observation-audit .table-wrap{overflow:auto;max-width:100%;scrollbar-color:#879b8f var(--paper,#f7f8f5)}.bm-observation-audit table{border-collapse:collapse;width:100%;min-width:700px}.bm-observation-audit caption{text-align:left;font-weight:650;padding:12px 0}
.bm-observation-audit th,.bm-observation-audit td{vertical-align:top;text-align:left}.bm-observation-audit tbody th{font-size:.9375rem;font-weight:600;background:var(--surface,#fff);padding:18px 16px;border-bottom:1px solid var(--line,#d7ded8)}.bm-observation-audit td{border-bottom:1px solid var(--line,#d7ded8)}
.bm-observation-audit .bm-audit-status{font-size:.875rem;white-space:nowrap;color:var(--teal,#18564c)}.bm-observation-audit .bm-audit-status[data-status=partial],.bm-observation-audit .bm-audit-status[data-status=unconfirmed]{color:var(--coral,#98452d)}
.bm-observation-audit .bm-audit-ledger>section{padding-block:24px;border-bottom:1px solid var(--line,#d7ded8)}.bm-observation-audit h2{font-size:1.375rem;margin:32px 0 16px}.bm-observation-audit h3{font-size:1.125rem;margin:0 0 12px}.bm-observation-audit h4{font-size:1rem;margin:20px 0 8px}
.bm-observation-audit summary{cursor:pointer;min-height:44px;line-height:1.7;padding-block:10px}.bm-observation-audit details p,.bm-observation-audit details li{font-size:.9375rem}.bm-observation-audit code{overflow-wrap:anywhere;font-size:.8125rem}.bm-observation-audit .bm-audit-source code{display:block;margin-block:6px}
.bm-observation-audit .bm-audit-evidence{padding-block:12px;border-top:1px solid var(--line,#d7ded8)}.bm-observation-audit .bm-audit-media{display:flex;flex-wrap:wrap;gap:12px;margin-block:16px}.bm-observation-audit .bm-audit-media .timeline-preview{max-width:180px}.bm-observation-audit .timeline-preview img{height:250px;object-fit:contain}.bm-observation-audit a{text-underline-offset:.18em}
@media(max-width:600px){.bm-observation-audit .bm-audit-filters{gap:12px}.bm-observation-audit label{flex-basis:100%}.bm-observation-audit .bm-audit-media .timeline-preview{width:calc(50% - 6px)}.bm-observation-audit .timeline-preview img{height:210px}}
`;

function mediaButton(audit,key){
 const media=audit.mediaEntries?.find(item=>item.key===key);if(!validMedia(media)||media.kind==='gif')return '';
 return `<button type="button" class="timeline-preview" data-media-key="${escape(key)}" aria-label="${escape(media.alt)} ${media.kind==='video'?'재생':'확대'}"><img src="${escape(media.kind==='video'?media.poster:media.src)}" alt="${escape(media.alt)}" width="${Number(media.width)||360}" height="${Number(media.height)||720}" loading="lazy"><span>${media.kind==='video'?'짧은 무음 영상 재생':'근거 프레임 확대'}</span></button>`;
}

function observationHtml(audit,item){
 const ownMedia=(item.mediaKeys??[]).filter(key=>audit.mediaEntries?.some(entry=>entry.key===key)),existing=(item.mediaKeys??[]).filter(key=>!ownMedia.includes(key));
 return `<article class="bm-audit-evidence"><h4>${escape(item.sourceId)} · ${escape(range(item.sourceRange))}</h4><p>${escape(item.claim)}</p><p>근거 유형: 과거 원본 캡처 · 자동 호출/동일 SKU 미확인 · 실행 버전/촬영일 미확인</p><div class="bm-audit-media">${ownMedia.map(key=>mediaButton(audit,key)).join('')}</div>${existing.length?`<p>기존 타임라인 미디어 키: ${existing.map(key=>`<code>${escape(key)}</code>`).join(' · ')}. 해당 구간의 공개 선정본을 <a href="#bm-timeline">기존 타임라인</a>에서 비교합니다.</p>`:''}<details class="bm-audit-source"><summary>원본 식별·시각·미확정 범위</summary><p>${escape(item.sourceId)} · ${escape(range(item.sourceRange))}</p><code>원본 SHA-256 ${escape(item.originalSha256)}</code><p>이 관측은 ‘${escape(audit.questions.find(q=>q.id===item.questionId)?.label)}’ 한 질문에만 배정했습니다. 입력 이벤트는 확인하지 않았습니다.</p><ul>${(item.unknowns??[]).map(value=>`<li>${escape(value)}</li>`).join('')}</ul></details></article>`;
}

function staticHtml(audit,row){
 const own=(row.staticAnchorIds??[]).map(id=>audit.staticAnchors.find(item=>item.id===id)).filter(Boolean),generic=(row.generalStaticAnchorIds??[]).map(id=>audit.staticAnchors.find(item=>item.id===id)).filter(Boolean);
 const source=item=>`<li><code>${escape(item.path)}:${item.line_start}–${item.line_end}</code><code>SHA-256 ${escape(item.sha256)}</code><p>${escape(item.interpretation)}</p></li>`;
 return `<details class="bm-audit-source"><summary>정적 비교·판정 한계</summary><p>근거 유형: APK 4.10.5 복원 코드. 캡처 실행 버전과 같은 객체라는 증거는 아닙니다.</p><p>${escape(audit.questions.find(q=>q.id===row.questionId)?.codeOnly)}</p>${own.length?`<h4>이 질문에 관련된 정적 앵커</h4><p>${row.specificModelIdentified?'구조를 비교한 앵커입니다. 캡처의 동일 SKU/설정을 식별한 것은 아닙니다.':'일반 경로를 비교한 앵커이며 이 캡처의 특정 상품/활동 모델로 확정하지 않았습니다.'}</p><ul>${own.map(source).join('')}</ul>`:'<p>이 유형의 이 질문에 직접 연결한 정적 경로도 없습니다. 다른 질문의 구매·보상 코드를 최초/만료 조건으로 다시 쓰지 않습니다.</p>'}${generic.length?`<h4>공통 경로의 참고 앵커</h4><p>다른 상품에도 쓰일 수 있는 공통 조건입니다. 이 캡처에 적용되었다고 가정하지 않으며 이 앵커만으로 근거 상태를 올리지 않습니다.</p><ul>${generic.map(source).join('')}</ul>`:''}<h4>남은 확인</h4><ul>${(row.unknowns??[]).map(value=>`<li>${escape(value)}</li>`).join('')}</ul></details>`;
}

export function renderBMObservationAudit(data,filters={}){
 const audit=payload(data);if(!audit?.rows?.length)return '<section class="bm-observation-audit"><h1>BM 관측과 코드 조건 대조</h1><p>연결된 BM 관측 자료가 없습니다.</p></section>';
 const selected=normalize(filters),rows=selectBMObservationRows(audit,selected),summary=summarizeBMObservationAudit(audit,selected),types=indexOf(audit.types),questions=indexOf(audit.questions),observations=indexOf(audit.observations);
 const options=(items,current,all)=>`<option value="all">${all}</option>${items.map(item=>`<option value="${escape(item.id)}"${item.id===current?' selected':''}>${escape(item.label)}</option>`).join('')}`;
 return `<style>${BM_OBSERVATION_AUDIT_STYLES}</style><section class="bm-observation-audit"><header class="studio-intro"><h1>BM 관측과 코드 조건 대조</h1><p>최초 등장·닫기·재등장·구매 흐름 후·만료·경쟁 노출을 질문별로 나눕니다. ${audit.summary.contextPointCount}개 기존 표본은 맥락이며 완료 건수로 세지 않습니다.</p></header>
 <div class="domain-boundary"><strong>확인된 범위</strong><p>같은 파일의 상품→맵→상품 UI 재등장은 레벨 상품과 특선 카드에서 확인했습니다. 자동 재노출·동일 SKU·노출 원인·빈도·계정 배정은 미확인입니다. 신규 원작 실행 성공 근거는 ${audit.summary.newOriginalRuntimeObservations}건입니다.</p><p>타이머 감소는 만료가 아니며, ×8과 할인 버블의 동시 표시는 경쟁 팝업 우선순위 검증이 아닙니다.</p></div>
 <form class="bm-audit-filters" aria-label="BM 관측 근거 필터" data-bm-audit-filters><label>질문<select data-bm-audit-question>${options(audit.questions,selected.question,'전체 질문')}</select></label><label>BM 유형<select data-bm-audit-type>${options(audit.types,selected.type,'전체 유형')}</select></label><label>근거 상태<select data-bm-audit-status>${options(Object.entries(labels).map(([id,label])=>({id,label})),selected.status,'전체 근거 상태')}</select></label><label>유형·원본·관측 검색<input type="search" data-bm-audit-query value="${escape(selected.query)}" placeholder="예: GH-V0121, 만료"></label></form>
 <div class="bm-audit-summary"><p role="status" aria-live="polite">${summary.visibleCells} / ${summary.totalCells}개 질문·유형 조합 표시 · 고유 관측 ${summary.uniqueObservations}개</p><p>구간 한정 관측 ${summary['observed-scoped']} · 부분 관측 ${summary.partial} · 정적 경로만 ${summary['static-only']} · 독립 근거 없음 ${summary.unconfirmed}</p><p>관측 수는 노출 빈도·계정 수·결제 횟수·검증 완료율이 아닙니다.</p></div>
 ${rows.length?`<div class="table-wrap" role="region" aria-label="BM 질문별 근거 매트릭스" tabindex="0"><table><caption>질문별로 실제 관측과 정적 경로를 구분한 표</caption><thead><tr><th scope="col">BM 유형</th><th scope="col">질문</th><th scope="col">근거 상태</th><th scope="col">확인된 답과 한계</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${escape(types.get(row.typeId)?.label)}</th><td>${escape(questions.get(row.questionId)?.label)}</td><td><span class="bm-audit-status" data-status="${escape(row.status)}">${escape(labels[row.status])}</span></td><td><a href="#bm-audit-${escape(row.id)}" data-bm-audit-jump="${escape(row.id)}">${escape(row.answer)}</a></td></tr>`).join('')}</tbody></table></div><div class="bm-audit-ledger"><h2>표시된 질문의 근거 읽기</h2>${rows.map(row=>`<section id="bm-audit-${escape(row.id)}" aria-label="${escape(types.get(row.typeId)?.label)} ${escape(questions.get(row.questionId)?.label)} 근거"><h3>${escape(types.get(row.typeId)?.label)} · ${escape(questions.get(row.questionId)?.label)}</h3><p class="bm-audit-prose">${escape(row.answer)}</p><p class="bm-audit-status" data-status="${escape(row.status)}">${escape(labels[row.status])} · 전체 생명주기 완료 아님</p>${(row.observationIds??[]).map(id=>observations.get(id)).filter(Boolean).map(item=>observationHtml(audit,item)).join('')}${staticHtml(audit,row)}</section>`).join('')}</div>`:'<div class="empty-state"><h2>조건에 맞는 항목이 없습니다</h2><p>검색어를 지우거나 질문·유형·근거 상태를 전체로 바꿔 보세요.</p></div>'}
 <details><summary>원작·연구 예제와 전체 검토 범위</summary><p>${escape(audit.evidencePolicy.researchExamples)}</p><p>${escape(audit.reusedReviewContext.interpretation)}</p><p>이전 실기: ${escape(audit.historicalRuntime.result)}</p><ul>${audit.boundaries.map(value=>`<li>${escape(value)}</li>`).join('')}</ul></details><details class="bm-audit-source"><summary>공개 투영의 입력 파일과 SHA-256</summary><p>입력 JSON은 Git의 UTF-8/LF 기준 SHA입니다. 당시 로컬 줄바꿈 기준 해시는 JSON의 localWorkingCopySha256에 보존합니다. 원본 영상·복원 Lua SHA는 바이트 그대로 유지합니다.</p><ul>${audit.inputRefs.map(ref=>`<li><code>${escape(ref.path)}</code><code>${escape(ref.sha256)}</code></li>`).join('')}</ul></details><div class="quick-links"><a class="button" href="#bm-timeline">기존 42개 관측점 비교</a><a class="button" href="#bm-validation">서버값 대신 연구 입력으로 조건 실험</a></div></section>`;
}

// Optional standalone wiring for insertion into an existing wiki container.
// Media buttons retain the host's existing delegated data-media-key contract.
export function mountBMObservationAudit(container,data,initialFilters={}){
 if(!container?.addEventListener)throw new TypeError('An audit container is required.');
 let filters=normalize(initialFilters);
 const attributes={'data-bm-audit-question':'question','data-bm-audit-type':'type','data-bm-audit-status':'status','data-bm-audit-query':'query'};
 const render=()=>{container.innerHTML=renderBMObservationAudit(data,filters);};
 const update=event=>{
  const target=event.target,attribute=Object.keys(attributes).find(name=>target?.hasAttribute?.(name));if(!attribute)return;
  if(event.type==='input'&&attributes[attribute]!=='query')return;
  const active=container.ownerDocument.activeElement===target,start=target.selectionStart,end=target.selectionEnd;
  filters={...filters,[attributes[attribute]]:target.value};render();
  if(active){const next=container.querySelector(`[${attribute}]`);next?.focus();if(attributes[attribute]==='query'&&typeof next?.setSelectionRange==='function'&&start!=null){try{next.setSelectionRange(start,end);}catch{/* Search controls may not support selection ranges. */}}}
 };
 const submit=event=>{if(event.target?.matches?.('[data-bm-audit-filters]'))event.preventDefault();};
 const jump=event=>{const link=event.target?.closest?.('[data-bm-audit-jump]');if(!link||!container.contains(link))return;event.preventDefault();const id='bm-audit-'+link.getAttribute('data-bm-audit-jump');const section=[...container.querySelectorAll('.bm-audit-ledger>section')].find(node=>node.id===id);section?.scrollIntoView?.({block:'start'});if(section){section.setAttribute('tabindex','-1');section.focus({preventScroll:true});}};
 render();container.addEventListener('change',update);container.addEventListener('input',update);container.addEventListener('submit',submit);container.addEventListener('click',jump);
 return ()=>{container.removeEventListener('change',update);container.removeEventListener('input',update);container.removeEventListener('submit',submit);container.removeEventListener('click',jump);};
}
