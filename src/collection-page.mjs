import {mediaFor,validMedia} from './visual-model.mjs';
import {renderCollectionCards,renderCollectionOperations,renderCollectionSectionNav} from './collection-overview.mjs';
const list=x=>Array.isArray(x)?x:[];
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusNames={'registered-only-image-needed':'그림 실물 필요','exact-local-Sprite':'APK Sprite 확보','registered-only-prefab-needed':'프리팹 실물 필요','exact-local-container':'APK 프리팹 확보','registered-only-audio-needed':'음원 실물 필요','exact-remote-Sprite':'원격 Sprite 확보','exact-remote-container':'원격 프리팹 확보','exact-remote-AudioClip':'원격 음원 확보'};
const sourceLinks=ids=>`<div class="collection-source-links">${list(ids).map(id=>`<a href="#collection?source=${encodeURIComponent(id)}">출처 ${e(id)}</a>`).join('')}</div>`;
function preview(data,key,{compact=false}={}){
 const m=mediaFor(data,key);if(!validMedia(m))return '';
 const src=m.kind==='image'?m.src:m.poster;if(!src)return '';
 const origin=m.origin?.startsWith('observed-user-capture')?'실제 캡처 · 버전 미확인':m.origin?.includes('official')?'공식 외부 공지 · 기간 별도 확인':m.origin?.includes('remote')?'APK 카탈로그에 연결한 원격 실물':'APK 동봉 자산';
 return `<figure class="collection-preview${compact?' compact':''}"><button type="button" data-media-key="${e(key)}" aria-label="${e(m.alt)} ${m.kind==='image'?'확대':'재생'}"><img src="${e(src)}" alt="${e(m.alt)}" width="${Number(m.width)||320}" height="${Number(m.height)||400}" loading="lazy" decoding="async"></button><figcaption>${origin}<small>${e(m.alt)}</small></figcaption></figure>`;
}
export function selectCollectionAssets(study,{system='album',group='all',status='all',query='',page=1,size=24}={}){
 const q=String(query).trim().toLowerCase(),groups=new Set(list(study?.systems).find(s=>s.id===system)?.resourceGroups?.map(g=>g.id)||[]);
 const assets=list(study?.resourceAssets).filter(a=>(groups.size===0||groups.has(a.groupId))&&(group==='all'||a.groupId===group)&&(status==='all'||a.status===status)&&(!q||[a.id,a.name,a.displayName,a.localizationKey,a.role,a.fileKey,a.assetPath].join(' ').toLowerCase().includes(q)));
 const pages=Math.max(1,Math.ceil(assets.length/size)),selected=Math.max(1,Math.min(pages,Number(page)||1));return {total:assets.length,page:selected,pages,rows:assets.slice((selected-1)*size,selected*size)};
}
export function collectionResourceCSV(study){
 const cell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\ufeff'+[['분류','자산 키','용도','종류','수량','단위','확보 상태','원본 너비','원본 높이','정확 경로','GUID','출처'],...list(study.resourceAssets).map(a=>[a.groupId,a.name,a.role,a.kind,a.quantity,a.unit,statusNames[a.status]||a.status,a.width,a.height,a.assetPath,a.assetGuid,list(a.sourceRefs).join(' / ')])].map(r=>r.map(cell).join(',')).join('\r\n');
}
function flow(system,selected){
 const rows=list(system.flow),current=rows.find(r=>r.id===selected)||rows[0];if(!current)return '';
 return `<section class="collection-section" aria-labelledby="collection-flow-title"><h2 id="collection-flow-title">콘텐츠 흐름</h2><p>단계를 눌러 처리 순서와 다음 분기를 확인하세요. 아래 탐색은 구조 설명이며 카드 추첨이나 보상 지급을 실행하지 않습니다.</p><div class="collection-flow">${rows.map((r,i)=>`<button type="button" data-collection-step="${e(r.id)}" aria-pressed="${r.id===current.id}" aria-controls="collection-flow-detail"><span>${i+1}</span><strong>${e(r.title)}</strong></button>`).join('')}</div><article id="collection-flow-detail" class="collection-flow-detail" aria-live="polite"><h3>${e(current.title)}</h3><p>${e(current.description)}</p>${list(current.next).length?`<div class="collection-next"><span>다음 조건으로</span>${current.next.map(id=>rows.find(r=>r.id===id)).filter(Boolean).map(r=>`<button type="button" class="button" data-collection-step="${e(r.id)}">${e(r.title)}</button>`).join('')}</div>`:''}${sourceLinks(current.sourceRefs)}</article></section>`;
}
function resources(data,study,system,state){
 const result=selectCollectionAssets(study,state),groups=list(system.resourceGroups),statuses=[...new Set(list(study.resourceAssets).map(a=>a.status))];
 return `<section class="collection-section" aria-labelledby="collection-resources-title"><div class="section-heading"><h2 id="collection-resources-title">제작에 필요한 리소스 자산</h2><button type="button" class="button" data-collection-export>전체 자산 목록 CSV</button></div><p>원작 등록 키·프리팹·음원을 서로 다른 단위로 셉니다. 등록 수량은 독립 원화 파일 수나 새 게임의 제작 수량과 같지 않습니다. 원본 치수가 확인되지 않은 자산에 임의 스펙을 넣지 않았습니다.</p><div class="collection-resource-groups">${groups.map(g=>`<details><summary><strong>${e(g.title)}</strong><span>${Number(g.quantity).toLocaleString('ko-KR')} ${e(g.unit)}</span></summary><p>${e(g.purpose)}</p><p>정확 실물 확보 ${(Number(g.localExactCount)||0)+(Number(g.remoteExactCount)||0)} · 등록만 확인 ${Number(g.registeredOnlyCount)||0}</p>${[...new Set(list(g.pixelDimensions).map(d=>`${d.width} × ${d.height}`))].map(size=>`<p>선정 원본 치수 ${e(size)}px</p>`).join('')}<div class="collection-small-gallery">${list(g.mediaKeys).map(k=>preview(data,k,{compact:true})).join('')}</div>${sourceLinks(g.sourceRefs)}</details>`).join('')}</div><p><a class="text-link" href="#production-assets">제작 리소스 페이지에서 MVP·출시 범위와 요청 수량 정하기</a></p><div class="collection-filters"><label>자산 분류<select data-collection-filter="group"><option value="all">전체 분류</option>${groups.map(g=>`<option value="${e(g.id)}"${state.group===g.id?' selected':''}>${e(g.title)}</option>`).join('')}</select></label><label>확보 상태<select data-collection-filter="status"><option value="all">전체 상태</option>${statuses.map(s=>`<option value="${e(s)}"${state.status===s?' selected':''}>${e(statusNames[s]||s)}</option>`).join('')}</select></label><label>이름·경로 검색<input type="search" data-collection-query value="${e(state.query)}" placeholder="예: joker, pack, set1"></label></div><p role="status">${result.total}개 등록 항목 · ${result.page}/${result.pages}페이지</p>${result.rows.length?`<div class="table-wrap" tabindex="0" role="region" aria-label="컬렉션 자산 근거 목록"><table class="collection-resource-table"><thead><tr><th scope="col">자산·용도</th><th scope="col">확보 상태·치수</th><th scope="col">정확 경로·출처</th></tr></thead><tbody>${result.rows.map(a=>`<tr><th scope="row">${a.displayName?`<strong>${e(a.displayName)}</strong><br>`:''}<code>${e(a.name)}</code><small>${e(a.role)} · ${e(a.kind)}</small>${a.mediaKey?preview(data,a.mediaKey,{compact:true}):''}</th><td>${e(statusNames[a.status]||a.status)}<br>${a.width&&a.height?`원본 추출 ${a.width} × ${a.height}px`:'원본 픽셀 치수 미확인'}${a.sourceSpriteRect?`<small>논리 Sprite ${a.sourceSpriteRect.width} × ${a.sourceSpriteRect.height}px</small>`:''}${a.derivativePixelDimensions?`<small>공개 축소 ${a.derivativePixelDimensions.width} × ${a.derivativePixelDimensions.height}px</small>`:''}<br>${e(a.quantity)} ${e(a.unit)}</td><td><code>${e(a.assetPath||a.fileKey||'원본 경로 미확인')}</code>${a.assetGuid?`<details><summary>GUID 확인</summary><code>${e(a.assetGuid)}</code></details>`:''}${sourceLinks(a.sourceRefs)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty-state">일치하는 자산이 없습니다. 분류·상태 또는 검색어를 바꿔주세요.</p>'}<div class="gallery-pagination"><span>${result.total}개 항목</span><div><button type="button" class="button" data-collection-page="${result.page-1}"${result.page<=1?' disabled':''}>이전</button><button type="button" class="button" data-collection-page="${result.page+1}"${result.page>=result.pages?' disabled':''}>다음</button></div></div></section>`;
}
function official(data,study){
 const ref=study.officialReference;if(!ref)return '';
 return `<section class="collection-section collection-official"><h2>공식 외부 자료 · 과거 공개 기간</h2><p>APK 도움말의 확정 URL에서 읽은 공지입니다. 표기 기간은 <strong>2026-08-28~2026-10-06 UTC</strong>이며 현재 운영값·APK4.10.5의 동일 배정으로 검증하지 않았습니다.</p><a href="${e(ref.url)}" target="_blank" rel="noopener noreferrer">공식 카드 확률 안내 원문</a><div class="collection-pack-grid">${list(ref.packExamples).map(p=>`<article>${preview(data,p.mediaKey,{compact:true})}<h3>${e(p.title)}</h3><p>표기 획득 카드 ${e(p.drawCount)}장</p><details><summary>슬롯별 과거 공개 확률</summary>${list(p.draws).map(d=>`<p><strong>${e(d.positionLabel)}</strong><br>${list(d.rarityDistribution).map(r=>e(r.sourceDisplay)).join(' · ')}</p>`).join('')}<p>확률 설명 그룹 수와 실제 지급 카드 수는 다릅니다.</p></details></article>`).join('')}</div><details><summary>공식 자료의 시점·동일 버전 확인 범위</summary>${list(ref.boundaries).map(b=>`<p>${e(b)}</p>`).join('')}<p>HTML SHA-256 <code>${e(ref.htmlSha256)}</code><br>공개 script SHA-256 <code>${e(ref.scriptSha256)}</code></p></details></section>`;
}
export function renderCollectionStudy(data,state={}){
 const d=data.collectionStudy;if(!d)return '<h1>컬렉션</h1><p>컬렉션 근거 자료를 준비하고 있습니다.</p>';
 state={system:'album',step:'',group:'all',status:'all',query:'',page:1,cardTheme:'moon',cardSet:'1',cardQuery:'',cardPage:1,...state};
 const system=list(d.systems).find(s=>s.id===state.system)||d.systems[0];state.system=system.id;
 const album=system.id==='album',hero=list(system.mediaKeys)[0];
 return `<section class="collection-study">
 <header class="studio-intro"><h1>컬렉션</h1><p>${e(d.summary)}</p></header>
 <nav class="collection-system-nav" aria-label="수집 콘텐츠 구분">${list(d.systems).map(s=>`<button type="button" class="button" data-collection-system="${e(s.id)}" aria-pressed="${s.id===system.id}">${e(s.title)}</button>`).join('')}<a class="button" href="#experience">스토리 회상 책 · 별도 기능</a></nav>
 ${album?renderCollectionSectionNav():''}
 <details class="collection-reference-details collection-capture-details"${album?'':' open'}><summary>실제 앨범 화면과 수집 콘텐츠 구분</summary><div class="collection-overview">${hero?preview(data,hero):''}<div><h2>${e(system.title)}</h2><p>${e(system.overview)}</p><dl class="collection-taxonomy">${list(d.taxonomy).map(t=>`<div><dt>${e(t.title)}</dt><dd>${e(t.description)}</dd></div>`).join('')}</dl><p class="collection-boundary">카드 앨범을 중심으로 분석합니다. 현재 계정의 시즌 배정·상품값·추첨 확률은 미확인입니다.</p></div></div></details>
 ${album?renderCollectionCards(data,state)+renderCollectionOperations(data,sourceLinks):''}
 <details class="collection-reference-details"><summary>콘텐츠 플로우 · 개봉·교환·회차의 상세 처리</summary>${flow(system,state.step)}</details>
 <details class="collection-reference-details"><summary>핵심 규칙과 예외 · 정적 코드 분석</summary><section class="collection-section"><h2>핵심 규칙</h2><div class="collection-rules">${list(system.rules).map(r=>`<article><h3>${e(r.title)}</h3><p>${e(r.summary)}</p>${sourceLinks(r.sourceRefs)}</article>`).join('')}</div></section></details>
 <section class="collection-section" id="collection-bm" aria-labelledby="collection-bm-title"><h2 id="collection-bm-title" tabindex="-1">관련 BM · 구매 가치와 노출</h2><p>플레이 보상·중복 활용·선택권·완성 직전의 가치를 연결합니다. 모든 팩이 현금 전용 상품이라는 뜻은 아닙니다.</p>${list(system.monetization).map(m=>`<article class="collection-bm-row"><h3>${e(m.title)}</h3><p>${e(m.summary)}</p>${m.value?`<p><strong>구매·소비 가치</strong> · ${e(m.value)}</p>`:''}<dl><div><dt>진입·평가 조건</dt><dd>${e(m.trigger)}</dd></div><div><dt>운영값 확인 범위</dt><dd>${e(m.operationalValues)}</dd></div></dl>${m.details?`<details><summary>처리·재노출·복구 조건</summary><ul>${list(m.details).map(row=>`<li>${e(row)}</li>`).join('')}</ul></details>`:''}${sourceLinks(m.sourceRefs)}<div class="collection-small-gallery">${list(m.mediaKeys).map(k=>preview(data,k,{compact:true})).join('')}</div></article>`).join('')||'<p>카드 앨범과 다른 발견·해금·수령 기능입니다. 같은 과금 경로라고 일반화하지 않습니다.</p>'}${album&&d.operationalAnalysis?`<p class="collection-method-note">${e(d.operationalAnalysis.popupBoundary)}</p>${sourceLinks(['popup-priority','bundle-priority'])}`:''}</section>
 ${album?`<details class="collection-reference-details"><summary>팩 그림·공식 과거 확률 안내</summary>${official(data,d)}</details>`:''}
 <details class="collection-reference-details" id="collection-all-assets"><summary>전체 자산 목록 · 원본 치수·출처·CSV</summary>${resources(data,d,system,state)}</details>
 <section class="collection-section"><h2>확인 범위와 남은 자료</h2><ul>${list(system.unknowns).map(u=>`<li>${e(u)}</li>`).join('')}</ul>${list(d.boundaries).map(b=>`<p>${e(b)}</p>`).join('')}<a class="text-link" href="#checklist">전체 작업 · 동일 완료 기준 보기</a></section>
 <section class="collection-section"><h2>원본 근거</h2>${list(d.sources).map(s=>`<details class="collection-source" data-collection-source-id="${e(s.id)}"${state.source===s.id?' open':''}><summary>${e(s.id)} · ${e(s.kind)}</summary><p><code>${e(s.path||s.url)}</code>${s.lineStart?` · ${s.lineStart}~${s.lineEnd}행`:''}</p><p>SHA-256 <code>${e(s.sha256)}</code></p></details>`).join('')}</section>
 </section>`;
}
export function createCollectionStudy({getData,render,download}){
 const state={system:'album',step:'',group:'all',status:'all',query:'',page:1,cardTheme:'moon',cardSet:'1',cardQuery:'',cardPage:1};let source='';
 function reveal(id){const target=document.getElementById(id);if(!target)return;if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView?.({block:'start',behavior:'instant'});(target.querySelector('h2,summary')||target).focus({preventScroll:true});}
 return {
  renderPage(){source=new URLSearchParams(location.hash.split('?')[1]||'').get('source')||'';return renderCollectionStudy(getData(),{...state,source});},
  handleClick(event){
   const target=event.target.closest('[data-collection-system],[data-collection-step],[data-collection-page],[data-collection-export],[data-collection-card-page],[data-collection-jump]');if(!target)return false;
   if(target.hasAttribute('data-collection-jump')){reveal(target.dataset.collectionJump);return true;}
   if(target.hasAttribute('data-collection-export')){download('gossip-harbor-collection-resources.csv',collectionResourceCSV(getData().collectionStudy),'text/csv');return true;}
   if(target.dataset.collectionSystem)Object.assign(state,{system:target.dataset.collectionSystem,step:'',group:'all',status:'all',query:'',page:1});
   else if(target.dataset.collectionStep)state.step=target.dataset.collectionStep;
   else if(target.hasAttribute('data-collection-card-page'))state.cardPage=Number(target.dataset.collectionCardPage)||1;
   else state.page=Number(target.dataset.collectionPage)||1;
   // Preserve disclosures while replacing this route's DOM for a filter change.
   const openIds=[...document.querySelectorAll('.collection-study details[open]')].filter(n=>n.id).map(n=>n.id);
   const flowOpen=target.hasAttribute('data-collection-step');render();
   for(const id of openIds){const node=document.getElementById(id);if(node)node.open=true;}
   if(flowOpen){const button=[...document.querySelectorAll('[data-collection-step]')].find(n=>n.dataset.collectionStep===state.step);button?.closest('details')?.setAttribute('open','');button?.focus({preventScroll:true});}
   if(target.hasAttribute('data-collection-card-page'))reveal('collection-card-gallery');
   return true;
  },
  handleChange(event){
   const cardField=event.target.dataset.collectionCardFilter;
   if(['cardTheme','cardSet'].includes(cardField)){state[cardField]=event.target.value;state.cardPage=1;if(cardField==='cardTheme'){state.cardSet='1';state.cardQuery='';}render();document.querySelector(`[data-collection-card-filter="${cardField}"]`)?.focus({preventScroll:true});return true;}
   const field=event.target.dataset.collectionFilter;if(!['group','status'].includes(field))return false;state[field]=event.target.value;state.page=1;render();document.getElementById('collection-all-assets').open=true;document.querySelector(`[data-collection-filter="${field}"]`)?.focus({preventScroll:true});return true;
  },
  handleInput(event){
   const card=event.target.hasAttribute('data-collection-card-query');if(!card&&!event.target.hasAttribute('data-collection-query'))return false;
   const input=event.target,start=input.selectionStart,end=input.selectionEnd;state[card?'cardQuery':'query']=input.value;state[card?'cardPage':'page']=1;render();if(!card)document.getElementById('collection-all-assets').open=true;
   const next=document.querySelector(card?'[data-collection-card-query]':'[data-collection-query]');next?.focus({preventScroll:true});next?.setSelectionRange(start,end);return true;
  },
  afterMount(){if(!source)return;const target=[...document.querySelectorAll('[data-collection-source-id]')].find(n=>n.dataset.collectionSourceId===source);if(!target)return;queueMicrotask(()=>{if(!target.isConnected)return;target.open=true;target.scrollIntoView?.({block:'start',behavior:'instant'});target.querySelector('summary')?.focus({preventScroll:true});});}
 };
}
