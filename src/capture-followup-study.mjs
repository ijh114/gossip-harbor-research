const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const list = value => Array.isArray(value) ? value : [];
const mediaURL = value => /^\.\/assets\/media\/[a-zA-Z0-9_./-]+$/.test(value || '') && !value.includes('..') ? value : '';
const seconds = value => Number.isFinite(value) ? `${value.toFixed(6)}초` : '시각 미확인';
const studyMedia = (data, key) => list(data.mediaEntries).find(row => row.key === key);

function renderStudy(data, study) {
  const frames = list(study.frames).map(frame => ({...frame, media:studyMedia(data,frame.mediaKey)})).filter(frame => frame.media && mediaURL(frame.media.src));
  const first = frames[0];
  const video = list(study.mediaKeys).map(key=>studyMedia(data,key)).find(row=>row?.kind==='video' && mediaURL(row.src));
  const gif = list(study.mediaKeys).map(key=>studyMedia(data,key)).find(row=>row?.kind==='gif' && mediaURL(row.src));
  const source = list(data.sources).find(row=>row.id===study.sourceId);
  return `<article class="capture-followup-card" data-capture-study="${escape(study.id)}" data-capture-tasks="${escape(list(study.taskIds).join(' '))}">
    <header><p class="capture-followup-eyebrow">${escape(study.sourceId)} · ${escape(list(study.taskIds).join(' / '))} · ${study.evidenceStatus==='excluded-candidate'?'다른 기능의 화면':'성공 판정 보류'}</p><h3>${escape(study.title)}</h3></header>
    ${first?`<figure class="capture-followup-frame"><img data-capture-frame src="${escape(mediaURL(first.media.src))}" alt="${escape(first.media.alt)}" width="${Number(first.media.width)}" height="${Number(first.media.height)}" loading="lazy"><figcaption data-capture-caption>${escape(first.caption)} · 원본 PTS ${seconds(first.sourcePTS)}</figcaption></figure>`:''}
    ${frames.length>1?`<div class="capture-followup-scrubber"><button type="button" data-capture-step="-1" aria-label="이전 선정 프레임" disabled>이전</button><label>선정 원본 프레임 <output data-capture-index>1 / ${frames.length}</output><input type="range" data-capture-scrub min="0" max="${frames.length-1}" value="0" step="1" aria-label="${escape(study.sourceId)} 선정 프레임"></label><button type="button" data-capture-step="1" aria-label="다음 선정 프레임">다음</button></div>`:''}
    ${video?`<details class="capture-followup-playback"><summary>실제 녹화 선정 구간 · 1배속 무음</summary><video controls playsinline muted preload="none" poster="${escape(mediaURL(video.poster))}" width="${Number(video.width)}" height="${Number(video.height)}"><source src="${escape(mediaURL(video.src))}" type="video/mp4"></video><p>${seconds(video.sourceRange?.startSeconds)}–${seconds(video.sourceRange?.endSeconds)} · MP4 24fps. 원본 오디오 제외.</p>${gif?`<button type="button" data-capture-gif-toggle aria-pressed="false">반복 GIF 보기</button><img data-capture-gif hidden data-capture-gif-src="${escape(mediaURL(gif.src))}" src="${escape(mediaURL(gif.poster))}" alt="${escape(gif.alt)}" width="${Number(gif.width)}" height="${Number(gif.height)}" loading="lazy">`:''}</details>`:''}
    <div class="capture-followup-findings"><h4>실제로 본 것</h4><ul>${list(study.observations).map(text=>`<li>${escape(text)}</li>`).join('')}</ul><h4>이 자료로 확정할 수 없는 것</h4><ul>${list(study.cannotConclude).map(text=>`<li>${escape(text)}</li>`).join('')}</ul><details><summary>기존 완료 조건 중 남아 있는 것</summary><p>${escape(study.unresolvedAcceptance)}</p></details></div>
    <details class="capture-followup-source"><summary>원본 ID·SHA-256·검수 범위</summary><p>${escape(study.sourceId)} · manifest 버전 미확인 · 실제 촬영일 미확인 · 입력 로그 없음</p><p><code>${escape(source?.sha256||'해시 미확인')}</code></p><p>선정 구간 ${seconds(study.sourceRange?.startSeconds)}–${seconds(study.sourceRange?.endSeconds)}. 원본 PTS 선정 프레임과 파생 영상은 전체 녹화의 전프레임 육안 검수와 구분합니다.</p></details>
  </article>`;
}

