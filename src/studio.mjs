import {createCurrentMaterialReview} from './current-material-review.mjs';
import {createTutorialSurfacesController} from './tutorial-surfaces.mjs';
import {renderNativeMapStudy,mountNativeMapStudy} from './native-map-study.mjs';
import {createRecapMotionStudy} from './recap-motion-study.mjs';
import {createRegisteredActivityController} from './registered-activity.mjs';
import {createSkinShopController} from './skin-shop-controller.mjs';
import {createSceneCast} from './scene-cast.mjs';
import {createSpineMotionStudy} from './spine-motion-study.mjs';
import {mountItemResolutionFollowup} from './item-resolution-followup.mjs';
import {mountCaptureFollowupStudy} from './capture-followup-study.mjs';
import {createMediaAudition} from './media-audition.mjs';
import {createResourceAudit} from './resource-audit.mjs';
import {createCollectionStudy} from './collection-page.mjs';
import {renderAPKMediaReview} from './apk-media-review.mjs';
import {createTutorialCatalogWorkbench} from './tutorial-catalog-page.mjs';
import {renderMasterChecklist} from './checklist-page.mjs';
import {renderProgressionStudy} from './progression-study.mjs';
import {createFactoryReference} from './factory-reference.mjs';
import {createMoreTutorials,moreTutorialEvent,moreTutorialView,validMoreTutorials} from './tutorial-more.mjs';
import {renderBMObservationAudit,mountBMObservationAudit} from './bm-observation-audit.mjs';
import {renderArtifactAvailability} from './artifact-availability.mjs';
import {createTutorialWorkbench} from './tutorial-page.mjs';
import {renderResearch,renderPuzzle,renderPuzzleMotion,renderInteraction,renderDifficulty,renderInterface,renderStructure,renderUIMotion,renderExperience,renderItemCatalog,renderUIRegistry,difficultyOutput,regionDetail} from './studio-pages.mjs';
import {validMedia,mediaFor} from './visual-model.mjs';
import {createWalkthrough,walkthroughAction} from './walkthrough.mjs';
import {renderCaptures} from './capture-pages.mjs';
import {createPlayController} from './play-controller.mjs';
import {renderBMTimeline} from './bm-timeline.mjs';
import {mountInteractionLoops} from './interaction-gallery.mjs';
import {createProductionController} from './production-controller.mjs';
import {renderMediaAudit} from './media-audit-page.mjs';
import {renderAudioReadout} from './capture-study.mjs';
import {renderSceneAnalysis,growthReadout} from './research-completion.mjs';

