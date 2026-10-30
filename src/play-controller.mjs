import {createLiveSourceStage} from './source-stage-bridge.mjs';
import {mountTutorialFocus} from './tutorial-focus.mjs';
import {createRecapMotionStudy,recapBookCellPose} from './recap-motion-study.mjs';
import {mergeSkinAcquisitionOwnership} from './skin-shop-controller.mjs';
import {playSceneCastOptions} from './game-scenes.mjs';
import {createFactoryFallbackResearchInput} from './random-reward-study.mjs';
import {withTutorialEconomy,normalizeTutorialEconomy} from './tutorial-economy.mjs';
import {createTutorialAdapterState,validTutorialAdapterState,tutorialAdapterPermission,tutorialAdapterMountLifecycle} from './tutorial-adapter.mjs';
import {collectTutorialAdapterTargets,applyTutorialAdapterDOM,clearTutorialAdapterDOM} from './tutorial-adapter-dom.mjs';
import {tutorialAdapterContext} from './tutorial-runtime.mjs';
import {createActivityEvent} from './activity-event.mjs';
import {createCGPresentation,cgPresentationAction} from './cg-presentation.mjs';
import {activityConfigFor,importActivitySeasonTransaction} from './activity-config.mjs';
import {renderActivitySeasonPanel} from './activity-season-page.mjs';
import {createActivityLinkInputs,configureActivityTransaction,commitActivityTransaction,commitActivityEventTransaction,queueActivityProgress,drainActivityProgress,canQueueActivityProgress,activityLinkView} from './activity-transaction.mjs';
import {createMapPresentation,validMapPresentation,mapPresentationAction} from './presentation-model.mjs';
import {createPlay,playAction,advancePlay,validPlay,migratePlayState,currentBubbleQuote} from './play-model.mjs';
import {renderSourcePlay} from './play-page.mjs';
import {renderGamePlay,gameClocks} from './game-page.mjs';
import {onboardingConstraints} from './onboarding-model.mjs';
import {readSession,writeSession,encodeSave,decodeSave,SAVE_KEY,MAX_OFFLINE_SECONDS} from './session-store.mjs';
import {createScreenController} from './screen-controller.mjs';
import {soundForAction} from './screen-flow.mjs';
import {createActivityPlay,activityAction,recordActivityProgress,validActivityPlay,activityView} from './activity-play.mjs';
import {renderActivityPlay} from './activity-page.mjs';
import {createTutorialPlay,validTutorialPlay,configureTutorialPlay,tutorialPlayEvent,renderTutorialPlay,playTutorialCatalog,restoreTutorialPlay,tutorialPlayPermission,tutorialPlayView} from './tutorial-play.mjs';
import {createSkinLab,validSkinLab,skinLabAction} from './skin-lab.mjs';
import {playGuide} from './play-guide.mjs';
import {createFactoryPlay,factoryView} from './factory-play.mjs';
import {createFactoryInputs,factoryContext,configureFactoryTransaction,commitFactoryTransaction,factoryLifecycleTransaction} from './factory-transaction.mjs';
import {createFactoryMotion,advanceFactoryMotion,startFactoryMotion,cancelFactoryMotion,factoryMotionView} from './factory-motion.mjs';
import {createStoryRecap,createStoryRecapInputs,validStoryRecap,storyRecapAction,storyRecapView} from './story-recap.mjs';
import {renderRuntimeInline} from './tutorial-inline.mjs';
import {renderTutorialRuntimePanel} from './tutorial-runtime-page.mjs';
import {tutorialRuntimeActionCallback,createTutorialRuntime,validTutorialRuntime,buildTutorialRuntimeContext,tutorialRuntimeEvent,restoreTutorialRuntime,tutorialRuntimeView,tutorialRuntimePermission} from './tutorial-runtime.mjs';

