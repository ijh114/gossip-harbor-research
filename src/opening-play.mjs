import {sceneSteps} from './scene-script.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const int=(v,max=10000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const phases=['playing','paused','done','skipped'];
function identity(c){const r=c?.sources?.find(s=>s.id==='scene:Timeline_intro');return r?.sha256||r?.hash||'packaged-intro-v1';}
const steps=c=>sceneSteps(c?.intro);
export function createOpeningPlay(c){return {schema:1,source:identity(c),index:0,elapsed:0,phase:'playing',autoplay:false};}
export function validOpeningPlay(s,c){
 if(s===undefined)return true;if(!object(s))return false;const seconds=duration(steps(c)[s.index]);
 return object(s)&&Object.keys(s).every(k=>['schema','source','index','elapsed','phase','autoplay'].includes(k))&&s.schema===1&&s.source===identity(c)&&int(s.index,Math.max(0,steps(c).length-1))&&Number.isFinite(s.elapsed)&&s.elapsed>=0&&s.elapsed<=604800&&phases.includes(s.phase)&&typeof s.autoplay==='boolean'&&(seconds===null?s.elapsed===0:s.elapsed<=seconds);
}
function duration(step){
 if(step?.kind==='mask'){const m=step.mask;return [m?.fadeIn,m?.hold,m?.fadeOut,m?.delay].every(Number.isFinite)?m.fadeIn+m.hold+m.fadeOut+m.delay:null;}
 if(['camera','end'].includes(step?.kind)){const c=step.camera;return Number.isFinite(c?.tweenTime)&&Number.isFinite(c?.delay)?c.tweenTime+c.delay:null;}
 return null;
}
export function openingPlayView(s,c){
 if(!validOpeningPlay(s,c)||s===undefined)return {valid:s===undefined,initialized:false,steps:[],step:null};
 const rows=steps(c),step=rows[s.index]||null,seconds=duration(step),remaining=seconds===null?null:Math.max(0,seconds-s.elapsed);
 return {valid:true,initialized:true,steps:rows,step,index:s.index,total:rows.length,phase:s.phase,autoplay:s.autoplay,duration:seconds,remaining,waiting:s.autoplay&&remaining>0&&s.phase==='playing',canNext:s.phase==='playing'&&(!s.autoplay||remaining===null||remaining===0),canPrevious:s.index>0&&s.phase!=='done'&&s.phase!=='skipped',atEnd:s.index===rows.length-1};
}
export function openingPlayAction(s,event,c){
 if(s===undefined||!validOpeningPlay(s,c))return {ok:false,status:'invalid-state',message:'인트로 저장을 보존했습니다. 상태 JSON을 보관한 뒤 인트로만 초기화하세요.'};
 const copy=structuredClone(s),v=openingPlayView(copy,c);let finished=false;
 if(event.type==='pause'){if(copy.phase==='playing')copy.phase='paused';}
 else if(event.type==='resume'){if(copy.phase==='paused')copy.phase='playing';}
 else if(event.type==='autoplay'){if(typeof event.value!=='boolean')return {ok:false,status:'invalid-input'};copy.autoplay=event.value;}
 else if(event.type==='advance'){
  if(copy.phase!=='playing'||!copy.autoplay||!Number.isFinite(event.seconds)||event.seconds<0||event.seconds>3600||v.duration===null)return {ok:false,status:'ignored'};
  copy.elapsed=Math.min(v.duration,copy.elapsed+event.seconds);
  // Dialogue and omitted bodies always require explicit user continuation.
  if(copy.elapsed>=v.duration&&copy.index<v.total-1){copy.index++;copy.elapsed=0;}
 }
 else if(event.type==='next'){
  if(!v.canNext)return {ok:false,status:'input-locked',message:'선언된 전환 시간이 지난 뒤 계속하세요.'};
  if(v.atEnd){copy.phase='done';finished=true;}else{copy.index++;copy.elapsed=0;}
 }
 else if(event.type==='previous'){
  if(!v.canPrevious)return {ok:false,status:'edge'};copy.index--;copy.elapsed=0;
 }
 else if(event.type==='skip'){copy.phase='skipped';finished=true;}
 else return {ok:false,status:'unsupported-event'};
 if(!validOpeningPlay(copy,c))return {ok:false,status:'invalid-result'};
 Object.assign(s,copy);return {ok:true,status:copy.phase,finished,message:finished?'인트로를 마치고 메인 맵으로 이동합니다.':'동봉 인트로 명령을 진행했습니다.'};
}
