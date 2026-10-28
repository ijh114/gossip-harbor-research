import {createPlay,playAction,advancePlay,validPlay} from './play-model.mjs';
import {renderSourcePlay} from './play-page.mjs';
import {readSession,writeSession,encodeSave,decodeSave,SAVE_KEY,MAX_OFFLINE_SECONDS} from './session-store.mjs';

export function createPlayController({getData,render,download}){
 let state,wallAt=0,storage,canWrite=true;
 const config=()=>getData().playConfig;
 const options=()=>({revision:config().revision,now:Date.now(),validate:s=>validPlay(s,config())});
 function syncTime(){
  if(!state||!wallAt)return;
  const now=Date.now(),seconds=Math.max(0,Math.floor((now-wallAt)/1000));
  if(seconds){advancePlay(state,Math.min(seconds,MAX_OFFLINE_SECONDS),config(),{silent:true});wallAt=now;}
 }
 function persist(){
  if(!canWrite){state.storageMessage='기존 저장을 보존 중입니다. 상태 JSON을 내보내거나 새 실험을 선택하세요.';return false;}
  const result=writeSession(storage,state,options());state.storageMessage=result.message;return result.ok;
 }
 function ensure(){
  if(state)return;
  try{storage=window.localStorage;}catch{storage=null;}
  const saved=readSession(storage,options());wallAt=Date.now();
  if(saved.ok){state=saved.state;advancePlay(state,saved.elapsedSeconds,config(),{silent:true});state.message=`이전 실험 복원 · ${saved.elapsedSeconds}초 경과${saved.capped?' (웹 정책7일 상한)':''}`;persist();}
  else{state=createPlay(config());canWrite=['missing','storage-unavailable'].includes(saved.reason);state.storageMessage=saved.reason==='missing'?'연구 상태를 이 브라우저에 자동 저장합니다.':saved.message;}
 }
 function backup(){
  try{const current=storage?.getItem(SAVE_KEY);if(current)storage.setItem(SAVE_KEY+'-previous',current);canWrite=Boolean(storage);return true;}
  catch{canWrite=false;return false;}
 }
 function handle(action,value){
  const disclosures=[...document.querySelectorAll('.source-play details')].map((node,i)=>({i,open:node.open}));
  ensure();syncTime();
  if(action==='reset'||action==='scenario'){
   const scenario=action==='scenario'&&['open','initial'].includes(value)?value:state.scenario;
   const backed=backup();state=createPlay(config(),{scenario});wallAt=Date.now();
   state.storageMessage=backed?'이전 저장을 별도 보관하고 새 실험을 준비했습니다.':'기존 저장을 보존하기 위해 새 실험은 메모리에서만 진행합니다.';
  }else if(action==='save'){persist();render();return;}
  else if(action==='export'){
   const result=encodeSave(state,options());if(result.ok)download('harbor-play-session.json',JSON.parse(result.raw));
   else state.storageMessage=result.message;
  }else playAction(state,action,value,config());
  persist();render();for(const {i,open}of disclosures){const node=document.querySelectorAll('.source-play details')[i];if(node)node.open=open;}
  if(!state.modal)document.querySelector(`[data-play="${action}"]${value!==undefined?`[data-value="${value}"]`:''}`)?.focus({preventScroll:true});
 }
 function afterMount(){
  document.body.dataset.playFocus=String(Boolean(state?.focused));
  const dialog=document.querySelector('#play-dialog');
  if(dialog&&!dialog.open){dialog.showModal();dialog.addEventListener('cancel',event=>{event.preventDefault();handle(state.modal==='energy'?'close-energy':state.modal==='offer'?'close-offer':'close-shop');});}
 }
 document.addEventListener('change',async event=>{
  const input=event.target;
  if(input.hasAttribute('data-play-bm')){
   ensure();syncTime();const key=input.dataset.playBm,value=input.type==='checkbox'?input.checked:Number(input.value);
   if((['bundle','noPay','invite','plenty','chain','weekly'].includes(key)&&typeof value==='boolean')||(key==='triggerPrice'&&Number.isInteger(value)&&value>=0&&value<=1e6)||(key==='popType'&&[1,2].includes(value))){state.bm[key]=value;persist();}
   return;
  }
  if(input.id!=='play-import'||!input.files?.[0])return;
  ensure();const file=input.files[0];
  if(file.size>2*1024*1024){state.storageMessage='가져올 상태 JSON은2MB 이하여야 합니다.';render();return;}
  try{
   const saved=decodeSave(await file.text(),options());
   if(!saved.ok){state.storageMessage=saved.message;render();return;}
   backup();state=saved.state;advancePlay(state,saved.elapsedSeconds,config(),{silent:true});wallAt=Date.now();persist();render();
  }catch{state.storageMessage='상태 파일을 읽지 못했습니다. 기존 실험을 유지합니다.';render();}
 });
 window.addEventListener('pagehide',()=>{if(state){syncTime();persist();}});
 return {render(){ensure();return renderSourcePlay(state,config(),getData());},handle,afterMount};
}
