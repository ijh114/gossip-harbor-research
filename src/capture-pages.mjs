import {validMedia} from './visual-model.mjs';
import {renderCaptureStudies,renderAudioStudy} from './capture-study.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const asArray = value => Array.isArray(value) ? value : [];
const CATEGORIES = ['all', 'BM', '퍼즐', 'UI', '맵'];
const KINDS = ['all', 'image', 'video'];

export function selectCaptures(data, {category = 'all', kind = 'all'} = {}) {
  const entries = asArray(data.media?.entries).filter(entry => entry.origin === 'observed-user-capture' && validMedia(entry));
  const selectedCategory = CATEGORIES.includes(category) ? category : 'all';
  const selectedKind = KINDS.includes(kind) ? kind : 'all';
  return {
    entries,
    rows: entries.filter(entry => (selectedCategory === 'all' || entry.category === selectedCategory) && (selectedKind === 'all' || entry.kind === selectedKind)),
    category: selectedCategory,
    kind: selectedKind,
    images: entries.filter(entry => entry.kind === 'image').length,
    videos: entries.filter(entry => entry.kind === 'video').length,
  };
}

function captureCard(entry) {
  const image = entry.kind === 'video' ? entry.poster : entry.src;
  const action = entry.kind === 'video' ? '영상 재생' : '크게 보기';
  return `<article class="capture-card">
    <button type="button" class="capture-preview" data-media-key="${escape(entry.key)}" aria-label="${escape(entry.alt)} · ${action}">
      ${image ? `<img src="${escape(image)}" alt="${escape(entry.alt)}" loading="lazy" decoding="async" width="480" height="640">` : '<span class="capture-no-poster">영상 자료</span>'}
      <span class="capture-action">${entry.kind === 'video' ? '<span aria-hidden="true">▶</span> ' : ''}${action}</span>
    </button>
    <div class="capture-card-body"><div class="capture-card-meta"><span>${escape(entry.category || '기타')}</span><span>${entry.kind === 'video' ? '무음 영상' : entry.kind === 'gif' ? 'GIF' : '이미지'}</span></div>
      <h3>${escape(entry.alt)}</h3>
      <p class="capture-source-id">${escape(entry.sourceId || entry.source)}</p>
      ${asArray(entry.observations).length ? `<ul>${entry.observations.slice(0, 3).map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : ''}
      <details class="capture-provenance"><summary>출처와 확인 범위</summary><p>${escape(entry.source)}</p><p>캡처 버전 ${entry.version ? escape(entry.version) : '미확인'} · 실제 촬영일 ${entry.capturedAt ? escape(entry.capturedAt) : '미확인'}</p>${entry.notes ? `<p>${escape(entry.notes)}</p>` : ''}</details>
    </div></article>`;
}

function factSourceIds(fact) {
  return new Set([...asArray(fact.sourceIds), ...asArray(fact.sources).flatMap(source => [source.source_id, source.sourceId, source.capture_id])].filter(Boolean));
}

function observationNotes(data, entries) {
  const findings = asArray(data.facts).filter(fact => fact.kind === 'capture');
  if (!findings.length) return '';
  return `<section class="capture-findings" aria-labelledby="capture-findings-title"><h2 id="capture-findings-title">화면에서 확인한 BM 구조</h2><p class="section-copy">캡처 당시의 상태와 전후 변화를 기록합니다. 가격·보상·타이머 표본을 모든 계정의 공통 규칙으로 일반화하지 않습니다.</p>
    <div class="capture-note-list">${findings.map(fact => {
      const ids = factSourceIds(fact);
      const related = entries.filter(entry => ids.has(entry.sourceId));
      return `<article class="capture-note"><div><span class="capture-note-id">${escape(fact.id)}</span><h3>${escape(fact.title)}</h3><p>${escape(fact.summary)}</p>${asArray(fact.unknowns).length ? `<p class="capture-note-limit"><strong>아직 모르는 점</strong> ${escape(fact.unknowns[0])}</p>` : ''}</div><div class="capture-note-actions">${related.slice(0, 2).map(entry => `<button type="button" class="button small" data-media-key="${escape(entry.key)}">${escape(entry.sourceId)} ${entry.kind === 'video' ? '재생' : '보기'}</button>`).join('')}<button type="button" class="source-button" data-evidence="${escape(fact.id)}">관측 상세·출처</button></div></article>`;
    }).join('')}</div></section>`;
}

function chainDiagram(entries) {
  const clip = entries.find(entry => entry.sourceId === 'GH-V0030');
  const steps = [
    ['20 보석', '에너지 100', false],
    ['무료', '카드팩', false],
    ['무료', '에너지 15', false],
    ['40 보석', '에너지 100', false],
    ['무료', '카드팩', false],
    ['무료', '에너지 20', false],
    ['80 보석', '다음 단계 대기', true],
  ];
  return `<section class="capture-chain" aria-labelledby="capture-chain-title"><div class="capture-section-heading"><div><span class="capture-eyebrow">GH-V0030 · 00:05.50–00:19.00</span><h2 id="capture-chain-title">지출 다음에 열리는 무료 보상</h2></div>${clip ? `<button type="button" class="button" data-media-key="${escape(clip.key)}">관측 영상 보기</button>` : ''}</div>
    <ol class="capture-chain-steps" aria-label="캡처에서 확인한 에너지 순차 판매 단계">${steps.map(([cost, reward, pending]) => `<li${pending ? ' class="capture-step-pending"' : ''}><strong>${cost}</strong><span>${reward}</span><small>${pending ? '구매 미관측' : '수령 관측'}</small></li>`).join('')}</ol>
    <p>보석은 <strong>719 → 659</strong>, 에너지는 <strong>2 → 237</strong>로 변합니다. 관측한 구간의 보석 60 소비·에너지 235 증가는 위 단계 구성과 일치합니다. 보석 80 단계의 구매와 이후 반복 여부는 확인하지 않았습니다.</p>
  </section>`;
}

export function renderCaptures(data, filters = {}, studyState) {
  const result = selectCaptures(data, filters);
  const audit=data.mediaAudit?.summary;
  return `<header class="studio-intro capture-intro"><span class="capture-eyebrow">사용자 제공 플레이 기록</span><h1>실제 화면으로 보는 가십하버</h1><p>퍼즐의 조작, UI 배치, 맵과 판매 흐름을 이미지와 짧은 영상으로 확인합니다. 각 자료에서 출처와 관측 범위를 함께 볼 수 있습니다.</p></header>
    <div class="capture-boundary"><strong>APK 분석과 구분해서 읽기</strong><p>이 페이지는 과거 사용자 캡처의 관측입니다. 캡처 버전과 실제 촬영일은 미확인이며, APK 4.10.5의 실행 검증으로 간주하지 않습니다. 파일명 날짜·가격·레벨은 캡처 당시 표본입니다.</p></div>
    ${audit?`<section class="capture-boundary"><h2>영상 전 구간 검토 장부</h2><p>전체 디코드 ${audit.decodedVideos}/${audit.totalVideos}개 · 가십하버 시간순 시각 검토 ${audit.visualTimelineReviewedVideos}/${audit.inScopeVideos}개. 약 0.5초 간격 표본 검토와 원속도 전체 재생·오디오 청취를 구분합니다.</p><a class="text-link" href="#media-audit">원본별 구간·동작·검토 범위 확인 →</a></section>`:''}
    ${renderCaptureStudies(data,studyState)}${renderAudioStudy(data)}
    <section class="capture-gallery" aria-labelledby="capture-gallery-title"><div class="capture-section-heading"><div><h2 id="capture-gallery-title">기존 선정 화면·동작 자료</h2><p class="capture-counts"><span>이미지 <strong>${result.images}</strong></span><span>영상 <strong>${result.videos}</strong></span><span>현재 표시 <strong>${result.rows.length}</strong></span></p></div><a class="text-link" href="#puzzle">퍼즐 도감에서 보기 →</a></div>
      <div class="capture-filters"><div role="group" aria-label="자료 주제">${CATEGORIES.map(category => `<button type="button" class="button small" data-capture-category="${category}" aria-pressed="${category === result.category}">${category === 'all' ? '전체 주제' : category}</button>`).join('')}</div><div role="group" aria-label="자료 형식">${KINDS.map(kind => `<button type="button" class="button small" data-capture-kind="${kind}" aria-pressed="${kind === result.kind}">${{all:'모든 형식',image:'이미지',video:'영상'}[kind]}</button>`).join('')}</div></div>
      <p class="sr-only" role="status" aria-live="polite">조건에 맞는 자료 ${result.rows.length}개</p>
      ${result.rows.length ? `<div class="capture-grid">${result.rows.map(captureCard).join('')}</div>` : '<div class="empty-state"><strong>이 조건의 자료는 아직 연결되지 않았습니다</strong><p>전체 주제 또는 모든 형식으로 바꾸면 다른 관측 자료를 볼 수 있습니다.</p></div>'}
    </section>
    ${chainDiagram(result.entries)}${observationNotes(data, result.entries)}
    <section class="capture-verification" aria-labelledby="capture-verification-title"><h2 id="capture-verification-title">관측과 검증의 현재 범위</h2><ul><li><span class="capture-check">확인</span><div><strong>공유 캡처와 분석 연결</strong><p>원본 ID·해시·선정 구간을 보존한 파생 자료만 연결합니다. 일부 프레임 확인을 영상 전체의 연속 검토로 표현하지 않습니다.</p></div></li><li><span class="capture-check pending">보류</span><div><strong>실제 게임 실행 검증</strong><p>LDPlayer에서 버전 4.10.5 설치는 확인했으나 검은 화면 이후 진행을 관측하지 못했습니다. 사용자 요청으로 LDPlayer 분석을 중단했습니다.</p></div></li><li><span class="capture-check pending">미확인</span><div><strong>서버 배정과 전체 운영 조건</strong><p>계정별 상품 배정, 서버 실험, 실제 구매 전환율과 매출은 캡처와 APK만으로 확정할 수 없습니다.</p></div></li></ul><a class="text-link" href="#bm-validation">APK의 BM 조건식과 비교하기 →</a></section>`;
}
