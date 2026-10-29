// Presentation only. The domain's title/play/home stages and rewards stay in
// play-model. This optional save field is normalized independently of old saves.
export const FLOW_SCHEMA=1;
export const SPACES=[
 {id:'garden',name:'정원 구조물',study:'scene-garden-bridge',before:'capture:scene-garden-bridge-before',after:'capture:scene-garden-bridge-after'},
 {id:'flowers',name:'실내 화분',study:'scene-indoor-planters',before:'capture:scene-indoor-planter-before',after:'capture:scene-indoor-planter-after'},
 {id:'furniture',name:'낮은 가구',study:'scene-room-furniture',before:'capture:scene-room-table-before',after:'capture:scene-room-table-after'}
];
const phases=new Set(['opening','map','board','task-story','task-building','task-reward','space-choice','space-building']);
const tasks=new Set(['task-story','task-building','task-reward']);
const validIndex=n=>Number.isSafeInteger(n)&&n>=0&&n<=5000;
export function screenFlow(s,c){
 const raw=s.screenFlow,base=s.stage==='home'?'map':'board';
 if(!raw||raw.schema!==FLOW_SCHEMA||!phases.has(raw.phase))s.screenFlow={schema:FLOW_SCHEMA,phase:base,introStep:0,space:'garden',spaceAfter:false,sound:false,task:null};
 const f=s.screenFlow;
 f.introStep=f.introStep===1?1:0;f.sound=f.sound===true;f.spaceAfter=f.spaceAfter===true;
 if(!SPACES.some(r=>r.id===f.space))f.space='garden';
 if(f.phase==='opening'&&s.stage!=='title')f.phase=base;
 if(tasks.has(f.phase)){
  const t=f.task,q=validIndex(t?.index)?c.quests[t.index]:null;
  const pending=q&&q.id===t.id&&s.pendingQuest?.id===q.id&&s.questsDone===t.index;
  const committed=q&&q.id===t.id&&s.questsDone===t.index+1&&!s.pendingQuest;
  if(s.stage!=='home'||(!pending&&!committed)){f.phase=base;f.task=null;}
  else if(committed)f.phase='task-reward';
  else if(f.phase==='task-reward')f.phase='task-story';
 }
 if(!tasks.has(f.phase)&&f.phase!=='opening'&&!f.phase.startsWith('space-'))f.phase=base;
 if(f.phase.startsWith('space-')&&s.stage!=='home')f.phase=base;
 return f;
}
export function beginOpening(s,c){const f=screenFlow(s,c);f.phase='opening';f.introStep=0;f.task=null;return f;}
export function beginTaskScene(s,c){
 const f=screenFlow(s,c),q=c.quests[s.questsDone];
 if(s.stage!=='home'||!q||s.pendingQuest?.id!==q.id)return false;
 f.task={id:q.id,index:s.questsDone};f.phase='task-story';return true;
}
export function taskForFlow(s,c){const f=screenFlow(s,c);return f.task?c.quests[f.task.index]:null;}
export function flowBlocksInput(s,c){return ['opening','task-story','task-building','task-reward','space-choice','space-building'].includes(screenFlow(s,c).phase);}
export function finishTaskScene(s,c){const f=screenFlow(s,c);if(!f.task||s.questsDone!==f.task.index+1||s.pendingQuest)return false;f.phase='task-reward';return true;}
export function leaveScene(s,c){const f=screenFlow(s,c);f.phase=s.stage==='home'?'map':'board';f.task=null;}

// Use only successful, attributable events. The published lv4 sound is never
// generalized to every merge; mixed capture audio and BGM excerpts are unused.
export function soundForAction(action,before,after,result,c){
 if(!result?.ok||action.startsWith('aid-')||['time','save','export'].includes(action))return null;
 if(action==='deliver')return 'order-deliver';
 if(action==='buy-energy')return 'shop-energy-success';
 if(action==='quest-finish')return 'reward-window';
 if(action==='collect'&&after.wallet.coins>before.coins)return 'collect-coins';
 if(action==='buy-bubble')return 'bubble-disappear';
 if(result.generatedType||action==='generate')return 'manual-generate';
 const fresh=after.board.filter(x=>x&&!before.uids.has(x.uid));
 if(['move','cell'].includes(action)&&fresh.some(x=>c.items.find(r=>r.type===x.type)?.chainLevel===4))return 'merge-level-4';
 return null;
}