export function renderCaptureFollowupStudy(data) {
  if (!data || !list(data.tasks).length) return '';
  const summary=data.summary||{};
  return `<section class="capture-followup-study" data-capture-followup><header><p class="capture-followup-eyebrow">4.06 · 4.07 · 4.08 · 4.11 · 4.12</p><h2>${escape(data.title)}</h2><p>성공 전이가 없는 자료는 완료로 바꾸지 않습니다. 아래는 현재 자료를 다시 좁혀 본 범위와, 같은 완료 조건으로 남아 있는 내용입니다.</p></header>
    <dl class="capture-followup-metrics"><div><dt>추가 후보 검색</dt><dd>${Number(summary.additionalCandidateSearchVideos)||0}개 구간 · ${Number(summary.additionalSampleFrames)||0}장</dd></div><div><dt>추가 육안 검수</dt><dd>후보 전후 ${Number(summary.distinctCandidatePairsVisuallyReviewed)||0}쌍 · PTS ${Number(summary.additionalNativePointsVisuallyReviewed)||0}장 · 문맥 ${Number(summary.additionalContextStillsVisuallyReviewed)||0}장</dd></div><div><dt>미확인 동작의 새 성공 표본</dt><dd>${Number(summary.newSuccessfulTargetTransitionsConfirmed)||0}건</dd></div><div><dt>직접 청취</dt><dd>0초 · 실제 음향 대응 미확정</dd></div></dl>
    <details class="capture-followup-scope"><summary>검색 수·실제 검수 수·원작 실행을 구분하는 기준</summary><ul>${list(data.boundaries).map(text=>`<li>${escape(text)}</li>`).join('')}</ul></details>
    <div class="capture-followup-table" tabindex="0" role="region" aria-label="실제 녹화 재검수 항목과 남은 완료 조건"><table><thead><tr><th>항목</th><th>현재 확인</th><th>남은 완료 조건</th></tr></thead><tbody>${list(data.tasks).map(task=>`<tr><th scope="row"><a href="#apk-media?task=${escape(task.id)}">${escape(task.id)}</a><br>${escape(task.status)}</th><td>${escape(task.verified)}</td><td>${escape(task.remaining)}</td></tr>`).join('')}</tbody></table></div>
    <label class="capture-followup-filter">확인할 항목<select data-capture-filter><option value="all">전체 후보</option>${list(data.tasks).filter(task=>list(task.studyIds).length).map(task=>`<option value="${escape(task.id)}">${escape(task.id)} · ${escape(task.status)}</option>`).join('')}</select></label><p data-capture-count role="status">후보 ${list(data.studies).length}개</p>
    <div class="capture-followup-grid">${list(data.studies).map(study=>renderStudy(data,study)).join('')}</div>
    <aside class="capture-followup-audio"><h3>4.12 · 음향은 직접 청취 전 상태</h3><p>110개 녹화의 정량 분석과 14개 동봉 짧은 발췌는 기존 자료입니다. 이 환경에는 직접 청각 입력이 없어, 파형·재생 성공·종료 여부로 음색이나 효과음의 실제 동기화를 확정하지 않습니다. 직접 청취 0초, 원본 녹화 음원 공개 0개를 유지합니다.</p></aside>
  </section>`;
}

export function mountCaptureFollowupStudy(root,data) {
  const scope=root?.matches?.('[data-capture-followup]')?root:root?.querySelector?.('[data-capture-followup]');
  if(!scope)return ()=>{};
  const Controller=scope.ownerDocument?.defaultView?.AbortController||globalThis.AbortController;
  const controller=new Controller(),options={signal:controller.signal};
  const updateFrame=(card,index)=>{
    const study=list(data.studies).find(row=>row.id===card.dataset.captureStudy);
    const frames=list(study?.frames);const next=Math.max(0,Math.min(frames.length-1,index));const frame=frames[next];const media=studyMedia(data,frame?.mediaKey);if(!media||!mediaURL(media.src))return;
    const image=card.querySelector('[data-capture-frame]');if(image){image.src=mediaURL(media.src);image.alt=media.alt||'';}
    const caption=card.querySelector('[data-capture-caption]');if(caption)caption.textContent=`${frame.caption} · 원본 PTS ${seconds(frame.sourcePTS)}`;
    const slider=card.querySelector('[data-capture-scrub]');if(slider)slider.value=String(next);
    const output=card.querySelector('[data-capture-index]');if(output)output.textContent=`${next+1} / ${frames.length}`;
    for(const button of card.querySelectorAll('[data-capture-step]'))button.disabled=Number(button.dataset.captureStep)<0?next===0:next===frames.length-1;
  };
  scope.addEventListener('input',event=>{if(event.target.matches('[data-capture-scrub]'))updateFrame(event.target.closest('[data-capture-study]'),Number(event.target.value));},options);
  scope.addEventListener('change',event=>{
    if(!event.target.matches('[data-capture-filter]'))return;const filter=event.target.value;let visible=0;
    for(const card of scope.querySelectorAll('[data-capture-study]')){card.hidden=filter!=='all'&&!card.dataset.captureTasks.split(' ').includes(filter);if(!card.hidden)visible++;else for(const video of card.querySelectorAll('video'))video.pause();}
    scope.querySelector('[data-capture-count]').textContent=`후보 ${visible}개`;
  },options);
  scope.addEventListener('click',event=>{
    const step=event.target.closest('[data-capture-step]');if(step){const card=step.closest('[data-capture-study]');updateFrame(card,Number(card.querySelector('[data-capture-scrub]').value)+Number(step.dataset.captureStep));return;}
    const toggle=event.target.closest('[data-capture-gif-toggle]');if(!toggle)return;const image=toggle.parentElement.querySelector('[data-capture-gif]');const active=toggle.getAttribute('aria-pressed')!=='true';image.hidden=!active;if(active)image.src=mediaURL(image.dataset.captureGifSrc);else image.removeAttribute('src');toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'반복 GIF 닫기':'반복 GIF 보기';
  },options);
  return ()=>{controller.abort();for(const video of scope.querySelectorAll('video'))video.pause();};
}
