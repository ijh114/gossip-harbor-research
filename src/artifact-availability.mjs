const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUS_LABELS = Object.freeze({missing:'자료 미확보','registered-only':'등록만 확인',curated:'선별 자료 있음','research-projection':'연구용 투영'});
const GROUP_LABELS = Object.freeze({scene:'과제·스토리',decoration:'장식 후보',event:'이벤트',factory:'생성기 공장', 'base-item':'기본 타입'});
const safeTarget = value => typeof value === 'string' && /^#[a-z0-9-]+(?:\?[a-z0-9_=&%.-]*)?$/i.test(value) ? value : null;
const normalizedFilter = filter => typeof filter === 'string' ? {status:filter} : filter && typeof filter === 'object' ? filter : {};
const ledgerData = data => data?.artifactAvailability ?? data;

/** Pure selector. A filter never changes a record's evidence/availability status. */
export function selectArtifactAvailability(data, {filter} = {}) {
  data = ledgerData(data);
  const f = normalizedFilter(filter), query = String(f.query ?? '').trim().toLocaleLowerCase();
  return (Array.isArray(data?.entries) ? data.entries : []).filter(row =>
    (!f.status || f.status === 'all' || row.status === f.status) &&
    (!f.group || f.group === 'all' || row.group === f.group) &&
    (!f.target || (row.targets || []).some(t => t.href === f.target)) &&
    (!query || [row.id,row.title,row.claim,row.impact,...(row.subjectIds || []),...(row.neededEvidence || [])].join(' ').toLocaleLowerCase().includes(query))
  );
}

const styles = `<style>
.artifact-availability{--av-forest:#1d594b;--av-ink:#173d32;--av-muted:#52665b;--av-line:#cbd9ce;--av-paper:#fffef9;color:var(--av-ink);font-family:var(--font,Pretendard),"Noto Sans KR",system-ui,sans-serif;font-size:15px;line-height:1.75;overflow-wrap:anywhere}
.artifact-availability h2{color:var(--av-ink);font-size:clamp(1.35rem,2vw,1.8rem);letter-spacing:-.035em;line-height:1.35;margin:0 0 .6rem}.artifact-availability h3{font-size:1rem;margin:0 0 .4rem}.artifact-availability p{margin:.35rem 0 .8rem;max-width:82ch}.artifact-availability small{color:var(--av-muted);font-size:.82rem}.artifact-availability a{color:var(--av-forest);text-decoration:underline;text-underline-offset:.2em;font-weight:650}
.artifact-availability :is(a,summary,input,select):focus-visible{outline:3px solid #b66b14;outline-offset:4px}.av-legend{display:flex;flex-wrap:wrap;gap:.5rem 1.3rem;margin:1rem 0;padding:1rem 0;border-block:1px solid var(--av-line)}.av-legend div{display:flex;gap:.6rem;align-items:baseline}.av-legend dt{font-weight:700}.av-legend dd{margin:0;color:var(--av-muted)}
.av-boundary{border-radius:12px;padding:.55rem .9rem;background:#edf4ed}.av-controls{display:flex;gap:.8rem;flex-wrap:wrap;align-items:end;margin:1rem 0}.av-controls label{display:flex;flex-direction:column;gap:.25rem;font-size:.85rem;font-weight:700}.av-controls input,.av-controls select{font:inherit;color:var(--av-ink);background:var(--av-paper);border:1px solid #869f8e;border-radius:4px;padding:.5rem .65rem;min-height:44px}.av-controls input{min-width:min(260px,65vw)}.av-filter-buttons{display:flex;flex-wrap:wrap;gap:.5rem;margin:.8rem 0}.av-filter-buttons button{font:inherit;font-size:.85rem;font-weight:650;line-height:1.5;min-height:44px;padding:.4rem .7rem;border:1px solid #869f8e;border-radius:4px;background:var(--av-paper);color:var(--av-forest);cursor:pointer}.av-filter-buttons button[aria-pressed=true]{color:#fffef9;background:var(--av-forest)}.av-filter-buttons button:focus-visible{outline:3px solid #b66b14;outline-offset:4px}
.av-table-scroll{max-width:100%;overflow:auto;border:1px solid var(--av-line);background:var(--av-paper)}.av-table{width:100%;border-collapse:collapse;min-width:720px;text-align:left}.av-table caption{text-align:left;padding:.7rem 1rem;font-weight:650;color:var(--av-muted);border-bottom:1px solid var(--av-line)}.av-table th,.av-table td{vertical-align:top;padding:1rem;border-bottom:1px solid var(--av-line)}.av-table tr:last-child td,.av-table tr:last-child th{border-bottom:0}.av-table thead th{font-size:.8rem;color:#355946;background:#edf4ed;letter-spacing:.02em}.av-table th[scope=row]{width:21%;font-size:.95rem}.av-table th[scope=row] small{display:block;margin-top:.35rem;font-weight:400}.av-status-cell{width:16%;white-space:nowrap}.av-status{font-size:.79rem;display:inline-block;padding:.17rem .45rem;line-height:1.6;border:1px solid var(--av-line);border-radius:3px;background:#f3f5ef;color:#254b38;font-weight:700}.av-status-missing{background:#fff0e4;border-color:#d6b18f;color:#77401d}.av-status-registered-only{background:#fff8d8;border-color:#c5bb84;color:#62500e}.av-status-curated{background:#e8f4ea;border-color:#a1c6aa;color:#245335}.av-status-research-projection{background:#eaf0f6;border-color:#afc0d2;color:#304d69}
.av-table details{margin:.6rem 0 0}.av-table summary,.av-scope summary{cursor:pointer;color:var(--av-forest);font-weight:700;min-height:30px}.av-table ul{margin:.35rem 0 .5rem;padding-left:1.15rem}.av-links{display:flex;flex-wrap:wrap;gap:.3rem 1rem;margin-top:.6rem;font-size:.85rem}.av-proof{font-size:.78rem;border-top:1px solid var(--av-line);padding-top:.5rem;margin-top:.5rem}.av-proof code{font-family:ui-monospace,Consolas,monospace;font-size:.75rem;word-break:break-all;color:#365545}.av-proof .av-hash{display:block;margin:.2rem 0 .5rem;color:var(--av-muted)}.av-empty{padding:1.2rem;border:1px solid var(--av-line);background:var(--av-paper)}.av-scope{margin-top:1rem}.av-scope li{max-width:85ch}.av-results{font-size:.87rem;color:var(--av-muted)}
@media(max-width:640px){.artifact-availability{font-size:14px}.av-table th,.av-table td{padding:.8rem}.av-controls{gap:.65rem}.av-controls label{flex:1 1 130px}.av-controls input{min-width:0;width:100%}.av-legend{gap:.5rem 1rem}.av-legend div{gap:.4rem}}
</style>`;

