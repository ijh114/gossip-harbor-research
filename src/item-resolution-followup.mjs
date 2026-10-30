// Curated static findings. Does not execute recovered Lua or migrate saves.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const local = value => typeof value === 'string' && /^\.\/assets\/media\/[A-Za-z0-9_./-]+\.png$/.test(value) && !value.includes('..');
const SOURCE_WORDS = [4194375,98,2147532830,4210758,12615751,16482,2147500062,4210758,12632135,16777318,8388646];
const luaTrue = value => value !== null && value !== undefined && value !== false;

/** Faithful Lua and/or selection, including false/nil fallback. This function
 * models the single verified expression and never executes target bytecode. */
export function selectBubbleImageKey(instant, optionalInstantKey, normalKey = 'Bubble') {
  const first = luaTrue(instant) ? optionalInstantKey : instant;
  return luaTrue(first) ? first : normalKey;
}

export function validItemResolutionFollowup(data) {
  try {
    const boardValid = group => !group.boardSummary || (
      group.boardSummary.columns === 7 && group.boardSummary.visibleRows === 10
      && group.boardSummary.sourceRows === 13 && group.boardSummary.initialCells === 70
      && group.boardSummary.starterCacheItem === 'pb_dogpark_tar_1' && group.boardSummary.starterCacheCount === 5
      && group.boardSummary.scroll?.length === 1 && group.boardSummary.scroll[0].level === 12
      && group.boardSummary.scroll[0].scrollRows === 3);
    return data?.schemaVersion === 1 && data.targetVersion === '4.10.5' && sha(data.revision)
      && data.runtimeObserved === false && data.scope.parsedBytecodeChunks === 3400
      && data.coverage.exactSpriteIdentities === 70 && data.coverage.uniquePublishedPNGContents === 32
      && data.bubble.instantConstantDefined === false && data.bubble.normalImageKey === 'Bubble'
      && local(data.bubble.outerSrc) && sha(data.bubble.outerSHA256)
      && JSON.stringify(data.bubble.bytecode.instructions.map(x => x.word)) === JSON.stringify(SOURCE_WORDS)
      && data.fixture.registered === false && data.fixture.types.length === 35
      && data.fixture.types.every(x => !x.imageKeyRegistered && !x.imageRegistryFound && !x.itemViewConfigFound)
      && data.registeredGroups.length === 2 && new Set(data.registeredGroups.map(x => x.id)).size === 2
      && data.registeredGroups.every(group => group.registered === true && group.runtimeObserved === false && boardValid(group)
        && group.entries.length === 35 && new Set(group.entries.map(x => x.type)).size === 35
        && group.entries.every(x => typeof x.type === 'string' && x.type.length < 160 && local(x.src)
          && sha(x.sha256) && x.runtimeObserved === false && x.identity.type === 'Sprite'
          && sha(x.identity.object_source_sha256) && sha(x.identity.bundle_sha256)
          && typeof x.identity.path_id === 'string' && /^-?\d+$/.test(x.identity.path_id)
          && Number.isInteger(x.width) && x.width > 0 && x.width <= 8192
          && Number.isInteger(x.height) && x.height > 0 && x.height <= 8192))
      && data.propertyBubble.status === 'declared-only-purpose-unresolved' && data.propertyBubble.modelDeclarations.length === 4
      && typeof data.propertyBubble.explanation === 'string' && typeof data.propertyBubble.boundary === 'string'
      && Array.isArray(data.unknowns) && data.unknowns.every(x => typeof x === 'string')
      && data.sources.every(x => x.path.startsWith('analysis/') && !x.path.includes('..') && sha(x.sha256));
  } catch { return false; }
}

export function shippedBubbleRepresentation(instant, data) {
  if (!validItemResolutionFollowup(data)) return {status:'invalid-evidence', imageKey:null, src:null};
  const imageKey = selectBubbleImageKey(instant, null, data.bubble.normalImageKey);
  return {status:'source-key-resolved', imageKey, src:data.bubble.outerSrc, sha256:data.bubble.outerSHA256,
    instant:luaTrue(instant), method:'verified-shipped-and-or-nil-fallback', runtimeObserved:false};
}

function artCard(row) {
  return `<figure class="irf-art-card"><img src="${esc(row.src)}" alt="${esc(row.type)} 원본 Sprite" loading="lazy" decoding="async" width="${row.width}" height="${row.height}"><figcaption><code>${esc(row.type)}</code><small>${esc(row.width)} × ${esc(row.height)} · 정확 연결</small>${row.mergedType ? `<small>합성 → <code>${esc(row.mergedType)}</code></small>` : '<small>최종 단계 또는 별도 동작</small>'}</figcaption><details><summary>그림 근거</summary><dl><dt>키</dt><dd><code>${esc(row.imageKey)}</code></dd><dt>Sprite PPtr</dt><dd><code>${esc(row.identity.path_id)}</code></dd><dt>PNG SHA-256</dt><dd><code>${esc(row.sha256)}</code></dd></dl></details></figure>`;
}

