import {mountDecorHold} from './decor-hold.mjs';
import {createSourceAudio,sourceActionCue} from './source-audio.mjs';
import {createOpeningPlay,validOpeningPlay,openingPlayAction,openingPlayView} from './opening-play.mjs';
import {screenFlow,beginOpening,beginTaskScene,finishTaskScene,leaveScene,flowBlocksInput,SPACES} from './screen-flow.mjs';
import {sourceScene,sceneCursor,chooseSceneVariant,advanceScene,canCommitScene,commitSceneChoices} from './scene-script.mjs';
import {beginDecorEdit,previewDecor,confirmDecorEdit,cancelDecorEdit} from './decor-model.mjs';
import {playGuide} from './play-guide.mjs';
import {mountMapInput} from './map-input.mjs';

export function createScreenController({getState,getConfig,getData,domain,persist,render,backup=()=>false}){
 let booted=false,loading=false,entry=true,taskList=false,newPrompt=false,timer=null,lastScreen='',audio=null,screenNotice='',returnFocus=null,mapInput=null,introTicker=null,decorHoldCleanup=()=>{};
 const state=()=>getState(),config=()=>getConfig(),flow=()=>screenFlow(state(),config());
 const sourceAudio=createSourceAudio({getData,getEnabled:()=>flow().sound,onNotice:message=>{screenNotice=message;const node=document.querySelector('.game-feedback');if(node)node.textContent=message;},AudioClass:window.Audio});
 const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 function stopAudio(){sourceAudio.stop();if(audio){audio.pause();audio=null;}}
 function sound(id,explicitClip=null){
  if(getData().sourceAudio){sourceAudio.effect(id,explicitClip);return;}
  if(!flow().sound||!id||document.hidden)return;
  const clip=explicitClip||getData().refinement?.audio?.clips?.find(r=>r.id===id);
  if(!clip||!(/^\.\/assets\/media\/refinement\/audio\/[\w-]+\.mp3$/.test(clip.src)||explicitClip&&clip.kind==='audio'&&clip.duration>0&&clip.duration<=3&&/^\.\/assets\/media\/story-recap\/[\w-]+\.wav$/.test(clip.src)))return;
  stopAudio();
  try{const current=new window.Audio(clip.src);audio=current;current.volume=.3;const result=current.play();result?.catch(()=>{screenNotice='브라우저에서 효과음을 재생하지 못했습니다. 효과음을 껐다가 다시 켜보세요.';const node=document.querySelector('.game-feedback');if(node)node.textContent=screenNotice;});}
  catch{screenNotice='이 환경에서는 효과음을 재생할 수 없습니다.';}
 }
 function refresh(){persist();render();}
 function finish(){
  const f=flow();if(f.phase!=='task-building')return;
  const scene=sourceScene(getData().sceneConfig,f.task?.id);if(scene&&!canCommitScene(f.task,scene)){f.phase='task-story';return;}
  const result=domain('quest-finish');
  if(result.ok){if(scene)commitSceneChoices(f,f.task,scene);finishTaskScene(state(),config());if(getData().sourceSceneStage)sound('sfxStoryOut');}else{f.phase='task-story';screenNotice=result.message;}
 }
 function handle(action,value){
  const s=state(),f=flow();
  returnFocus=action==='game-task-list-close'?'[data-play="game-task-list"]':action==='game-new-cancel'?'[data-play="game-new-prompt"]':action==='game-sound'?'[data-play="game-sound"]':null;
  if(action==='game-cg-open'){if(s.modal||s.pendingQuest||taskList||!entry&&!['map','board','opening'].includes(f.phase)){screenNotice='현재 장면을 마친 뒤 CG 구성을 여세요.';return true;}f.cgReturn=entry?'title':f.phase;if(s.sourceOpening!==undefined&&getData().sceneConfig)openingPlayAction(s.sourceOpening,{type:'pause'},getData().sceneConfig);entry=false;f.phase='cg';return true;}
  if(action==='game-cg-close'){if(f.phase==='cg'){const prior=f.cgReturn;f.phase=['map','board','opening'].includes(prior)?prior:s.stage==='home'?'map':'board';if(prior==='title')entry=true;if(f.phase==='opening'&&s.sourceOpening!==undefined&&getData().sceneConfig)openingPlayAction(s.sourceOpening,{type:'resume'},getData().sceneConfig);}return true;}
  if(action==='game-title'){stopAudio();if(s.sourceOpening!==undefined&&getData().sceneConfig)openingPlayAction(s.sourceOpening,{type:'pause'},getData().sceneConfig);entry=true;taskList=false;newPrompt=false;return true;}
  if(action==='game-continue'){entry=false;if(s.stage==='title'&&f.phase!=='opening')beginOpening(s,config());if(f.phase==='opening'&&s.sourceOpening!==undefined&&getData().sceneConfig)openingPlayAction(s.sourceOpening,{type:'resume'},getData().sceneConfig);return true;}
  if(action==='game-new-prompt'){newPrompt=true;return true;}
  if(action==='game-new-cancel'){newPrompt=false;return true;}
  if(action==='game-sound'){f.sound=!f.sound;screenNotice='';if(f.sound){sourceAudio.activate();sound('button-click');}else stopAudio();return true;}
  if(action==='game-audio-enable'){f.sound=true;sourceAudio.activate();screenNotice='현재 탭의 음향을 켰습니다. 음악은 명시 조건을 확인한 뒤 재생합니다.';return true;}
  if(action==='game-audio-stop'){f.sound=false;stopAudio();return true;}
  if(action==='game-audio-set'){try{const input=JSON.parse(value);if(!sourceAudio.configure(input.key,input.value))screenNotice='음향 설정 값과 범위를 확인하세요.';}catch{screenNotice='음향 설정 형식을 확인하세요.';}return true;}
  if(action==='game-task-list-close'){taskList=false;return true;}
  if(entry||loading||newPrompt)return false;
  if(action.startsWith('game-intro-')){
   if(f.phase!=='opening'||!getData().sceneConfig?.intro)return true;const c=getData().sceneConfig,kind=action.slice(11);
   if(kind==='reset-invalid'){if(backup())s.sourceOpening=createOpeningPlay(c);else screenNotice='기존 저장 백업에 실패해 인트로를 초기화하지 않았습니다.';return true;}
   const out=openingPlayAction(s.sourceOpening,{type:kind,value:value==='true'?true:value==='false'?false:value},c);screenNotice=out.message||'';if(out.ok&&out.finished){domain('home');f.phase='map';}else if(out.ok&&kind==='next')sound('dialogue-pop');return true;
  }
  if(action==='game-opening-next'||action==='game-opening-skip'){
   if(f.phase!=='opening')return true;
   if(s.sourceOpening!==undefined&&getData().sceneConfig?.intro){const out=openingPlayAction(s.sourceOpening,{type:action==='game-opening-skip'?'skip':'next'},getData().sceneConfig);screenNotice=out.message||'';if(out.finished){domain('home');f.phase='map';}return true;}
   if(f.introStep===0&&action!=='game-opening-skip'){f.introStep=1;sound('dialogue-pop');}
   else{domain('home');f.phase='map';}
   return true;
  }
  if(action==='game-task-list'){if(f.phase==='map')taskList=true;return true;}
  if(taskList)return false;
  if(action==='quest-start'){
   if(f.phase==='map'&&domain(action,value).ok){beginTaskScene(s,config());sound(getData().sourceSceneStage?'sfxStoryIn':'dialogue-pop');}return true;
  }
  if(action==='game-task-resume'||action==='quest-finish'){
   if(f.phase==='map')beginTaskScene(s,config());return true;
  }
  if(action==='game-task-build'){
   const scene=sourceScene(getData().sceneConfig,f.task?.id);
   if(f.phase==='task-story'&&s.pendingQuest?.id===f.task?.id&&(!scene||canCommitScene(f.task,scene))){f.phase='task-building';sound('renovate');}return true;
  }
  if(action==='game-scene-choice'||action==='game-scene-next'){
   const scene=sourceScene(getData().sceneConfig,f.task?.id);if(f.phase!=='task-story'||!scene)return true;
   if(action==='game-scene-choice'){chooseSceneVariant(f.task,scene,String(value));returnFocus=`[data-play="game-scene-choice"][data-value="${['1','2','3'].includes(String(value))?value:'1'}"]`;}
   else if(advanceScene(f.task,scene)){if(!getData().sourceSceneStage||sceneCursor(f.task,scene).step?.kind==='dialogue')sound('dialogue-pop');returnFocus='#game-scene-heading';}return true;
  }
  if(action==='game-decor-open'){if(f.phase==='map')f.phase='decor';return true;}
  if(action==='game-decor-close'){if(f.phase==='decor')f.phase='map';return true;}
  if(action==='game-skins-open'){if(['map','decor'].includes(f.phase)&&!s.pendingQuest&&!s.modal)f.phase='skins';return true;}
  if(action==='game-skins-close'){if(f.phase==='skins')f.phase='map';return true;}
  if(action==='game-factory-open'){const guide=playGuide(s,config());if(s.stage==='play'&&(!s.modal||s.modal==='inventory')&&!s.toolPending&&!guide.input&&!guide.waitSeconds){if(s.modal==='inventory')domain('close-inventory');f.phase='factory';}else screenNotice='퍼즐의 기본 안내와 열린 선택창을 먼저 마친 뒤 공장을 여세요.';return true;}
  if(action==='game-factory-close'){sourceAudio.stopScope('factory');if(f.phase==='factory')f.phase='board';return true;}
  if(action==='game-map-edit-slot'){
   if(f.phase==='map'){const guide=playGuide(s,config()),r=beginDecorEdit(s,config(),getData().sceneConfig,String(value),{inputLocked:Boolean(guide.input||guide.waitSeconds),returnTo:'map'});screenNotice=r.message;}return true;
  }
  if(action==='game-decor-edit'){
   if(f.phase==='decor'){const guide=playGuide(s,config()),r=beginDecorEdit(s,config(),getData().sceneConfig,String(value),{inputLocked:Boolean(guide.input||guide.waitSeconds)});screenNotice=r.message;}return true;
  }
  if(action==='game-decor-preview'){const r=previewDecor(s,config(),getData().sceneConfig,String(value));screenNotice=r.message;returnFocus=`[data-play="game-decor-preview"][data-value="${['1','2','3'].includes(String(value))?value:'1'}"]`;return true;}
  if(action==='game-decor-confirm'){const changed=f.decorEdit?.selected!==f.decorEdit?.original,r=confirmDecorEdit(s,config(),getData().sceneConfig);if(r.ok&&changed)sound('decor-change');screenNotice=r.message;return true;}
  if(action==='game-decor-cancel'){const r=cancelDecorEdit(s);screenNotice=r.message;return true;}
  if(action==='game-map-pan'&&f.phase==='map'){const step={left:[-5,0],right:[5,0],up:[0,-5],down:[0,5]}[value];if(step){f.view.x=Math.max(-25,Math.min(25,f.view.x+step[0]));f.view.y=Math.max(-25,Math.min(25,f.view.y+step[1]));}return true;}
  if(action==='game-map-zoom'&&f.phase==='map'){f.view.zoom=Math.max(1,Math.min(1.8,Number(value)||1));return true;}
  if(action==='game-map-reset'&&f.phase==='map'){f.view={x:0,y:0,zoom:1};return true;}
  if(action==='game-task-finish'){finish();return true;}
  if(action==='game-task-close'){sourceAudio.stopScope('reward');if(f.phase==='task-reward')leaveScene(s,config());return true;}
  if(action==='game-task-hold'){if(['task-story','task-building'].includes(f.phase))leaveScene(s,config());return true;}
  if(action==='game-space-open'){if(f.phase==='map'&&!s.pendingQuest){f.phase='space-choice';}return true;}
  if(action==='game-space-select'){
   if(f.phase==='space-choice'&&SPACES.some(x=>x.id===value)){f.space=value;f.spaceAfter=false;returnFocus=`[data-play="game-space-select"][data-value="${value}"]`;}return true;
  }
  if(action==='game-space-before'){if(f.phase==='space-choice')f.spaceAfter=false;return true;}
  if(action==='game-space-build'){if(f.phase==='space-choice'){f.phase='space-building';sound('renovate');}return true;}
  if(action==='game-space-close'){if(f.phase.startsWith('space-')){f.phase='map';}return true;}
  return false;
 }
 function blocked(action){
  if(['focus','save','export','reset','scenario','new-game'].includes(action))return false;
  return entry||loading||taskList||newPrompt||flowBlocksInput(state(),config());
 }
 function beforeRender(){decorHoldCleanup();decorHoldCleanup=()=>{};if(introTicker!==null){window.clearInterval(introTicker);introTicker=null;}if(timer!==null){window.clearTimeout(timer);timer=null;}mapInput?.stop();mapInput=null;if(!window.location.hash.startsWith('#experience')||new URLSearchParams(window.location.hash.split('?')[1]||'').get('mode')&&!['game','activities'].includes(new URLSearchParams(window.location.hash.split('?')[1]||'').get('mode'))){sourceAudio.leave();stopAudio();}else if(new URLSearchParams(window.location.hash.split('?')[1]||'').get('mode')==='activities')sourceAudio.sync(null);}
 function afterMount(){
  const root=document.querySelector('.game-play');if(!root)return;
  for(const [id,close]of [['game-task-list','game-task-list-close'],['game-new-dialog','game-new-cancel']]){
   const dialog=document.getElementById(id);if(dialog&&!dialog.open){dialog.showModal();dialog.addEventListener('cancel',ev=>{ev.preventDefault();handle(close);refresh();});}
  }
  if(!booted){loading=true;timer=window.setTimeout(()=>{booted=true;loading=false;render();},350);return;}
  const f=flow();
  if(f.phase==='map'&&!entry&&!taskList&&!newPrompt)decorHoldCleanup=mountDecorHold(root,{isAllowed:()=>flow().phase==='map'&&!playGuide(state(),config()).input&&!playGuide(state(),config()).waitSeconds,onLoop:()=>sourceAudio.loopEffect('decor-bar','decor-progress'),onStop:()=>sourceAudio.stopScope('decor-progress'),onComplete:slot=>{handle('game-map-edit-slot',slot);refresh();}});
  if(getData().sourceAudio)sourceAudio.sync(!entry&&!loading&&!newPrompt&&(f.phase==='map'||f.phase==='board')?(f.phase==='map'?'Map':'Main'):null);
  if(!entry&&!taskList&&!newPrompt&&f.phase==='opening'&&getData().sceneConfig&&state().sourceOpening!==undefined){const c=getData().sceneConfig,v=openingPlayView(state().sourceOpening,c);if(v.valid&&v.phase==='playing'&&v.autoplay&&v.duration!==null){let at=Date.now(),savedAt=at;introTicker=window.setInterval(()=>{const now=Date.now(),delta=(now-at)/1000;at=now;if(document.hidden)return;const before=state().sourceOpening.index,wasWaiting=openingPlayView(state().sourceOpening,c).waiting,out=openingPlayAction(state().sourceOpening,{type:'advance',seconds:delta},c),next=openingPlayView(state().sourceOpening,c);if(!out.ok)return;if(before!==state().sourceOpening.index||wasWaiting&&!next.waiting){refresh();return;}const remaining=document.querySelector('[data-opening-remaining]'),progress=document.querySelector('[data-opening-progress]');if(remaining)remaining.textContent=next.remaining.toFixed(2);if(progress)progress.value=next.duration-next.remaining;if(now-savedAt>1000){persist();savedAt=now;}},25);}}
  if(f.phase==='map'&&!entry&&!taskList&&!newPrompt)mapInput=mountMapInput(root.querySelector('.game-map-scene'),{getView:()=>flow().view,isLocked:()=>{const g=playGuide(state(),config());return Boolean(state().modal||g.input||g.waitSeconds);},onCommit:view=>{flow().view=view;returnFocus='.game-map-scene';refresh();}});
  if(!entry&&!taskList&&!newPrompt&&['task-building','space-building'].includes(f.phase)){
   const expected=snapshot();timer=window.setTimeout(()=>{if(expected!==snapshot()||entry)return;if(f.phase==='task-building')finish();else{f.spaceAfter=true;f.phase='space-choice';}refresh();},reduce()?0:850);
  }
  const screen=entry?'title':root.querySelector('[data-game-screen]')?.dataset.gameScreen||'loading';
  if(screen!==lastScreen){const target=root.querySelector('[data-game-screen] h2');if(target){target.tabIndex=-1;target.focus({preventScroll:true});}lastScreen=screen;}
  else if(returnFocus)root.querySelector(returnFocus)?.focus({preventScroll:true});
  returnFocus=null;
 }
 function snapshot(){const s=state(),f=flow();return JSON.stringify([s.questsDone,s.pendingQuest?.id,f.phase,f.task?.id,f.task?.script?.index,f.space]);}
 document.addEventListener('visibilitychange',()=>{sourceAudio.setHidden(document.hidden);if(document.hidden)stopAudio();});
 window.addEventListener('pagehide',()=>{sourceAudio.leave();stopAudio();});
 return {handle,blocked,beforeRender,afterMount,sound,stopAudio,stageSound:cue=>!cue.isMusicExcerpt&&sourceAudio.effect(cue.name,cue.clip,'stage'),stopStageAudio:()=>sourceAudio.stopScope('stage'),audioControls:()=>getData().sourceAudio?sourceAudio.renderControls():'',actionSound:(action,before,after,result,c)=>getData().sourceAudio?sourceAudio.effect(sourceActionCue(action,before,after,result,c)):null,scheduleSound:(id,seconds,scope='factory')=>sourceAudio.scheduleEffect(id,seconds,scope,()=>scope==='reward'?flow().phase==='task-reward':scope==='factory'?flow().phase==='factory':true),isMapDragging:()=>Boolean(mapInput?.isDragging()),researchContext:()=>({entry,loading,taskList,newPrompt,presentation:flow().phase}),
  reset(){beforeRender();booted=true;loading=false;entry=false;newPrompt=false;taskList=false;beginOpening(state(),config());if(getData().sceneConfig?.intro)state().sourceOpening=createOpeningPlay(getData().sceneConfig);},
  imported(){beforeRender();entry=true;newPrompt=false;taskList=false;stopAudio();},
  renderOptions(){if(!booted)loading=true;return {loading,entry,taskList,newPrompt,notice:screenNotice};}
 };
}