export function createPlayController({getData,render,download}){
 let state,wallAt=0,storage,canWrite=true,ticker=null,guideTicker=null,lastGuideSkin='',notice='',drag=null,suppressClick=false,lastCheckpoint=0,skin='source';
 let factoryMotion=createFactoryMotion(),factoryTicker=null,factoryWallAt=Date.now(),recapTicker=null,recapDrag=null;
 let recapVisual=null,recapVisualTicker=null,tutorialFocusCleanup=()=>{};
 const recapMotion=createRecapMotionStudy({getData});
 let adapterBundle=null,adapterTicker=null,pendingFactoryTabEvent=false;
 const emptyAdapterRegistry={schema:1,epoch:'actual-web-unmounted',targets:[]};
 let seasonFormDraft={};
 const seasonFields=['accept','ticket','pack','pack-cards','duplicate-cards','event-type','import-json','import-backup','album-variants-json','joker-type','joker-count','joker-packet','joker-card','joker-consume','royal-level','cached-stars','unlimited-json'];
 function captureSeasonDraft(){for(const key of seasonFields){const node=document.querySelector('[data-season-'+key+']');if(node)seasonFormDraft[key]=node.type==='checkbox'?node.checked:node.value;}}
 function restoreSeasonDraft(){for(const [key,value]of Object.entries(seasonFormDraft)){const node=document.querySelector('[data-season-'+key+']');if(!node)continue;if(node.type==='checkbox')node.checked=value;else if(node.tagName!=='SELECT'||[...node.options].some(o=>o.value===value))node.value=value;}}
 let seasonDrag=null,seasonSuppressClick=false,seasonTicker=null;
 let runtimeTicker=null,runtimeWallAt=Date.now(),runtimeRestoring=false,runtimeSelection='';
 const config=()=>getData().playConfig;
 const tutorialCatalog=()=>playTutorialCatalog(getData());
 const liveSourceStage=createLiveSourceStage({getData,getState:()=>state,getConfig:config,getVisual:()=>({recapVisual}),onAudio:cue=>screens.stageSound(cue),audioControl:action=>{if(['pause','mute'].includes(action))screens.stopStageAudio();}});
 const screens=createScreenController({getState:()=>state,getConfig:config,getData,domain:commit,persist,render,backup});
 function adapterOptions(){if(state.tutorialAdapter===undefined)state.tutorialAdapter=createTutorialAdapterState();const mounted=adapterBundle?.root?.isConnected&&adapterBundle.registry.targets.every(t=>adapterBundle.nodes.get(t.id)?.isConnected&&adapterBundle.root.contains(adapterBundle.nodes.get(t.id)));return {adapterState:state.tutorialAdapter,registry:mounted?adapterBundle.registry:emptyAdapterRegistry};}
 function adapterPanel(){if(!getData().tutorialCatalogConfig)return '';if(!validTutorialAdapterState(state.tutorialAdapter))return '<aside class="tutorial-runtime"><h2>안내 UI 저장을 보존했습니다</h2><p>정의된 전용 UI 상태가 호환되지 않아 자동 변경하지 않았습니다. 원본을 보관한 뒤 자동 안내와 전용 UI 상태만 함께 초기화할 수 있습니다.</p><button class="button" data-play="export">상태 JSON</button><button class="button" data-play="runtime:reset-adapter">백업 후 자동 안내·UI 상태 초기화</button></aside>';return '<details class="tutorial-runtime"><summary>현재 마운트한 UI 동작 연결</summary><p>실제 대상 '+adapterOptions().registry.targets.length+'개 · 적용 기록 '+state.tutorialAdapter.operations.length+'건 · 잠금 소유자 '+Object.keys(state.tutorialAdapter.ownerLocks).length+'개. 원본 활동/창이 없는 동작을 성공 처리하지 않습니다.</p><button class="button" data-play="runtime:reset-adapter">백업 후 자동 안내·UI 상태 초기화</button></details>';}
 function economicScope(fn){const rt=state?.tutorialRuntime,d=getData();return rt?.enabled&&validTutorialRuntime(rt,d)&&normalizeTutorialEconomy(rt.constraints||{}).ok?withTutorialEconomy(state,rt.constraints||{},fn):fn();}
 function runtimeContext(){const d=getData(),ui={...screens.researchContext(),tutorialEconomySupported:state?.tutorialRuntime?.enabled&&validTutorialRuntime(state.tutorialRuntime,getData())&&normalizeTutorialEconomy(state.tutorialRuntime.constraints||{}).ok};let recap={};if(d.storyRecapConfig&&validStoryRecap(state.storyRecap,d.storyRecapConfig)){const v=storyRecapView(state.storyRecap,recapContext(),d.storyRecapConfig);recap={storyRecapOpen:v.state==='unknown'?null:v.state==='open',storyUnlockedBooks:v.unlocked||[],recapUnlocked:v.state==='open'&&v.unlocked.length>0,recapEntryAvailable:v.state==='open'&&v.unlocked.length>0};}const context=buildTutorialRuntimeContext(state,d,{...ui,...recap,skin,manualGuideId:state.tutorialBridge?.enabled?state.tutorialBridge.selected:null,manualStrong:Boolean(state.tutorialBridge?.enabled&&state.tutorialBridge.engine?.active?.strong),recapOpen:ui.presentation==='recap'});const o=adapterOptions();return tutorialAdapterContext(o.adapterState,o.registry,context);}
 function syncRuntime(restore=false){const d=getData();if(!state||!d.tutorialCatalogConfig||runtimeRestoring)return null;if(state.tutorialRuntime===undefined)state.tutorialRuntime=createTutorialRuntime(d);if(!validTutorialRuntime(state.tutorialRuntime,d))return null;return restore?restoreTutorialRuntime(state.tutorialRuntime,runtimeContext(),d,adapterOptions()):tutorialRuntimeEvent(state.tutorialRuntime,{type:'reconcile'},runtimeContext(),d,adapterOptions());}
 function emitRuntime(sourceEvent,payload={}){const d=getData();if(!d.tutorialCatalogConfig)return null;syncRuntime();if(!validTutorialRuntime(state.tutorialRuntime,d)||state.tutorialRuntime===undefined)return null;const n=state.runtimeEventSequence;if(n!==undefined&&(!Number.isSafeInteger(n)||n<0||n>=1e9))return null;state.runtimeEventSequence=(n||0)+1;return tutorialRuntimeEvent(state.tutorialRuntime,{type:'source-event',sourceEvent,payload,eventId:'web-'+state.runtimeEventSequence},runtimeContext(),d,adapterOptions());}
 function handleRuntime(kind,value){const d=getData();if(!d.tutorialCatalogConfig)return;if(kind==='reset-adapter'){if(backup()){state.tutorialAdapter=createTutorialAdapterState();state.tutorialRuntime=createTutorialRuntime(d);state.runtimeEventSequence=0;notice='백업 후 자동 안내·전용 UI 상태만 초기화했습니다.';}return;}if(kind==='reset-invalid'||kind==='clear-invalid'){if(backup()){state.tutorialRuntime=createTutorialRuntime(d);state.runtimeEventSequence=0;notice='기존 저장을 백업하고 자동 안내만 초기화했습니다.';}return;}syncRuntime();if(!validTutorialRuntime(state.tutorialRuntime,d)){notice='정의된 자동 안내 저장을 보존했습니다. JSON으로 보관한 뒤 해당 필드만 초기화하세요.';return;}if(kind==='select'){runtimeSelection=String(value);return;}let event={type:kind};if(kind==='mask'){try{event={type:'mask-click',...JSON.parse(value)};}catch{notice='현재 안내 마스크 콜백을 다시 선택하세요.';return;}}if(kind==='choose-order'){try{event.order=JSON.parse(value);}catch{notice='안내 경쟁 순서를 확인하세요.';return;}}if(kind==='reset'){if(!backup()){notice='원본 백업에 실패해 안내를 초기화하지 않았습니다.';return;}event.guideId=String(value);}if(kind==='configure'){try{event={type:'configure',guideId:String(value||runtimeSelection||document.querySelector('[data-runtime-guide]')?.value),context:JSON.parse(document.querySelector('[data-runtime-context]')?.value||'{}')};}catch{notice='자동 안내의 연구 컨텍스트 JSON을 확인하세요.';return;}}const r=tutorialRuntimeEvent(state.tutorialRuntime,event,runtimeContext(),d,adapterOptions());notice=r.message;}
 function adoptMainState(next){
  if(next===state)return;const previous=state,oldFlow=previous?.screenFlow,newFlow=next?.screenFlow;
  const copyOwn=(target,source)=>{for(const k of Object.keys(target))if(!Object.hasOwn(source,k))delete target[k];for(const k of Object.keys(source))Object.defineProperty(target,k,{value:source[k],writable:true,enumerable:true,configurable:true});};
  if(!previous){state=next;return;}copyOwn(previous,next);
  if(oldFlow&&newFlow&&typeof oldFlow==='object'&&typeof newFlow==='object'&&!Array.isArray(oldFlow)&&!Array.isArray(newFlow)){copyOwn(oldFlow,newFlow);previous.screenFlow=oldFlow;}state=previous;
 }
 const seasonConfig=()=>activityConfigFor(state,getData().activitySeasonConfig);
 function drainSeason(){const c=seasonConfig();if(!c||!state.activityLink?.enabled)return null;const r=drainActivityProgress(state,c,{playConfig:config(),limit:256});if(r.ok)adoptMainState(r.state);return r;}
 function resumeSeason(){const c=seasonConfig();if(!c||!state.activityLink?.enabled)return null;drainSeason();const r=commitActivityTransaction(state,'resume',undefined,c,{playConfig:config(),now:state.wallet.time});if(r.ok)adoptMainState(r.state);return r;}
 function handleSeason(kind,value){
  captureSeasonDraft();
  const c=seasonConfig();if(!c){notice='활동 설정 자료가 필요합니다.';return;}let out;
  if(kind==='import-config'){const accepted=document.querySelector('[data-season-import-backup]')?.checked;if(!accepted){notice='설정 교체와 이전 상태 백업을 명시적으로 선택하세요.';return;}const raw=document.querySelector('[data-season-import-json]')?.value||'';if(raw.length>1500000){notice='활동 설정 JSON이 저장 한도를 초과합니다.';return;}if(!backup()){notice='원본 백업에 실패해 설정을 교체하지 않았습니다.';return;}out=importActivitySeasonTransaction(state,raw,{playConfig:config(),currentConfig:c,confirmReplace:true,backupAcknowledged:true});}
  else if(kind==='configure'){const enabled=value==='true';if(enabled&&!document.querySelector('[data-season-accept]')?.checked){notice='현재 설정의 메인 모의 경제 사용을 명시적으로 선택하세요.';return;}out=configureActivityTransaction(state,{...createActivityLinkInputs(),enabled,acceptedConfigRevision:enabled?c.revision:null},c,{playConfig:config()});}
  else if(kind==='drain')out=drainActivityProgress(state,c,{playConfig:config(),limit:256});
  else{
   try{const num=key=>{const v=document.querySelector('[data-season-'+key+']')?.value;return v===undefined||v.trim()===''?NaN:Number(v);};
    if(kind==='pass-unlimited-configure'){const raw=document.querySelector('[data-season-unlimited-json]')?.value||'';if(raw.length>100000)throw Error('size');value=JSON.parse(raw);}
    if(kind==='album-variants-configure'){const raw=document.querySelector('[data-season-album-variants-json]')?.value||'';if(raw.length>1000000)throw Error('size');value=JSON.parse(raw);}
    if(kind==='album-joker-grant')value={type:document.querySelector('[data-season-joker-type]')?.value,count:num('joker-count'),packetId:document.querySelector('[data-season-joker-packet]')?.value};
    if(kind==='album-joker-exchange')value={cardId:document.querySelector('[data-season-joker-card]')?.value,consume:document.querySelector('[data-season-joker-consume]')?.value};
    if(kind==='album-royal-start')value={playerLevel:num('royal-level')};
    if(kind==='ticket')value=document.querySelector('[data-season-ticket]')?.value;
    if(kind==='claim-pass'||kind==='event-move')value=JSON.parse(value);
    if(kind==='grant-pack')value={id:document.querySelector('[data-season-pack]')?.value,count:1};
    if(kind==='open-pack'){const raw=document.querySelector('[data-season-pack-cards]')?.value||'[]';if(raw.length>16384)throw Error('size');const id=document.querySelector('[data-season-pack]')?.value;value=c.album?.packs?.find(p=>p.id===id)?.fixed?{id}:{id,cards:JSON.parse(raw)};}
    if(kind==='exchange-duplicates'){const raw=document.querySelector('[data-season-duplicate-cards]')?.value||'[]';if(raw.length>16384)throw Error('size');const cached=document.querySelector('[data-season-cached-stars]');value={id:value,cards:JSON.parse(raw),...(cached?{cachedStars:num('cached-stars')}:{})};}
    if(kind==='event-research-item')value=document.querySelector('[data-season-event-type]')?.value;
   }catch{notice='활동 입력의 JSON과 현재 설정 ID를 확인하세요.';return;}
   const isBoard=kind.startsWith('event-')&&!['event-offer','event-level','event-end-claim'].includes(kind),mapped={'event-pop-cache':'pop-cache','event-scroll':'scroll','event-finish':'finish'}[kind]||kind;
   out=isBoard?commitActivityEventTransaction(state,mapped,value,c,{playConfig:config(),activityConfig:getData().activityConfig,now:state.wallet.time}):commitActivityTransaction(state,kind,value,c,{playConfig:config(),now:state.wallet.time});
  }
  if(out.ok){adoptMainState(out.state);if(kind==='open-pack'&&skin==='activities')screens.sound('card-pack-open');if(kind==='import-config')seasonFormDraft={};if(kind==='start'&&c.event&&getData().activityConfig?.event.id===c.event.projectionId&&state.activityEvent===undefined)state.activityEvent=createActivityEvent(getData().activityConfig,c);notice=out.message||(out.blocked?'활동 사건을 보존했습니다. 미확정 설정과 지급 대기열을 확인하세요.':'활동 처리를 반영했습니다.');}else notice=out.message||'활동 입력을 처리하지 못했습니다.';
 }
 const recapContext=()=>{const q=config().quests[state.questsDone];return {serverEnabled:null,currentTask:q?{day:q.day,id:q.taskId}:null};};
 const factoryPresentation=()=>{const ui=screens.researchContext();return {playConfig:config(),mainMode:state.stage==='play',viewReady:state.stage==='play'&&(skin!=='game'||!ui.entry&&!ui.loading)};};
 function factoryLifecycle(event){const c=getData().factoryConfig;if(!c||state.factoryPlay===undefined&&state.factoryInputs===undefined)return false;const r=factoryLifecycleTransaction(state,event,c,factoryPresentation());if(r.ok){adoptMainState(r.state);return true;}return false;}
 function restoreFactory(){factoryMotion=createFactoryMotion();factoryWallAt=Date.now();factoryLifecycle('session-start');factoryLifecycle('late-init');factoryLifecycle('scene-loaded');factoryLifecycle('login-finished');}
 function factoryRewards(events){let changed=false;for(const event of events||[])if(event.requestReward){const r=commitFactoryTransaction(state,{type:'reward',targetType:event.targetType},getData().factoryConfig,factoryPresentation());if(r.ok){adoptMainState(r.state);changed=true;}}return changed;}
 function stepFactoryMotion(){const c=getData().factoryConfig;if(!c)return false;const now=Date.now(),delta=Math.max(0,(now-factoryWallAt)/1000);factoryWallAt=now;const before=factoryMotion.locked,r=advanceFactoryMotion(factoryMotion,factoryMotion.clock+delta,c);if(!r.ok)return false;factoryMotion=r.state;const changed=factoryRewards(r.events);if(changed)persist();return changed||before!==factoryMotion.locked||r.events.length>0;}
 function leaveFactoryMotion(){const c=getData().factoryConfig;if(!c)return;stepFactoryMotion();const r=cancelFactoryMotion(factoryMotion,factoryMotion.clock,c);if(!r.ok)return;factoryMotion=r.state;let changed=factoryRewards(r.events);for(const targetType of r.pendingRewards){const out=commitFactoryTransaction(state,{type:'reward',targetType},c,factoryPresentation());if(out.ok){adoptMainState(out.state);changed=true;}}if(changed)persist();}
 function handleRecap(kind,value){
  const c=getData().storyRecapConfig;if(!c)return;const ui=screens.researchContext();
  if(kind==='reset-invalid'){if(backup()){state.storyRecap=createStoryRecap(c);notice='기존 저장을 백업하고 회상 책만 초기화했습니다.';}return;}
  if(kind==='inspect'){if(state.stage==='home'&&!state.pendingQuest&&!state.modal&&!ui.entry&&!ui.loading){screens.handle('game-task-list-close');state.screenFlow.phase='recap';notice='회상 책의 서버 활성·과제 조건을 확인합니다. 연구 설정은 메인 진행을 바꾸지 않습니다.';}else notice='장면을 마친 뒤 메인 맵에서 확인하세요.';return;}
  if(kind==='leave'&&!validStoryRecap(state.storyRecap,c)){state.screenFlow.phase='map';screens.handle('game-task-list');return;}
  if(state.storyRecap===undefined)state.storyRecap=createStoryRecap(c);
  if(!validStoryRecap(state.storyRecap,c)){notice='기존 회상 책 기록을 보존했습니다. JSON을 보관한 뒤 해당 필드만 초기화하세요.';return;}
  if(state.stage!=='home'||state.pendingQuest||state.modal||ui.entry||ui.loading){notice='메인 맵에서 진행 중인 장면을 마친 뒤 회상 책을 여세요.';return;}
  let action={type:kind};
  if(kind==='configure'){const inputs=createStoryRecapInputs(),flag=document.querySelector('[data-recap-flag]')?.value;inputs.serverEnabled=flag==='true'?true:flag==='false'?false:null;inputs.taskMode=document.querySelector('[data-recap-task-mode]')?.value==='research'?'research':'main';if(inputs.taskMode==='research'){const raw=document.querySelector('[data-recap-task]')?.value?.trim();if(raw&&raw!=='all'&&raw!=='complete'){const match=/^(\d+)_(\d+)$/.exec(raw);if(!match){notice='과제 스냅샷은 day_id 또는 complete로 입력하세요.';return;}inputs.taskOverride={day:Number(match[1]),id:Number(match[2])};}}action.inputs=inputs;}
  else if(kind==='open-book')action.book=Number(value);
  else if(kind==='swipe')Object.assign(action,value);
  const oldBook=state.storyRecap.book;const out=storyRecapAction(state.storyRecap,action,recapContext(),c);notice=out.message;
  if(out.ok&&out.effect==='page-turn')recapVisual={action:out.direction==='next'?'nextPage':'lastPage',startedAt:Date.now()};else if(out.ok&&kind==='close-book')recapVisual={action:'yoyo',book:oldBook,startedAt:Date.now()};else if(out.ok&&['leave','close-shelf','open-book'].includes(kind))recapVisual=null;
  if(out.ok&&['next','previous','swipe'].includes(kind))screens.sound('recap-page-turn',c.audioEntries?.find(a=>a.key==='recap:audio:sfxStoryIn'));
  if(out.ok&&['leave','close-book','close-shelf'].includes(kind))screens.stopAudio();
  if(out.ok&&kind==='open-shelf'){const was=ui.taskList;if(was)emitRuntime('OnViewWillClose',{name:'TaskWindow'});screens.handle('game-task-list-close');if(was)guideEvent({type:'view-closed',name:'TaskWindow'});state.screenFlow.phase='recap';if(was)emitRuntime('CloseView',{name:'TaskWindow'});emitRuntime('OpenView',{name:'StoryRecapMainWindow'});}
  if(out.ok&&out.returnTo==='task-list'){state.screenFlow.phase='map';screens.handle('game-task-list');guideEvent({type:'view-opened',name:'TaskWindow'});emitRuntime('CloseView',{name:'StoryRecapMainWindow'});emitRuntime('OpenView',{name:'TaskWindow'});}
 }
 function guideContext(){
  const b=state.tutorialBridge;if(!b)return {};const ui=screens.researchContext(),g=playGuide(state,config()),ctx={};
  if(Object.hasOwn(b.context,'gameMode'))ctx.gameMode=state.stage==='play'?'Main':'Map';
  if(Object.hasOwn(b.context,'mainBoardViewAvailable'))ctx.mainBoardViewAvailable=state.stage==='play'&&!ui.entry&&!ui.loading;
  if(Object.hasOwn(b.context,'allWindowsClosed'))ctx.allWindowsClosed=!state.modal&&!state.toolPending&&!ui.entry&&!ui.loading&&!ui.taskList&&!ui.newPrompt&&!['factory','skins','decor','decor-edit'].includes(ui.presentation);
  if(Object.hasOwn(b.context,'otherStrong'))ctx.otherStrong=Boolean(g.input||g.waitSeconds);
  if(Object.hasOwn(b.context,'openViews')){const mapped=new Set(['TaskWindow','NoTaskWindow',b.context.passDefinition?.mainWindow].filter(Boolean));ctx.openViews=[...(Array.isArray(b.context.openViews)?b.context.openViews.filter(name=>!mapped.has(name)):[]),...(ui.taskList?['TaskWindow']:[]),...(skin==='activities'&&state.activityPlay?.tab==='pass'&&b.context.passDefinition?[b.context.passDefinition.mainWindow]:[])];}
  if(b.selected==='tutorial_story_recap'&&getData().storyRecapConfig&&state.storyRecap!==undefined&&validStoryRecap(state.storyRecap,getData().storyRecapConfig)){const v=storyRecapView(state.storyRecap,recapContext(),getData().storyRecapConfig);ctx.storyRecapOpen=v.state==='unknown'?null:v.state==='open';ctx.storyUnlockedBooks=v.unlocked||[];}
  if(b.selected==='tutorial_generator_factory_Acquire'&&getData().factoryConfig&&state.factoryInputs!==undefined){const fc=getData().factoryConfig,fstate=state.factoryPlay===undefined?createFactoryPlay(fc):state.factoryPlay,context=factoryContext(state,fc),v=context?factoryView(fstate,context,fc):{state:'unknown'},types=new Set(fc.groups.flatMap(g=>g.fragments.map(f=>f.type)));ctx.generatorFactoryOpen=v.state==='open'?true:v.state==='closed'?false:null;ctx.factoryCandidates=state.board.flatMap((cell,index)=>cell&&types.has(cell.type)&&!cell.cover&&!state.bubbles?.[cell.uid]?[{uid:String(cell.uid),hasFactoryComponent:v.state==='open',position:{x:index%7+1,y:Math.floor(index/7)+1}}]:[]);}
  return ctx;
 }
 function guideEvent(event,context={}){const c=tutorialCatalog(),b=state.tutorialBridge;if(!c||!b||!validTutorialPlay(b,c)||!b.enabled)return null;return tutorialPlayEvent(b,event,c,{context:{...guideContext(),...context}});}
 function guideUI(action){
  if(action==='game-task-list'&&screens.researchContext().taskList)emitRuntime('OpenView',{name:'TaskWindow'});
  if(action==='game-task-list-close')emitRuntime('CloseView',{name:'TaskWindow'});
  if(['main','home','game-continue'].includes(action))emitRuntime('GameModeChangeFinished');
  if(action==='game-factory-close')emitRuntime('CloseView',{name:'InventoryWindow'});
  const b=state.tutorialBridge;if(!b?.enabled)return;
  if(action==='game-task-list'&&screens.researchContext().taskList)guideEvent({type:'view-opened',name:'TaskWindow'});
  else if(action==='game-task-list-close')guideEvent({type:'view-closed',name:'TaskWindow'});
  else if(['main','home','game-continue'].includes(action))guideEvent({type:'game-mode-change-finished'});
  else if(action==='pass-open'&&state.activityPlay&&state.activityPlay.startedAt!==null)guideEvent({type:'view-opened',name:b.context.passDefinition?.mainWindow});
  else if(action==='game-factory-close'&&b.selected==='tutorial_generator_factory_Acquire')guideEvent({type:'factory-poll'});
 }
 function handleGuide(action,value){
  const c=tutorialCatalog();if(!c)return;
  if(action==='reset-invalid'){if(backup())state.tutorialBridge=createTutorialPlay(c);return;}
  if(state.tutorialBridge===undefined)state.tutorialBridge=createTutorialPlay(c);const b=state.tutorialBridge;
  if(!validTutorialPlay(b,c)){notice='연결 안내 저장을 보존 중입니다. JSON으로 보관한 뒤 초기화하세요.';return;}
  if(action==='configure'||action==='configure-custom'){
   const id=document.querySelector('[data-guide-select]')?.value||b.selected,g=c.guides.find(g=>g.id===id);let ctx=g?.researchExample;
   if(action==='configure-custom')try{ctx=JSON.parse(document.querySelector('[data-guide-context]')?.value);}catch{notice='연구 컨텍스트 JSON 형식을 확인하세요.';return;}
   const r=configureTutorialPlay(b,id,ctx,c);notice=r.message;if(r.ok){guideUI(state.stage==='play'?'main':'home');if(skin==='activities'&&state.activityPlay?.tab==='pass')guideUI('pass-open');}return;
  }
  if(action==='disable'){b.enabled=false;b.message='연결을 중지했습니다. 안내 초안·완료 기록은 유지합니다.';return;}
  if(action==='reset'){if(!b.enabled)b.enabled=true;const r=guideEvent({type:'reset'});notice=r?.message||'';return;}
  if(action==='clock'){const r=guideEvent({type:'clock',now:b.engine.active?.dueAt??b.engine.time});notice=r?.message||'';return;}
  if(action==='event'){const ev=c.guides.find(g=>g.id===b.selected)?.eventCatalog[Number(value)]?.event;if(ev){const r=guideEvent(ev);notice=r?.message||'';}return;}
  if(action==='factory-poll'||action==='factory-tap'){const r=guideEvent({type:action==='factory-poll'?'factory-poll':'factory-item-tapped'});notice=r?.message||'';}
 }
 function handleFactory(kind,value){
  const c=getData().factoryConfig;if(c){stepFactoryMotion();if(factoryMotion.locked){notice='공장 입력 잠금 구간입니다.';return;}}if(!c||state.stage!=='play'||state.modal||state.toolPending){notice='퍼즐의 선택창을 닫은 뒤 생성기 공장에서 진행하세요.';return;}
  if(kind==='reset-invalid'){if(backup()){state.factoryPlay=createFactoryPlay(c);state.factoryInputs=createFactoryInputs();state.generatorFactoryOpen=null;notice='기존 저장을 백업하고 공장 연구만 초기화했습니다.';}return;}
  let out;const beforeScores=Object.fromEntries(c.groups.map(g=>[g.targetType,state.factoryPlay?.genData[g.targetType]?.score||0]));
  if(kind==='configure'){const raw=document.querySelector('[data-factory-flag]')?.value,input=createFactoryInputs();input.serverEnabled=raw==='true'?true:raw==='false'?false:null;input.unlockMode=document.querySelector('[data-factory-assume]')?.checked?'assumed':'main';const random=document.querySelector('[data-factory-random-config]')?.value.trim()||'',draws=document.querySelector('[data-factory-random-draws]')?.value.trim()||'';if(Boolean(random)!==Boolean(draws)||random.length>500000||draws.length>250000){notice='랜덤 보상표와 UID별 난수 입력을 함께 확인하세요. 기존 조건을 유지했습니다.';return;}if(random){try{input.randomRewardConfig=JSON.parse(random);input.randomRewardDraws=JSON.parse(draws);}catch{notice='랜덤 보상표·난수 JSON 형식을 확인하세요. 기존 조건을 유지했습니다.';return;}}out=configureFactoryTransaction(state,input,c,factoryPresentation());}
  else{let action;if(kind==='store'){const parts=/^(board|inventory):(\d+):(\d+)$/.exec(String(value));if(parts)action={type:'store',source:parts[1],index:Number(parts[2]),uid:Number(parts[3])};}else if(kind==='add-score'){const parts=/^(\d+):(\d+)$/.exec(String(value));if(parts)action={type:'add-score',targetType:parts[1],itemType:parts[2]};}else if(kind==='reward')action={type:'reward',targetType:String(value)};else if(kind==='return-closed')action={type:'return-closed'};if(!action){notice='공장 행동의 타입·위치·UID를 확인하세요.';return;}out=commitFactoryTransaction(state,action,c,factoryPresentation());}
  notice=out.message;if(out.ok){adoptMainState(out.state);if(kind==='configure'&&!state.factoryPlay?.lifecycle?.lateInit){factoryLifecycle('late-init');factoryLifecycle('scene-loaded');}if(kind==='add-score'){if(skin==='game'){screens.sound('factory-card-fly');screens.scheduleSound('factory-progress-arrive',.4);screens.scheduleSound('factory-energy-crush',.7);}const [targetType,itemType]=String(value).split(':'),motion=startFactoryMotion(factoryMotion,{now:factoryMotion.clock,sequence:state.factoryPlay.sequence,targetType,itemType,fromScore:beforeScores[targetType],toScore:state.factoryPlay.genData[targetType].score},c);if(motion.ok)factoryMotion=motion.state;factoryRewards(motion.events);}if(kind==='store'){guideEvent({type:'factory-item-tapped'});emitRuntime('GeneratorFactoryTabBoardItem',{uid:String(value).split(':').at(-1)});}if(kind==='configure')emitRuntime('GeneratorFactoryStateChanged',{isOpen:state.generatorFactoryOpen});}
 }
 function commit(action,value){
  const seasonPhase=seasonConfig()?activityLinkView(state,seasonConfig(),{now:state.wallet.time}).season?.phase:null,linkedSnapshot=state.activityLink?.enabled&&!['Idle','Preparing','Ended','Released'].includes(seasonPhase)?structuredClone(state):null;
  const [from,to]=action==='move'?String(value).split(',').map(Number):[state.selected,Number(value)];
  const oldPair=['cell','move'].includes(action)&&from!==null&&from!==to&&state.board[from]&&state.board[to]&&state.board[from].type===state.board[to].type;
  const before={sourceType:state.board[from??state.selected]?.type,sourceCell:structuredClone(state.board[from??state.selected]),targetCell:structuredClone(state.board[to]),bubbleUIDs:Object.keys(state.bubbles||{}),mergePair:Boolean(oldPair),selectedType:state.board[state.selected]?.type,level:state.wallet.level,quests:state.questsDone,queue:JSON.stringify(state.queue),boost:state.boostRatio,coins:state.wallet.coins,orders:state.wallet.orders,energy:state.wallet.energy,gems:state.wallet.gems,uids:new Set(state.board.filter(Boolean).map(x=>x.uid))};
  const result=economicScope(()=>playAction(state,action,value,config()));
  if(result.ok&&linkedSnapshot&&!action.startsWith('aid-')&&action!=='time'){
   const merge=oldPair&&state.board.some(x=>x&&!before.uids.has(x.uid)),events=[['customer',state.wallet.orders-before.orders],['merge',merge?1:0],...(merge?[[state.board.find(x=>x&&!before.uids.has(x.uid)).type,1]]:[]),['energy',result.costEnergy&&result.debitSucceeded?result.requestedEnergy:Math.max(0,before.energy-state.wallet.energy)],['gold',action==='sell'?0:Math.max(0,state.wallet.coins-before.coins)],['gem',Math.max(0,before.gems-state.wallet.gems)]].filter(([,count])=>count>0);
   const previous=state.seasonEventSequence;if(events.length&&(!canQueueActivityProgress(state,events.length)||previous!==undefined&&(!Number.isSafeInteger(previous)||previous<0||previous>=1e9))){adoptMainState(linkedSnapshot);notice='활동 성공 사건의 저장 한도 또는 기록을 확인하세요. 메인 동작 전체를 보존하고 확정하지 않았습니다.';return {ok:false,message:notice};}
   if(events.length){const sequence=(previous||0)+1;state.seasonEventSequence=sequence;for(const [kind,count]of events){const q=queueActivityProgress(state,{eventId:'main-'+sequence+'-'+kind,kind,count,at:state.wallet.time});if(!q.ok){adoptMainState(linkedSnapshot);notice=q.message;return {ok:false,message:notice};}adoptMainState(q.state);}drainSeason();}
  }
  const ac=getData().activityConfig,a=state.activityPlay;
  if(result.ok&&ac&&a&&validActivityPlay(a,ac)&&!action.startsWith('aid-')&&action!=='time'){
   const sequence=Math.max(Number.isSafeInteger(state.activityEventSequence)&&state.activityEventSequence>=0&&state.activityEventSequence<1e9?state.activityEventSequence:0,...Object.values(a.lastSequences))+1;state.activityEventSequence=sequence;
   const fresh=state.board.some(x=>x&&!before.uids.has(x.uid)),merge=oldPair&&fresh;
   const events=[['customer',state.wallet.orders-before.orders],['merge',merge?1:0],['energy',result.costEnergy&&result.debitSucceeded?result.requestedEnergy:Math.max(0,before.energy-state.wallet.energy)],['gold',action==='sell'?0:Math.max(0,state.wallet.coins-before.coins)],['gem',Math.max(0,before.gems-state.wallet.gems)]];
   for(const [kind,count]of events)if(count>0)recordActivityProgress(a,{kind,count,sequence},ac,{now:state.wallet.time});
  }
  if(result.ok){if(state.wallet.level>before.level)emitRuntime('LevelUp',{level:state.wallet.level});if(state.questsDone>before.quests){const q=config().quests[before.quests];emitRuntime('MainTaskFinished',{id:q?.id,day:q?.day,taskId:q?.taskId});}if(JSON.stringify(state.queue)!==before.queue)emitRuntime('CacheItems');if(action==='set-boost'&&state.boostRatio!==before.boost)emitRuntime('EnergyBoostModeChanged');if(action==='main')factoryLifecycle('game-mode-main');if(oldPair&&state.board.some(x=>x&&!before.uids.has(x.uid))){const merged=state.board.find(x=>x&&!before.uids.has(x.uid));factoryLifecycle({type:'item-merged',itemType:merged.type});}if(action==='set-boost'&&state.boostRatio!==before.boost)guideEvent({type:'energy-mode-changed'});if(['main','home'].includes(action))guideUI(action);}
  if(skin==='game'){if(action==='time'&&result.ok)for(const uid of before.bubbleUIDs)if(!state.bubbles?.[uid])screens.sound('bubble-disappear');if(getData().sourceAudio){if(action==='quest-finish'&&result.ok)screens.scheduleSound('reward-window',.3,'reward');else screens.actionSound(action,before,state,result,config());}else screens.sound(soundForAction(action,before,state,result,config()));}return result;
 }
 const options=()=>({revision:config().revision,now:Date.now(),validate:s=>validPlay(s,config())});
 function syncTime(){
  if(!state||!wallAt)return;
  const now=Date.now(),seconds=Math.max(0,Math.floor((now-wallAt)/1000));
  if(seconds){const bubbles=Object.keys(state.bubbles||{});economicScope(()=>advancePlay(state,Math.min(seconds,MAX_OFFLINE_SECONDS),config(),{silent:true}));wallAt+=seconds*1000;if(skin==='game')for(const uid of bubbles)if(!state.bubbles?.[uid])screens.sound('bubble-disappear');}
 }
 function persist(){
  if(!runtimeRestoring)syncRuntime();
  if(!canWrite){state.storageMessage='기존 저장을 보존 중입니다. 상태 JSON을 내보내거나 새 실험을 선택하세요.';return false;}
  const result=writeSession(storage,state,options());state.storageMessage=result.message;return result.ok;
 }
 function backup(){
  try{if(!storage)return false;const current=storage.getItem(SAVE_KEY);if(current)storage.setItem(SAVE_KEY+'-previous',current);canWrite=Boolean(storage);return true;}
  catch{canWrite=false;return false;}
 }
 // Migrate only the explicitly reviewed prior projection; preserve its raw backup.
 function compatible(raw){
  const exact=decodeSave(raw,options());if(exact.ok||exact.reason!=='revision-mismatch')return exact;
  try{const revision=JSON.parse(raw).revision;if(!config().compatibleRevisions?.includes(revision))return exact;
   const saved=decodeSave(raw,{...options(),revision,validate:s=>validPlay(migratePlayState(s,config()),config())});
   return saved.ok?{...saved,state:migratePlayState(saved.state,config()),migrated:true}:saved;
  }catch{return exact;}
 }
 function ensure(){
  if(state)return;
  try{storage=window.localStorage;}catch{storage=null;}
  let saved=readSession(storage,options());
  if(saved.reason==='revision-mismatch'){try{saved=compatible(storage.getItem(SAVE_KEY));}catch{}}
  wallAt=Date.now();runtimeRestoring=true;
  if(saved.ok){state=saved.state;if(tutorialCatalog()&&state.tutorialBridge)restoreTutorialPlay(state.tutorialBridge,tutorialCatalog());if(saved.migrated)backup();economicScope(()=>advancePlay(state,saved.elapsedSeconds,config(),{silent:true}));restoreFactory();resumeSeason();state.message=`이전 실험 복원 · ${saved.elapsedSeconds}초 경과${saved.capped?' (웹 정책7일 상한)':''}${saved.migrated?' · 원본 저장을 백업하고 새 규칙으로 이전':''}`;persist();}
  else{state=createPlay(config(),{scenario:'initial'});canWrite=['missing','storage-unavailable'].includes(saved.reason);state.storageMessage=saved.reason==='missing'?'연구 상태를 이 브라우저에 자동 저장합니다.':saved.message;}
  runtimeRestoring=false;runtimeWallAt=Date.now();const r=syncRuntime(saved.ok);if(r?.changed&&canWrite)persist();
 }
 function handle(action,value){
  const disclosures=[...document.querySelectorAll('.source-play details,.game-play details')].map((node,i)=>({i,open:node.open}));
  ensure();syncTime();notice='';if(action==='season:event-cell'&&seasonSuppressClick)return;if(action==='game-factory-close'){stepFactoryMotion();if(factoryMotion.locked){notice='공장 입력 잠금 구간입니다.';render();return;}}if(['game-factory-close','game-title'].includes(action))leaveFactoryMotion();
  if(action==='inventory'&&state.tutorialBridge?.enabled&&state.tutorialBridge.selected==='tutorial_generator_factory_Acquire'&&state.tutorialBridge.engine.active?.phase==='inventory-highlight'){guideEvent({type:'mask-click'});persist();render();return;}
  if(getData().tutorialCatalogConfig){const view=tutorialRuntimeView(state.tutorialRuntime,runtimeContext(),getData()),callback=tutorialRuntimeActionCallback(view,action,value);if(callback){const out=tutorialRuntimeEvent(state.tutorialRuntime,callback,runtimeContext(),getData(),adapterOptions());notice=out.message;persist();render();return;}}
  if(['game','activities'].includes(skin)){const permission=tutorialPlayPermission(state.tutorialBridge,action,tutorialCatalog(),value);if(!permission.allowed){notice=permission.message;render();return;}}
  if(action==='random-study-prefill'){const number=sel=>{const v=document.querySelector(sel)?.value;return v===undefined||v.trim()===''?NaN:Number(v);};const out=createFactoryFallbackResearchInput(getData().randomRewardStudy,{board:state.board,uid:Number(value),choice:number('[data-random-study-choice]'),amount:number('[data-random-study-amount]'),acknowledgeMissingServerRow:document.querySelector('[data-random-study-ack]')?.checked===true});const table=document.querySelector('[data-factory-random-config]'),draws=document.querySelector('[data-factory-random-draws]');if(out.ok&&table&&draws){try{const previous=draws.value.trim()?JSON.parse(draws.value):{};if(table.value.trim()&&JSON.stringify(JSON.parse(table.value))!==JSON.stringify(out.randomRewardConfig))throw Error('conflict');table.value=JSON.stringify(out.randomRewardConfig,null,2);draws.value=JSON.stringify({...previous,...out.randomRewardDraws},null,2);notice='조건부 연구 입력을 불러왔습니다. 연구 조건 적용 버튼으로 검증 후 확정하세요.';}catch{notice='기존 보상표와 충돌하여 입력을 보존했습니다. 다른 표를 자동으로 덮어쓰지 않습니다.';}}else notice=out.message||'현재 설정 창을 확인하세요.';let node=document.querySelector('[data-random-study-result]');if(node)node.textContent=notice;return;}
  if(action.startsWith('runtime:')){handleRuntime(action.slice(8),value);persist();render();return;}
  if(getData().tutorialCatalogConfig){syncRuntime();const permission=tutorialRuntimePermission(state.tutorialRuntime,action,value,runtimeContext(),getData());if(!permission.allowed){notice=permission.message;render();return;}}
  if(state.tutorialRuntime?.enabled&&getData().tutorialCatalogConfig){const o=adapterOptions(),p=tutorialAdapterPermission(o.adapterState,o.registry,action,value);if(!p.allowed){notice=p.message;render();return;}}
  if(action.startsWith('guide:')){handleGuide(action.slice(6),value);persist();render();return;}
  if(action.startsWith('recap:')){handleRecap(action.slice(6),value);persist();render();return;}
  if(action.startsWith('season:')){handleSeason(action.slice(7),value);persist();render();return;}
  if(action.startsWith('cg:')){const kind=action.slice(3);if(kind==='reset-invalid'){if(backup())state.cgPresentation=createCGPresentation(getData());}else{if(state.cgPresentation===undefined)state.cgPresentation=createCGPresentation(getData());const r=cgPresentationAction(state.cgPresentation,{type:kind,value},getData());notice=r.message||'';}persist();render();return;}
  if(action.startsWith('map:')){const kind=action.slice(4);if(kind==='reset-invalid'){if(backup())state.mapPresentation=createMapPresentation(getData());}else{if(state.mapPresentation===undefined)state.mapPresentation=createMapPresentation(getData());const r=mapPresentationAction(state.mapPresentation,{type:kind,value},getData());notice=r.message||'';}persist();render();return;}
  if(action.startsWith('factory:')){handleFactory(action.slice(8),value);persist();render();return;}
  if(action.startsWith('skin:')){
   const c=getData().skinConfig,kind=action.slice(5);if(!c||state.stage!=='home'||state.pendingQuest||state.modal)return;
   if(kind==='reset-invalid'){if(backup())state.skinLab=createSkinLab(c);}
   else{if(state.skinLab===undefined)state.skinLab=createSkinLab(c);const r=skinLabAction(state.skinLab,kind,value,c);notice=r.message;
    if(r.ok&&r.acquired?.length){const all=c.groups.flatMap(g=>g.skins),decorationRewards=r.acquired.map(id=>{const row=all.find(x=>x.id===id);return {category:'Skin',skinId:id,slot:row.slot,unlockedSkins:state.skinLab.owned.filter(owned=>all.find(x=>x.id===owned)?.slot===row.slot)};});guideEvent({type:'decoration-reward'},{decorationRewards});}
   }persist();render();return;
  }
  if(action.startsWith('activity:')){
   const ac=getData().activityConfig,kind=action.slice(9);if(!ac)return;
   if(kind==='reset-invalid'){if(backup()){state.activityPlay=createActivityPlay(ac);notice='기존 저장을 백업하고 활동 연구 상태를 새로 만들었습니다.';}}
   else{
    if(state.activityPlay===undefined)state.activityPlay=createActivityPlay(ac);
    if(kind==='open-pack')value=document.querySelector('[data-activity-card]')?.value;
    if(kind==='event-research-item')value=document.querySelector('[data-activity-type]')?.value;
    const r=activityAction(state.activityPlay,kind,value,ac,{now:state.wallet.time});notice=r.message;
   }
   if(kind==='start'||kind==='tab'&&value==='pass')guideUI('pass-open');persist();render();return;
  }
  const beforeUi=screens.researchContext();if(action==='game-factory-open'&&state.modal==='inventory')pendingFactoryTabEvent=true;if(beforeUi.taskList&&['game-task-list-close','game-title'].includes(action))emitRuntime('OnViewWillClose',{name:'TaskWindow'});
  if(skin==='game'&&screens.handle(action,value)){if(action==='game-continue'){factoryLifecycle('scene-loaded');factoryLifecycle('login-finished');if(state.stage==='play')factoryLifecycle('game-mode-main');}if(action!=='game-task-list-close'||beforeUi.taskList)guideUI(action);persist();render();return;}
  if(skin==='game'&&screens.blocked(action)){notice='현재 장면을 마치거나 맵으로 돌아간 뒤 조작하세요.';render();return;}
  if(action==='new-game'){
   const backed=backup();const sound=state.screenFlow?.sound===true;state=createPlay(config(),{scenario:'initial',guide:true});factoryMotion=createFactoryMotion();factoryWallAt=Date.now();wallAt=Date.now();
   state.storageMessage=backed?'이전 저장을 백업하고 새 게임을 시작했습니다.':'기존 저장을 보존하기 위해 메모리에서만 진행합니다.';
   if(skin==='game'){screens.reset();state.screenFlow.sound=sound;}else commit('start');persist();render();return;
  }
  if(action==='reset'||action==='scenario'){
   screens.imported();
   const scenario=action==='scenario'&&['open','initial'].includes(value)?value:state.scenario;
   const backed=backup();state=createPlay(config(),{scenario});factoryMotion=createFactoryMotion();factoryWallAt=Date.now();wallAt=Date.now();
   state.storageMessage=backed?'이전 저장을 별도 보관하고 새 실험을 준비했습니다.':'기존 저장을 보존하기 위해 새 실험은 메모리에서만 진행합니다.';
  }else if(action==='save'){persist();render();return;}
  else if(action==='export'){
   const result=encodeSave(state,options());if(result.ok)download('harbor-play-session.json',JSON.parse(result.raw));else state.storageMessage=result.message;
  }else if(action==='set-modifiers'){
   commit(action,value??document.querySelector('[data-modifier-json]')?.value);
  }else if(action==='aid-type'){
   commit(action,document.querySelector('[data-play-aid-type]')?.value);
  }else if(action==='game-cell'){
   const index=Number(value),cell=state.board[index],definition=config().items.find(r=>r.type===cell?.type);
   const fc=getData().factoryConfig,fx=fc&&factoryContext(state,fc),fv=fx?factoryView(state.factoryPlay===undefined?createFactoryPlay(fc):state.factoryPlay,fx,fc):null;
   if(state.stage==='play'&&!state.modal&&cell&&!cell.cover&&!state.bubbles?.[cell.uid]&&fv?.state==='open'&&fc.groups.some(g=>g.fragments.some(f=>f.type===cell.type))){handleFactory('store','board:'+index+':'+cell.uid);}
   else if(state.stage==='play'&&!state.modal&&definition?.generator&&!cell.cover&&!state.bubbles?.[cell.uid]&&(state.selected===null||state.selected===index)){
    const constraint=state.tutorialStep!==undefined&&!state.guidanceSkipped?onboardingConstraints(state,config()):{},phase=state.generatorState[cell.uid]?.phase;
    if(constraint.input?.kind==='select'||phase==='closed'&&state.selected!==index)commit('cell',value);
    else{state.selected=index;commit(phase==='closed'?'open-item':'generate');}
   }else commit('cell',value);
  }else commit(action,value);
  persist();render();for(const {i,open}of disclosures){const node=document.querySelectorAll('.source-play details,.game-play details')[i];if(node)node.open=open;}
  if(!state.modal&&!state.toolPending){
   const returnTo={'close-info':'item-info','close-choice':'open-choice','close-inventory':'inventory','close-shop':'shop','close-energy':'open-energy','close-offer':'open-energy'},focusAction=returnTo[action]||action;
   document.querySelector(`[data-play="${focusAction}"]${value!==undefined&&typeof value!=='object'?`[data-value="${value}"]`:''}`)?.focus({preventScroll:true});
  }
  if(action==='commerce-input')document.querySelector(`[data-commerce-field="${value.field}"]`)?.focus({preventScroll:true});
  if((action==='focus'&&state.focused)||['main','home'].includes(action))document.querySelector('.game-play-stage')?.scrollIntoView?.({block:'start',behavior:'instant'});
 }
 function stopDrag(ev){
  if(!drag||ev?.pointerId!==undefined&&ev.pointerId!==drag.id)return;const previous=drag;drag=null;previous.node?.classList.remove('drag-origin');previous.target?.classList.remove('drag-target');previous.ghost?.remove();
  try{previous.node?.releasePointerCapture(previous.id);}catch{}
 }
 function stopSeasonDrag(ev){if(!seasonDrag||ev?.pointerId!==undefined&&ev.pointerId!==seasonDrag.id)return;const old=seasonDrag;seasonDrag=null;old.node?.classList.remove('drag-origin');old.target?.classList.remove('drag-target');old.ghost?.remove();try{old.node?.releasePointerCapture(old.id);}catch{}}
 document.addEventListener('dragstart',ev=>{if(ev.target.closest?.('[data-season-cell]'))ev.preventDefault();});
 document.addEventListener('pointerdown',ev=>{const node=ev.target.closest?.('[data-season-cell]');if(!node||node.disabled||ev.button!==0||skin!=='activities')return;ensure();const index=Number(node.dataset.seasonCell),cell=state.activityEvent?.play?.event.board[index];if(!cell||cell.cover)return;seasonDrag={id:ev.pointerId,from:index,x:ev.clientX,y:ev.clientY,node,moving:false};node.setPointerCapture?.(ev.pointerId);});
 document.addEventListener('pointermove',ev=>{if(!seasonDrag||ev.pointerId!==seasonDrag.id)return;if(!seasonDrag.moving&&Math.hypot(ev.clientX-seasonDrag.x,ev.clientY-seasonDrag.y)<7)return;ev.preventDefault();if(!seasonDrag.moving){seasonDrag.moving=true;seasonDrag.node.classList.add('drag-origin');const ghost=document.createElement('div');ghost.className='game-drag-ghost';ghost.setAttribute('aria-hidden','true');const image=seasonDrag.node.querySelector('img,strong');if(image)ghost.append(image.cloneNode(true));document.body.append(ghost);seasonDrag.ghost=ghost;}seasonDrag.ghost.style.left=ev.clientX+'px';seasonDrag.ghost.style.top=ev.clientY+'px';const target=document.elementFromPoint?.(ev.clientX,ev.clientY)?.closest('[data-season-cell]');if(seasonDrag.target!==target){seasonDrag.target?.classList.remove('drag-target');target?.classList.add('drag-target');seasonDrag.target=target;}},{passive:false});
 document.addEventListener('pointerup',ev=>{if(!seasonDrag||ev.pointerId!==seasonDrag.id)return;const old=seasonDrag,target=old.target?.dataset.seasonCell;stopSeasonDrag();if(old.moving){seasonSuppressClick=true;setTimeout(()=>{seasonSuppressClick=false;},0);if(target!==undefined)handle('season:event-move',JSON.stringify({from:old.from,to:Number(target)}));}});
 document.addEventListener('pointercancel',stopSeasonDrag);document.addEventListener('lostpointercapture',stopSeasonDrag);window.addEventListener('blur',()=>stopSeasonDrag());
 document.addEventListener('pointerdown',ev=>{
  const node=ev.target.closest?.('.game-cell');if(!node||ev.button!==0||skin==='game'&&screens.blocked('move'))return;if(getData().tutorialCatalogConfig&&!tutorialRuntimePermission(state.tutorialRuntime,'drag-start',node.dataset.value,runtimeContext(),getData()).allowed)return;
  if(['game','activities'].includes(skin)&&!tutorialPlayPermission(state?.tutorialBridge,'move',tutorialCatalog()).allowed)return;
  ensure();const cell=state.board[Number(node.dataset.value)];if(!cell||cell.cover||state.modal||state.toolPending||state.bubbles?.[cell.uid])return;
  drag={id:ev.pointerId,from:Number(node.dataset.value),x:ev.clientX,y:ev.clientY,node,moving:false};node.setPointerCapture?.(ev.pointerId);
 });
 document.addEventListener('pointermove',ev=>{
  if(!drag||ev.pointerId!==drag.id)return;
  if(!drag.moving&&Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)<7)return;
  ev.preventDefault();
  if(!drag.moving){drag.moving=true;drag.node.classList.add('drag-origin');const ghost=document.createElement('div');ghost.className='game-drag-ghost';ghost.setAttribute('aria-hidden','true');const image=drag.node.querySelector('.game-item,.game-item-missing');if(image)ghost.append(image.cloneNode(true));document.body.append(ghost);drag.ghost=ghost;}
  drag.ghost.style.left=ev.clientX+'px';drag.ghost.style.top=ev.clientY+'px';
  const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.game-cell,.game-bottom [data-play=inventory]');if(drag.target!==target){drag.target?.classList.remove('drag-target');target?.classList.add('drag-target');drag.target=target;}
 },{passive:false});
 document.addEventListener('pointerup',ev=>{
  if(!drag||ev.pointerId!==drag.id)return;const from=drag.from,to=drag.target?.dataset.value,inventory=drag.target?.dataset.play==='inventory',moving=drag.moving;stopDrag();
  if(moving){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);if(inventory)handle('inventory-store',from);else if(to!==undefined)handle('move',`${from},${to}`);}
 });
 document.addEventListener('pointerdown',ev=>{if(ev.button===0&&ev.target.closest?.('[data-recap-swipe]'))recapDrag={id:ev.pointerId,x:ev.clientX,y:ev.clientY,at:Date.now()};});
 document.addEventListener('pointerup',ev=>{if(!recapDrag||ev.pointerId!==recapDrag.id)return;const start=recapDrag;recapDrag=null;const seconds=(Date.now()-start.at)/1000,dx=ev.clientX-start.x,dy=ev.clientY-start.y;if(seconds>=.01&&Math.abs(dx)/seconds>1000&&Math.abs(dx)>Math.abs(dy)*1.5)handle('recap:swipe',{dx,dy,seconds});});
 document.addEventListener('pointercancel',()=>{recapDrag=null;});
 document.addEventListener('pointercancel',stopDrag);
 document.addEventListener('lostpointercapture',stopDrag);
 window.addEventListener('blur',stopDrag);
 document.addEventListener('click',ev=>{if(suppressClick&&ev.target.closest?.('.game-cell')){ev.preventDefault();ev.stopImmediatePropagation();}},{capture:true});
 document.addEventListener('keydown',ev=>{
  const node=ev.target.closest?.('.game-cell');if(!node)return;const index=Number(node.dataset.value),offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[ev.key];if(!offset)return;
  const next=index+offset;if(next<0||next>62||(Math.abs(offset)===1&&Math.floor(next/7)!==Math.floor(index/7)))return;ev.preventDefault();document.querySelector(`.game-cell[data-value="${next}"]`)?.focus();
 });
 function beforeRender(){const stageMode=new URLSearchParams(window.location.hash.split('?')[1]||'').get('mode');liveSourceStage.beforeRender(window.location.hash.split('?')[0]==='#experience'&&(!stageMode||stageMode==='game')&&!document.hidden);tutorialFocusCleanup();tutorialFocusCleanup=()=>{};const recapMode=new URLSearchParams(window.location.hash.split('?')[1]||'').get('mode');if(window.location.hash.split('?')[0]!=='#experience'||recapMode&&recapMode!=='game')recapVisual=null;recapMotion.cleanup();if(recapVisualTicker)window.clearInterval(recapVisualTicker);recapVisualTicker=null;if(adapterTicker)window.clearInterval(adapterTicker);adapterTicker=null;if(adapterBundle&&window.location.hash.split('?')[0]!=='#experience'){clearTutorialAdapterDOM(adapterBundle.root);adapterBundle=null;}for(const audio of document.querySelectorAll('.story-recap-page audio'))if(!audio.paused)audio.pause();stopSeasonDrag();if(seasonTicker)window.clearInterval(seasonTicker);seasonTicker=null;if(runtimeTicker)window.clearInterval(runtimeTicker);runtimeTicker=null;if(factoryTicker)window.clearInterval(factoryTicker);factoryTicker=null;if(recapTicker)window.clearInterval(recapTicker);recapTicker=null;if(state&&window.location.hash.split('?')[0]!=='#experience')leaveFactoryMotion();if(ticker)window.clearInterval(ticker);ticker=null;if(guideTicker)window.clearInterval(guideTicker);guideTicker=null;stopDrag();screens.beforeRender();}
 function afterMount(){
  if(skin==='game'&&state)liveSourceStage.afterMount(document.getElementById('app-view'));
  recapMotion.mount(document.getElementById('app-view'));if(getData().recapMotionStudy&&document.querySelector('[data-game-screen="recap"]')&&recapVisual){const update=()=>{const elapsed=Math.max(0,(Date.now()-recapVisual.startedAt)/1000);if(recapVisual.action==='yoyo'){const pose=recapBookCellPose(getData(),elapsed),image=document.querySelector('[data-play="recap:open-book"][data-value="'+recapVisual.book+'"] img');if(image&&pose.valid)image.style.transform='scale('+pose.normalizedScale[0]+','+pose.normalizedScale[1]+')';}else recapMotion.sync({action:recapVisual.action,elapsed,playing:false});if(elapsed>0.75&&recapVisualTicker){window.clearInterval(recapVisualTicker);recapVisualTicker=null;}};update();if((Date.now()-recapVisual.startedAt)/1000<=0.75)recapVisualTicker=window.setInterval(update,25);}
  if(skin==='activities')restoreSeasonDraft();
  if(skin==='game')screens.afterMount();
  if(skin==='activities'&&seasonConfig()&&state.activityLink?.enabled){let prior=activityLinkView(state,seasonConfig(),{now:state.wallet.time}).season?.phase;seasonTicker=window.setInterval(()=>{if(document.hidden)return;syncTime();const v=activityLinkView(state,seasonConfig(),{now:state.wallet.time});const status=document.querySelector('[data-season-clock]');if(status)status.textContent=v.season?.phase||'Unknown';if(v.season?.phase!==prior){prior=v.season?.phase;resumeSeason();persist();render();}},1000);}
  const screenUi=screens.researchContext();
  if(getData().tutorialCatalogConfig&&validTutorialRuntime(state.tutorialRuntime,getData())){
   const cachedContext=runtimeContext(),view=tutorialRuntimeView(state.tutorialRuntime,cachedContext,getData());
   if(view.enabled){
    if(Number.isFinite(view.nextDueAt)&&!view.ambiguity){runtimeWallAt=Date.now();runtimeTicker=window.setInterval(()=>{const at=Date.now(),delta=(at-runtimeWallAt)/1000;runtimeWallAt=at;if(document.hidden)return;const r=state.tutorialRuntime;if(!r?.enabled)return;const v=tutorialRuntimeView(r,runtimeContext(),getData());if(!Number.isFinite(v.nextDueAt)||r.time+delta<v.nextDueAt){if(Number.isFinite(v.nextDueAt))r.time+=delta;return;}const out=tutorialRuntimeEvent(r,{type:'clock',now:r.time+delta},runtimeContext(),getData(),adapterOptions());if(out.changed){persist();render();}},100);}
   }
  }
  if(skin==='game'&&screenUi.presentation==='factory'&&!screenUi.entry&&!screenUi.loading&&getData().factoryConfig){factoryWallAt=Date.now();factoryTicker=window.setInterval(()=>{if(document.hidden)return;if(stepFactoryMotion()){persist();render();return;}const v=factoryMotionView(factoryMotion,factoryMotion.clock,getData().factoryConfig);for(const flight of v.flights){const node=document.querySelector('[data-factory-flight="'+flight.sequence+'"]');if(node){node.style.setProperty('--flight-progress',String(flight.progress));node.dataset.arrived=String(flight.arrived);}}for(const group of v.groups){const node=document.querySelector('[data-factory-progress="'+group.targetType+'"]');if(node)node.value=group.value*group.maxScore;}},25);}
  if(skin==='game'&&screenUi.presentation==='recap'&&!screenUi.entry&&!screenUi.loading&&getData().storyRecapConfig&&validStoryRecap(state.storyRecap,getData().storyRecapConfig)&&state.storyRecap?.transition){let at=Date.now();recapTicker=window.setInterval(()=>{const now=Date.now(),seconds=(now-at)/1000;at=now;if(document.hidden)return;const before=state.storyRecap?.displayPage,was=Boolean(state.storyRecap?.transition);storyRecapAction(state.storyRecap,{type:'advance',seconds},recapContext(),getData().storyRecapConfig);if(before!==state.storyRecap.displayPage||was!==Boolean(state.storyRecap.transition)){persist();render();}},25);}

  const linked=state?.tutorialBridge,tc=tutorialCatalog(),target=linked&&tc?tutorialPlayView(linked,tc).active?.target:null;
  if(linked?.enabled&&target?.uid!==undefined){const i=state.board.findIndex(c=>String(c?.uid)===String(target.uid));if(i>=0)document.querySelector('.game-cell[data-value="'+i+'"]')?.classList.add('tutorial-linked-target');}
  if(linked?.enabled){const selector={EnergyBoost:'[data-play="set-boost"]',Inventory:'[data-play="inventory"]',Task:'[data-play="game-task-list"]'}[target?.hud];if(selector)for(const node of document.querySelectorAll(selector))node.classList.add('tutorial-linked-target');}
  if(lastGuideSkin!==skin){lastGuideSkin=skin;if(skin==='activities'&&state.activityPlay?.tab==='pass'){const before=JSON.stringify(state.tutorialBridge);guideUI('pass-open');if(before!==JSON.stringify(state.tutorialBridge)){persist();render();return;}}}
  if(['game','activities'].includes(skin)&&state.tutorialBridge?.enabled&&validTutorialPlay(state.tutorialBridge,tutorialCatalog())){
   let at=Date.now();guideTicker=window.setInterval(()=>{const now=Date.now(),delta=(now-at)/1000;at=now;const b=state.tutorialBridge;if(document.hidden||!b?.enabled||b.engine.active?.dueAt==null)return;const r=guideEvent({type:'clock',now:Math.round((b.engine.time+delta)*1000)/1000});if(r?.changed&&r.status!=='waiting'){persist();render();}},100);
  }
  document.body.dataset.playFocus=String(skin==='activities'?false:Boolean(state?.focused));
  if(skin==='activities'&&state?.activityPlay&&validActivityPlay(state.activityPlay,getData().activityConfig)){
   let phase=activityView(state.activityPlay,getData().activityConfig,{now:state.wallet.time}).phase;
   ticker=window.setInterval(()=>{syncTime();const v=activityView(state.activityPlay,getData().activityConfig,{now:state.wallet.time});const clock=document.querySelector('[data-activity-clock]');if(clock)clock.textContent=v.phase==='Started'?`플레이 남은 시간 ${Math.floor(v.remainingSeconds/60)}:${String(v.remainingSeconds%60).padStart(2,'0')}`:v.phase;if(Date.now()-lastCheckpoint>=15000){persist();lastCheckpoint=Date.now();}if(v.phase!==phase){phase=v.phase;persist();render();}},1000);
  }
  for(const id of ['play-dialog','tool-dialog']){const dialog=document.getElementById(id);if(dialog&&!dialog.open){dialog.showModal();dialog.addEventListener('cancel',ev=>{ev.preventDefault();handle(id==='tool-dialog'?'cancel-tool':state.modal==='energy'?'close-energy':state.modal==='offer'?'close-offer':state.modal==='inventory'?'close-inventory':state.modal==='item-info'?'close-info':state.modal==='choice'?'close-choice':'close-shop');});}}
  if(getData().tutorialCatalogConfig){const v=tutorialRuntimeView(state.tutorialRuntime,runtimeContext(),getData()),dialog=document.querySelector('dialog[open]');if(dialog&&!dialog.querySelector('[data-runtime-inline]')){const html=renderRuntimeInline(v);if(html){const holder=document.createElement('div');holder.innerHTML=html;dialog.append(holder);holder.querySelector('[data-play]')?.focus({preventScroll:true});}}}
  if(getData().tutorialCatalogConfig){const root=document.getElementById('app-view')||document.querySelector('main')||document.body;const previous=adapterBundle?.registry||emptyAdapterRegistry;adapterBundle=collectTutorialAdapterTargets(root,{epoch:'actual-web-components-v1'});tutorialAdapterMountLifecycle(state.tutorialAdapter,previous,adapterBundle.registry);const previousInventory=previous.targets.some(t=>t.id==='inventory.window'),currentInventory=adapterBundle.registry.targets.some(t=>t.id==='inventory.window');let windowEvent=null;if(previousInventory!==currentInventory)windowEvent=emitRuntime(currentInventory?'OpenView':'CloseView',{name:'InventoryWindow'});if(pendingFactoryTabEvent&&adapterBundle.registry.targets.some(t=>t.id==='inventory.factory-detail')){pendingFactoryTabEvent=false;windowEvent=emitRuntime('GeneratorFactoryTabGenButton');}if(state.tutorialRuntime?.enabled&&validTutorialAdapterState(state.tutorialAdapter)){applyTutorialAdapterDOM(adapterBundle,state.tutorialAdapter,{now:Date.now()/1000});const settled=syncRuntime();if(settled?.changed||windowEvent?.changed){persist();render();return;}adapterTicker=window.setInterval(()=>{if(!document.hidden&&state.tutorialRuntime?.enabled)applyTutorialAdapterDOM(adapterBundle,state.tutorialAdapter,{now:Date.now()/1000});},100);const mountedContext=runtimeContext(),mountedView=tutorialRuntimeView(state.tutorialRuntime,mountedContext,getData());for(const active of mountedView.active)if(active.binding?.selector)for(const node of document.querySelectorAll(active.binding.selector))node.classList.add('tutorial-linked-target');for(const node of document.querySelectorAll('.game-play [data-play],.source-play [data-play],.activity-play [data-play],.activity-season-panel [data-play]')){if(node.tagName!=='BUTTON')continue;const permission=tutorialRuntimePermission(state.tutorialRuntime,node.dataset.play,node.dataset.value,mountedContext,getData(),mountedView);if(!permission.allowed){node.disabled=true;node.dataset.runtimeBlocked=permission.reason;}}}}
  if(getData().tutorialCatalogConfig&&state.tutorialRuntime?.enabled){const root=document.querySelector('.game-play dialog[open]')||document.querySelector('.game-phone')||document.querySelector('.source-play');if(root)tutorialFocusCleanup=mountTutorialFocus(root,tutorialRuntimeView(state.tutorialRuntime,runtimeContext(),getData()),{validateBinding:b=>b.kind!=='cell'||String(state.board[b.index]?.uid)===String(b.uid)});}
  if(document.querySelector('.game-phone')&&['play','home'].includes(state?.stage)){
   const signature=()=>JSON.stringify([state.board.map(c=>c&&[c.uid,c.type]),Object.values(state.generatorState).map(r=>r.charges),state.wallet.price,state.orders?.slots.map(o=>o.id),state.onboarding?.phases,Object.values(state.generatorState).map(r=>r.phase)]);
   ticker=window.setInterval(()=>{
    const before=signature();syncTime();const clocks=gameClocks(state,config());
    for(const [key,value]of [['energy',state.wallet.energy.toLocaleString('ko-KR')],['coins',state.wallet.coins.toLocaleString('ko-KR')],['energy-clock',clocks.energy],['selected-clock',clocks.selected]]){const node=document.querySelector(`[data-live-${key}]`);if(node)node.textContent=value;}
    document.querySelectorAll('[data-bubble-timer]').forEach(node=>{const b=state.bubbles?.[node.dataset.bubbleTimer];if(b){const quote=currentBubbleQuote(state,config(),b),left=Math.max(0,(quote.expiresAt??b.expiresAt)-state.wallet.time);node.textContent=`${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,'0')}`;}});
    const bubblePrice=document.querySelector('[data-live-bubble-price]'),bubble=state.bubbles?.[state.board[state.selected]?.uid];if(bubblePrice&&bubble){const quote=currentBubbleQuote(state,config(),bubble);bubblePrice.textContent=quote.status==='known'?quote.price.toLocaleString('ko-KR'):'미확인';bubblePrice.closest('button').disabled=quote.status!=='known'||state.wallet.gems<quote.price;}
    const skipCost=document.querySelector('[data-live-speedup-cost]');if(skipCost&&clocks.skipCost!==null){skipCost.textContent=clocks.skipCost.toLocaleString('ko-KR');skipCost.closest('button').disabled=state.wallet.gems<clocks.skipCost;}
    if(Date.now()-lastCheckpoint>=15000){persist();lastCheckpoint=Date.now();}
    if(before!==signature()&&!drag&&!screens.isMapDragging()&&!document.querySelector('dialog[open]')){persist();render();}
   },1000);
  }
 }
 document.addEventListener('change',async ev=>{
  const input=ev.target;if(input.hasAttribute('data-runtime-guide')){handle('runtime:select',input.value);return;}
  if(input.hasAttribute('data-skin-select')){handle('skin:select',input.value);return;}
  if(input.hasAttribute('data-play-bm')){
   ensure();syncTime();const key=input.dataset.playBm,value=input.type==='checkbox'?input.checked:Number(input.value);
   if((['bundle','noPay','invite','plenty','chain','weekly'].includes(key)&&typeof value==='boolean')||(key==='triggerPrice'&&Number.isInteger(value)&&value>=0&&value<=1e6)||(key==='popType'&&[1,2].includes(value))){state.bm[key]=value;persist();}return;
  }
  if(input.hasAttribute('data-commerce-field')){
   const value=input.type==='checkbox'?input.checked:input.value;
   handle('commerce-input',{field:input.dataset.commerceField,value});return;
  }
  if(input.id!=='play-import'||!input.files?.[0])return;ensure();const file=input.files[0];
  if(file.size>2*1024*1024){state.storageMessage='가져올 상태 JSON은2MB 이하여야 합니다.';render();return;}
  try{const saved=compatible(await file.text());if(!saved.ok){state.storageMessage=saved.message;render();return;}backup();state=saved.state;economicScope(()=>advancePlay(state,saved.elapsedSeconds,config(),{silent:true}));restoreFactory();resumeSeason();if(tutorialCatalog()&&state.tutorialBridge)restoreTutorialPlay(state.tutorialBridge,tutorialCatalog());wallAt=Date.now();screens.imported();persist();render();}
  catch{state.storageMessage='상태 파일을 읽지 못했습니다. 기존 실험을 유지합니다.';render();}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){recapVisual=null;recapMotion.cleanup();if(recapVisualTicker)window.clearInterval(recapVisualTicker);recapVisualTicker=null;stopSeasonDrag();stopDrag();if(state)leaveFactoryMotion();}factoryWallAt=Date.now();});
 window.addEventListener('pagehide',()=>{if(state){leaveFactoryMotion();syncTime();persist();}});
 return {applySkinAcquisitions(ledger,acquisitionConfig){ensure();const before=state.skinLab;const merged=mergeSkinAcquisitionOwnership(before,ledger,acquisitionConfig,getData().skinConfig);if(!merged.acquired.length)return {ok:true,acquired:[]};state.skinLab=merged.lab;if(!persist()){state.skinLab=before;throw Error('맵 저장에 실패했습니다. 영수증은 보존됐으며 다시 연결할 수 있습니다.');}return {ok:true,acquired:merged.acquired};},castOptions(){ensure();return playSceneCastOptions(state,config(),getData());},render(nextSkin='source',extra={}){skin=nextSkin;ensure();
  if(skin==='activities'){
   const ac=getData().activityConfig;if(!ac)return '<p>활동 자료를 준비하고 있습니다.</p>';
   if(state.activityPlay===undefined)state.activityPlay=createActivityPlay(ac);
   if(!validActivityPlay(state.activityPlay,ac))return '<section><h1>활동 저장을 보존했습니다</h1><p>호환되지 않는 연구 활동 상태입니다. 현재 상태 JSON을 보관한 뒤 활동만 다시 시작할 수 있습니다. 메인 보드는 유지합니다.</p><button class="button" data-play="export">현재 상태 JSON</button><button class="button" data-play="activity:reset-invalid">백업하고 활동 초기화</button></section>';
   const activity=activityView(state.activityPlay,ac,{now:state.wallet.time});
   return (getData().tutorialCatalogConfig?renderTutorialRuntimePanel(state.tutorialRuntime,runtimeContext(),getData(),{selectedId:runtimeSelection}):'')+(getData().activitySeasonConfig!==undefined?renderActivitySeasonPanel(state,seasonConfig(),getData())+'<details class="legacy-activity-study"><summary>기존 분리 연구 시즌 · 메인 지갑 지급 없음</summary>'+renderActivityPlay(state.activityPlay,ac,getData(),{now:state.wallet.time})+'</details>':renderActivityPlay(state.activityPlay,ac,getData(),{now:state.wallet.time}))+`<p class="game-feedback" role="status">${String(notice).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p>`+renderTutorialPlay(state.tutorialBridge,tutorialCatalog())+adapterPanel();
  }
  const runtimeView=getData().tutorialCatalogConfig?tutorialRuntimeView(state.tutorialRuntime,runtimeContext(),getData()):null;const runtimePanel=getData().tutorialCatalogConfig?renderTutorialRuntimePanel(state.tutorialRuntime,runtimeContext(),getData(),{selectedId:runtimeSelection}):'';const options=skin==='game'?{...screens.renderOptions(),runtimeGuideHTML:renderRuntimeInline(runtimeView),factoryPresentation:getData().factoryConfig?factoryMotionView(factoryMotion,factoryMotion.clock,getData().factoryConfig):null}:{};return (skin==='game'?economicScope(()=>renderGamePlay(state,config(),{...getData(),...extra,recapVisual},{...options,notice:notice||options.notice})):economicScope(()=>renderSourcePlay(state,config(),getData())))+(['game','activities'].includes(skin)?screens.audioControls():'')+runtimePanel+adapterPanel();},handleRecapMotionClick:event=>recapMotion.handleClick(event),handle,afterMount,beforeRender};
}
