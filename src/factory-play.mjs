// Generator factory quantities from packaged 4.10.5 Lua. No domain mutation,
// native API, wallet, network, or invented ownership. The caller commits a plan's
// removals, queue emissions and nextState together after checking expectedSequence.
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const int=(v,max=1e9)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const dense=a=>Array.isArray(a)&&Object.keys(a).length===a.length;
const fail=(status,message,unknown=[])=>({ok:false,status,message,unknown});
const groups=c=>c.groups;
const groupFor=(c,type)=>groups(c).find(g=>g.targetType===type);
const fragmentFor=(c,type)=>groups(c).flatMap(g=>g.fragments.map(f=>({...f,targetType:g.targetType}))).find(f=>f.type===type);
const valueFor=(c,type)=>groupFor(c,type)?.targetScore??fragmentFor(c,type)?.points;
function validConfig(c){
 try{
  if(!obj(c)||c.schemaVersion!==1||typeof c.revision!=='string'||!/^[a-f0-9]{64}$/.test(c.revision)||c.serverControl!=='generator_factory'||!dense(c.groups)||c.groups.length!==6||!obj(c.limits))return false;
  if(!int(c.limits.maxCountPerType)||c.limits.maxCountPerType===0||!int(c.limits.maxScore)||c.limits.maxScore===0||!int(c.limits.maxRecords,100000)||c.limits.maxRecords===0)return false;
  const targets=['104','404','705','1006','1205','1705'],types=new Set();
  for(let i=0;i<c.groups.length;i++){
   const g=c.groups[i],n=Number(g.targetType),level=n%100;
   if(g.targetType!==targets[i]||g.chainId!==String(Math.floor(n/100))||g.targetLevel!==level||g.targetScore!==2**(level-1)||!dense(g.fragments)||g.fragments.length!==level-1)return false;
   for(let j=0;j<g.fragments.length;j++){
    const f=g.fragments[j];if(f.type!==String(n-level+j+1)||f.chainId!==g.chainId||f.level!==j+1||f.points!==2**j||types.has(f.type))return false;types.add(f.type);
   }
  }
  return true;
 }catch{return false;}
}
export function createFactoryPlay(config){
 if(!validConfig(config))throw new TypeError('Verified factory rules are required; no inferred group or score defaults.');
 return {schema:1,revision:config.revision,sequence:0,unlockedLatched:false,genData:{},receipts:[],emitted:[]};
}
// This journal is a web transaction safeguard, not the original game's save
// layout. Receipts keep an already removed UID from being collected twice and
// permit checking total input/output points without minting fragments on load.
export function validFactoryPlay(state,config){
 try{
  if(state===undefined)return true; // Optional field keeps pre-factory saves valid.
  if(!validConfig(config)||!obj(state)||state.schema!==1||state.revision!==config.revision||!int(state.sequence)||typeof state.unlockedLatched!=='boolean'||!obj(state.genData)||!dense(state.receipts)||!dense(state.emitted)||state.receipts.length>config.limits.maxRecords||state.emitted.length>config.limits.maxRecords)return false;
  if(Object.keys(state).some(k=>!['schema','revision','sequence','unlockedLatched','genData','receipts','emitted'].includes(k)))return false;
  const uids=new Set(),incoming={},outgoing={};let previous=0;
  for(const r of state.receipts){
   const f=fragmentFor(config,r?.type);
   if(!obj(r)||Object.keys(r).length!==4||!f||!int(r.uid)||r.uid===0||uids.has(r.uid)||!['board','inventory'].includes(r.source)||!int(r.sequence,state.sequence)||r.sequence<=previous)return false;
   uids.add(r.uid);previous=r.sequence;incoming[f.targetType]=(incoming[f.targetType]||0)+f.points;
  }
  previous=0;
  for(const e of state.emitted){
   const target=groupFor(config,e?.type)||groupFor(config,fragmentFor(config,e?.type)?.targetType);
   if(!obj(e)||Object.keys(e).length!==4||!target||!int(e.count,config.limits.maxCountPerType)||e.count===0||!int(e.sequence,state.sequence)||e.sequence===0||e.sequence<previous||!['reward','return-closed'].includes(e.reason)||e.reason==='reward'&&(e.type!==target.targetType||e.count!==1))return false;
   previous=e.sequence;outgoing[target.targetType]=(outgoing[target.targetType]||0)+valueFor(config,e.type)*e.count;
  }
  if(state.receipts.length>state.sequence)return false;
  for(const [type,d]of Object.entries(state.genData)){
   const g=groupFor(config,type);if(!g||!obj(d)||Object.keys(d).length!==2||!obj(d.items)||!int(d.score,config.limits.maxScore))return false;
   for(const [t,count]of Object.entries(d.items))if(!g.fragments.some(f=>f.type===t)||!int(count,config.limits.maxCountPerType))return false;
  }
  for(const g of config.groups){
   const d=state.genData[g.targetType],held=(d?.score||0)+g.fragments.reduce((n,f)=>n+(d?.items[f.type]||0)*f.points,0);
   if(!int(held,config.limits.maxScore)||!int(incoming[g.targetType]||0)||!int(outgoing[g.targetType]||0)||held+(outgoing[g.targetType]||0)!==(incoming[g.targetType]||0))return false;
  }
  return true;
 }catch{return false;}
}
function gate(state,context,config){
 if(typeof context?.serverEnabled!=='boolean')return {state:'unknown',unknown:['serverEnabled']};
 if(!context.serverEnabled)return {state:'closed',unknown:[],reason:'server-disabled'};
 if(state.unlockedLatched)return {state:'open',unknown:[],latched:true};
 const unlocks=obj(context.unlockedTypes)?context.unlockedTypes:{};
 const locked=config.groups.filter(g=>unlocks[g.targetType]===false).map(g=>g.targetType);
 if(locked.length)return {state:'closed',unknown:[],reason:'locked-types',locked};
 const unknown=config.groups.filter(g=>typeof unlocks[g.targetType]!=='boolean').map(g=>'unlockedTypes.'+g.targetType);
 return unknown.length?{state:'unknown',unknown}:{state:'open',unknown:[],latched:false};
}
export function factoryView(state,context,config){
 if(!validConfig(config)||state===undefined||!validFactoryPlay(state,config))return {valid:false,state:'invalid',unknown:[],groups:[]};
 const opened=gate(state,context,config);
 const rows=config.groups.map(g=>{
  const d=state.genData[g.targetType],score=d?.score||0,fragments=g.fragments.map(f=>({...f,count:d?.items[f.type]||0}));
  const itemScore=fragments.reduce((n,f)=>n+f.points*f.count,0);
  return {...g,fragments,score,itemScore,totalScore:score+itemScore,canMerge:score+itemScore>=g.targetScore,canReward:score>=g.targetScore,remaining:Math.max(0,g.targetScore-score),storedCount:fragments.reduce((n,f)=>n+f.count,0)};
 });
 return {valid:true,...opened,sequence:state.sequence,unlockedLatched:state.unlockedLatched,groups:rows,defaultIndex:Math.max(0,rows.findIndex(g=>g.canMerge)),canMerge:rows.some(g=>g.canMerge),canReturn:opened.state==='closed'&&Object.keys(state.genData).length>0,emitted:structuredClone(state.emitted)};
}
function storageInput(state,action,context,config){
 if(!['board','inventory'].includes(action.source)||!int(action.index,999)||!int(action.uid)||action.uid===0)return fail('invalid-input','이동할 원본 위치와 UID를 지정하세요.');
 if(!dense(context.board)||!dense(context.inventory))return fail('unknown','보드와 일반 보관함의 명시 스냅샷이 필요합니다.',['board','inventory']);
 const seen=new Set();
 for(const cell of [...context.board,...context.inventory]){
  if(cell===null)continue;
  if(!obj(cell)||!int(cell.uid)||cell.uid===0||typeof cell.type!=='string'||seen.has(cell.uid))return fail('invalid-input','보드·보관함에 잘못되거나 중복된 UID가 있습니다.');seen.add(cell.uid);
 }
 const cell=context[action.source][action.index];
 if(!cell||cell.uid!==action.uid)return fail('stale-input','선택한 위치의 아이템 UID가 바뀌었습니다.');
 const f=fragmentFor(config,cell.type);if(!f)return fail('unsupported','동봉 공장의 23개 조각 타입만 보관할 수 있습니다.');
 if(cell.cover!==null||cell.locked===true||cell.temporary===true||cell.bubble===true)return fail('blocked-item','상자·거미줄·잠금·버블·임시 상태의 조각은 직접 보관하지 않습니다.');
 if(action.source==='board'){
  if(!obj(context.bubbles))return fail('unknown','분리 저장된 보드 버블 상태를 명시하세요.',['bubbles']);
  if(context.bubbles[cell.uid])return fail('blocked-item','버블 안의 조각은 먼저 버블을 해제해야 합니다.');
 }
 if(state.receipts.some(r=>r.uid===cell.uid))return fail('duplicate-input','이미 공장으로 이동한 UID입니다. 다시 보관하지 않았습니다.');
 return {ok:true,cell,f};
}
/** Pure transaction planner. No input object is changed, including on failure.
 * Commit only when main state still has plan.expectedSequence and every
 * removal still matches {source,index,uid,type}. Recheck queue capacity first.
 * Then apply removals, emissions and nextState in one cloned/validated domain
 * transaction. Never commit nextState alone before a queue/removal can succeed.
 */
