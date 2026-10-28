import {renderResearch,renderPuzzle,renderInteraction,renderDifficulty,renderInterface,renderStructure,renderUIMotion,renderExperience,renderItemCatalog,renderUIRegistry,interactionExample,difficultyOutput,regionDetail} from './studio-pages.mjs';
import {validMedia,mediaFor} from './visual-model.mjs';
import {createWalkthrough,walkthroughAction} from './walkthrough.mjs';

export function createStudio({getData,getRoute,render,toast,download}){
 let walkthrough=createWalkthrough(),running=new Map();
 const itemFilters={query:'',table:'ItemModelConfig',role:'all',page:1};
 const uiFilters={query:'',category:'all',page:1};
 const mediaDialog=document.querySelector('#media-dialog'),mediaContent=document.querySelector('#media-content');
 const pages={research:()=>renderResearch(getData()),puzzle:()=>renderPuzzle(getData(),itemFilters),'puzzle-interaction':()=>renderInteraction(getData()),'puzzle-difficulty':()=>renderDifficulty(getData()),interface:()=>renderInterface(getData(),uiFilters),'interface-structure':()=>renderStructure(getData()),'interface-motion':()=>renderUIMotion(getData()),experience:()=>renderExperience(walkthrough,getData())};
 const renderItem=()=>{document.querySelector('#item-catalog').innerHTML=renderItemCatalog(getData(),itemFilters);};
 const renderUI=()=>{document.querySelector('#ui-registry').innerHTML=renderUIRegistry(getData(),uiFilters);};
 function preserveInput(id,update){const node=document.getElementById(id),start=node.selectionStart,end=node.selectionEnd;update();const next=document.getElementById(id);next.focus({preventScroll:true});if(next.type==='search')next.setSelectionRange(start,end);}
 function closeMedia(){mediaDialog.close();mediaContent.replaceChildren();}
 function openMedia(key){
  const entry=mediaFor(getData(),key);if(!validMedia(entry)){toast('연결된 실제 캡처가 아직 없습니다.');return;}
  const title=document.createElement('h2');title.id='media-title';title.textContent=entry.alt;
  const asset=document.createElement(entry.kind==='video'?'video':'img');asset.src=entry.src;
  if(entry.kind==='video'){asset.controls=true;asset.autoplay=false;asset.playsInline=true;if(entry.poster)asset.poster=entry.poster;}
  else asset.alt=entry.alt;
  const caption=document.createElement('p');caption.textContent=`${entry.source}${entry.capturedAt?' · '+entry.capturedAt:''}${entry.version?' · v'+entry.version:''}${entry.notes?' · '+entry.notes:''}`;
  const stop=document.createElement('button');stop.className='button';stop.textContent=entry.kind==='gif'?'GIF 정지·닫기':'닫기';stop.addEventListener('click',closeMedia);
  mediaContent.replaceChildren(title,asset,caption,stop);mediaDialog.showModal();document.querySelector('#close-media').focus();
 }
 function handleWalk(action,value){
  if(action==='reset'){walkthrough=createWalkthrough();render();document.querySelector('[data-walk="reset"]').focus({preventScroll:true});return;}
  if(action==='export'){download('harbor-flow-experiment.json',{schemaVersion:1,kind:'independent-flow-prototype',targetVersion:'4.10.5',boundary:'실험용 아이템·주문·튜토리얼·집 비용. 원작 전체 재현 아님.',state:walkthrough});return;}
  const previousStage=walkthrough.stage;walkthroughAction(walkthrough,action,value);render();
  const focus=document.querySelector(`[data-walk="${action}"]${value!==undefined?`[data-value="${value}"]`:''}`);if(focus)focus.focus({preventScroll:true});
  else if(previousStage!==walkthrough.stage){const scene=document.querySelector('.experience-scene');scene.tabIndex=-1;scene.focus({preventScroll:true});}
 }
 document.addEventListener('click',event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.hasAttribute('data-walk')){handleWalk(target.dataset.walk,target.dataset.value);return;}
  if(target.hasAttribute('data-demo')){
   const id=target.dataset.demo,node=document.getElementById('demo-'+id);if(!node)return;
   const existing=running.get(id);if(existing){clearTimeout(existing);running.delete(id);node.classList.remove('playing');target.textContent='웹 시연 재생';target.setAttribute('aria-pressed','false');return;}
   node.classList.remove('playing');void node.offsetWidth;node.classList.add('playing');target.textContent='시연 정지';target.setAttribute('aria-pressed','true');
   const timer=setTimeout(()=>{node.classList.remove('playing');target.textContent='웹 시연 재생';target.setAttribute('aria-pressed','false');running.delete(id);},2000);running.set(id,timer);return;
  }
  if(target.dataset.interaction){for(const b of document.querySelectorAll('[data-interaction]'))b.setAttribute('aria-pressed',String(b===target));document.querySelector('#interaction-example').innerHTML=interactionExample(target.dataset.interaction);return;}
  if(target.dataset.uiRegion){for(const b of document.querySelectorAll('[data-ui-region]'))b.setAttribute('aria-pressed',String(b===target));document.querySelector('#region-inspector').innerHTML=regionDetail(target.dataset.uiRegion);return;}
  if(target.hasAttribute('data-item-page')){itemFilters.page=Number(target.dataset.itemPage);renderItem();document.querySelector('#item-catalog').scrollIntoView({block:'start'});document.querySelector('#item-query').focus({preventScroll:true});return;}
  if(target.hasAttribute('data-ui-page')){uiFilters.page=Number(target.dataset.uiPage);renderUI();document.querySelector('#ui-registry').scrollIntoView({block:'start'});document.querySelector('#ui-query').focus({preventScroll:true});return;}
  if(target.dataset.mediaKey)openMedia(target.dataset.mediaKey);
 });
 document.addEventListener('input',event=>{const t=event.target;
  if(t.id==='item-query'){itemFilters.query=t.value;itemFilters.page=1;preserveInput(t.id,renderItem);}
  if(t.id==='ui-query'){uiFilters.query=t.value;uiFilters.page=1;preserveInput(t.id,renderUI);}
  if(t.hasAttribute('data-visual-depth'))document.querySelector('#difficulty-output').innerHTML=difficultyOutput(Number(t.value));
 });
 document.addEventListener('change',event=>{const t=event.target;
  if(t.id==='item-table'){itemFilters.table=t.value;itemFilters.page=1;renderItem();document.querySelector('#item-table').focus({preventScroll:true});}
  if(t.id==='item-role'){itemFilters.role=t.value;itemFilters.page=1;renderItem();document.querySelector('#item-role').focus({preventScroll:true});}
  if(t.id==='ui-category'){uiFilters.category=t.value;uiFilters.page=1;renderUI();document.querySelector('#ui-category').focus({preventScroll:true});}
 });
 document.querySelector('#close-media').addEventListener('click',closeMedia);
 mediaDialog.addEventListener('close',()=>mediaContent.replaceChildren());
 mediaDialog.addEventListener('cancel',()=>mediaContent.replaceChildren());
 function afterRender(){for(const [id,timer]of running){clearTimeout(timer);}running.clear();}
 return {renderPage:id=>pages[id]?.()||'',afterRender};
}
