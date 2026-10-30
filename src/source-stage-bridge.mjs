import {renderSourceSceneStage,createSourceSceneStage} from './source-scene-stage.mjs';
import {screenFlow,taskForFlow} from './screen-flow.mjs';
import {sourceScene,sceneCursor} from './scene-script.mjs';
import {storyRecapView,validStoryRecap} from './story-recap.mjs';
import {createNativeMapProjector,nativeMapFrame} from './native-map-study.mjs';
// Ephemeral presentation only. No clock snapshot is serialized into a game save.
export function liveSourceStageOptions(s,c,d,{recapVisual=null}={}){
 if(!d.sourceSceneStage)return null;const f=screenFlow(s,c);
 if(f.phase==='task-story'){
  const q=taskForFlow(s,c),scene=q&&sourceScene(d.sceneConfig,q.id),cast=s.pendingQuest&&scene?{scene:scene.id,order:sceneCursor(f.task,scene).step?.order}:null;return cast?{mode:'map',scene:cast.scene,order:cast.order,playing:true,embedded:true,seed:42}:null;
 }
 if(f.phase==='cg')return {mode:'cg',scene:s.cgPresentation?.sceneId||d.sourceSceneStage.CG.prefabs[0]?.sceneId,playing:true};
 if(f.phase==='recap'&&d.storyRecapConfig&&validStoryRecap(s.storyRecap,d.storyRecapConfig)){
  const q=c.quests[s.questsDone],v=storyRecapView(s.storyRecap,{serverEnabled:null,currentTask:q?{day:q.day,id:q.taskId}:null},d.storyRecapConfig);
  if(v.state!=='open'||!['shelf','book'].includes(v.phase))return null;
  const action=v.phase==='book'&&['nextPage','lastPage'].includes(recapVisual?.action)?recapVisual.action:undefined;
  return {mode:'recap',scene:'recap-'+v.phase,recapView:v.phase==='book'?'book':'main',recapOpened:v.phase==='shelf',...(action?{action,eventId:String(recapVisual.startedAt)}:{}),playing:true,book:v.book?.id,page:v.book?.displayPage};
 }
 return null;
}
export function renderLiveSourceStage(d,options){return options&&d.sourceSceneStage?renderSourceSceneStage(d.sourceSceneStage,options):'';}
export function createLiveSourceStage({getData,getState,getConfig,getVisual=()=>({}),onAudio=()=>{},audioControl=()=>{}}){
 let stage=null,manifest=null,clock=null,key=null,mountedRoot=null,mountedHost=null,projectors=new Map();
 const options=()=>liveSourceStageOptions(getState(),getConfig(),getData(),getVisual());
 const identity=o=>o?JSON.stringify([o.mode,o.scene,o.mode==='recap'?o.book:null,o.eventId||null]):null;
 function beforeRender(keep=true){if(stage){clock=keep?stage.getClockSnapshot():null;stage.cleanup();}if(!keep){key=null;clock=null;}}
 function afterMount(root){const o=options(),d=getData(),host=root?.querySelector('[data-live-source-stage] [data-source-scene-stage]');if(!o||!host){beforeRender(false);return;}
  mountedRoot=root;mountedHost=host;const k=identity(o);if(k!==key)clock=null;key=k;
  if(manifest!==d.sourceSceneStage){manifest=d.sourceSceneStage;projectors=new Map();stage=createSourceSceneStage(manifest,{onAudio,audioControl,onContentRect:()=>{
   const current=options();if(current?.mode!=='recap'||current.recapView!=='book')return;const slot=mountedHost?.querySelector('[data-source-stage-content]'),body=mountedRoot?.querySelector('[data-recap-swipe]');if(slot&&body&&body.parentElement!==slot){slot.classList.add('has-reading-content');slot.append(body);}
  }});}
  const props={...o,clockSnapshot:clock};
  if(o.mode==='map'&&d.nativeMapStudy?.views.some(v=>v.slotId===o.scene)){
   if(!projectors.has(o.scene))projectors.set(o.scene,createNativeMapProjector(d.nativeMapStudy,o.scene));props.projectWorld=projectors.get(o.scene);
   const view=d.nativeMapStudy.views.find(v=>v.slotId===o.scene),f=screenFlow(getState(),getConfig()),variant=f.task?.script?.choices?.[o.scene]||view.layers.find(l=>l.variantId==='1')?.variantId||view.layers[0]?.variantId,frame=nativeMapFrame(d.nativeMapStudy,{slotId:o.scene,variantId:variant});
   if(frame.valid)props.background={src:frame.base.src,layers:[{src:frame.layer.media.src}]};
  }
  stage.mount(host,props);
 }
 return {beforeRender,afterMount,options,getState:()=>stage?.getState()||null};
}
