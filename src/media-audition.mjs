const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='harbor-research-audition-v1';
const clipsFor=data=>[...(data.refinement?.audio?.clips||[]),...(data.sourceAudio?.clips||[]),...(data.sourceSceneStage?.audio?.clips||[]).map(c=>({id:'stage-'+c.id,title:c.id,assetName:c.id,kind:c.isMusicExcerpt?'music':'effect',...c.media,sha256:c.media.sha256,excerptSeconds:c.media.duration,routeSummary:'정확한CG·회상·스토리 호출 자료. 실제원작청취/동기는미검증.',sources:[{path:'packaged AudioClip / '+c.source.bundleFile,sha256:c.source.sourceSHA256,pathId:c.source.pathId,evidenceType:'exact-packaged-AudioClip-object'}]}))].filter(c=>/^[\w-]+$/.test(c.id)&&/^\.\/assets\/media\/[\w./-]+\.(mp3|wav|ogg)$/.test(c.src)&&!c.src.includes('..')&&/^[a-f0-9]{64}$/.test(c.sha256||c.output?.sha256));
export function createAuditionBook(){return {schema:1,origin:'local-user-review',records:[]};}
export function validAuditionBook(book){return Boolean(book&&book.schema===1&&book.origin==='local-user-review'&&Array.isArray(book.records)&&book.records.length<=200&&book.records.every(r=>r&&typeof r.clipId==='string'&&/^[\w-]{1,100}$/.test(r.clipId)&&/^[a-f0-9]{64}$/.test(r.sha256)&&['heard','uncertain'].includes(r.verdict)&&typeof r.note==='string'&&r.note.length<=1500&&typeof r.updatedAt==='string'&&Number.isFinite(Date.parse(r.updatedAt)))&&new Set(book.records.map(r=>r.clipId+':'+r.sha256)).size===book.records.length);}
export function recordAudition(book,clips,{clipId,verdict,note='',now=new Date().toISOString()}={}){
 if(!validAuditionBook(book))return {ok:false,message:'기존 청취 기록을 보존했습니다. 내보내기로 먼저 확인하세요.'};
 const clip=clips.find(c=>c.id===clipId),sha256=clip?.sha256||clip?.output?.sha256;
 if(!clip||!/^[a-f0-9]{64}$/.test(sha256)||!['heard','uncertain'].includes(verdict)||typeof note!=='string'||note.length>1500||typeof now!=='string'||!Number.isFinite(Date.parse(now)))return {ok:false,message:'현재 음원과 직접 청취 여부·메모를 확인하세요.'};
 const next=structuredClone(book),record={clipId,sha256,verdict,note,updatedAt:now},index=next.records.findIndex(r=>r.clipId===clipId&&r.sha256===sha256);
 if(index<0)next.records.push(record);else next.records[index]=record;
 if(!validAuditionBook(next))return {ok:false,message:'청취 기록 저장 한도를 확인하세요.'};
 return {ok:true,book:next};
}
export function renderMediaAudition(data,book=createAuditionBook(),notice=''){
 const clips=clipsFor(data);if(!clips.length)return '';
 const valid=validAuditionBook(book),recordFor=c=>valid?book.records.find(r=>r.clipId===c.id&&r.sha256===(c.sha256||c.output?.sha256)):null,heard=clips.filter(c=>recordFor(c)?.verdict==='heard').length;
 return `<section class="media-audition" aria-labelledby="audition-title"><h3 id="audition-title">APK 짧은 음원 · 직접 청취 기록</h3><p>효과음12개와 음악 발췌2개를 직접 재생하며 메모할 수 있습니다. 아래 표시는 사용자가 명시적으로 남긴 이 브라우저의 기록입니다. AI의 청취 완료나 실제 녹화본110개의 음향·입력 동기 검증으로 합산하지 않습니다.</p><p role="status">내 직접 청취 표시 ${heard}/${clips.length}개${notice?' · '+e(notice):''}</p><button type="button" class="button" data-audition-export>내 청취 기록 JSON</button>${valid?'':'<p>저장된 기록의 형식을 확인할 수 없어 원문을 보존했습니다. JSON으로 내려받을 수 있으며 자동으로 초기화하지 않습니다.</p>'}<div class="audition-grid">${clips.map(c=>{const r=recordFor(c);return `<article data-audition-id="${e(c.id)}"><h4>${e(c.title)}</h4><p><code>${e(c.assetName)}</code> · ${Number(c.excerptSeconds||c.duration).toFixed(3)}초</p><audio controls preload="none" src="${e(c.src)}" aria-label="${e(c.title)} APK 음원"></audio><p>${e(c.routeSummary||c.note||'동봉 음원 발췌')}</p><label>내 청취 상태<select data-audition-verdict><option value="">아직 기록 안 함</option><option value="heard"${r?.verdict==='heard'?' selected':''}>직접 들음</option><option value="uncertain"${r?.verdict==='uncertain'?' selected':''}>듣거나 판단하지 못함</option></select></label><label>내 메모<textarea data-audition-note maxlength="1500" rows="2" placeholder="직접 들은 내용 또는 미확인 이유">${e(r?.note||'')}</textarea></label><button type="button" class="button" data-audition-save="${e(c.id)}"${valid?'':' disabled'}>이 음원 기록 저장</button><details><summary>음원 출처·확인 범위</summary><p>${e(c.source)}</p><p>공개 음원 SHA-256 <code>${e(c.sha256||c.output?.sha256)}</code></p><p>재생 종료 이벤트나 파형 일치만으로 직접 청취로 기록하지 않습니다. 원본 녹화의 혼합 음향은 이 페이지에서 공개하지 않습니다.</p></details></article>`;}).join('')}</div></section>`;
}
export function createMediaAudition({getData,render,download,storage}={}){
 let book=createAuditionBook(),raw='',notice='';
 try{storage??=globalThis.localStorage;raw=storage?.getItem(key)||'';if(raw)book=JSON.parse(raw);}catch{if(raw)book=null;else notice='브라우저 저장을 사용할 수 없으며 현재 탭 기록은 JSON으로 보관할 수 있습니다.';}
 return {renderPage:()=>renderMediaAudition(getData(),book,notice),handleClick(event){const target=event.target.closest('[data-audition-save],[data-audition-export]');if(!target)return false;
  if(target.hasAttribute('data-audition-export')){download('harbor-audition-notes.json',validAuditionBook(book)?JSON.stringify({...book,boundary:'Local user attestations for exact APK excerpts; no original recording identity, native execution, or checklist completion is inferred.'},null,2):raw,'application/json');return true;}
  const card=target.closest('[data-audition-id]'),result=recordAudition(book,clipsFor(getData()),{clipId:target.dataset.auditionSave,verdict:card?.querySelector('[data-audition-verdict]')?.value,note:card?.querySelector('[data-audition-note]')?.value||''});
  if(result.ok){book=result.book;notice='이 음원의 직접 청취 메모를 저장했습니다.';try{if(storage)storage.setItem(key,JSON.stringify(book));else notice='현재 탭에 기록했습니다. 영구 보관은 JSON 내려받기를 사용하세요.';}catch{notice='현재 탭에 기록했습니다. 영구 보관은 JSON 내려받기를 사용하세요.';}}
  else notice=result.message;
  render();document.querySelector('[data-audition-save="'+target.dataset.auditionSave+'"]')?.focus({preventScroll:true});return true;
 }};
}