function renderProof(refs, sources) {
  const selected = (refs || []).map(id => sources.get(id)).filter(Boolean);
  return `<details class="av-evidence"><summary>출처 ${selected.length}개 · 경로·행·SHA</summary>${selected.map(s => {
    const line = Number.isInteger(s.lineStart) ? `L${s.lineStart}${s.lineEnd !== s.lineStart ? `–${s.lineEnd}` : ''}` : '바이너리 객체 식별';
    const locator = s.locator;
    return `<div class="av-proof"><strong>${escapeHtml(s.id)}</strong><br><code>${escapeHtml(s.path)} · ${escapeHtml(line)}</code><code class="av-hash">SHA-256 ${escapeHtml(s.sha256)}</code>${locator ? `<p>${locator.objectType ? `${escapeHtml(locator.objectType)} · ` : ''}${locator.fileKey ? `등록 경로 <code>${escapeHtml(locator.fileKey)}</code>` : ''}${locator.pathId || locator.path_id ? ` · path_id <code>${escapeHtml(locator.pathId ?? locator.path_id)}</code>` : ''}${locator.bundle ? `<br>번들 <code>${escapeHtml(locator.bundle)}</code><code class="av-hash">SHA-256 ${escapeHtml(locator.bundleSha256 ?? locator.bundle_sha256)}</code>` : ''}</p>` : ''}</div>`;
  }).join('')}<small>출처 식별 정보입니다. 원본 APK·Lua·메시 파일 다운로드를 제공하지 않습니다.</small></details>`;
}

/**
 * Accepts the ledger itself or the app's {artifactAvailability: ledger} object.
 * Compact HTML evidence table; no game execution, fetches, DOM or global state.
 * filter: status string, or {status, group, query, target}. Optional host controls
 * use data-artifact-status/group/query attributes and rerender with that filter.
 */
