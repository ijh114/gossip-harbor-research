import {DOMAIN_DEFS, selectDomainFacts} from './domain-model.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase();
const factRoute=fact=>DOMAIN_DEFS.find(d=>selectDomainFacts([fact],d.id).length)?.id||'wiki';

// One search index across chapters, findings and products; source excerpts remain searchable.
export function searchNotebook(data,query){
 const q=normalize(query).trim();if(!q)return {chapters:[],facts:[],products:[]};
 const matches=value=>normalize(value).includes(q);
 return {
  chapters:DOMAIN_DEFS.filter(d=>matches([d.title,d.subtitle,d.intro].join(' '))),
  facts:data.facts.filter(f=>matches(JSON.stringify(f))).sort((a,b)=>Number(matches(b.title))-Number(matches(a.title))),
  products:data.products.filter(p=>matches([p.id,p.title,p.kind,p.conditions,p.other].join(' ')))
 };
}

export function createReader({getData,getRoute,clearQuery,render,toast}){
 const view=document.querySelector('#app-view'), search=document.querySelector('#global-search');
 const results=document.querySelector('#search-results'), outline=document.querySelector('#page-outline');
 let detailsOpen=false,lastRoute='',observer,searchTimer;
 try{document.body.dataset.textSize=window.localStorage.getItem('harbor-text-size')==='large'?'large':'normal';}catch{/* Storage can be unavailable in private contexts. */}
 function closeSearch(){clearTimeout(searchTimer);results.hidden=true;search.setAttribute('aria-expanded','false');}
 function updateSearch(){
  const data=getData();if(!data||!search.value.trim()){closeSearch();return;}
  const found=searchNotebook(data,search.value),total=found.chapters.length+found.facts.length+found.products.length;
  const link=(href,title,detail)=>`<a class="search-result" data-search-result href="${escape(href)}"><strong>${escape(title)}</strong><small>${escape(detail)}</small></a>`;
  results.innerHTML=`<div class="search-result-head"><strong role="status">${total}개 검색 결과</strong><button class="button small" data-action="close-search">닫기</button></div>`+
   (found.chapters.length?`<h3>분석 페이지</h3>${found.chapters.slice(0,3).map(d=>link('#'+d.id,d.title,d.subtitle)).join('')}`:'')+
   (found.facts.length?`<h3>규칙과 근거 · ${found.facts.length}건</h3>${found.facts.slice(0,6).map(f=>link(`#${factRoute(f,data)}?finding=${encodeURIComponent(f.id)}`,f.title,f.summary)).join('')}`:'')+
   (found.products.length?`<h3>상품 · ${found.products.length}건</h3>${found.products.slice(0,3).map(p=>link('#catalog?product='+encodeURIComponent(p.id),p.title||p.id,p.id+' · 내장 USD 기본가')).join('')}`:'')+
   (!total?'<p class="search-feedback">일치하는 항목이 없습니다. 에너지, 보드, 상점 또는 상품 ID로 검색해 보세요.</p>':'')+
   (found.facts.length>6?'<div class="search-result-footer"><button class="button" data-action="search-all">근거 검색 결과 모두 보기</button></div>':'');
  results.hidden=false;search.setAttribute('aria-expanded','true');
 }
 function readHeading(target){
  target.scrollIntoView({block:'start'});target.tabIndex=-1;target.focus({preventScroll:true});
 }
 function followLocation(){
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const finding=params.get('finding');
  if(finding){const node=document.getElementById('finding-'+finding);if(node){for(const detail of node.querySelectorAll('details'))detail.open=true;readHeading(node);}}
  const section=params.get('section');
  if(section){const node=document.getElementById('section-'+section)||document.getElementById(section);if(node)readHeading(node);}
 }
 function afterRender(){
  observer?.disconnect();
  const route=getRoute(),changed=route!==lastRoute;lastRoute=route;
  for(const d of view.querySelectorAll('.finding-detail'))d.open=detailsOpen;
  const headings=[...view.querySelectorAll('h2')].filter(h=>!h.closest('.domain-summary-grid,.trace-result,.activity-result'));
  const entries=headings.map((h,i)=>{if(!h.id)h.id='reading-section-'+i;return {id:h.closest('.domain-section')?.id||h.id,title:h.textContent.trim(),heading:h};});
  document.querySelector('#outline-links').innerHTML=entries.map(x=>`<a href="#${route}?section=${encodeURIComponent(x.id.replace(/^section-/,''))}" data-outline-target="${escape(x.id)}">${escape(x.title)}</a>`).join('')+`<a class="outline-top" href="#${route}" data-action="page-top">맨 위로</a>`;
  outline.hidden=entries.length===0;if(changed)outline.open=window.innerWidth>=1280;
  if(window.IntersectionObserver){observer=new window.IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){const entry=entries.find(x=>x.heading===item.target);for(const link of document.querySelectorAll('[data-outline-target]')){if(link.dataset.outlineTarget===entry.id)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');}}},{rootMargin:'-100px 0px -65% 0px'});for(const entry of entries)observer.observe(entry.heading);}
  const sizeButton=document.querySelector('[data-action="text-size"]');sizeButton.setAttribute('aria-pressed',String(document.body.dataset.textSize==='large'));sizeButton.textContent=document.body.dataset.textSize==='large'?'기본 글씨':'글씨 크게';
  const detailButton=document.querySelector('[data-action="toggle-details"]');detailButton.setAttribute('aria-pressed',String(detailsOpen));detailButton.textContent=detailsOpen?'상세 모두 접기':'상세 모두 펼치기';detailButton.hidden=!view.querySelector('.finding-detail');
  for(const wrap of view.querySelectorAll('.table-wrap')){wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',wrap.querySelector('caption')?.textContent||'데이터 표. 좌우로 스크롤할 수 있습니다.');}
  document.querySelector('#reading-status').textContent=DOMAIN_DEFS.find(d=>d.id===route)?'요약 → 구조와 수치 → 규칙과 근거':'게임 시스템 연구 위키';
  if(changed)closeSearch();followLocation();
 }
 async function copyLink(finding){
  const url=new URL(window.location.href),data=getData();
  if(finding){
   const product=data.products.find(p=>p.id===finding),fact=data.facts.find(f=>f.id===finding);
   const destination=document.getElementById('finding-'+finding)?getRoute():fact?factRoute(fact):getRoute();
   url.hash=product?`catalog?product=${encodeURIComponent(finding)}`:`${destination}?finding=${encodeURIComponent(finding)}`;
  }
  try{await window.navigator.clipboard.writeText(url.href);toast('공유 링크를 복사했습니다.');}
  catch{const field=document.createElement('textarea');field.value=url.href;field.setAttribute('aria-label','복사할 공유 링크');field.readOnly=true;field.style.cssText='position:fixed;top:0;left:0';document.body.append(field);field.select();const copied=typeof document.execCommand==='function'&&document.execCommand('copy');field.remove();toast(copied?'공유 링크를 복사했습니다.':'링크를 자동 복사하지 못했습니다. 브라우저 주소를 복사해 주세요.');}
 }
 document.addEventListener('click',event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.hasAttribute('data-search-result')){event.preventDefault();clearQuery();closeSearch();const hash=target.getAttribute('href');if(location.hash===hash){render();followLocation();}else location.hash=hash;return;}
  if(target.hasAttribute('data-share-finding')){copyLink(target.dataset.shareFinding);return;}
  if(target.dataset.outlineTarget){event.preventDefault();const node=document.getElementById(target.dataset.outlineTarget);if(node)readHeading(node);history.replaceState(null,'',target.getAttribute('href'));return;}
  const action=target.dataset.action;
  if(action==='text-size'){document.body.dataset.textSize=document.body.dataset.textSize==='large'?'normal':'large';try{window.localStorage.setItem('harbor-text-size',document.body.dataset.textSize);}catch{}target.setAttribute('aria-pressed',String(document.body.dataset.textSize==='large'));target.textContent=document.body.dataset.textSize==='large'?'기본 글씨':'글씨 크게';}
  if(action==='toggle-details'){detailsOpen=!detailsOpen;for(const d of view.querySelectorAll('.finding-detail'))d.open=detailsOpen;target.textContent=detailsOpen?'상세 모두 접기':'상세 모두 펼치기';target.setAttribute('aria-pressed',String(detailsOpen));}
  if(action==='copy-page')copyLink();
  if(action==='page-top'){event.preventDefault();history.replaceState(null,'','#'+getRoute());window.scrollTo({top:0});document.querySelector('#main').focus({preventScroll:true});}
  if(action==='close-search'){closeSearch();search.focus();}
  if(action==='search-all'){closeSearch();location.hash='wiki';render();}
 });
 document.addEventListener('pointerdown',event=>{if(!results.contains(event.target)&&!event.target.closest('.global-search'))closeSearch();});
 search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(updateSearch,100);});
 search.addEventListener('focus',()=>{if(search.value.trim())updateSearch();});
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();search.focus();}
  if(event.key==='Escape'&&!results.hidden){event.preventDefault();closeSearch();search.focus();}
  if(event.target===search&&event.key==='ArrowDown'&&!results.hidden){event.preventDefault();results.querySelector('a')?.focus();}
  if(event.target===search&&event.key==='Enter'&&!results.hidden){event.preventDefault();results.querySelector('a')?.click();}
 });
 window.addEventListener('resize',()=>{if(window.innerWidth>=1280)outline.open=true;});
 return {afterRender,followLocation,closeSearch};
}
