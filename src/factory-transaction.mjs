import {createFactoryPlay,factoryPlan,factoryView,validFactoryPlay} from './factory-play.mjs';
import {validPlay} from './play-model.mjs';
import {reconcileOrders} from './order-model.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=message=>({ok:false,message});
export const createFactoryInputs=()=>({schema:1,mode:'research',serverEnabled:null,unlockMode:'main'});
export function validFactoryInputs(x){return object(x)&&x.schema===1&&x.mode==='research'&&(x.serverEnabled===null||typeof x.serverEnabled==='boolean')&&['main','assumed'].includes(x.unlockMode)&&Object.keys(x).every(k=>['schema','mode','serverEnabled','unlockMode'].includes(k));}
export function factoryContext(s,c,{mainMode=s.stage==='play',viewReady=s.stage==='play'}={}){const input=s.factoryInputs===undefined?createFactoryInputs():s.factoryInputs;if(!validFactoryInputs(input))return null;return {mode:'research',serverEnabled:input.serverEnabled,unlockedTypes:Object.fromEntries(c.groups.map(g=>[g.targetType,input.unlockMode==='assumed'?true:object(s.itemUnlocks)?s.itemUnlocks[g.targetType]===true:null])),board:s.board,inventory:s.inventory?.items||[],bubbles:s.bubbles||{},nextUid:s.nextUid,mainMode,viewReady};}
export function validFactoryIntegration(s,c){if(s.factoryInputs!==undefined&&!validFactoryInputs(s.factoryInputs))return false;if(s.factoryPlay===undefined)return true;if(!validFactoryPlay(s.factoryPlay,c))return false;const uids=new Set([...(s.board||[]),...(s.inventory?.items||[])].filter(Boolean).map(x=>x.uid));return !s.factoryPlay.receipts.some(r=>uids.has(r.uid))&&!s.factoryPlay.lifecycle?.replacements.some(r=>uids.has(r.uid)||r.newUid>=s.nextUid);}
function finish(draft,c,playConfig,message,plan){if(!validPlay(draft,playConfig)||!validFactoryIntegration(draft,c))return fail('공장 변경 후 전체 상태 검사가 통과하지 않아 기존 기록을 유지했습니다.');return {ok:true,state:draft,message,plan};}
export function configureFactoryTransaction(s,input,c,{playConfig,...presentation}={}){
 if(!validPlay(s,playConfig)||!validFactoryIntegration(s,c)||!validFactoryInputs(input))return fail('공장·연구 설정 저장을 보존 중입니다. JSON으로 보관한 뒤 명시적으로 초기화하세요.');
 const draft=structuredClone(s);draft.factoryInputs=structuredClone(input);if(draft.factoryPlay===undefined)draft.factoryPlay=createFactoryPlay(c);const context=factoryContext(draft,c),view=factoryView(draft.factoryPlay,context,c);draft.generatorFactoryOpen=view.state==='open'?true:view.state==='closed'?false:null;
 if(view.state==='open'&&!draft.factoryPlay.unlockedLatched){const p=factoryPlan(draft.factoryPlay,{type:'observe-open'},context,c);if(!p.ok)return p;draft.factoryPlay=p.nextState;}
 if(view.state==='unknown')return finish(draft,c,playConfig,'공장 연구 조건을 미확인으로 저장했습니다. 보상·교체를 임의 실행하지 않습니다.');
 const update=commitFactoryTransaction(draft,{type:'open-state-changed'},c,{playConfig,...presentation});if(!update.ok)return update;
 return {...update,message:'공장 연구 조건을 적용하고 실제 보드의 덮개 교체·동봉 추가 보상을 함께 반영했습니다. 해금 가정은 원작 계정 소유·서버 설정과 구분합니다.'};
}
export function commitFactoryTransaction(s,action,c,{playConfig,...presentation}){
 if(!validPlay(s,playConfig)||!validFactoryIntegration(s,c))return fail('기존 메인·공장 저장을 보존했습니다. 상태를 보관한 뒤 공장 연구만 초기화하세요.');
 const current=s.factoryPlay===undefined?createFactoryPlay(c):s.factoryPlay,context=factoryContext(s,c,presentation);if(!context)return fail('공장 연구 설정을 먼저 확인하세요.');
 const plan=factoryPlan(current,action,context,c);if(!plan.ok)return plan;if(plan.expectedSequence!==current.sequence)return fail('공장 기록 순서가 변경됐습니다. 다시 선택하세요.');
 const draft=structuredClone(s);
 for(const r of plan.replacements||[]){const old=draft.board[r.index];if(!old||old.uid!==r.uid||old.type!==r.type||old.cover!==r.cover||draft.nextUid!==r.newUid)return fail('덮개 교체 대상 또는 다음 UID가 바뀌어 전체 공장 변경을 취소했습니다.');draft.board[r.index]={uid:draft.nextUid++,type:r.type,cover:null};if(draft.generatorState)delete draft.generatorState[r.uid];}
 for(const r of plan.removals){const cells=r.source==='board'?draft.board:draft.inventory.items,cell=cells[r.index];if(!cell||cell.uid!==r.uid||cell.type!==r.type)return fail('이동할 아이템이 바뀌어 공장 보관을 취소했습니다.');if(r.source==='board'){cells[r.index]=null;if(draft.selected===r.index)draft.selected=null;}else cells.splice(r.index,1);if(draft.generatorState)delete draft.generatorState[r.uid];}
 for(const emitted of plan.emissions){if(!playConfig.items.some(i=>i.type===emitted.type)||emitted.cacheType!==2||!Number.isSafeInteger(emitted.count)||emitted.count<=0||emitted.count>100000)return fail('공장 보상 타입·수량 또는 웹 대기열 한도를 확인하세요.');const existing=draft.queue.find(q=>q.type===emitted.type&&q.cacheType===2&&q.origin===undefined);if(existing){if(existing.count+emitted.count>100000)return fail('대기열 수량 한도를 넘어 기존 공장과 대기열을 유지했습니다.');existing.count+=emitted.count;}else{if(draft.queue.length>=1000)return fail('대기열1000칸 한도에 도달해 공장 보상을 확정하지 않았습니다.');draft.queue.unshift({...emitted});}}
 for(const reward of plan.properties||[]){const key={energy:'energy',gem:'gems',gold:'coins'}[reward.type];if(!key||!Number.isSafeInteger(reward.count)||reward.count<=0||!Number.isSafeInteger(draft.wallet[key]+reward.count))return fail('상자 추가 재화 보상의 종류·수량을 확인하세요.');draft.wallet[key]+=reward.count;}
 if(plan.replacements?.length)reconcileOrders(draft,playConfig);
 draft.factoryPlay=plan.nextState;const opened=factoryView(draft.factoryPlay,factoryContext(draft,c,presentation),c).state;draft.generatorFactoryOpen=opened==='open'?true:opened==='closed'?false:null;
 return finish(draft,c,playConfig,plan.message,plan);
}
/** Original source runtime flags restart per application instance. Call
 * session-start -> late-init -> scene-loaded -> login-finished, then
 * game-mode-main on actual board entry. Unknown gates remain untouched. */
export function factoryLifecycleTransaction(s,event,c,options){const action=typeof event==='string'?{type:event}:event;return commitFactoryTransaction(s,action,c,options);}