export function renderArtifactAvailability(data, {filter} = {}) {
  data = ledgerData(data);
  if (!data || !Array.isArray(data.entries)) return `${styles}<section class="artifact-availability"><h2>자료 가용성</h2><p>검증된 자료 가용성 장부를 준비하고 있습니다.</p></section>`;
  const f = normalizedFilter(filter), rows = selectArtifactAvailability(data,{filter}), summary = data.summary || {};
  const sources = new Map((data.sources || []).map(s => [s.id,s]));
  const groups = [...new Set(data.entries.map(r => r.group))];
  return `${styles}<section class="artifact-availability" aria-label="자료 가용성 근거 장부">
    <header><h2>${escapeHtml(data.title || '자료 가용성 · 필요한 추가 근거')}</h2><p>원작 자료가 어디까지 있는지, 위키·시뮬레이션에 무엇을 더 연결해야 하는지 확인합니다. 각 상태는 출처로 구분하며 필터를 바꿔도 근거의 종류는 바뀌지 않습니다.</p><small>APK ${escapeHtml(data.targetVersion)} · 검토 ${escapeHtml(data.reviewDate)} · 이번 정적 후속 점검의 신규 자산 회수 ${Number(summary.newlyRecoveredAssets) || 0}개</small></header>
    <dl class="av-legend">${Object.entries(STATUS_LABELS).map(([id,label]) => `<div><dt>${label}</dt><dd>${data.entries.filter(r => r.status === id).length}항목</dd></div>`).join('')}</dl>
    <p class="av-boundary">기본 과제의 동봉 장면 투영은 ${Number(summary.sceneTasksProjected) || 0}개 · ${escapeHtml(summary.sceneLastTask || '미확인')}까지입니다. ${escapeHtml(summary.nextMissingTimelineTask || '이후')} 이후 타임라인, Area4 장식 ${Number(summary.decorationRegisteredOnly) || 0}후보, 이벤트 전용 ${Number(summary.eventTypesMissing) || 0}타입 그림은 추가 근거가 필요합니다.</p>
    <nav class="av-filter-buttons" aria-label="자료 가용성 상태 필터">${[['all','전체 상태'],...Object.entries(STATUS_LABELS)].map(([id,label])=>`<button type="button" data-artifact-filter="${id}" aria-pressed="${(f.status || 'all')===id}">${label}</button>`).join('')}</nav>
    <div class="av-controls"><label>자료 범위<select data-artifact-group><option value="all">모든 범위</option>${groups.map(g => `<option value="${escapeHtml(g)}"${f.group === g ? ' selected' : ''}>${escapeHtml(GROUP_LABELS[g] || g)}</option>`).join('')}</select></label><label>타입·과제·필요 자료 검색<input type="search" data-artifact-query value="${escapeHtml(f.query || '')}" placeholder="예: 12_5, 버블, dogparkpure"></label></div>
    <p class="av-results" role="status">전체 ${data.entries.length}항목 중 ${rows.length}항목 표시 · 수량의 단위는 과제·후보·타입·이미지를 구분합니다.</p>
    ${rows.length ? `<div class="av-table-scroll" tabindex="0" role="region" aria-label="자료 가용성 표 · 작은 화면에서는 좌우로 스크롤"><table class="av-table"><caption>등록 정보 · 실물 · 선별 공개 자료 · 연구용 투영의 구분</caption><thead><tr><th scope="col">대상</th><th scope="col">현재 상태</th><th scope="col">확인 범위와 필요한 자료</th></tr></thead><tbody>${rows.map(row => {
      const status = Object.hasOwn(STATUS_LABELS,row.status) ? row.status : 'missing';
      return `<tr data-artifact-id="${escapeHtml(row.id)}" data-artifact-state="${escapeHtml(status)}"><th scope="row">${escapeHtml(row.title)}<small>${escapeHtml(GROUP_LABELS[row.group] || row.group)} · ${escapeHtml(row.count)} ${escapeHtml(row.unit)}</small></th><td class="av-status-cell"><span class="av-status av-status-${status}">${STATUS_LABELS[status]}</span></td><td><p>${escapeHtml(row.claim)}</p><p><strong>위키·플레이 영향</strong><br>${escapeHtml(row.impact)}</p>${row.neededEvidence?.length ? `<details><summary>추가로 필요한 자료</summary><ul>${row.neededEvidence.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul></details>` : ''}${row.subjectIds?.length ? `<details><summary>대상 ID ${row.subjectIds.length}개</summary><p><code>${row.subjectIds.map(escapeHtml).join(' · ')}</code></p></details>` : ''}${row.boundary ? `<p><small>${escapeHtml(row.boundary)}</small></p>` : ''}<div class="av-links">${(row.targets || []).filter(t => safeTarget(t.href)).map(t => `<a href="${escapeHtml(t.href)}">${escapeHtml(t.label)}</a>`).join('')}</div>${renderProof(row.sourceRefs,sources)}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="av-empty">이 조건에 맞는 항목이 없습니다. 상태·범위·검색어를 바꿔 보세요.</p>'}
    <details class="av-scope"><summary>점검 범위와 해석 한계</summary><ul>${(data.boundaries || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>${(data.statuses || []).map(s => `<p><strong>${escapeHtml(s.label)}</strong> · ${escapeHtml(s.description)}</p>`).join('')}</details>
  </section>`;
}
