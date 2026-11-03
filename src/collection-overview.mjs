import {mediaFor,validMedia} from './visual-model.mjs';
import {renderOperationExplorer,renderContentFlow,renderLoopExplorer,renderResourceChart} from './collection-visuals.mjs';

const list=value=>Array.isArray(value)?value:[];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const positive=(value,fallback)=>Number.isFinite(Number(value))&&Number(value)>0?Math.floor(Number(value)):fallback;
const cardIdentity=asset=>/^A(moon|halloween)_set(\d+)_(\d+)$/.exec(asset.name||'');

export function selectCollectionCards(study,{cardTheme='moon',cardSet='1',cardQuery='',cardPage=1,size=27}={}){
 const themes=list(study?.themes),theme=themes.find(t=>t.id===cardTheme)||themes[0];
 const cards=list(study?.resourceAssets).filter(a=>a.groupId==='card-faces').map(asset=>({asset,match:cardIdentity(asset)})).filter(r=>r.match&&r.match[1]===theme?.id);
 const sets=[...new Set(cards.map(r=>Number(r.match[2])))].sort((a,b)=>a-b).map(number=>{
  const cover=list(study?.resourceAssets).find(a=>a.name===`A${theme.id}_set${number}`);
  return {id:String(number),number,title:cover?.displayName||`${number}세트`,coverKey:cover?.mediaKey,count:cards.filter(r=>Number(r.match[2])===number).length};
 });
 const set=cardSet==='all'?'all':sets.find(s=>s.id===String(cardSet))?.id||sets[0]?.id||'all';
 const query=String(cardQuery).trim().toLocaleLowerCase('ko-KR');
 const selected=cards.filter(r=>(set==='all'||Number(r.match[2])===Number(set))&&(!query||[r.asset.name,r.asset.displayName].join(' ').toLocaleLowerCase('ko-KR').includes(query))).sort((a,b)=>Number(a.match[2])-Number(b.match[2])||Number(a.match[3])-Number(b.match[3]));
 const pageSize=Math.min(36,positive(size,27)),pages=Math.max(1,Math.ceil(selected.length/pageSize)),page=Math.min(pages,positive(cardPage,1));
 return {themes,theme,sets,set,total:selected.length,themeTotal:cards.length,totalAcrossThemes:list(study?.resourceAssets).filter(a=>a.groupId==='card-faces').length,pages,page,rows:selected.slice((page-1)*pageSize,page*pageSize).map(r=>({...r.asset,setNumber:Number(r.match[2]),cardNumber:Number(r.match[3])}))};
}

function cardFigure(data,asset){
 const media=mediaFor(data,asset.mediaKey);
 const image=validMedia(media)?`<button type="button" data-media-key="${escape(asset.mediaKey)}" aria-label="${escape(asset.displayName||asset.name)} 카드 이미지 확대"><img src="${escape(media.src)}" alt="${escape(asset.displayName||asset.name)}" width="${media.width}" height="${media.height}" loading="lazy" decoding="async"></button>`:'<p class="empty-state">이미지를 불러올 수 없습니다. 아래 자산 키로 전체 목록을 확인하세요.</p>';
 return `<figure class="collection-card-figure">${image}<figcaption><span>${asset.setNumber}세트 · ${asset.cardNumber}번</span><strong>${escape(asset.displayName||asset.name)}</strong><details><summary>자산 정보</summary><code>${escape(asset.name)}</code><p>원본 추출 ${asset.width} × ${asset.height}px<br>공개 도감은 연구용 축소본입니다.</p></details></figcaption></figure>`;
}

export function renderCollectionCards(data,state={}){
 const result=selectCollectionCards(data.collectionStudy,state);
 const selected=result.sets.find(s=>s.id===result.set),cover=selected&&mediaFor(data,selected.coverKey);
 return `<section class="collection-section collection-card-catalog" id="collection-card-gallery" aria-labelledby="collection-card-title">
 <h2 id="collection-card-title" tabindex="-1">카드 컬렉션 도감</h2>
 <p>두 테마의 카드 앞면 ${result.totalAcrossThemes}개를 세트별로 비교합니다. 이미지를 누르면 확대됩니다. 원본 카탈로그에 연결해 확보한 자산이며, 현재 활성 시즌·성급 배정은 미확인입니다.</p>
 <div class="collection-card-controls">
 <label>시즌 테마<select data-collection-card-filter="cardTheme">${result.themes.map(t=>`<option value="${escape(t.id)}"${t.id===result.theme?.id?' selected':''}>${escape(t.name)}</option>`).join('')}</select></label>
 <label>카드 세트<select data-collection-card-filter="cardSet"><option value="all"${result.set==='all'?' selected':''}>시즌 전체 ${result.themeTotal}장</option>${result.sets.map(s=>`<option value="${s.id}"${result.set===s.id?' selected':''}>${s.number}세트 · ${escape(s.title)} (${s.count}장)</option>`).join('')}</select></label>
 <label>선택한 범위에서 카드 검색<input type="search" data-collection-card-query value="${escape(state.cardQuery||'')}" placeholder="카드 이름 또는 자산 키"></label>
 </div>
 ${selected?`<div class="collection-selected-set">${validMedia(cover)?`<button type="button" data-media-key="${escape(selected.coverKey)}" aria-label="${escape(selected.title)} 세트 표지 확대"><img src="${escape(cover.src)}" alt="${escape(selected.title)} 세트 표지" width="${cover.width}" height="${cover.height}" loading="lazy"></button>`:''}<div><h3>${escape(selected.title)}</h3><p>${escape(result.theme?.name)} · ${selected.number}세트 · 카드 ${selected.count}장</p></div></div>`:''}
 <p class="collection-gallery-status" role="status" aria-live="polite">${escape(result.theme?.name||'')} · 검색 결과 ${result.total}장 · ${result.page}/${result.pages}페이지</p>
 ${result.rows.length?`<div class="collection-card-grid">${result.rows.map(a=>cardFigure(data,a)).join('')}</div>`:'<p class="empty-state">일치하는 카드가 없습니다. 검색어를 지우거나 카드 세트를 ‘시즌 전체’로 바꿔주세요.</p>'}
 <div class="gallery-pagination"><span>전체 ${result.themeTotal}장 중 ${result.total}장 검색</span><div><button type="button" class="button" data-collection-card-page="${result.page-1}"${result.page<=1?' disabled':''}>이전 카드</button><button type="button" class="button" data-collection-card-page="${result.page+1}"${result.page>=result.pages?' disabled':''}>다음 카드</button></div></div>
 </section>`;
}

