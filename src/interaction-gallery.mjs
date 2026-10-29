import {INTERACTION_SAMPLES} from './interaction-samples.mjs';
import {mediaFor,validMedia} from './visual-model.mjs';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderInteractionGallery(data){
 return `<section class="interaction-gallery" data-interaction-gallery aria-label="퍼즐 상호작용 GIF 도감">
 <div class="interaction-toolbar"><p data-loop-status aria-live="polite">보이는 GIF를 자동 반복 재생합니다.</p><button type="button" class="button" data-loop-all aria-pressed="false">모두 일시정지</button></div>
 <p class="interaction-scope">합성은 <strong>실제 영상 발췌</strong>, 나머지는 <strong>APK 규칙 재현</strong>입니다. 재현 배치와 속도는 설명용입니다.</p>
 <div class="interaction-grid">${INTERACTION_SAMPLES.map(row=>{
  const m=mediaFor(data,row.mediaKey),valid=validMedia(m)&&m.kind==='gif'&&m.poster,observed=m?.origin==='observed-user-capture';
  return `<article class="interaction-card" id="interaction-${e(row.id)}" data-interaction-card="${e(row.id)}">
   <div class="interaction-preview">${valid?`<img src="${e(m.poster)}" data-loop-src="${e(m.src)}" data-loop-poster="${e(m.poster)}" alt="${e(m.alt)}" width="560" height="400" loading="lazy" decoding="async">`:'<p>반복 시연 자료를 준비하고 있습니다.</p>'}</div>
   <div class="interaction-card-body"><span class="interaction-origin">${observed?'실제 영상 발췌 · 버전 미확인':'APK 규칙 재현'}</span><h2>${e(row.title)}</h2><p>${e(row.description)}</p><p class="interaction-note">${e(row.note)}</p><p class="interaction-load-error" data-loop-error hidden>GIF를 불러오지 못해 정지 이미지를 표시합니다. 페이지를 새로고침해 주세요.</p>
   <div class="interaction-card-actions">${valid?`<button type="button" class="button" data-media-key="${e(row.mediaKey)}" aria-label="${e(row.title)} GIF 크게 재생">크게 재생</button>`:''}<button type="button" class="source-button" data-evidence="${e(row.source)}">규칙 근거</button></div>
   <details class="interaction-provenance"><summary>출처·확인 범위</summary><p>${e(m?.source||'자료 미확보')}</p><p>${e(m?.notes||'실제 사용 영상 미확보')}</p>${m?.replay?'<p>아이템 이미지와 전후 상태는 APK 기본 규칙으로 확인했습니다. 배치·속도·강조 효과는 웹 재현입니다.</p>':''}</details></div></article>`;
 }).join('')}</div></section>`;
}

// GIF files have no native pause API. Replace them with their verified poster
// when paused, offscreen, hidden, or leaving this route to stop decoding too.
export function mountInteractionLoops(root=document){
 const gallery=root.querySelector('[data-interaction-gallery]');if(!gallery)return ()=>{};
 const doc=gallery.ownerDocument,win=doc.defaultView,images=[...gallery.querySelectorAll('[data-loop-src]')],control=gallery.querySelector('[data-loop-all]'),status=gallery.querySelector('[data-loop-status]');
 const preference=win.matchMedia?.('(prefers-reduced-motion: reduce)');
 let paused=Boolean(preference?.matches),reason=paused?'preference':'',destroyed=false;
 const visible=new Set(),failed=new Set();
 const Observer=win.IntersectionObserver;
 const sync=()=>{if(destroyed)return;for(const img of images){const playing=!paused&&!doc.hidden&&visible.has(img)&&!failed.has(img);const path=playing?img.dataset.loopSrc:img.dataset.loopPoster;if(img.getAttribute('src')!==path)img.setAttribute('src',path);img.dataset.loopState=playing?'playing':'paused';}control.textContent=paused?'모두 재생':'모두 일시정지';control.setAttribute('aria-pressed',String(paused));status.textContent=paused?(reason==='preference'?'움직임 줄이기 설정에 따라 멈췄습니다. 원하면 재생할 수 있습니다.':'GIF를 모두 멈췄습니다. 정지 이미지로 비교하세요.'):'보이는 GIF를 자동 반복 재생합니다.';};
 const observer=Observer?new Observer(entries=>{for(const entry of entries){if(entry.isIntersecting)visible.add(entry.target);else visible.delete(entry.target);}sync();},{rootMargin:'80px 0px',threshold:0.01}):null;
 for(const img of images){if(observer)observer.observe(img);else visible.add(img);}
 const toggle=()=>{paused=!paused;reason='user';sync();};
 const motionChange=event=>{if(event?.matches??preference?.matches){paused=true;reason='preference';sync();}};
 const visibilityChange=()=>sync();
 const imageError=event=>{const img=event.currentTarget;if(img.getAttribute('src')!==img.dataset.loopSrc)return;failed.add(img);img.closest('[data-interaction-card]').querySelector('[data-loop-error]').hidden=false;sync();};
 for(const img of images)img.addEventListener('error',imageError);
 control.addEventListener('click',toggle);preference?.addEventListener?.('change',motionChange);doc.addEventListener('visibilitychange',visibilityChange);sync();
 return ()=>{destroyed=true;observer?.disconnect();control.removeEventListener('click',toggle);preference?.removeEventListener?.('change',motionChange);doc.removeEventListener('visibilitychange',visibilityChange);for(const img of images){img.removeEventListener('error',imageError);img.src=img.dataset.loopPoster;img.dataset.loopState='paused';}};
}
