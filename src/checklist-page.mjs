const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderMasterChecklist(data,{status='all',currentOnly=false}={}){
 const c=data.masterChecklist;if(!c)return '<p>전체 작업 장부를 준비하고 있습니다.</p>';
 const work=c.currentWork,changes=new Map((work?.items||[]).map(item=>[item.taskId,item.summary]));
 const wanted=c.tasks.filter(t=>(status==='all'||t.status===status)&&(!currentOnly||changes.has(t.id)));
 const resource=data.resourceResolution;
 const current=c.tasks.filter(t=>/^4\.(0[3-9]|1[0-3])$/.test(t.id));
 const state=t=>`<span class="checklist-statuses"><span class="checklist-state" data-state="${e(t.status)}">${e(t.status)}</span>${changes.has(t.id)?'<span class="checklist-work-tag" data-current-work-tag>이번 작업</span>':''}</span>`;
 const row=t=>`<li id="task-${t.id.replace('.','-')}" data-checklist-id="${t.id}"><div><strong>${t.id} · ${e(t.title)}</strong>${state(t)}</div>${changes.has(t.id)?`<aside class="checklist-work-note"><strong>이번 작업 내용</strong><p>${e(changes.get(t.id))}</p></aside>`:''}<p><b>완료 조건 / 남은 내용</b><br>${e(t.acceptance)}</p>${/^4\.(0[3-9]|1[0-3])$/.test(t.id)?`<a class="button" href="#apk-media?task=${t.id}">APK 조사·시각 자료 보기</a>`:''}</li>`;
 return `<section class="master-checklist">
 <header class="studio-intro"><h1>전체 작업 · 완료 기준</h1><p>기존 작업 번호와 세부 ID를 유지합니다. 완료한 구현과 원작에서 확인한 범위를 구분하며, 남은 작업을 새로운 이름으로 옮기지 않습니다.</p></header>
 <p>기존 2~5번은 부분 완료입니다. 선택 범위·자료 필요·보류를 포함한 100개 항목의 현재 상태와 종료 조건을 확인하세요.</p>
 ${work?`<section class="checklist-latest-work" aria-labelledby="checklist-work-heading"><h2 id="checklist-work-heading">이번 작업</h2><p><strong>${e(work.title)}</strong><br><time datetime="${e(work.date)}">${e(work.date)}</time> · ${changes.size}항목 갱신</p><p>상태 옆의 <span class="checklist-work-tag">이번 작업</span> 태그와 각 항목의 변경 내용으로 확인할 수 있습니다. 다음 작업에서는 이전 태그·설명을 지우고 새 작업 내용으로 교체합니다. 완료 판정과 근거는 유지합니다.</p></section>`:''}
 <div class="checklist-controls"><label class="checklist-filter">표시할 상태<select data-checklist-status><option value="all">전체 상태</option>${c.states.map(s=>`<option value="${e(s)}"${status===s?' selected':''}>${e(s)} · ${c.tasks.filter(t=>t.status===s).length}항목</option>`).join('')}</select></label>${work?`<label class="checklist-work-filter"><input type="checkbox" data-checklist-current-only${currentOnly?' checked':''}>이번 작업 항목만 보기</label>`:''}</div>
 <p role="status">${wanted.length} / ${c.tasks.length}항목 표시${currentOnly?' · 이번 작업 항목만':''} · 개별 항목 수는 전체 게임 완성률이 아닙니다.</p>
 ${wanted.length?'':'<p class="checklist-empty">선택한 조건에 해당하는 항목이 없습니다. 상태 필터를 바꾸거나 이번 작업 항목만 보기를 해제하세요.</p>'}
 ${c.groups.map(g=>{const rows=wanted.filter(t=>t.group===g.id);return rows.length?`<details class="checklist-group"${[0,3].includes(g.id)||status!=='all'||currentOnly?' open':''}><summary>${g.id}. ${e(g.title)} <span>${e(g.status)} · ${rows.length}항목</span></summary><p>${e(g.remaining)}</p><ol>${rows.map(row).join('')}</ol></details>`:'';}).join('')}
 <section class="checklist-current-release"><h2>APK 자료 보강 · 4.03~4.13 판정</h2><p>종료 조건과 번호는 그대로입니다. 자산 회수·최소 투영·화면 검수의 완료와 실제 관측이 필요한 미완료를 구분합니다.</p><ul class="checklist-release-grid">${current.map(t=>`<li><a href="#apk-media?task=${t.id}">${t.id}</a>${state(t)}</li>`).join('')}</ul>${data.collectionStudy?'<p><a class="button" href="#collection">컬렉션 · 자산·흐름·BM 설명 보기</a></p>':''}</section>
 ${resource?'<section class="checklist-current-release"><h2>리소스 연결·해석 현황</h2><p>초기 대상 Spine654건·네이티브342건·GUID24건을 유지한 전수 판정입니다. Spine654 연결, 네이티브339 전체 해석/3 부분, 정확 경로 실물5/범위 내 미실물19로 구분합니다. 런타임 검증이 필요한0.04·3.13·4.10은 부분 상태를 유지합니다.</p><a class="button" href="#resource-audit">항목1020건과 원본·파생·미확정 범위 확인</a></section>':''}
 <details><summary>상태 기준과 문서 출처</summary>${c.boundaries.map(b=>`<p>${e(b)}</p>`).join('')}<p><a href="https://github.com/ijh114/gossip-harbor-research/blob/main/docs/MASTER-CHECKLIST.md" target="_blank" rel="noopener noreferrer">전체 장부와 상세 부록 보기 · 87안내/85외부 연산/제작 항목</a></p><p><code>${e(c.source)}</code><br>문서 SHA-256 <code>${e(c.sourceSha256)}</code> · UTF-8/LF</p></details>
 <div class="quick-links"><a class="button" href="#experience">웹 시뮬레이션</a><a class="button" href="#production-assets">제작 리소스</a><a class="button" href="#artifact-availability">자료 확보 상태</a></div>
 </section>`;
}
