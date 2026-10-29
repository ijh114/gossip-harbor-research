import {screenFlow,beginOpening,beginTaskScene,finishTaskScene,leaveScene,flowBlocksInput,SPACES} from './screen-flow.mjs';

export function createScreenController({getState,getConfig,getData,domain,persist,render}){
 let booted=false,loading=false,entry=true,taskList=false,newPrompt=false,timer=null,lastScreen='',audio=null,soundFailure='',returnFocus=null;
 const state=()=>getState(),config=()=>getConfig(),flow=()=>screenFlow(state(),config());
 const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 function stopAudio(){if(audio){audio.pause();audio=null;}}
 function sound(id){
  if(!flow().sound||!id||document.hidden)return;
  const clip=getData().refinement?.audio?.clips?.find(r=>r.id===id);
  if(!clip||!/^\.\/assets\/media\/refinement\/audio\/[\w-]+\.mp3$/.test(clip.src))return;
  stopAudio();
  try{const current=new window.Audio(clip.src);audio=current;current.volume=.3;const result=current.play();result?.catch(()=>{soundFailure='브라우저에서 효과음을 재생하지 못했습니다. 효과음을 껐다가 다시 켜보세요.';const node=document.querySelector('.game-feedback');if(node)node.textContent=soundFailure;});}
  catch{soundFailure='이 환경에서는 효과음을 재생할 수 없습니다.';}
 }
 function refresh(){persist();render();}
 function finish(){
  const f=flow();if(f.phase!=='task-building')return;
  const result=domain('quest-finish');
  if(result.ok)finishTaskScene(state(),config());else{f.phase='task-story';soundFailure=result.message;}
 }
 function handle(action,value){
  const s=state(),f=flow();
  returnFocus=action==='game-task-list-close'?'[data-play="game-task-list"]':action==='game-new-cancel'?'[data-play="game-new-prompt"]':action==='game-sound'?'[data-play="game-sound"]':null;
  if(action==='game-title'){entry=true;taskList=false;newPrompt=false;return true;}
  if(action==='game-continue'){entry=false;if(s.stage==='title'&&f.phase!=='opening')beginOpening(s,config());return true;}
  if(action==='game-new-prompt'){newPrompt=true;return true;}
  if(action==='game-new-cancel'){newPrompt=false;return true;}
  if(action==='game-sound'){f.sound=!f.sound;soundFailure='';if(f.sound)sound('button-click');else stopAudio();return true;}
  if(action==='game-task-list-close'){taskList=false;return true;}
  if(entry||loading||newPrompt)return false;
  if(action==='game-opening-next'||action==='game-opening-skip'){
   if(f.phase!=='opening')return true;
   if(f.introStep===0&&action!=='game-opening-skip'){f.introStep=1;sound('dialogue-pop');}
   else{domain('home');f.phase='map';}
   return true;
  }
  if(action==='game-task-list'){if(f.phase==='map')taskList=true;return true;}
  if(taskList)return false;
  if(action==='quest-start'){
   if(f.phase==='map'&&domain(action,value).ok){beginTaskScene(s,config());sound('dialogue-pop');}return true;
  }
  if(action==='game-task-resume'||action==='quest-finish'){
   if(f.phase==='map')beginTaskScene(s,config());return true;
  }
  if(action==='game-task-build'){
   if(f.phase==='task-story'&&s.pendingQuest?.id===f.task?.id){f.phase='task-building';sound('renovate');}return true;
  }
  if(action==='game-task-finish'){finish();return true;}
  if(action==='game-task-close'){if(f.phase==='task-reward')leaveScene(s,config());return true;}
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
 function beforeRender(){if(timer!==null){window.clearTimeout(timer);timer=null;}if(!window.location.hash.startsWith('#experience'))stopAudio();}
 function afterMount(){
  const root=document.querySelector('.game-play');if(!root)return;
  for(const [id,close]of [['game-task-list','game-task-list-close'],['game-new-dialog','game-new-cancel']]){
   const dialog=document.getElementById(id);if(dialog&&!dialog.open){dialog.showModal();dialog.addEventListener('cancel',ev=>{ev.preventDefault();handle(close);refresh();});}
  }
  if(!booted){loading=true;timer=window.setTimeout(()=>{booted=true;loading=false;render();},350);return;}
  const f=flow();
  if(!entry&&!taskList&&!newPrompt&&['task-building','space-building'].includes(f.phase)){
   const expected=snapshot();timer=window.setTimeout(()=>{if(expected!==snapshot()||entry)return;if(f.phase==='task-building')finish();else{f.spaceAfter=true;f.phase='space-choice';}refresh();},reduce()?0:850);
  }
  const screen=entry?'title':root.querySelector('[data-game-screen]')?.dataset.gameScreen||'loading';
  if(screen!==lastScreen){const target=root.querySelector('[data-game-screen] h2');if(target){target.tabIndex=-1;target.focus({preventScroll:true});}lastScreen=screen;}
  else if(returnFocus)root.querySelector(returnFocus)?.focus({preventScroll:true});
  returnFocus=null;
 }
 function snapshot(){const s=state(),f=flow();return JSON.stringify([s.questsDone,s.pendingQuest?.id,f.phase,f.task?.id,f.space]);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();});
 window.addEventListener('pagehide',stopAudio);
 return {handle,blocked,beforeRender,afterMount,sound,
  reset(){beforeRender();booted=true;loading=false;entry=false;newPrompt=false;taskList=false;beginOpening(state(),config());},
  imported(){beforeRender();entry=true;newPrompt=false;taskList=false;stopAudio();},
  renderOptions(){if(!booted)loading=true;return {loading,entry,taskList,newPrompt,notice:soundFailure};}
 };
}
