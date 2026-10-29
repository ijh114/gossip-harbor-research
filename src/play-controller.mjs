import {createPlay,playAction,advancePlay,validPlay,migratePlayState,currentBubbleQuote} from './play-model.mjs';
import {renderSourcePlay} from './play-page.mjs';
import {renderGamePlay,gameClocks} from './game-page.mjs';
import {onboardingConstraints} from './onboarding-model.mjs';
import {readSession,writeSession,encodeSave,decodeSave,SAVE_KEY,MAX_OFFLINE_SECONDS} from './session-store.mjs';
import {createScreenController} from './screen-controller.mjs';
import {soundForAction} from './screen-flow.mjs';
import {createActivityPlay,activityAction,recordActivityProgress,validActivityPlay,activityView} from './activity-play.mjs';
import {renderActivityPlay} from './activity-page.mjs';

export function createPlayController({getData,render,download}){
 let state,wallAt=0,storage,canWrite=true,ticker=null,notice='',drag=null,suppressClick=false,lastCheckpoint=0,skin='source';
 const config=()=>getData().playConfig;
 const screens=createScreenController({getState:()=>state,getConfig:config,getData,domain:commit,persist,render});
 function commit(action,value){
  const [from,to]=action==='move'?String(value).split(',').map(Number):[state.selected,Number(value)];
  const oldPair=['cell','move'].includes(action)&&from!==null&&from!==to&&state.board[from]&&state.board[to]&&state.board[from].type===state.board[to].type;
  const before={coins:state.wallet.coins,orders:state.wallet.orders,energy:state.wallet.energy,gems:state.wallet.gems,uids:new Set(state.board.filter(Boolean).map(x=>x.uid))};
  const result=playAction(state,action,value,config());
  const ac=getData().activityConfig,a=state.activityPlay;
  if(result.ok&&ac&&a&&validActivityPlay(a,ac)&&!action.startsWith('aid-')&&action!=='time'){
   const sequence=Math.max(Number.isSafeInteger(state.activityEventSequence)&&state.activityEventSequence>=0&&state.activityEventSequence<1e9?state.activityEventSequence:0,...Object.values(a.lastSequences))+1;state.activityEventSequence=sequence;
   const fresh=state.board.some(x=>x&&!before.uids.has(x.uid)),merge=oldPair&&fresh;
   const events=[['customer',state.wallet.orders-before.orders],['merge',merge?1:0],['energy',result.costEnergy&&result.debitSucceeded?result.requestedEnergy:Math.max(0,before.energy-state.wallet.energy)],['gold',action==='sell'?0:Math.max(0,state.wallet.coins-before.coins)],['gem',Math.max(0,before.gems-state.wallet.gems)]];
   for(const [kind,count]of events)if(count>0)recordActivityProgress(a,{kind,count,sequence},ac,{now:state.wallet.time});
  }
  if(skin==='game')screens.sound(soundForAction(action,before,state,result,config()));return result;
 }
 const options=()=>({revision:config().revision,now:Date.now(),validate:s=>validPlay(s,config())});
 function syncTime(){
  if(!state||!wallAt)return;
  const now=Date.now(),seconds=Math.max(0,Math.floor((now-wallAt)/1000));
  if(seconds){advancePlay(state,Math.min(seconds,MAX_OFFLINE_SECONDS),config(),{silent:true});wallAt+=seconds*1000;}
 }
 function persist(){
  if(!canWrite){state.storageMessage='기존 저장을 보존 중입니다. 상태 JSON을 내보내거나 새 실험을 선택하세요.';return false;}
  const result=writeSession(storage,state,options());state.storageMessage=result.message;return result.ok;
 }
 function backup(){
  try{const current=storage?.getItem(SAVE_KEY);if(current)storage.setItem(SAVE_KEY+'-previous',current);canWrite=Boolean(storage);return true;}
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
  wallAt=Date.now();
  if(saved.ok){state=saved.state;if(saved.migrated)backup();advancePlay(state,saved.elapsedSeconds,config(),{silent:true});state.message=`이전 실험 복원 · ${saved.elapsedSeconds}초 경과${saved.capped?' (웹 정책7일 상한)':''}${saved.migrated?' · 원본 저장을 백업하고 새 규칙으로 이전':''}`;persist();}
  else{state=createPlay(config(),{scenario:'initial'});canWrite=['missing','storage-unavailable'].includes(saved.reason);state.storageMessage=saved.reason==='missing'?'연구 상태를 이 브라우저에 자동 저장합니다.':saved.message;}
 }
 function handle(action,value){
  const disclosures=[...document.querySelectorAll('.source-play details,.game-play details')].map((node,i)=>({i,open:node.open}));
  ensure();syncTime();notice='';
  if(action.startsWith('activity:')){
   const ac=getData().activityConfig,kind=action.slice(9);if(!ac)return;
   if(kind==='reset-invalid'){if(backup()){state.activityPlay=createActivityPlay(ac);notice='기존 저장을 백업하고 활동 연구 상태를 새로 만들었습니다.';}}
   else{
    if(state.activityPlay===undefined)state.activityPlay=createActivityPlay(ac);
    if(kind==='open-pack')value=document.querySelector('[data-activity-card]')?.value;
    if(kind==='event-research-item')value=document.querySelector('[data-activity-type]')?.value;
    const r=activityAction(state.activityPlay,kind,value,ac,{now:state.wallet.time});notice=r.message;
   }
   persist();render();return;
  }
  if(skin==='game'&&screens.handle(action,value)){persist();render();return;}
  if(skin==='game'&&screens.blocked(action)){notice='현재 장면을 마치거나 맵으로 돌아간 뒤 조작하세요.';render();return;}
  if(action==='new-game'){
   const backed=backup();const sound=state.screenFlow?.sound===true;state=createPlay(config(),{scenario:'initial',guide:true});wallAt=Date.now();
   state.storageMessage=backed?'이전 저장을 백업하고 새 게임을 시작했습니다.':'기존 저장을 보존하기 위해 메모리에서만 진행합니다.';
   if(skin==='game'){screens.reset();state.screenFlow.sound=sound;}else commit('start');persist();render();return;
  }
  if(action==='reset'||action==='scenario'){
   screens.imported();
   const scenario=action==='scenario'&&['open','initial'].includes(value)?value:state.scenario;
   const backed=backup();state=createPlay(config(),{scenario});wallAt=Date.now();
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
   if(state.stage==='play'&&!state.modal&&definition?.generator&&!cell.cover&&!state.bubbles?.[cell.uid]&&(state.selected===null||state.selected===index)){
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
 function stopDrag(){
  if(!drag)return;drag.node?.classList.remove('drag-origin');drag.target?.classList.remove('drag-target');drag.ghost?.remove();
  try{drag.node?.releasePointerCapture(drag.id);}catch{}drag=null;
 }
 document.addEventListener('pointerdown',ev=>{
  const node=ev.target.closest?.('.game-cell');if(!node||ev.button!==0||skin==='game'&&screens.blocked('move'))return;
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
 document.addEventListener('pointercancel',stopDrag);
 document.addEventListener('click',ev=>{if(suppressClick&&ev.target.closest?.('.game-cell')){ev.preventDefault();ev.stopImmediatePropagation();}},{capture:true});
 document.addEventListener('keydown',ev=>{
  const node=ev.target.closest?.('.game-cell');if(!node)return;const index=Number(node.dataset.value),offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[ev.key];if(!offset)return;
  const next=index+offset;if(next<0||next>62||(Math.abs(offset)===1&&Math.floor(next/7)!==Math.floor(index/7)))return;ev.preventDefault();document.querySelector(`.game-cell[data-value="${next}"]`)?.focus();
 });
 function beforeRender(){if(ticker)window.clearInterval(ticker);ticker=null;stopDrag();screens.beforeRender();}
 function afterMount(){
  if(skin==='game')screens.afterMount();
  document.body.dataset.playFocus=String(skin==='activities'?false:Boolean(state?.focused));
  if(skin==='activities'&&state?.activityPlay&&validActivityPlay(state.activityPlay,getData().activityConfig)){
   let phase=activityView(state.activityPlay,getData().activityConfig,{now:state.wallet.time}).phase;
   ticker=window.setInterval(()=>{syncTime();const v=activityView(state.activityPlay,getData().activityConfig,{now:state.wallet.time});const clock=document.querySelector('[data-activity-clock]');if(clock)clock.textContent=v.phase==='Started'?`플레이 남은 시간 ${Math.floor(v.remainingSeconds/60)}:${String(v.remainingSeconds%60).padStart(2,'0')}`:v.phase;if(Date.now()-lastCheckpoint>=15000){persist();lastCheckpoint=Date.now();}if(v.phase!==phase){phase=v.phase;persist();render();}},1000);
  }
  for(const id of ['play-dialog','tool-dialog']){const dialog=document.getElementById(id);if(dialog&&!dialog.open){dialog.showModal();dialog.addEventListener('cancel',ev=>{ev.preventDefault();handle(id==='tool-dialog'?'cancel-tool':state.modal==='energy'?'close-energy':state.modal==='offer'?'close-offer':state.modal==='inventory'?'close-inventory':state.modal==='item-info'?'close-info':state.modal==='choice'?'close-choice':'close-shop');});}}
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
  const input=ev.target;
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
  try{const saved=compatible(await file.text());if(!saved.ok){state.storageMessage=saved.message;render();return;}backup();state=saved.state;advancePlay(state,saved.elapsedSeconds,config(),{silent:true});wallAt=Date.now();screens.imported();persist();render();}
  catch{state.storageMessage='상태 파일을 읽지 못했습니다. 기존 실험을 유지합니다.';render();}
 });
 window.addEventListener('pagehide',()=>{if(state){syncTime();persist();}});
 return {render(nextSkin='source'){skin=nextSkin;ensure();
  if(skin==='activities'){
   const ac=getData().activityConfig;if(!ac)return '<p>활동 자료를 준비하고 있습니다.</p>';
   if(state.activityPlay===undefined)state.activityPlay=createActivityPlay(ac);
   if(!validActivityPlay(state.activityPlay,ac))return '<section><h1>활동 저장을 보존했습니다</h1><p>호환되지 않는 연구 활동 상태입니다. 현재 상태 JSON을 보관한 뒤 활동만 다시 시작할 수 있습니다. 메인 보드는 유지합니다.</p><button class="button" data-play="export">현재 상태 JSON</button><button class="button" data-play="activity:reset-invalid">백업하고 활동 초기화</button></section>';
   const activity=activityView(state.activityPlay,ac,{now:state.wallet.time});
   return renderActivityPlay(state.activityPlay,ac,getData(),{now:state.wallet.time})+`<p class="game-feedback" role="status">${String(notice).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p>`;
  }
  const options=skin==='game'?screens.renderOptions():{};return skin==='game'?renderGamePlay(state,config(),getData(),{...options,notice:notice||options.notice}):renderSourcePlay(state,config(),getData());},handle,afterMount,beforeRender};
}