function boardSummary(group) {
  const b = group.boardSummary;
  if (!b) return '';
  return `<div class="irf-callout"><h4>정확하게 연결된 보드 구성</h4><p><strong>${b.columns}열 × ${b.visibleRows}행</strong> · 출하 원본 ${b.sourceRows}행 중 초기 ${b.initialCells}칸 · 첫 시작 시 <code>${esc(b.starterCacheItem)}</code> ${b.starterCacheCount}개를 대기열에 한 번 지급합니다.</p><p>로컬 스크롤 표는 활동 레벨 ${esc(b.scroll[0].level)}에서 ${esc(b.scroll[0].scrollRows)}행 이동입니다. 이 레벨은 서버의 <code>pureBoardItems</code>와 연결된 활동 레벨이며 아이템 번호나 웹의 임의 합성 횟수로 바꾸면 안 됩니다.</p><p>주문 공급·단계 보상·도감 구성은 <code>eventOrderScore / pureBoardItems / eventBookContents</code> 서버 값이 필요합니다. 이 페이지는 자산·출하 정의를 연결한 결과이며 원작 이벤트 전체 플레이를 완료했다는 뜻은 아닙니다.</p></div>`;
}

export function renderItemResolutionFollowup(data, {sectionId = 'item-resolution-followup'} = {}) {
  if (!validItemResolutionFollowup(data)) return '<section class="item-resolution-followup"><h2>아이템 추가 근거 확인 필요</h2><p>등록 자료의 검증을 통과하지 못했습니다.</p></section>';
  const safeId = /^[A-Za-z][\w-]{0,80}$/.test(sectionId) ? sectionId : 'item-resolution-followup';
  return `<section class="item-resolution-followup" id="${esc(safeId)}" data-item-resolution-root>
    <header><p class="irf-eyebrow">APK 4.10.5 · 출하 코드와 정확 자산</p><h2>등록된 실제 이벤트 그림과 버블 표현</h2><p>실제 활동에 연결된 두 체인의 70타입을 확인했습니다. 기존 실험 fixture의 35타입은 별도 기록으로 보존합니다.</p><p>정확한 Sprite 객체 연결은 70건이며, 동일한 픽셀 그림을 공유하는 항목을 합치면 PNG 내용은 ${data.coverage.uniquePublishedPNGContents}종입니다. 서로 다른 등록을 이름 유사성으로 연결한 결과가 아닙니다.</p></header>
    <div class="irf-summary"><div><strong>70 / 70</strong><span>등록 타입 → 원본 Sprite</span></div><div><strong>3,400</strong><span>원본 해시·bytecode 대조</span></div><div><strong>정적 검증</strong><span>현재 계정 배정·활성 화면은 별도</span></div></div>
    <div class="irf-callout"><h3>기존 35타입은 미등록 실험 표</h3><p>${esc(data.fixture.explanation)}</p><p>${esc(data.fixture.replacementPolicy)}</p><p>기존 저장 데이터의 타입을 다른 타입으로 바꾸는 작업은 수행하지 않습니다. 실제 등록 이벤트로 플레이하려면 별도 시나리오와 명시적인 새 시작이 필요합니다.</p></div>
    <div class="irf-filter" role="group" aria-label="등록 이벤트 그림 선택"><button type="button" data-item-resolution-filter="all" aria-pressed="true">전체 70타입</button>${data.registeredGroups.map(group => `<button type="button" data-item-resolution-filter="${esc(group.id)}" aria-pressed="false">${group.id === 'dogpark-pureboard' ? '공원 순수 보드' : '공원 어드벤처'} 35타입</button>`).join('')}</div>
    <p data-item-resolution-count role="status" aria-live="polite">두 등록 이벤트 · 70타입 표시</p>
    ${data.registeredGroups.map(group => `<section class="irf-group" data-item-resolution-group="${esc(group.id)}"><h3>${group.id === 'dogpark-pureboard' ? '공원 순수 보드' : '공원 어드벤처'}</h3><p><code>${esc(group.activity)}</code> → <code>${esc(group.config)}</code> → 정확 ImageFileConfig GUID → Sprite PPtr → PNG</p><p>이 체인이 출하 정의에 등록되었다는 근거입니다. 현재 서버가 이 이벤트를 열었다는 관측은 아닙니다.</p>${boardSummary(group)}<div class="irf-art-grid">${group.entries.map(artCard).join('')}</div></section>`).join('')}
    <section class="irf-bubble"><div><h3>즉시 버블 외곽도 출하 표에서는 Bubble을 선택</h3><p>${esc(data.bubble.explanation)}</p><p>${esc(data.bubble.mechanicDifference)}</p><div class="irf-filter" role="group" aria-label="버블 상태 선택"><button type="button" data-item-resolution-bubble="normal" aria-pressed="true">일반 버블 b#</button><button type="button" data-item-resolution-bubble="instant" aria-pressed="false">즉시 버블 ib#</button></div><p data-item-resolution-bubble-label role="status" aria-live="polite">일반 버블 → Bubble</p><table><caption>출하 이름 표 기준의 선택 결과</caption><thead><tr><th scope="col">상태</th><th scope="col">즉시 키 조회</th><th scope="col">최종 선택</th></tr></thead><tbody><tr><th scope="row">일반</th><td>사용하지 않음</td><td><code>Bubble</code></td></tr><tr><th scope="row">즉시</th><td>미정의 · nil</td><td><code>Bubble</code></td></tr></tbody></table></div><figure><img src="${esc(data.bubble.outerSrc)}" alt="출하 코드가 선택하는 원본 Bubble 외곽" width="179" height="184"><figcaption>원본 외곽 Sprite<br>내부 아이템을 생략한 자산 예시</figcaption></figure><p class="irf-boundary">${esc(data.bubble.boundary)}</p></section>
    <section class="irf-callout"><h3>property_bubble_1은 용도를 확정하지 않음</h3><p>${esc(data.propertyBubble.explanation)}</p><p>${esc(data.propertyBubble.boundary)}</p><p>2,494개 패키지 모듈과 906개 개별 설정의 상수 참조는 Type만 있는 설정 4곳입니다. 복원한 native 342행의 해석 가능한 필드에도 이 키가 없었습니다. 문자열을 계산해 만드는 코드나 미관측 서버 데이터까지 부재를 증명한 결과는 아닙니다.</p></section>
    <details class="irf-evidence"><summary>검증 범위와 출처</summary><p>전체 bytecode 3,400개를 완전 파싱하고 각 파일의 원본 해시를 대조했습니다. BubbleInstant의 literal 참조는 GetSpriteName 1곳, literal 키 쓰기는 0곳입니다. ImageFileConfigName의 직접 전역 대입은 원본 이름 표 1곳입니다. 동적 계산키·현재 hot-update는 범위 밖입니다.</p><p>native 342개는 필드 전체 해석 339개와 공통 prefix 해석 3개를 구분하여 조회했습니다.</p>${data.sources.map(source => `<p><code>${esc(source.path)}</code>${source.lineStart ? ` · ${source.lineStart}–${source.lineEnd}행` : ''}<br><small>SHA-256 <code>${esc(source.sha256)}</code></small></p>`).join('')}<ul>${data.unknowns.map(value => `<li>${esc(value)}</li>`).join('')}</ul></details>
  </section>`;
}