export function createStudio({getData,getRoute,render,toast,download}){
 let walkthrough=createWalkthrough(),running=new Map();
 let nativeMapCleanup=()=>{};
 let lastExperienceHash='',playMode='game',interactionCleanup=()=>{},lastAPKTask=null;
 const tutorials=createTutorialWorkbench({getData,render,download});
 const catalogTutorials=createTutorialCatalogWorkbench({getData,render,download});
 const moreTutorials=createTutorialWorkbench({getData,render,download,storageKey:'harbor-tutorial-more-v1',configKey:'tutorialMoreConfig',model:{create:createMoreTutorials,event:moreTutorialEvent,view:moreTutorialView,valid:validMoreTutorials},title:'추가 튜토리얼 · 두 번째 조건 실험'});
 let checklistStatus='all',checklistCurrentOnly=false,checklistRemaining='all';
 const motionState={role:'all',clip:''};
 let growthMetric='actions',growthSeed=42;
 let tutorialPack='first',availabilityFilter={status:'all',group:'all',query:''};
 const tutorialPage=()=>'<nav class="studio-tabs" aria-label="추가 안내 자료 묶음"><button class="button" data-tutorial-pack="first" aria-pressed="'+(tutorialPack==='first')+'">기존 추가 안내 5종</button><button class="button" data-tutorial-pack="more" aria-pressed="'+(tutorialPack==='more')+'">신규 추가 안내 5종</button><button class="button" data-tutorial-pack="catalog" aria-pressed="'+(tutorialPack==='catalog')+'">나머지 안내87종</button></nav>'+(tutorialPack==='catalog'?catalogTutorials:tutorialPack==='more'?moreTutorials:tutorials).renderPage();
 const collection=createCollectionStudy({getData,render,download});
 const resourceAudit=createResourceAudit({getData,render,download});
 const wikiRecap=createRecapMotionStudy({getData});
 const spineMotions=createSpineMotionStudy({getData,render,download});
 const mediaAudition=createMediaAudition({getData,render,download});
 const production=createProductionController({getData,render,download,toast});
 const auditFilters={query:'',category:'all',status:'all'};
 let lastAuditSource=null;
 const auditPage=()=>{const source=new URLSearchParams(location.hash.split('?')[1]||'').get('source');if(source!==lastAuditSource){lastAuditSource=source;if(source&&getData()?.mediaAudit?.videos.some(v=>v.id===source)){auditFilters.query=source;auditFilters.category='all';auditFilters.status='all';}}return renderMediaAudit(getData(),auditFilters);};
 const sourcePlay=createPlayController({getData,render,download});
 const tutorialSurfaces=createTutorialSurfacesController({getData,render,download});
 const currentMaterials=createCurrentMaterialReview({getData,render,download});
 const registered=createRegisteredActivityController({getData,render,download});
 const skinShop=createSkinShopController({getData,download,onAcquire:(ledger,c)=>sourcePlay.applySkinAcquisitions(ledger,c)});
 const castStudy=createSceneCast({getData:()=>getData().sceneCastStudy,render});
 const liveCast=createSceneCast({getData:()=>getData().sceneCastStudy,render});
 const factoryReference=createFactoryReference({getData,getRoute,render});
 let sceneId=null;
 const scenePage=()=>{const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('task'),id=requested||sceneId||'1_1',d=getData();return renderSceneAnalysis(d,id)+(d.nativeMapStudy?.views.some(v=>v.slotId===id)?renderNativeMapStudy(d.nativeMapStudy,{slotId:id}):'');};
 const playPage=()=>{if(location.hash!==lastExperienceHash){lastExperienceHash=location.hash;const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('mode');if(['game','source','activities','registered','skin-shop','cast','guides','prototype'].includes(requested))playMode=requested;}const opts=playMode==='game'?sourcePlay.castOptions():null;let body;if(playMode==='guides')body=tutorialSurfaces.renderPage();else if(playMode==='registered')body=registered.renderPage();else if(playMode==='skin-shop')body=skinShop.renderPage();else if(playMode==='cast')body=castStudy.renderPage();else if(playMode==='prototype')body=renderExperience(walkthrough,getData());else{if(opts)liveCast.update(opts);body=sourcePlay.render(playMode,{sceneCastHTML:opts?liveCast.renderPage(opts):''});}return `<nav class="studio-tabs" aria-label="게임 시뮬레이션 모드"><button class="button" data-play-mode="game" aria-pressed="${playMode==='game'}">게임 플레이</button><button class="button" data-play-mode="source" aria-pressed="${playMode==='source'}">APK 설정 기반 플레이</button><button class="button" data-play-mode="activities" aria-pressed="${playMode==='activities'}">패스·앨범·이벤트</button><button class="button" data-play-mode="guides" aria-pressed="${playMode==='guides'}">튜토리얼 컴포넌트</button><button class="button" data-play-mode="registered" aria-pressed="${playMode==='registered'}">등록 이벤트 보드</button><button class="button" data-play-mode="skin-shop" aria-pressed="${playMode==='skin-shop'}">Skin 획득 거래</button><button class="button" data-play-mode="cast" aria-pressed="${playMode==='cast'}">캐릭터·CG</button><button class="button" data-play-mode="prototype" aria-pressed="${playMode==='prototype'}">기존 흐름 시연</button></nav>`+body;};
 const itemFilters={query:'',table:'ItemModelConfig',role:'all',page:1};
 const uiFilters={query:'',category:'all',page:1};
 const captureFilters={category:'all',kind:'all'};
 const studyState={topic:'all',query:'',selected:'',region:'',frame:''};let lastStudySource=null,studyLoopsPaused;
 const capturePage=()=>{const id=new URLSearchParams(location.hash.split('?')[1]||'').get('study');if(id!==lastStudySource){lastStudySource=id;if(id&&getData()?.refinement?.studies.some(s=>s.id===id)){Object.assign(studyState,{topic:'all',query:'',selected:id,region:'',frame:''});}}return renderCaptures(getData(),captureFilters,studyState);};
 const timelineFilters={entryId:null,milestoneId:null,baselineId:null};
 const mediaDialog=document.querySelector('#media-dialog'),mediaContent=document.querySelector('#media-content');
 const pages={'current-material-review':()=>currentMaterials.renderPage(),'spine-motions':()=>spineMotions.renderPage(),'resource-audit':()=>resourceAudit.renderPage(),collection:()=>collection.renderPage()+'<aside class="resource-boundary"><h2>앨범 상위 변형을 직접 확인하기</h2><p>조커의 보유 순서·금카드 제한, 다음 라운드와Royal 별도 세트·왕관 종료를 연구 시즌에 연결했습니다. 운영 확률·활성 배정은 명시 입력과 미확정으로 구분합니다.</p><a class="button" href="#experience?mode=activities">조커·다음 라운드·Royal 실험</a></aside>','apk-media':()=>renderAPKMediaReview({...getData(),mediaReview:{...getData().mediaReview,selectedTask:new URLSearchParams(location.hash.split('?')[1]||'').get('task')}},{motionState,auditionHTML:mediaAudition.renderPage()}),checklist:()=>renderMasterChecklist(getData(),{status:checklistStatus,currentOnly:checklistCurrentOnly,remainingCategory:checklistRemaining}),'growth-validation':()=>renderProgressionStudy(getData(),{metric:growthMetric,seed:growthSeed}),'factory-reference':()=>factoryReference.renderPage(),'tutorial-analysis':tutorialPage,'bm-observation':()=>renderBMObservationAudit(getData()),'artifact-availability':()=>'<header class="studio-intro"><h1>자산·장면 확보 현황</h1><p>등록·실물·선별 공개·연구 투영을 구분하고 필요한 추가 자료를 확인합니다.</p></header>'+renderArtifactAvailability(getData(),{filter:availabilityFilter}),'scene-analysis':scenePage,'production-assets':()=>"<aside class=\"resource-boundary\"><strong>전체 카탈로그 회수·참조 복원 결과</strong><p>번들2,087개를 회수했고 Spine654건의 직접 참조·네이티브339개 전체 필드를 추가 확인했습니다. 네이티브3개와 GUID19개 실물 공백은 미확정으로 유지합니다. 신규 제작 수량·실제 게임 재생 판정은 기존 조건을 유지합니다.</p><a class=\"button\" href=\"#resource-audit\">리소스 확보·연결 결과 보기</a></aside>"+production.renderPage(),'media-audit':auditPage,'bm-timeline':()=>renderBMTimeline(getData(),timelineFilters),research:()=>renderResearch(getData()),captures:capturePage,puzzle:()=>renderPuzzle(getData(),itemFilters)+'<aside class="resource-boundary"><h2>추가로 확인한 실제 등록 이벤트 이미지</h2><p>Adventure35 · PureBoard35의70개 Sprite/PPtr를 확인했습니다. 서로 공유하는 PNG 내용은32종입니다. 이전 미등록 fixture와 실제 등록 타입을 구분합니다.</p><a class="button" href="#apk-media?task=4.04">70타입 이미지 그리드와 정확 참조 보기</a> <a class="button" href="#experience?mode=registered">등록 보드 이동·합성·먹이 변환 플레이</a></aside>','puzzle-motion':()=>renderPuzzleMotion(getData()),'puzzle-interaction':()=>renderInteraction(getData()),'puzzle-difficulty':()=>renderDifficulty(getData()),interface:()=>renderInterface(getData(),uiFilters),'interface-structure':()=>renderStructure(getData()),'interface-motion':()=>renderUIMotion(getData()),experience:playPage};
 const renderItem=()=>{document.querySelector('#item-catalog').innerHTML=renderItemCatalog(getData(),itemFilters);};
 const renderUI=()=>{document.querySelector('#ui-registry').innerHTML=renderUIRegistry(getData(),uiFilters);};
 function preserveInput(id,update){const node=document.getElementById(id),start=node.selectionStart,end=node.selectionEnd;update();const next=document.getElementById(id);next.focus({preventScroll:true});if(next.type==='search')next.setSelectionRange(start,end);}
 function clearMedia(){for(const video of mediaContent.querySelectorAll('video'))if(!video.paused)video.pause();mediaContent.replaceChildren();}
 function closeMedia(){clearMedia();mediaDialog.close();}
 function openMedia(key){
  const entry=mediaFor(getData(),key);if(!validMedia(entry)){toast('연결된 실제 캡처가 아직 없습니다.');return;}
  const title=document.createElement('h2');title.id='media-title';title.textContent=entry.alt;
  const asset=document.createElement(entry.kind==='video'?'video':'img');asset.src=entry.src;
  if(entry.kind==='video'){asset.controls=true;asset.autoplay=false;asset.playsInline=true;asset.preload='metadata';if(entry.poster)asset.poster=entry.poster;}
  else asset.alt=entry.alt;
  const caption=document.createElement('p');caption.textContent=`${entry.source}${entry.capturedAt?' · '+entry.capturedAt:''}${entry.version?' · v'+entry.version:entry.origin==='observed-user-capture'?' · 캡처 버전 미확인':''}${entry.notes?' · '+entry.notes:''}`;
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
  if(getRoute()==='current-material-review'&&currentMaterials.handleClick(event))return;
  if(getRoute()==='experience'){if(playMode==='guides'){const node=event.target.closest('[data-play]');if(node&&tutorialSurfaces.handleClick(node.dataset.play,node))return;}if(sourcePlay.handleRecapMotionClick(event))return;if(playMode==='registered'&&registered.handleClick(event))return;if(playMode==='skin-shop'&&skinShop.handleClick(event))return;if((playMode==='cast'?castStudy:liveCast).handleClick(event))return;}
  if(getRoute()==='apk-media'&&wikiRecap.handleClick(event))return;
  if(getRoute()==='spine-motions'&&spineMotions.handleClick(event))return;if(getRoute()==='apk-media'&&mediaAudition.handleClick(event))return;
  if(getRoute()==='resource-audit'&&resourceAudit.handleClick(event))return;if(getRoute()==='collection'&&collection.handleClick(event))return;
  const target=event.target.closest('button,a');if(!target)return;
  if(target.dataset.studySelect){studyState.selected=target.dataset.studySelect;studyState.region='';studyState.frame='';render();document.querySelector('.study-workbench')?.scrollIntoView?.({block:'start'});document.querySelector('.study-workbench h3')?.focus({preventScroll:true});return;}
  if(target.hasAttribute('data-study-frame')||target.hasAttribute('data-study-region')){const isFrame=target.hasAttribute('data-study-frame'),origin=isFrame?'':target.classList.contains('study-hotspot')?'.study-image-plane ':'.study-region-controls ';studyState[isFrame?'frame':'region']=isFrame?target.dataset.studyFrame:target.dataset.studyRegion;render();document.querySelector(`${origin}[data-study-${isFrame?'frame':'region'}="${isFrame?studyState.frame:studyState.region}"]`)?.focus({preventScroll:true});return;}
  if(target.dataset.timelineEntry||target.dataset.timelinePoint){if(target.dataset.timelineEntry){timelineFilters.entryId=target.dataset.timelineEntry;timelineFilters.milestoneId=null;}else timelineFilters.milestoneId=target.dataset.timelinePoint;render();document.querySelector(`[data-timeline-${target.dataset.timelineEntry?'entry':'point'}="${target.dataset.timelineEntry||target.dataset.timelinePoint}"]`)?.focus({preventScroll:true});return;}
  if(target.hasAttribute('data-growth-seed')){growthSeed=Number(target.dataset.growthSeed);render();document.querySelector('#seed-detail-heading')?.focus({preventScroll:true});return;}
  if(target.hasAttribute('data-factory-ref-action')){factoryReference.handle(target.dataset.factoryRefAction,target.dataset.value);return;}
  if(target.hasAttribute('data-catalog-action')){catalogTutorials.handle(target.dataset.catalogAction,target.dataset.value);return;}
  if(target.hasAttribute('data-tutorial-pack')){tutorialPack=['more','catalog'].includes(target.dataset.tutorialPack)?target.dataset.tutorialPack:'first';render();document.querySelector('[data-tutorial-pack="'+tutorialPack+'"]')?.focus({preventScroll:true});return;}
  if(target.hasAttribute('data-tutorial-action')){(tutorialPack==='more'?moreTutorials:tutorials).handle(target.dataset.tutorialAction,target.dataset.value);return;}
  if(target.hasAttribute('data-artifact-filter')){availabilityFilter.status=target.dataset.artifactFilter;render();document.querySelector('[data-artifact-filter="'+availabilityFilter.status+'"]')?.focus({preventScroll:true});return;}
  if(target.dataset.playMode){playMode=target.dataset.playMode;history.replaceState(null,'','#experience?mode='+encodeURIComponent(playMode));render();document.querySelector(`[data-play-mode="${playMode}"]`)?.focus({preventScroll:true});return;}
  if(target.hasAttribute('data-activity')){sourcePlay.handle('activity:'+target.dataset.activity,target.dataset.value);return;}
  if(target.hasAttribute('data-play')){sourcePlay.handle(target.dataset.play,target.dataset.value);return;}
  if(target.hasAttribute('data-capture-category')||target.hasAttribute('data-capture-kind')){const key=target.hasAttribute('data-capture-category')?'category':'kind',value=key==='category'?target.dataset.captureCategory:target.dataset.captureKind;captureFilters[key]=value;render();document.querySelector(`[data-capture-${key}="${value}"]`)?.focus({preventScroll:true});return;}
  if(target.hasAttribute('data-walk')){handleWalk(target.dataset.walk,target.dataset.value);return;}
  if(target.hasAttribute('data-demo')){
   const id=target.dataset.demo,node=document.getElementById('demo-'+id);if(!node)return;
   const existing=running.get(id);if(existing){clearTimeout(existing);running.delete(id);node.classList.remove('playing');target.textContent='웹 시연 재생';target.setAttribute('aria-pressed','false');return;}
   node.classList.remove('playing');void node.offsetWidth;node.classList.add('playing');target.textContent='시연 정지';target.setAttribute('aria-pressed','true');
   const timer=setTimeout(()=>{node.classList.remove('playing');target.textContent='웹 시연 재생';target.setAttribute('aria-pressed','false');running.delete(id);},2000);running.set(id,timer);return;
  }
  if(target.dataset.uiRegion){for(const b of document.querySelectorAll('[data-ui-region]'))b.setAttribute('aria-pressed',String(b===target));document.querySelector('#region-inspector').innerHTML=regionDetail(target.dataset.uiRegion);return;}
  if(target.hasAttribute('data-item-page')){itemFilters.page=Number(target.dataset.itemPage);renderItem();document.querySelector('#item-catalog').scrollIntoView({block:'start'});document.querySelector('#item-query').focus({preventScroll:true});return;}
  if(target.hasAttribute('data-ui-page')){uiFilters.page=Number(target.dataset.uiPage);renderUI();document.querySelector('#ui-registry').scrollIntoView({block:'start'});document.querySelector('#ui-query').focus({preventScroll:true});return;}
  if(target.dataset.mediaKey)openMedia(target.dataset.mediaKey);
 });
 document.addEventListener('input',event=>{
  if(getRoute()==='current-material-review'&&currentMaterials.handleInput(event))return;
  if(getRoute()==='experience'&&playMode==='guides'&&tutorialSurfaces.handleInput(event.target))return;
  if(getRoute()==='experience'&&playMode==='registered'&&registered.handleInput(event))return;
  if(getRoute()==='spine-motions'&&spineMotions.handleInput(event))return;
  if(getRoute()==='resource-audit'&&resourceAudit.handleInput(event))return;if(getRoute()==='collection'&&collection.handleInput(event))return;const t=event.target;
  if(t.hasAttribute('data-artifact-query')){const start=t.selectionStart,end=t.selectionEnd;availabilityFilter.query=t.value;render();const next=document.querySelector('[data-artifact-query]');next?.focus({preventScroll:true});try{next?.setSelectionRange(start,end);}catch{}return;}
  if(t.hasAttribute('data-growth-point')){const out=document.querySelector('[data-growth-readout]');if(out)out.textContent=growthReadout(getData().progressionValidation?.continuation||getData().progressExtended.late||getData().progressExtended,Number(t.value));return;}
  if(t.hasAttribute('data-audio-bin')){const r=getData()?.refinement?.audio?.recordings.find(r=>r.sourceId===t.dataset.audioBin);if(!r)return;const index=Number(t.value),output=document.querySelector(`[data-audio-readout="${r.sourceId}"]`),cursor=document.querySelector(`[data-audio-cursor="${r.sourceId}"]`);if(output)output.innerHTML=renderAudioReadout(r,index);if(cursor){const x=600*index/Math.max(1,r.timeline.peakDbfs.length-1);cursor.setAttribute('x1',String(x));cursor.setAttribute('x2',String(x));}return;}
  if(t.hasAttribute('data-study-query')){if(event.isComposing)return;const start=t.selectionStart;studyState.query=t.value;studyState.frame='';studyState.region='';render();const next=document.querySelector('[data-study-query]');next?.focus({preventScroll:true});next?.setSelectionRange(start,start);return;}
  if(t.hasAttribute('data-audit-query')){if(event.isComposing)return;const start=t.selectionStart; auditFilters.query=t.value;render();const next=document.querySelector('[data-audit-query]');next.focus({preventScroll:true});next.setSelectionRange(start,start);return;}
  if(t.id==='item-query'){itemFilters.query=t.value;itemFilters.page=1;preserveInput(t.id,renderItem);}
  if(t.id==='ui-query'){uiFilters.query=t.value;uiFilters.page=1;preserveInput(t.id,renderUI);}
  if(t.hasAttribute('data-visual-depth'))document.querySelector('#difficulty-output').innerHTML=difficultyOutput(Number(t.value));
 });
 document.addEventListener('change',event=>{
  if(getRoute()==='current-material-review'&&currentMaterials.handleChange(event))return;
  if(getRoute()==='experience'&&playMode==='guides'&&tutorialSurfaces.handleChange(event.target))return;
  if(getRoute()==='experience'&&event.target.hasAttribute('data-source-audio-setting')){const t=event.target,key=t.dataset.sourceAudioSetting,value=t.type==='checkbox'?t.checked:t.type==='range'?Number(t.value):t.value==='true'?true:t.value==='false'?false:null;sourcePlay.handle('game-audio-set',JSON.stringify({key,value}));return;}
  if(getRoute()==='experience'){if(playMode==='registered'&&registered.handleChange(event))return;if((playMode==='cast'?castStudy:liveCast).handleChange(event))return;}
  if(getRoute()==='spine-motions'&&spineMotions.handleChange(event))return;
  if(getRoute()==='resource-audit'&&resourceAudit.handleChange(event))return;if(getRoute()==='collection'&&collection.handleChange(event))return;const t=event.target;
  if(t.hasAttribute('data-apk-motion-role')){motionState.role=t.value;motionState.clip='';render();document.querySelector('[data-apk-motion-role]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-apk-motion-clip')){motionState.clip=t.value;render();document.querySelector('[data-apk-motion-clip]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-cg-select')){sourcePlay.handle('cg:select',t.value);document.querySelector('[data-cg-select]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-map-select')){sourcePlay.handle('map:select-map',t.value);document.querySelector('[data-map-select]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-map-slot-select')&&t.value){sourcePlay.handle('map:select-slot',t.value);document.querySelector('[data-map-slot-select]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-catalog-select')){catalogTutorials.handle('select',t.value);return;}
  if(t.hasAttribute('data-catalog-event')){catalogTutorials.handle('event-select',t.value);return;}
  if(t.hasAttribute('data-checklist-current-only')){checklistCurrentOnly=t.checked;render();document.querySelector('[data-checklist-current-only]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-checklist-remaining')){checklistRemaining=t.value;render();document.querySelector('[data-checklist-remaining]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-checklist-status')){checklistStatus=t.value;render();document.querySelector('[data-checklist-status]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-growth-metric')){growthMetric=t.value;render();document.querySelector('[data-growth-metric]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-factory-ref-group')){factoryReference.handle('group',t.value);return;}
  if(t.hasAttribute('data-artifact-group')){availabilityFilter.group=t.value;render();document.querySelector('[data-artifact-group]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-scene-select')){sceneId=t.value;history.replaceState(null,'','#scene-analysis?task='+encodeURIComponent(t.value));render();document.querySelector('[data-scene-select]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-study-topic')){studyState.topic=t.value;studyState.frame='';studyState.region='';render();document.querySelector('[data-study-topic]')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-audit-category')||t.hasAttribute('data-audit-status')){const key=t.hasAttribute('data-audit-category')?'category':'status';auditFilters[key]=t.value;render();document.querySelector('[data-audit-'+key+']')?.focus({preventScroll:true});return;}
  if(t.hasAttribute('data-timeline-baseline')){timelineFilters.baselineId=t.value;render();document.querySelector('[data-timeline-baseline]')?.focus({preventScroll:true});return;}
  if(t.id==='item-table'){itemFilters.table=t.value;itemFilters.page=1;renderItem();document.querySelector('#item-table').focus({preventScroll:true});}
  if(t.id==='item-role'){itemFilters.role=t.value;itemFilters.page=1;renderItem();document.querySelector('#item-role').focus({preventScroll:true});}
  if(t.id==='ui-category'){uiFilters.category=t.value;uiFilters.page=1;renderUI();document.querySelector('#ui-category').focus({preventScroll:true});}
 });
 document.querySelector('#close-media').addEventListener('click',closeMedia);
 mediaDialog.addEventListener('close',clearMedia);
 mediaDialog.addEventListener('cancel',clearMedia);
 function afterRender(){tutorialSurfaces.cleanup();currentMaterials.beforeLeave();nativeMapCleanup();nativeMapCleanup=()=>{};wikiRecap.cleanup();registered.cleanup();skinShop.cleanup();castStudy.cleanup();liveCast.cleanup();spineMotions.beforeLeave();factoryReference.beforeRender();interactionCleanup();interactionCleanup=()=>{};sourcePlay.beforeRender();for(const [id,timer]of running){clearTimeout(timer);}running.clear();}
 return {renderPage:id=>pages[id]?.()||'',afterRender,afterMount(){if(getRoute()==='current-material-review')currentMaterials.afterMount();if(['scene-analysis','apk-media'].includes(getRoute()))nativeMapCleanup=mountNativeMapStudy(document.getElementById('app-view'),getData().nativeMapStudy);factoryReference.afterMount();if(getRoute()==='spine-motions')spineMotions.afterMount();if(getRoute()==='resource-audit')resourceAudit.afterMount();if(getRoute()==='collection')collection.afterMount();if(getRoute()==='bm-observation')interactionCleanup=mountBMObservationAudit(document.querySelector('#app-view'),getData());if(getRoute()==='apk-media'){wikiRecap.mount(document.getElementById('app-view'));const loopCleanup=mountInteractionLoops(document,{gallerySelector:'[data-apk-loop-gallery]',cardSelector:'[data-apk-loop-card]'}),itemCleanup=mountItemResolutionFollowup(document.getElementById('app-view'),getData().itemResolutionFollowup),captureCleanup=mountCaptureFollowupStudy(document.getElementById('app-view'),getData().captureFollowup);interactionCleanup=()=>{loopCleanup?.();itemCleanup?.();captureCleanup?.();};const id=new URLSearchParams(location.hash.split('?')[1]||'').get('task');if(id!==lastAPKTask){lastAPKTask=id;const target=[...document.querySelectorAll('[data-apk-task]')].find(n=>n.dataset.apkTask===id);if(target)queueMicrotask(()=>{if(target.isConnected){target.scrollIntoView({block:'start',behavior:'instant'});target.querySelector('summary')?.focus({preventScroll:true});}});}}else lastAPKTask=null;if(getRoute()==='puzzle-interaction')interactionCleanup=mountInteractionLoops();if(getRoute()==='captures')interactionCleanup=mountInteractionLoops(document,{gallerySelector:'[data-study-loop-gallery]',cardSelector:'[data-study-select]',initialPaused:studyLoopsPaused,onPauseChange:value=>{studyLoopsPaused=value;}});if(getRoute()==='experience'){const root=document.getElementById('app-view');if(playMode==='guides')tutorialSurfaces.afterMount(root);else if(playMode==='registered')registered.afterMount(root);else if(playMode==='skin-shop')skinShop.afterMount(root);else if(playMode==='cast')castStudy.mount(root);else if(['game','source','activities'].includes(playMode)){sourcePlay.afterMount();if(playMode==='game')liveCast.mount(root);}}}};
}
