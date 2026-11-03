export const COLLECTION_OUTLINE=[
 ['collection-operation','운영 방식'],
 ['collection-content-flow','콘텐츠 플로우'],
 ['collection-play-loop','플레이 루프'],
 ['collection-resource-summary','리소스 수량'],
 ['collection-bm','관련 BM'],
 ['collection-all-assets','전체 자산·CSV']
];

export function collectionOutlineEntries(root){
 return COLLECTION_OUTLINE.map(([id,title])=>({id,title,heading:root.querySelector('#'+id)})).filter(entry=>entry.heading);
}

// Track the full section, including long galleries and gaps between headings.
export function activeCollectionSection(entries,activationLine=112){
 let active=entries[0]||null;
 for(const entry of entries)if(entry.heading.getBoundingClientRect().top<=activationLine)active=entry;
 return active;
}

export function mountCollectionScrollSpy({root,outline,entries,win=window}){
 let pending=null,disposed=false;
 const frame=win.requestAnimationFrame?.bind(win)||win.setTimeout.bind(win);
 const cancel=win.cancelAnimationFrame?.bind(win)||win.clearTimeout.bind(win);
 function update(){
  pending=null;if(disposed||!root.isConnected)return;
  const header=root.ownerDocument.querySelector('.topbar');
  // Match the document's112px scroll padding so clicked sections stay current.
  const line=Math.min(160,Math.max(112,(header?.getBoundingClientRect().bottom||80)+32));
  const active=activeCollectionSection(entries,line);
  for(const link of outline.querySelectorAll('[data-outline-target]')){
   if(link.dataset.outlineTarget===active?.id)link.setAttribute('aria-current','location');
   else link.removeAttribute('aria-current');
  }
  const current=outline.querySelector('[data-collection-current]');
  if(current)current.textContent=active?'현재 위치 · '+active.title:'';
 }
 function schedule(){if(!disposed&&pending===null)pending=frame(update);}
 win.addEventListener('scroll',schedule,{passive:true});
 win.addEventListener('resize',schedule);
 root.addEventListener('load',schedule,true);
 root.addEventListener('toggle',schedule,true);
 const resize=win.ResizeObserver?new win.ResizeObserver(schedule):null;
 resize?.observe(root);update();
 return ()=>{
  disposed=true;if(pending!==null)cancel(pending);
  win.removeEventListener('scroll',schedule);win.removeEventListener('resize',schedule);
  root.removeEventListener('load',schedule,true);root.removeEventListener('toggle',schedule,true);
  resize?.disconnect();
 };
}