export function collectionResourceSummary(study){
 const perTheme=name=>list(study.themes).map(t=>list(study.resourceAssets).filter(a=>a.groupId===name&&a.name?.startsWith(`A${t.id}_`)).length);
 return ['card-faces','set-covers','set-backgrounds','card-nameplates'].map(id=>{
  const group=list(study.resourceGroups).find(g=>g.id===id);
  return {id,title:group?.title||id,total:list(study.resourceAssets).filter(a=>a.groupId===id).length,perTheme:perTheme(id)};
 });
}

export function renderCollectionOperations(data,sourceLinks,state={}){
 const study=data.collectionStudy,analysis=study.operationalAnalysis;if(!analysis)return '';
 const themeLabel=list(study.themes).map(t=>escape(t.name)).join(' / '),shared=list(analysis.sharedResources).map(id=>list(study.resourceGroups).find(g=>g.id===id)).filter(Boolean);
 return `<section class="collection-section" id="collection-operation" aria-labelledby="collection-operation-title">
 <h2 id="collection-operation-title" tabindex="-1">운영 방식 · 시즌의 한 바퀴</h2><p>${escape(analysis.summary)}</p>
 ${renderOperationExplorer(data,state,sourceLinks)}
 <p class="collection-method-note">${escape(analysis.phaseBoundary)}</p>
 <details class="collection-reference-details"><summary>전체 운영 단계를 글로 비교하기</summary><ol class="collection-operation-timeline">${analysis.phases.map(p=>`<li><h3>${escape(p.title)}</h3><p>${escape(p.player)}</p><dl><dt>운영에서 조절하는 것</dt><dd>${escape(p.control)}</dd></dl></li>`).join('')}</ol></details>
 </section>
 ${renderContentFlow(data,state,sourceLinks)}
 <section class="collection-section" id="collection-play-loop" aria-labelledby="collection-play-loop-title">
 <h2 id="collection-play-loop-title" tabindex="-1">플레이 루프 · 보상이 다음 플레이로</h2><p>${escape(analysis.loopSummary)}</p>
 ${renderLoopExplorer(data,state,sourceLinks)}
 <details class="collection-reference-details"><summary>세트 완성·중복 활용·이벤트 연결의 작은 루프</summary><div class="collection-loop-rows">${analysis.subLoops.map(loop=>`<article><h3>${escape(loop.title)}</h3><p>${escape(loop.path)}</p><p>${escape(loop.purpose)}</p></article>`).join('')}</div></details>
 <p class="collection-method-note">실제 보상량·무료 완성률·완성까지 걸리는 시간은 서버 운영표와 플레이 검증이 필요합니다.</p>
 </section>
 <section class="collection-section" id="collection-resource-summary" aria-labelledby="collection-resource-summary-title">
 <h2 id="collection-resource-summary-title" tabindex="-1">리소스 수량 · 무엇을 얼마나 만드는가</h2>
 ${renderResourceChart(data,state)}
 <details class="collection-reference-details"><summary>테마별 원화·공용 부품 수량표</summary><p>${themeLabel}의 확보 자산입니다.</p><div class="table-wrap" tabindex="0" role="region" aria-label="테마별 카드 리소스 수량"><table class="collection-count-table"><thead><tr><th scope="col">리소스</th>${study.themes.map(t=>`<th scope="col">${escape(t.name)}</th>`).join('')}<th scope="col">합계</th></tr></thead><tbody>${collectionResourceSummary(study).map(r=>`<tr><th scope="row">${escape(r.title)}</th>${r.perTheme.map(n=>`<td>${n}개</td>`).join('')}<td>${r.total}개</td></tr>`).join('')}</tbody></table></div><dl class="collection-shared-resources">${shared.map(g=>`<div><dt>${escape(g.title)}</dt><dd>${g.quantity} ${escape(g.unit)}</dd></div>`).join('')}</dl></details>
 <p class="collection-method-note">${escape(analysis.resourceBoundary)}</p>
 <p class="collection-production-formula"><strong>신규 시즌 카드 원화 = 선택한 세트 수 × 세트당 카드 수</strong><br>세트 표지·테마 장식을 추가하고 공용 프레임·NEW·중복 수량·개봉 효과를 재사용합니다. 신규 게임의 제작 산식이며 원작 확정 발주 수량은 아닙니다.</p>
 <p><a class="text-link" href="#collection?view=cards">카드 컬렉션 도감에서 이미지 보기</a> · <a class="text-link" href="#production-assets">제작 범위 정하기</a></p>${sourceLinks(['image-config','remote-retrieval'])}
 </section>`;
}