/** Returns cleanup; repeated mounting on a new route does not retain handlers. */
export function mountItemResolutionFollowup(root, data) {
  const container = root?.matches?.('[data-item-resolution-root]') ? root : root?.querySelector?.('[data-item-resolution-root]');
  if (!container || !validItemResolutionFollowup(data)) return () => {};
  const handler = event => {
    const button = event.target.closest?.('button');
    if (!button || !container.contains(button)) return;
    if (button.hasAttribute('data-item-resolution-filter')) {
      const selected = button.dataset.itemResolutionFilter;
      if (selected !== 'all' && !data.registeredGroups.some(x => x.id === selected)) return;
      let count = 0;
      for (const group of container.querySelectorAll('[data-item-resolution-group]')) {
        group.hidden = selected !== 'all' && group.dataset.itemResolutionGroup !== selected;
        if (!group.hidden) count += group.querySelectorAll('.irf-art-card').length;
      }
      for (const control of container.querySelectorAll('[data-item-resolution-filter]')) control.setAttribute('aria-pressed', String(control === button));
      container.querySelector('[data-item-resolution-count]').textContent = `${selected === 'all' ? '두 등록 이벤트' : '선택한 등록 이벤트'} · ${count}타입 표시`;
    }
    if (button.hasAttribute('data-item-resolution-bubble')) {
      const mode = button.dataset.itemResolutionBubble;
      if (!['normal','instant'].includes(mode)) return;
      const selected = shippedBubbleRepresentation(mode === 'instant', data);
      for (const control of container.querySelectorAll('[data-item-resolution-bubble]')) control.setAttribute('aria-pressed', String(control === button));
      container.querySelector('[data-item-resolution-bubble-label]').textContent = `${mode === 'instant' ? '즉시 버블 · 미정의 즉시 키를 거쳐' : '일반 버블'} → ${selected.imageKey}`;
    }
  };
  container.addEventListener('click', handler);
  return () => container.removeEventListener('click', handler);
}