export function factoryPlan(state,action,context,config){
 if(!validConfig(config)||state===undefined||!validFactoryPlay(state,config))return fail('invalid-state','공장 규칙·저장 검사가 통과하지 않아 변경하지 않았습니다.');
 if(!obj(action)||context?.mode!=='research')return fail('research-required','명시적인 연구 모드에서만 공장 동작을 실행합니다.');
 if(!['observe-open','store','add-score','reward','return-closed'].includes(action.type))return fail('unsupported','지원하지 않는 공장 동작입니다.');
 const opened=gate(state,context,config);
 if(opened.state==='unknown')return fail('unknown','서버 플래그 또는 여섯 해금 상태가 미확인입니다.',opened.unknown);
 if(action.type==='return-closed'&&opened.state!=='closed')return fail('gate-open','원작의 일괄 반환은 공장이 닫힌 경우에만 실행합니다.');
 if(action.type!=='return-closed'&&opened.state!=='open')return fail('gate-closed','서버 설정 활성화와 여섯 생성기 타입 해금이 필요합니다.');
 if(action.type==='observe-open'&&state.unlockedLatched)return fail('already-observed','전체 해금이 이미 확인되어 캐시에 보존되어 있습니다.');
 const next=structuredClone(state),removals=[],emissions=[],events=[];
 if(opened.state==='open')next.unlockedLatched=true;
 next.sequence++;
 let message,addedScore=0;
 const emit=(type,count,reason)=>{if(count){emissions.push({type,count,cacheType:2});next.emitted.push({type,count,reason,sequence:next.sequence});}};
 if(action.type==='observe-open'){
  message='명시된 여섯 타입의 전체 해금을 확인해 IsOpen의 해금 캐시만 보존할 계획입니다. 조각과 보상을 지급하지 않습니다.';
 }else if(action.type==='store'){
  const input=storageInput(state,action,context,config);if(!input.ok)return input;
  const {cell,f}=input,d=next.genData[f.targetType]??={items:{},score:0};
  d.items[cell.type]=(d.items[cell.type]||0)+1;
  next.receipts.push({uid:cell.uid,type:cell.type,source:action.source,sequence:next.sequence});
  removals.push({source:action.source,index:action.index,uid:cell.uid,type:cell.type});
  if(action.source==='board')events.push('Add2GeneratorFactory','GeneratorFactoryTabBoardItem');else events.push('InventoryItemUpdate','InventoryItemClicked');
  message='조각 1개의 보관 계획을 만들었습니다. 원본 UID 제거와 함께 확정해야 합니다.';
 }else if(action.type==='add-score'){
  const g=groupFor(config,action.targetType),f=g?.fragments.find(f=>f.type===action.itemType),d=next.genData[action.targetType];
  if(!g||!f)return fail('invalid-input','조각과 목표 생성기가 같은 동봉 공장 그룹이어야 합니다.');
  if(!d||!d.items[f.type])return fail('insufficient','해당 조각의 보관 수량이 부족합니다.');
  d.items[f.type]--;d.score+=f.points;addedScore=f.points;message=`보관 조각 1개를 소비해 점수 +${f.points}. 생성기 지급은 별도 단계입니다.`;
 }else if(action.type==='reward'){
  const g=groupFor(config,action.targetType),d=next.genData[action.targetType];
  if(!g)return fail('invalid-input','동봉 목표 생성기 타입을 지정하세요.');
  if(!d||d.score<g.targetScore)return fail('insufficient','합산된 점수가 목표에 도달해야 생성기를 획득합니다.');
  d.score-=g.targetScore;emit(g.targetType,1,'reward');message='목표 점수 1회분을 차감하고 Type2 대기열에 생성기 1개를 지급할 계획입니다.';
 }else{
  if(!Object.keys(next.genData).length)return fail('empty','반환할 공장 보관 데이터가 없습니다.');
  // Original outer/inner traversal uses pairs: this stable web order represents
  // the verified quantities only; original queue ordering is not established.
  for(const g of config.groups){
   const d=next.genData[g.targetType];if(!d)continue;
   for(const f of g.fragments)emit(f.type,d.items[f.type]||0,'return-closed');
   let score=d.score;const complete=Math.floor(score/g.targetScore);emit(g.targetType,complete,'return-closed');score-=complete*g.targetScore;
   for(const f of [...g.fragments].reverse())if(score>=f.points){score-=f.points;emit(f.type,1,'return-closed');}
   if(score!==0)return fail('invalid-state','점수의 이진 반환 검사가 통과하지 않았습니다.');
  }
  next.genData={};message='닫힌 공장의 보관 조각과 점수 잔량을 일괄 반환할 계획입니다. 개별 인출 기능은 아닙니다.';
 }
 if(!validFactoryPlay(next,config))return fail('limit','공장 점수·수량·UID 감사장부 한도를 넘어 변경하지 않았습니다.');
 return {ok:true,status:'planned',message,expectedSequence:state.sequence,transactionId:`factory:${config.revision}:${next.sequence}`,nextState:next,removals,emissions,events,addedScore,canReward:action.targetType?Boolean(next.genData[action.targetType]?.score>=groupFor(config,action.targetType)?.targetScore):false};
}
